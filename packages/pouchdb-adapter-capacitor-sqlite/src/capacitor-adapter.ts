import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import {
  SQLiteQueryResult,
  SQLiteExecuteResult,
  UserOpenDatabaseResult,
  SQLiteAdapter,
} from 'pouchdb-adapter-sqlite-core/interface';
import { escapeSerializer } from 'pouchdb-adapter-sqlite-core';
import { logger } from './logger';

/**
 * Capacitor SQLite Adapter class
 * Implements SQLiteDatabase interface, converts Capacitor SQLite API to generic interface
 */
export class CapacitorSQLiteAdapter implements SQLiteAdapter {
  private connection: SQLiteDBConnection;

  /**
   * Create Capacitor SQLite Adapter instance
   * @param connection Capacitor SQLite database connection
   */
  constructor(connection: SQLiteDBConnection) {
    this.connection = connection;
  }

  /**
   * Execute SQL query and return result set
   * @param sql SQL query statement
   * @param params Query parameters
   * @returns Query result
   */
  async query(sql: string, params: any[] = []): Promise<SQLiteQueryResult> {
    const result = await this.connection.query(sql, params);
    logger('query sql: %o params', sql, params);
    return {
      values: result.values || [],
    };
  }

  /**
   * Execute SQL statement, typically for INSERT/UPDATE/DELETE operations
   * @param sql SQL statement
   * @param params Statement parameters
   * @returns Execution result
   */
  async run(sql: string, params: any[] = []): Promise<SQLiteExecuteResult> {
    const result = await this.connection.run(sql, params, false);
    logger('run sql: %o params', sql, params);
    return {
      changes: {
        changes: result.changes?.changes,
        lastId: result.changes?.lastId,
      },
    };
  }

  /**
   * Execute SQL statement, typically for DDL operations like CREATE TABLE/INDEX
   * @param sql SQL statement
   * @returns Execution result
   */
  async execute(sql: string): Promise<void> {
    await this.connection.execute(sql, false);
    logger('execute sql: %o params', sql);
  }

  /**
   * Begin transaction
   */
  async beginTransaction(): Promise<void> {
    logger('begin transaction');
    await this.connection.beginTransaction();
  }

  /**
   * Commit transaction
   */
  async commitTransaction(): Promise<void> {
    logger('commit transaction');
    await this.connection.commitTransaction();
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(): Promise<void> {
    logger('rollback transaction');
    await this.connection.rollbackTransaction();
  }
  serializer = escapeSerializer;
}

/**
 * Capacitor SQLite factory implementation
 * Used to create Capacitor SQLite Adapter instances
 */
export const capacitorSQLiteFactory = {
  /**
   * Open database
   * @param options Database open options
   * @returns Database open result
   */
  async openDatabase(options: any): Promise<UserOpenDatabaseResult> {
    try {
      // Create SQLite connection
      const sqlite = new SQLiteConnection(CapacitorSQLite);

      await sqlite.checkConnectionsConsistency();

      // Create connection
      const dbName = options.name.endsWith('.db') ? options.name : `${options.name}.db`;

      // Check if database exists, create if not
      const isconn = await sqlite.isConnection(dbName, false);
      let connection: SQLiteDBConnection;

      if (!isconn.result) {
        connection = await sqlite.createConnection(
          dbName,
          options.encrypted || false,
          options.mode || 'no-encryption',
          options.version || 1,
          options.readonly || false
        );
      } else {
        connection = await sqlite.retrieveConnection(dbName, options.encrypted || false);
      }

      // Ensure database is open
      await connection.open();

      // Create adapter
      const adapter = new CapacitorSQLiteAdapter(connection);
      logger('open database: %o', adapter);

      // Return adapter instance, TransactionQueue will be created by core library
      return { db: adapter };
    } catch (err: any) {
      return { error: err };
    }
  },

  /**
   * Close database
   * @param name Database name
   */
  async closeDatabase(name: string): Promise<void> {
    const sqliteConnection = new SQLiteConnection(CapacitorSQLite);
    const dbName = name.endsWith('.db') ? name : `${name}.db`;
    await sqliteConnection.closeConnection(dbName, false);
  },
};
