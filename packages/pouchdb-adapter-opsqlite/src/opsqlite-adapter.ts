import type {
  SQLiteDatabase,
  SQLiteQueryResult,
  SQLiteExecuteResult,
} from 'pouchdb-adapter-sqlite-core/interface';
import { DB, open } from '@op-engineering/op-sqlite';
import { logger } from './logger';

/**
 * OPSQLite adapter class
 * Implements SQLiteDatabase interface, converts OPSQLite API to generic interface
 */
export class OPSQLiteAdapter implements SQLiteDatabase {
  private db: DB;

  /**
   * Create OPSQLite adapter instance
   * @param db OPSQLite database instance
   */
  constructor(db: DB) {
    this.db = db;
  }

  /**
   * Execute SQL query and return result set
   * @param sql SQL query statement
   * @param params Query parameters
   * @returns Query result
   */
  async query(sql: string, params: any[] = []): Promise<SQLiteQueryResult> {
    const result = await this.db.execute(sql, params);

    const values = result.rows ? [...result.rows] : [];
    const res = {
      values: values,
    };

    logger('query sql: %o params %o', sql, params);

    return res;
  }

  /**
   * Execute SQL statement, typically for INSERT, UPDATE, DELETE operations
   * @param sql SQL statement
   * @param params Statement parameters
   * @returns Execution result
   */
  async run(sql: string, params: any[] = []): Promise<SQLiteExecuteResult> {
    const result = await this.db.execute(sql, params);
    const res = {
      changes: {
        changes: result.rowsAffected || 0,
        lastId: result.insertId || 0,
      },
    };
    logger('run sql: %o params', sql, params);
    return res;
  }

  /**
   * Execute SQL statement, typically for CREATE TABLE, CREATE INDEX DDL operations
   * @param sql SQL statement
   * @returns Execution result
   */
  async execute(sql: string): Promise<void> {
    const exe = await this.db.execute(sql);
    logger('execute sql: %o params', sql);
  }

  /**
   * Begin transaction
   */
  async beginTransaction(): Promise<void> {
    try {
      logger('begin transaction');
      await this.db.execute('BEGIN TRANSACTION');
    } catch (err) {
      console.error('Failed to begin transaction', err);
      throw err;
    }
  }

  /**
   * Commit transaction
   */
  async commitTransaction(): Promise<void> {
    try {
      logger('commit transaction');
      await this.db.execute('COMMIT');
    } catch (err) {
      console.error('Failed to commit transaction', err);
      throw err;
    }
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(): Promise<void> {
    try {
      logger('rollback transaction');
      await this.db.execute('ROLLBACK');
    } catch (err) {
      console.error('Failed to rollback transaction', err);
      throw err;
    }
  }
}

/**
 * OPSQLite implementation factory
 * Used to create OPSQLite adapter instances
 */
export const opsqliteFactory = {
  db: null as null | DB,
  /**
   * Open database
   * @param options Database opening options
   * @returns Database opening result
   */
  async openDatabase(options: any): Promise<any> {
    try {
      logger('Opening database:', options);

      // Ensure database name has correct format
      const dbName = options.name.endsWith('.db') ? options.name : `${options.name}.db`;

      // Open database
      const db = open({
        name: dbName,
        location: options.location || 'default',
      });
      this.db = db;

      // Create adapter
      const adapter = new OPSQLiteAdapter(db);
      logger('Created OPSQLite adapter instance', adapter);

      return { db: adapter };
    } catch (err: any) {
      console.error('Failed to open database:', err);
      return { error: err };
    }
  },

  /**
   * Close database
   * @param name Database name
   */
  async closeDatabase(name: string): Promise<void> {
    if (this.db) {
      this.db.close();
      logger('close databse success');
      this.db = null;
    }
  },
};
