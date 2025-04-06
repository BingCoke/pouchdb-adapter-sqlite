# PouchDB Expo SQLite Adapter

PouchDB adapter using [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) as its data store.

## Installation

Install Plugin:
```bash
yarn add pouchdb-adapter-expo-sqlite expo-sqlite pouchdb-adapter-sqlite-core
```

And install some peer dependencies:
```bash
yarn add react-native-blob-jsi-helper react-native-quick-base64
```

## Usage

```typescript
import PouchDB from 'pouchdb';
import SqlitePlugin from 'pouchdb-adapter-sqlite-core';
import ExpoSQLPlugin from 'pouchdb-adapter-expo-sqlite';

// Initialize PouchDB with the adapter
PouchDB.plugin(SqlitePlugin).plugin(ExpoSQLPlugin);

const db = new PouchDB('mydb', {
  adapter: 'sqlite',
  sqliteImplementation: 'expo-sqlite',
});

export const sync = PouchDB.sync(db, remoteDB, { live: true, retry: true });
```

## Configuration Options
- `sqliteImplementation`: Must be set to 'expo-sqlite'

See the [main project README](https://github.com/BingCoke/pouchdb-adapter-sqlite/) for more details on attachment handling and common issues.
