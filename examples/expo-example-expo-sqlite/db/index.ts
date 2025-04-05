import PouchDB from 'pouchdb';
import { fromByteArray } from 'react-native-quick-base64';
import HttpPouch from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import { getBlobForArrayBuffer } from 'react-native-blob-jsi-helper';
import PounchdbFind from 'pouchdb-find';
import ExpoSQLPlugin from 'pouchdb-adapter-expo-sqlite';
import SqlitePlugin from 'pouchdb-adapter-sqlite-core';

const Db = PouchDB.plugin(HttpPouch)
  .plugin(PounchdbFind)
  .plugin(mapreduce)
  .plugin(SqlitePlugin)
  .plugin(ExpoSQLPlugin);

export const remoteDB = new Db('http://192.168.0.104:8080/couchdb/ea1', {
  auth: { username: 'admin', password: '123456' },
  adapter: 'http',
});

export const db = new Db('expo-example3', {
  adapter: 'sqlite',
  sqliteImplementation: 'expo-sqlite',
  btoa: (binary: any) => {
    const uint8Array: Uint8Array = binary;

    const base = fromByteArray(uint8Array);
    return base;
  },
  createBlob: (binary: Uint8Array, type: string) => {
    const arrayBuffer = binary.buffer.slice(
      binary.byteOffset,
      binary.byteOffset + binary.byteLength
    );

    // @ts-ignore
    const b = getBlobForArrayBuffer(arrayBuffer);
    return b;
  },
  serializer: {
    serialize: (data: any) => {
      const binary: string = data;
      const buffer = Buffer.from(binary, 'binary');
      const array = Uint8Array.from(buffer);
      return array;
    },
    deserialize: (data: any) => {
      return data;
    },
  },
});

export const sync = PouchDB.sync(db, remoteDB, { live: true, retry: true });
