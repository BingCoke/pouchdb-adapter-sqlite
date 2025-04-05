import SqlPouch from './core';
import { registerSQLiteImplementation } from './openDatabase';
import { SQLiteImplementationFactory, OpenConfig } from './interfaces';
export * from './utils';

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace PouchDB {
    namespace Core {}

    interface Static {
      new <Content extends {}>(name: string | null, options: OpenConfig): Database<Content>;
      registerSQLiteImplementation: (name: string, factory: SQLiteImplementationFactory) => void;
    }
  }
}

function SQLitePouch(opts: any, callback: (err: any) => void) {
  try {
    // @ts-ignore
    SqlPouch.call(this, opts, callback);
  } catch (err) {
    callback(err);
  }
}
/**
 * PouchDB SQLite Adapter
 * Provides functionality to interact with SQLite databases
 */
function SQLitePlugin(PouchDB: any) {
  /**
   * Register SQLite adapter
   * @param name Adapter name
   * @param constructor Adapter constructor
   * @param priority Priority
   */
  PouchDB.adapter('sqlite', SQLitePouch, true);

  /**
   * Register SQLite implementation
   * @param name Implementation name
   * @param factory Implementation factory
   */
  PouchDB.registerSQLiteImplementation = (name: string, factory: SQLiteImplementationFactory) => {
    registerSQLiteImplementation(name, factory);
  };
}

SQLitePouch.valid = () => true;
SQLitePouch.use_prefix = false;

export default SQLitePlugin;
