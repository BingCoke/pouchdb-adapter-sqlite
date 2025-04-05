import PouchDB from 'pouchdb';
import HttpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import PounchdbFind from 'pouchdb-find';
import OPSQLitePlugin from 'pouchdb-adapter-opsqlite';
import SqlitePlugin from 'pouchdb-adapter-sqlite-core';
import { getBlobForArrayBuffer } from 'react-native-blob-jsi-helper';

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
  createBlob: (binary: string, type: string) => {
    const buffer = Buffer.from(binary, 'binary');

    // @ts-ignore
    const blob = getBlobForArrayBuffer(buffer.buffer);
    return blob;
  },
});

export const sync = PouchDB.sync(db, remoteDB, { live: true, retry: true });

const test = async () => {
  //await db.createIndex({
  //  index: {
  //    fields: ['name'],
  //  },
  //});
  //await db.createIndex({
  //  index: {
  //    fields: ['some'],
  //  },
  //});
  //db.bulkDocs([
  //  { name: 'apple', some: 'somethin' },
  //  { name: 'banana', some: 'somthin' },
  //  { name: 'orange', some: 'hhhh' },
  //  { name: 'Alan', some: 'hhhh' },
  //  { name: 'Mike', some: 'hhhh' },
  //]);
};
test();
