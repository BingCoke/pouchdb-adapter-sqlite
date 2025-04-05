# PouchDB OP SQLite Adapter


PouchDB adapter using [OP SQLite](https://github.com/OP-Engineering/op-sqlite) as its data store.

## Installation

```bash
npm install pouchdb-adapter-opsqlite @op-engineering/op-sqlite pouchdb-adapter-sqlite-core
# or
yarn add pouchdb-adapter-opsqlite @op-engineering/op-sqlite pouchdb-adapter-sqlite-core
```

## Usage

```typescript
import PouchDB from 'pouchdb';
import SqlitePlugin from 'pouchdb-adapter-sqlite-core';
import OPSQLPlugin from 'pouchdb-adapter-opsqlite';

// Initialize PouchDB with the adapter
PouchDB.plugin(SqlitePlugin).plugin(OPSQLPlugin);

const db = new PouchDB('mydb', {
  adapter: 'sqlite',
  sqliteImplementation: 'op-sqlite',
});
```

## Configuration Options

- `sqliteImplementation`: Must be set to 'op-sqlite'
- `serializer`: Optional custom serializer for binary data
  - `serialize`: Function to transform data before storage
  - `deserialize`: Function to transform data after retrieval

## Notes

1. Requires `@op-engineering/op-sqlite` v11.4.8 or higher
2. Works with React Native projects
3. Supports both iOS and Android platforms

See the [main project README](https://github.com/BingCoke/pouchdb-adapter-sqlite/) for more details on attachment handling and common issues.
