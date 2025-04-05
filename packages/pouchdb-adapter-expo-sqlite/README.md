# PouchDB Expo SQLite Adapter

PouchDB adapter using [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) as its data store.

## Installation

```bash
npm install pouchdb-adapter-expo-sqlite expo-sqlite pouchdb-adapter-sqlite-core
# or 
yarn add pouchdb-adapter-expo-sqlite expo-sqlite pouchdb-adapter-sqlite-core
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
```

## Configuration Options

- `sqliteImplementation`: Must be set to 'expo-sqlite'
- `serializer`: Required custom serializer for Uint8Array conversion
  - Expo SQLite requires binary data to be stored as Uint8Array

## Notes

1. Requires `expo-sqlite` v15.1.4 or higher
2. Binary data must be converted to Uint8Array for storage
3. For React Native usage, additional polyfills may be needed

See the [main project README](https://github.com/BingCoke/pouchdb-adapter-sqlite/) for more details on attachment handling and common issues.
