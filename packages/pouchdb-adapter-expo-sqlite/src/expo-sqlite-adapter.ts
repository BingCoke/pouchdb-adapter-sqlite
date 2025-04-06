import * as SQLite from 'expo-sqlite';
import {
  SQLiteQueryResult,
  SQLiteExecuteResult,
  UserOpenDatabaseResult,
  SQLiteAdapter,
} from 'pouchdb-adapter-sqlite-core/interface';
import { logger } from './logger';
import { createBlob, serializer, btoa } from './binaryProcess';

/**
 * Expo SQLite Adapter Class
 * Implements SQLiteDatabase interface, converts Expo SQLite API to generic interface
 */
export class ExpoSQLiteAdapter implements SQLiteAdapter {
  private db: SQLite.SQLiteDatabase;

  /**
   * Create Expo SQLite adapter instance
   * @param db Expo SQLite database instance
   */
  constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
  }

  /**
   * Execute SQL query and return result set
   * @param sql SQL query statement
   * @param params Query parameters
   * @returns Query result
   */
  async query(sql: string, params: any[] = []): Promise<SQLiteQueryResult> {
    logger('query sql: %o params %o', sql, params);
    const resutlSet = await this.db.getAllAsync(sql);

    return {
      values: resutlSet || [],
    };
  }

  /**
   * Execute SQL statement, typically for INSERT, UPDATE, DELETE operations
   * @param sql SQL statement
   * @param params Statement parameters
   * @returns Execution result
   */
  async run(sql: string, params: any[] = []): Promise<SQLiteExecuteResult> {
    logger('run sql: %o params', sql);
    const resultSet = await this.db.runAsync(sql, params);
    logger('run sql: %o success!', sql);
    return {
      changes: {
        changes: resultSet.changes,
        lastId: resultSet.lastInsertRowId,
      },
    };
  }

  /**
   * Execute SQL statement, typically for CREATE TABLE, CREATE INDEX DDL operations
   * @param sql SQL statement
   * @returns Execution result
   */
  async execute(sql: string): Promise<void> {
    logger('execute sql: %o params', sql);
    return this.db.execAsync(sql);
  }

  /**
   * Begin transaction
   */
  async beginTransaction(): Promise<void> {
    try {
      logger('begin transaction');
      await this.execute('BEGIN TRANSACTION');
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
      await this.execute('COMMIT');
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
      await this.execute('ROLLBACK');
    } catch (err) {
      console.error('Failed to rollback transaction', err);
      throw err;
    }
  }
  serializer = serializer;
  createBlob = createBlob;
  btoa = btoa;
}

/**
 * Expo SQLite Implementation Factory
 * Used to create Expo SQLite adapter instances
 */
export const expoSQLiteFactory = {
  db: null as null | SQLite.SQLiteDatabase,
  /**
   * Open database
   * @param options Database opening options
   * @returns Database opening result
   */
  async openDatabase(options: any): Promise<UserOpenDatabaseResult> {
    try {
      logger('open database %o', options);

      // Ensure database name has correct format
      const dbName = options.name.endsWith('.db') ? options.name : `${options.name}.db`;

      // Open database
      const db = await SQLite.openDatabaseAsync(dbName);
      this.db = db;
      logger('open database success %o', db);

      // Create adapter
      const adapter = new ExpoSQLiteAdapter(db);

      // Return adapter instance, TransactionQueue will be created by core library
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
    logger('close database');
    await this.db?.closeAsync();
  },
};
