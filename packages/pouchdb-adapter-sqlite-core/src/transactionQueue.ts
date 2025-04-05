import { SQLiteDatabase, PendingTransaction } from './interfaces';
import { logger } from './logger';

/**
 * Transaction queue manager class, responsible for sequentially executing SQLite transactions
 */
export class TransactionQueue {
  private queue: PendingTransaction[] = [];
  private inProgress = false;
  private db: SQLiteDatabase;

  /**
   * Create transaction queue instance
   * @param db SQLite database connection
   */
  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  /**
   * Execute next transaction in queue
   */
  private run(): void {
    if (this.inProgress || this.queue.length === 0) {
      return;
    }

    this.inProgress = true;
    const tx = this.queue.shift();

    if (!tx) {
      this.inProgress = false;
      return;
    }

    // Use Promise instead of setTimeout for async operations
    Promise.resolve().then(async () => {
      const txType = tx.readonly ? 'read-only' : 'write';
      logger.debug(`---> ${txType} transaction started!`);

      try {
        // Begin transaction
        await this.db.beginTransaction();
        await tx.start(this.db);
        await this.db.commitTransaction();

        // Transaction completed successfully
        tx.finish();
      } catch (error) {
        // If error occurs, rollback transaction
        try {
          await this.db.rollbackTransaction();
        } catch (rollbackError) {
          logger.error('Failed to rollback transaction:', rollbackError);
        }

        // Pass error to transaction's finish callback
        tx.finish(error instanceof Error ? error : new Error(String(error)));
      } finally {
        logger.debug(`<--- Transaction completed! Remaining in queue: ${this.queue.length}`);
        this.inProgress = false;

        // Process next transaction in queue
        if (this.queue.length > 0) {
          this.run();
        }
      }
    });
  }

  /**
   * Add write transaction to queue
   * @param fn Transaction function
   * @returns Promise that resolves when transaction completes
   */
  async push(fn: (db: SQLiteDatabase) => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push({
        readonly: false,
        start: fn,
        finish: (error?: Error) => (error ? reject(error) : resolve()),
      });
      this.run();
    });
  }

  /**
   * Add read-only transaction to queue
   * @param fn Transaction function
   * @returns Promise that resolves when transaction completes
   */
  async pushReadOnly(fn: (db: SQLiteDatabase) => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push({
        readonly: true,
        start: fn,
        finish: (error?: Error) => (error ? reject(error) : resolve()),
      });
      this.run();
    });
  }
}
