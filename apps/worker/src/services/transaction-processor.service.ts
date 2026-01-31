import type { Logger } from 'pino';
import type { ClickHouseClient } from '@clickhouse/client';
import type { Connection, VersionedTransactionResponse, ParsedTransactionWithMeta } from '@solana/web3.js';
import { type TxIngestMessage } from '@incur-data/dtos';
import { type MessageMetadata } from '@incur-data/rabbitmq';
import { type TransactionInsert } from '@incur-data/olap-types';
import {
  createDlnEventParser,
  DlnEventType,
  extractOrderIdFromLogs,
  type ParsedDlnEvent,
} from '@incur-data/tx-parsing';
import { JupiterPriceService } from './jupiter-price.service.js';
import { RedisService } from './redis.service.js';
import { formatBlockTime } from '../utils/date.js';
import { getEventTypeString } from '../utils/dln.js';

/**
 * Transaction Processor
 * Processes Solana transactions and stores them in ClickHouse using async inserts
 */
export class TransactionProcessor {
  /** Cache of DLN event parsers by programId */
  private readonly parserCache = new Map<string, ReturnType<typeof createDlnEventParser>>();

  constructor(
    private clickhouse: ClickHouseClient,
    private solanaConnection: Connection,
    private jupiterPriceService: JupiterPriceService,
    private redisService: RedisService,
    private logger: Logger
  ) {}

  /**
   * Get or create DLN event parser for a programId
   */
  private getParser(programId: string): ReturnType<typeof createDlnEventParser> {
    let parser = this.parserCache.get(programId);
    if (!parser) {
      this.logger.info({ programId }, 'Creating DLN event parser');
      parser = createDlnEventParser(programId);
      this.parserCache.set(programId, parser);
    }
    return parser;
  }

  /**
   * Insert transactions to ClickHouse using async inserts
   * ClickHouse batches inserts automatically on the server side
   */
  private async insertTransactions(rows: TransactionInsert[], programId: string): Promise<void> {
    await this.clickhouse.insert({
      table: 'dln.transactions',
      values: rows,
      format: 'JSONEachRow',
      clickhouse_settings: {
        async_insert: 1,
        wait_for_async_insert: 1,
      },
    });

    await this.redisService.incrementProcessedCounter(programId, rows.length);
  }

  /**
   * Fetch transaction from Solana
   */
  private async fetchTransaction(
    signature: string
  ): Promise<VersionedTransactionResponse | null> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const tx = await this.solanaConnection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });

        if (tx) {
          return tx;
        }

        // Transaction not found, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          { signature, retry, error: (error as Error).message },
          'Error fetching transaction, retrying...'
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
      }
    }

    throw lastError || new Error('Transaction not found');
  }

  /**
   * Collect all token transfers including SOL
   */
  private collectAllTransfers(
    txResponse: VersionedTransactionResponse
  ): Array<{ mint: string; amount: number }> {
    const meta = txResponse.meta;
    if (!meta) {
      return [];
    }

    const tokenTransfers = this.collectTokenTransfers(meta);
    const solTransfer = this.collectSolTransfer(meta);
    
    if (solTransfer) {
      return [...tokenTransfers, solTransfer];
    }

    return tokenTransfers;
  }

  /**
   * Collect SPL token transfers from transaction metadata
   */
  private collectTokenTransfers(
    meta: VersionedTransactionResponse['meta']
  ): Array<{ mint: string; amount: number }> {
    const pre = meta?.preTokenBalances || [];
    const post = meta?.postTokenBalances || [];

    const preByIndex = new Map<number, typeof pre[number]>();
    for (const balance of pre) {
      preByIndex.set(balance.accountIndex, balance);
    }

    const transfers = new Map<string, number>();

    for (const postBalance of post) {
      const preBalance = preByIndex.get(postBalance.accountIndex);
      const mint = postBalance.mint;
      const decimals =
        postBalance.uiTokenAmount.decimals ??
        preBalance?.uiTokenAmount.decimals ??
        0;
      const postAmount = BigInt(postBalance.uiTokenAmount.amount || '0');
      const preAmount = BigInt(preBalance?.uiTokenAmount.amount || '0');
      const delta = postAmount - preAmount;

      if (delta > 0n) {
        const amount = Number(delta) / Math.pow(10, Number(decimals));
        const existing = transfers.get(mint) || 0;
        transfers.set(mint, existing + amount);
      }
    }

    return [...transfers.entries()].map(([mint, amount]) => ({ mint, amount }));
  }

  /**
   * Collect SOL transfer from transaction metadata
   */
  private collectSolTransfer(
    meta: VersionedTransactionResponse['meta']
  ): { mint: string; amount: number } | null {
    if (!meta) {
      return null;
    }

    const pre = meta.preBalances || [];
    const post = meta.postBalances || [];
    
    if (pre.length === 0 || post.length === 0) {
      return null;
    }

    let maxPositiveLamports = 0;
    for (let i = 0; i < Math.min(pre.length, post.length); i += 1) {
      const postBalance = post[i];
      const preBalance = pre[i];
      if (postBalance !== undefined && preBalance !== undefined) {
        const delta = postBalance - preBalance;
        if (delta > maxPositiveLamports) {
          maxPositiveLamports = delta;
        }
      }
    }

    if (maxPositiveLamports === 0) {
      return null;
    }

    const LAMPORTS_PER_SOL = 1_000_000_000;
    const solAmount = maxPositiveLamports / LAMPORTS_PER_SOL;
    
    return {
      mint: 'So11111111111111111111111111111111111111112',
      amount: solAmount,
    };
  }

  /**
   * Extract detailed token transfers with accounts
   */
  private extractTokenTransfers(
    txResponse: VersionedTransactionResponse
  ): Array<{
    account: string;
    tokenAddress: string;
    amount: string;
    instructionType: string;
  }> {
    const transfers: Array<{
      account: string;
      tokenAddress: string;
      amount: string;
      instructionType: string;
    }> = [];

    // Parse token balances from meta
    const preBalances = txResponse.meta?.preTokenBalances || [];
    const postBalances = txResponse.meta?.postTokenBalances || [];

    // Find balances that changed
    for (const postBalance of postBalances) {
      const preBalance = preBalances.find(
        (pb) => pb.accountIndex === postBalance.accountIndex
      );

      const preAmount = preBalance?.uiTokenAmount?.amount || '0';
      const postAmount = postBalance.uiTokenAmount?.amount || '0';
      
      if (preAmount !== postAmount) {
        const diff = BigInt(postAmount) - BigInt(preAmount);
        if (diff !== 0n) {
          transfers.push({
            account: postBalance.owner || '',
            tokenAddress: postBalance.mint || '',
            amount: diff.toString(),
            instructionType: diff > 0n ? 'receive' : 'send',
          });
        }
      }
    }

    return transfers;
  }

  /**
   * Determine if error is retryable (transient) or permanent
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Transient errors - retry
    if (
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('502')
    ) {
      return true;
    }

    // Permanent errors - skip (no retry)
    if (
      message.includes('transaction not found') ||
      message.includes('invalid signature') ||
      message.includes('validation error') ||
      message.includes('parse error')
    ) {
      return false;
    }

    return true; // Default: retry (safer)
  }

  /**
   * Process a single transaction
   */
  async processTransaction(
    message: TxIngestMessage,
    metadata: MessageMetadata
  ): Promise<boolean> {
    const { signature, slot, blockTime, programId, source } = message;
    const txLogger = this.logger.child({ blockTime, programId, source });

    try {
      txLogger.info({ slot, source, attempt: metadata.attempt }, 'Received transaction from queue');

      // Fetch transaction
      const txResponse = await this.fetchTransaction(signature);
      if (!txResponse) {
        txLogger.warn('Transaction not found');
        return metadata.attempt >= 3; // Give up after 3 attempts
      }

      // Parse DLN events (and extract orderId from logs) using @incur-data/tx-parsing
      let dlnEvents: ParsedDlnEvent[] = [];
      let parsedTx: ParsedTransactionWithMeta | null = null;
      try {
        parsedTx = await this.solanaConnection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });

        if (parsedTx) {
          // Get parser for this programId (cached)
          const allEvents = this.getParser(programId).parseTransaction(signature, parsedTx);
          dlnEvents = allEvents.filter(
            (event: ParsedDlnEvent) =>
              event.eventType === DlnEventType.OrderCreated ||
              event.eventType === DlnEventType.OrderFulfilled
          );
        } else {
          txLogger.debug('Parsed transaction not found, skipping DLN parsing');
        }
      } catch (error) {
        txLogger.warn(
          { error: (error as Error).message },
          'Failed to parse transaction with DLN event parser'
        );
      }

      // Filter out transactions that are not DLN events of supported DlnEventType
      if (dlnEvents.length === 0) {
        const logMessages = parsedTx?.meta?.logMessages ?? [];
        const orderIdFromLogs = logMessages.length > 0
          ? extractOrderIdFromLogs(logMessages)
          : null;

        txLogger.info(
          {
            slot,
            source,
            programId,
            hasParsedTx: !!parsedTx,
            logMessagesSample: logMessages.slice(0, 20),
            orderIdFromLogs,
            dlnEventsCount: dlnEvents.length,
          },
          'Transaction is not a supported DLN event, skipping (will NOT be saved)'
        );
        return true;
      }

      txLogger.debug(
        { dlnEventsCount: dlnEvents.length, eventTypes: dlnEvents.map(e => e.eventType) },
        'Found DLN events, proceeding with transaction processing'
      );

      const orderId = dlnEvents[0]?.orderId ?? '';
      txLogger.debug({ orderId }, 'Extracted orderId from DLN events');

      // Determine event type from DLN events
      const eventType = dlnEvents[0]?.eventType ?? DlnEventType.Unknown;
      const eventTypeString = getEventTypeString(eventType);

      txLogger.debug({ eventType: eventTypeString }, 'Determined event type');

      // Extract basic transaction info
      const success = !txResponse.meta?.err;
      const status = success ? 'success' : 'failed';

      const blockTimeFormatted = formatBlockTime(blockTime);

      // Step 1: Collect all token mints from the transaction
      const allTransfers = this.collectAllTransfers(txResponse);
      const tokenMints = allTransfers.map(t => t.mint);

      // Extract detailed transfers with accounts
      const transfers = this.extractTokenTransfers(txResponse);

      // Build rows with USD amounts
      const rows = await this.jupiterPriceService.buildTransactionRows(
        {
          signature,
          slot,
          blockTimeFormatted,
          programId,
          status,
          eventType: eventTypeString,
          orderId,
        },
        transfers,
        tokenMints
      );

      // Insert to ClickHouse (async inserts - server-side batching)
      await this.insertTransactions(rows, programId);

      return true;
    } catch (error) {
      const isRetryable = this.isRetryableError(error as Error);

      txLogger.error(
        {
          error: (error as Error).message,
          stack: (error as Error).stack,
          retryable: isRetryable,
          attempt: metadata.attempt
        },
        isRetryable
          ? 'Failed to process transaction (will retry)'
          : 'Failed to process transaction (permanent error, skipping)'
      );

      if (!isRetryable) {
        txLogger.warn('Permanent error detected, acknowledging without retry');
        return true; // ACK - don't retry
      }

      return false; // Retry
    }
  }

  /**
   * Shutdown - nothing to flush with async inserts
   */
  async shutdown(): Promise<void> {
    this.logger.info('TransactionProcessor shutdown');
  }
}
