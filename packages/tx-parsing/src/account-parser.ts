import { ParsedTransactionWithMeta } from '@solana/web3.js';

/**
 * Extract all accounts from a transaction
 */
export function parseAccounts(tx: ParsedTransactionWithMeta): string[] {
  const accounts: string[] = [];

  if (tx.transaction.message.accountKeys) {
    for (const key of tx.transaction.message.accountKeys) {
      const pubkey = typeof key === 'string' ? key : key.pubkey.toBase58();
      accounts.push(pubkey);
    }
  }

  return accounts;
}

/**
 * Get account by index from transaction
 */
export function getAccountByIndex(
  tx: ParsedTransactionWithMeta,
  index: number,
): string | null {
  if (!tx.transaction.message.accountKeys || index >= tx.transaction.message.accountKeys.length) {
    return null;
  }

  const key = tx.transaction.message.accountKeys[index];
  if (!key) {
    return null;
  }
  return typeof key === 'string' ? key : key.pubkey.toBase58();
}

/**
 * Check if account is writable in the transaction
 */
export function isAccountWritable(_tx: ParsedTransactionWithMeta, _accountIndex: number): boolean {
  // Implementation depends on transaction structure
  // This is a simplified version
  return true;
}

/**
 * Check if account is a signer in the transaction
 */
export function isAccountSigner(_tx: ParsedTransactionWithMeta, accountIndex: number): boolean {
  // Implementation depends on transaction structure
  // This is a simplified version
  return accountIndex === 0; // First account is typically the signer
}
