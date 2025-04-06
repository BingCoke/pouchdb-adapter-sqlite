# PouchDB OP SQLite Adapter

PouchDB adapter using [OP SQLite](https://github.com/OP-Engineering/op-sqlite) as its data store.

## Installation
Install Plugin:

```bash
yarn add pouchdb-adapter-opsqlite @op-engineering/op-sqlite pouchdb-adapter-sqlite-core
```

And install some peer dependencies:

```bash
yarn add react-native-blob-jsi-helper
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

See the [main project README](https://github.com/BingCoke/pouchdb-adapter-sqlite/) for more details on attachment handling and common issues.
