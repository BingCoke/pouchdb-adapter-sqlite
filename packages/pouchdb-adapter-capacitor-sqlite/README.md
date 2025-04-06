# PouchDB Capacitor SQLite Adapter

PouchDB adapter using [Capacitor SQLite](https://github.com/capacitor-community/sqlite) as its data store.

## Installation

```bash
npm install pouchdb-adapter-capacitor-sqlite @capacitor-community/sqlite pouchdb-adapter-sqlite-core
# or
yarn add pouchdb-adapter-capacitor-sqlite @capacitor-community/sqlite pouchdb-adapter-sqlite-core
```

## Usage

```typescript
import PouchDB from 'pouchdb';
import SqlitePlugin from 'pouchdb-adapter-sqlite-core';
import CapacitorSQLPlugin from 'pouchdb-adapter-capacitor-sqlite';

// Initialize PouchDB with the adapter
PouchDB.plugin(SqlitePlugin).plugin(CapacitorSQLPlugin);

const db = new PouchDB('mydb', {
  adapter: 'sqlite',
  sqliteImplementation: 'capacitor'
});
```

## Configuration Options

- `sqliteImplementation`: Must be set to 'capacitor'

See the [main project README](https://github.com/BingCoke/pouchdb-adapter-sqlite/) for more details on attachment handling and common issues.
