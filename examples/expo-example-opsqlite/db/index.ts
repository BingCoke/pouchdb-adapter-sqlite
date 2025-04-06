import PouchDB from 'pouchdb';
import HttpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import PounchdbFind from 'pouchdb-find';
import OPSQLitePlugin from 'pouchdb-adapter-opsqlite';
import SqlitePlugin from 'pouchdb-adapter-sqlite-core';
import { install } from 'react-native-quick-crypto';

install();

const Db = PouchDB.plugin(HttpPouch)
  .plugin(PounchdbFind)
  .plugin(mapreduce)
  .plugin(SqlitePlugin)
  .plugin(OPSQLitePlugin);

export const remoteDB = new Db('http://192.168.0.104:8080/couchdb/ea1', {
  auth: { username: 'admin', password: '123456' },
  adapter: 'http',
});

export const db = new Db('opex1', {
  adapter: 'sqlite',
  sqliteImplementation: 'opsqlite',
});

export const sync = PouchDB.sync(db, remoteDB, { live: true, retry: true });

const test = async () => {};
test();
