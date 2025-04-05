/**
 * SQLite query result interface
 */
export interface SQLiteQueryResult {
  /**
   * Rows returned by query
   */
  values?: any[];
}

/**
 * SQLite execute result interface
 */
export interface SQLiteExecuteResult {
  /**
   * Number of affected rows
   */
  changes?: {
    changes?: number;
    lastId?: number;
  };
}

/**
 * Abstract SQLite database connection interface
 * Defines basic methods for interacting with SQLite database
 */
export interface SQLiteDatabase {
  /**
   * Execute SQL query and return result set
   * @param sql SQL query statement
   * @param params Query parameters
   * @returns Query result
   */
  query(sql: string, params?: any[]): Promise<SQLiteQueryResult>;

  /**
   * Execute SQL statement, typically for INSERT/UPDATE/DELETE operations
   * @param sql SQL statement
   * @param params Statement parameters
   * @returns Execution result
   */
  run(sql: string, params?: any[]): Promise<SQLiteExecuteResult>;

  /**
   * Execute SQL statement, typically for DDL operations like CREATE TABLE/INDEX
   * @param sql SQL statement
   * @returns Execution result
   */
  execute(sql: string): Promise<void>;

  /**
   * Begin transaction
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit transaction
   */
  commitTransaction(): Promise<void>;

  /**
   * Rollback transaction
   */
  rollbackTransaction(): Promise<void>;
}

/**
 * Pending transaction interface in transaction queue
 */
export interface PendingTransaction {
  /**
   * Whether transaction is read-only
   */
  readonly: boolean;

  /**
   * Callback when transaction starts executing
   * @param db SQLite database connection
   */
  start: (db: SQLiteDatabase) => Promise<void>;

  /**
   * Callback when transaction completes
   * @param error Contains error if transaction fails
   */
  finish: (error?: Error) => void;
}

/**
 * Transaction queue interface
 * Manages and sequentially executes SQLite transactions
 */
export interface TransactionQueue {
  /**
   * Add write transaction to queue
   * @param fn Transaction function
   * @returns Promise that resolves when transaction completes
   */
  push(fn: (db: SQLiteDatabase) => Promise<void>): Promise<void>;

  /**
   * Add read-only transaction to queue
   * @param fn Transaction function
   * @returns Promise that resolves when transaction completes
   */
  pushReadOnly(fn: (db: SQLiteDatabase) => Promise<void>): Promise<void>;
}

export interface BinarySerializer {
  serialize(data: any): any;
  deserialize(data: any): any;
}
export interface OpenConfig {
  adapter: 'sqlite';
  sqliteImplementation?: string;
  btoa?: (data: any) => any;
  createBlob?: (binary: any, type: any) => any;
  serializer?: BinarySerializer;
}
/**
 * Database open options interface
 */
export interface OpenDatabaseOptions extends OpenConfig {
  /**
   * Database name
   */
  name: string;

  /**
   * SQLite implementation type, e.g. 'capacitor', 'react-native'
   */
  sqliteImplementation?: string;

  /**
   * Database location
   */
  location?: string;

  /**
   * iOS database location
   */
  iosDatabaseLocation?: string;

  /**
   * Android database location
   */
  androidDatabaseLocation?: string;

  /**
   * Whether to open in read-only mode
   */
  readonly?: boolean;

  /**
   * Whether encrypted
   */
  encrypted?: boolean;

  /**
   * Encryption mode
   */
  mode?: string;

  /**
   * Database version
   */
  version?: number;
}

export type UserOpenDatabaseResult =
  | {
      db: SQLiteDatabase;
      transactionQueue?: TransactionQueue;
    }
  | {
      error: Error;
    };
/**
 * Database open result interface
 */
export type OpenDatabaseResult =
  | {
      db: SQLiteDatabase;
      transactionQueue: TransactionQueue;
    }
  | {
      error: Error;
    };

/**
 * SQLite implementation factory interface
 * Creates instances of specific SQLite implementations
 */
export interface SQLiteImplementationFactory {
  /**
   * Open database
   * @param options Database open options
   * @returns Database open result
   */
  openDatabase(options: OpenDatabaseOptions): Promise<UserOpenDatabaseResult>;

  /**
   * Close database
   * @param name Database name
   */
  closeDatabase(name: string): Promise<void>;
}
