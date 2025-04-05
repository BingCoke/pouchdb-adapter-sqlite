import { OpenDatabaseResult, SQLiteImplementationFactory } from './interfaces';
import { logger } from './logger';
import { TransactionQueue } from './transactionQueue';

// Stores registered SQLite implementation factories
const implementationFactories = new Map<string, SQLiteImplementationFactory>();

// Caches opened database connections
const cachedDatabases = new Map<string, OpenDatabaseResult>();

/**
 * Register SQLite implementation factory
 * @param name Implementation name
 * @param factory Implementation factory
 */
export function registerSQLiteImplementation(
  name: string,
  factory: SQLiteImplementationFactory
): void {
  implementationFactories.set(name, factory);
  logger.debug(`Registered SQLite implementation: ${name}`);
}

/**
 * Get SQLite implementation factory
 * @param name Implementation name
 * @returns SQLite implementation factory
 * @throws If the specified implementation is not found
 */
export function getSQLiteImplementation(name: string): SQLiteImplementationFactory {
  const factory = implementationFactories.get(name);
  if (!factory) {
    throw new Error(`SQLite implementation not found: ${name}`);
  }
  return factory;
}

/**
 * Open database
 * @param options Database open options
 * @returns Database open result
 */
export async function openDatabase(options: any): Promise<OpenDatabaseResult> {
  const cacheKey = options.name;

  // Check if this database connection is already cached
  const cachedResult = cachedDatabases.get(cacheKey);
  if (cachedResult) {
    logger.debug(`Using cached database connection: ${options.name}`);
    return cachedResult;
  }

  // Determine which SQLite implementation to use
  const implementationName = options.sqliteImplementation || 'default';

  try {
    // Get SQLite implementation factory
    const factory = getSQLiteImplementation(implementationName);

    // Use factory to open database
    logger.debug(`Opening database: ${options.name} (using ${implementationName} implementation)`);
    const result = await factory.openDatabase(options);
    if ('db' in result) {
      if (!result.transactionQueue) result.transactionQueue = new TransactionQueue(result.db);
    }

    const r = result as OpenDatabaseResult;

    // @ts-ignore
    // Cache the result
    cachedDatabases.set(cacheKey, r);

    return r;
  } catch (error) {
    logger.error(`Failed to open database: ${options.name}`, error);
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Close database
 * @param name Database name
 */
export async function closeDatabase(name: string): Promise<void> {
  const cachedResult = cachedDatabases.get(name);
  if (!cachedResult) {
    logger.debug(`Database not open, no need to close: ${name}`);
    return;
  }

  if ('error' in cachedResult) {
    logger.debug(`Database connection has error, remove from cache directly: ${name}`);
    cachedDatabases.delete(name);
    return;
  }

  try {
    // Determine SQLite implementation to use
    // Assume all implementations use same cache key format
    for (const [implName, factory] of implementationFactories.entries()) {
      try {
        logger.debug(`Attempt to close database using ${implName} implementation: ${name}`);
        await factory.closeDatabase(name);
        logger.debug(`Successfully closed database: ${name}`);
        break;
      } catch (error) {
        // Try next implementation
        logger.debug(`Failed to close database using ${implName} implementation, try next one`);
      }
    }
  } finally {
    // Remove from cache regardless of success
    cachedDatabases.delete(name);
  }
}

/**
 * Get default SQLite implementation name
 * @returns Default implementation name
 */
export function getDefaultImplementation(): string {
  // If there's only one implementation, return it
  if (implementationFactories.size === 1) {
    return Array.from(implementationFactories.keys())[0];
  }

  // Otherwise return 'default' if it exists
  return implementationFactories.has('default')
    ? 'default'
    : Array.from(implementationFactories.keys())[0];
}

export default openDatabase;
