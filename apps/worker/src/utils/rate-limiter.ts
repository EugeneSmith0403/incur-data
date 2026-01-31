/**
 * Rate Limiter Utility
 * Ensures minimum delay between sequential operations
 */

/**
 * Rate Limiter class to enforce minimum delay between operations
 */
export class RateLimiter {
  private lastExecutionTime: number = 0;
  private readonly minDelayMs: number;
  private queue: Array<() => void> = [];
  private isProcessing: boolean = false;

  constructor(minDelayMs: number) {
    this.minDelayMs = minDelayMs;
  }

  /**
   * Execute a function with rate limiting
   * Ensures minimum delay between executions
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const timeSinceLastExecution = now - this.lastExecutionTime;
          
          // If not enough time has passed, wait
          if (timeSinceLastExecution < this.minDelayMs) {
            const delayNeeded = this.minDelayMs - timeSinceLastExecution;
            await this.sleep(delayNeeded);
          }

          // Execute the function
          this.lastExecutionTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          // Process next item in queue
          this.processNext();
        }
      });

      // Start processing if not already processing
      if (!this.isProcessing) {
        this.processNext();
      }
    });
  }

  /**
   * Process next item in queue
   */
  private processNext(): void {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const nextFn = this.queue.shift();
    if (nextFn) {
      nextFn();
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.lastExecutionTime = 0;
    this.queue = [];
    this.isProcessing = false;
  }
}
