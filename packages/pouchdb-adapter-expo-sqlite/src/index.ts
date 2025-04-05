import { expoSQLiteFactory } from './expo-sqlite-adapter';
import 'pouchdb-adapter-sqlite-core';
import { logger } from './logger';

/**
 * PouchDB OPSQLite Adapter Plugin
 * Provides functionality to interact with OPSQLite
 * @param PouchDB PouchDB constructor
 */
function OPSQLitePlugin(PouchDB: PouchDB.Static) {
  // Ensure registerSQLiteImplementation method exists
  // @ts-ignore
  if (typeof PouchDB.registerSQLiteImplementation !== 'function') {
    console.error(
      'PouchDB.registerSQLiteImplementation method does not exist, please ensure pouchdb-adapter-sqlite-core plugin is loaded first'
    );
    return;
  }

  // Register OPSQLite implementation
  // @ts-ignore
  PouchDB.registerSQLiteImplementation('expo-sqlite', expoSQLiteFactory);
  logger('expo-sqlite adapter injected');
}

export default OPSQLitePlugin;
