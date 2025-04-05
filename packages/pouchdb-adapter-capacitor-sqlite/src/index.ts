import { capacitorSQLiteFactory } from './capacitor-adapter';
import 'pouchdb-adapter-sqlite-core';

/**
 * PouchDB Capacitor SQLite Adapter Plugin
 * Provides functionality to interact with Capacitor SQLite
 * @param PouchDB PouchDB constructor
 */
function CapacitorSQLitePlugin(PouchDB: PouchDB.Static) {
  // Check if registerSQLiteImplementation method exists
  if (typeof PouchDB.registerSQLiteImplementation !== 'function') {
    throw new Error(
      'PouchDB.registerSQLiteImplementation not found, make sure to load pouchdb-adapter-sqlite-core plugin first'
    );
  }
  // Register Capacitor SQLite implementation
  PouchDB.registerSQLiteImplementation('capicator', capacitorSQLiteFactory);
}

export default CapacitorSQLitePlugin;
