import PouchDB from 'pouchdb';
import HttpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import PounchdbFind from 'pouchdb-find';
import ExpoSQLPlugin from 'pouchdb-adapter-expo-sqlite';
import SqlitePlugin from 'pouchdb-adapter-sqlite-core';
import debug from 'debug';

debug.enable('*');
const Db = PouchDB.plugin(HttpPouch)
  .plugin(PounchdbFind)
  .plugin(mapreduce)
  .plugin(SqlitePlugin)
  .plugin(ExpoSQLPlugin);

export const remoteDB = new Db('http://192.168.0.104:8080/couchdb/ea1', {
  auth: { username: 'admin', password: '123456' },
  adapter: 'http',
});

export const db = new Db('expo-example', {
  adapter: 'sqlite',
  sqliteImplementation: 'expo-sqlite',
});

try {
  const sync = PouchDB.sync(db, remoteDB, { live: true, retry: true });
  sync.catch((err) => {
    console.error(err);
  });
} catch (e) {
  console.error(e);
}
