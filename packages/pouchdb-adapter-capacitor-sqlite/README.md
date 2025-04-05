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
  sqliteImplementation: 'capacitor',
  // Optional serializer for binary data
  serializer: {
    serialize: (data) => escapeBlob(data),
    deserialize: (data) => unescapeBlob(data),
  }
});
```

## Configuration Options

- `sqliteImplementation`: Must be set to 'capacitor'
- `serializer`: Optional custom serializer for binary data
  - `serialize`: Function to transform data before storage
  - `deserialize`: Function to transform data after retrieval

## Notes

1. Requires `@capacitor-community/sqlite` v5.0.0 or higher
2. Binary data handling may require custom serialization due to SQLite escaping requirements

See the [main project README](https://github.com/BingCoke/pouchdb-adapter-sqlite/) for more details on attachment handling and common issues.
