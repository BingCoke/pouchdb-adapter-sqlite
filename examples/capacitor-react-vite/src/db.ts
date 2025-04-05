import PouchDB from 'pouchdb';
import capicatorSQLiteAdapter from 'pouchdb-adapter-capacitor-sqlite';
import sqlitePlugn from 'pouchdb-adapter-sqlite-core';
import { escapeBlob, unescapeBlob } from 'pouchdb-adapter-sqlite-core';

const DB = PouchDB.plugin(sqlitePlugn).plugin(capicatorSQLiteAdapter);
export const remotedb = new PouchDB('http://192.168.0.104:8080/couchdb/example', {
  auth: {
    username: 'admin',
    password: '123456',
  },
});

export const db = new DB('capp2', {
  adapter: 'sqlite',
  sqliteImplementation: 'capicator',
  serializer: {
    serialize: (data) => {
      return escapeBlob(data);
    },
    deserialize: (data) => {
      return unescapeBlob(data);
    },
  },
});

export const sync = db.sync(remotedb, { live: true, retry: true });

sync.on('change', () => {
  console.log('get change');
});

const test = async () => {
  // .... do something you want
};
test();
