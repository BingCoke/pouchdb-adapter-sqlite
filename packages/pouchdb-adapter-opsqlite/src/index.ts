import { logger } from './logger';
import { opsqliteFactory } from './opsqlite-adapter';
import 'pouchdb-adapter-sqlite-core';

/**
 * PouchDB OPSQLite Adapter Plugin
 * Provides functionality to interact with OPSQLite
 * @param PouchDB PouchDB constructor
 */
function OPSQLitePlugin(PouchDB: PouchDB.Static) {
  // Ensure registerSQLiteImplementation method exists
  if (typeof PouchDB.registerSQLiteImplementation !== 'function') {
    console.error(
      'PouchDB.registerSQLiteImplementation method does not exist, please ensure pouchdb-adapter-sqlite-core plugin is loaded first'
    );
    return;
  }

  // Register OPSQLite implementation
  PouchDB.registerSQLiteImplementation('opsqlite', opsqliteFactory);
  logger('OPSQLite adapter registered successfully');
}

export default OPSQLitePlugin;
