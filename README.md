# PouchDB SQLite Adapter

> **Project Status**: This project is currently under active development. While we strive to ensure compatibility across various SQLite implementations (especially for binary data storage), there may still be edge cases. We welcome any issues, suggestions or discussions to help improve the adapter.

This package provides a core implementation of a generic PouchDB SQLite adapter that works with any SQLite database supporting basic SQL operations.

## Design Philosophy

The core design philosophy of this adapter is to support different SQLite implementations through abstraction and interface separation. The adapter's core functionality is decoupled from specific SQLite implementations, enabling the same codebase to work across various platforms and environments.

## Architecture

The adapter follows a layered architecture:

1. **Core Layer**: Implements all PouchDB adapter functionalities including document storage, querying, and attachment handling
2. **Abstract Database Interface Layer**: Defines interfaces for SQLite database interactions
3. **Implementation Layer**: Provides concrete implementations for different SQLite libraries

## Supported SQLite Implementations

Currently supported or planned SQLite implementations:

- [x] [Capacitor SQLite (@capacitor-community/sqlite)](https://github.com/capacitor-community/sqlite)
- [x] [Expo-Sqlite](https://github.com/expo/expo/tree/sdk-52/packages/expo-sqlite)
- [x] [OP SQLite (@op-engineering/op-sqlite)](https://github.com/OP-Engineering/op-sqlite)
- [ ] Other SQLite implementations conforming to the interface specification

## Upcoming Features

- [x]  **More Efficient Attachment Handling**
   Currently, the adapter uses pouchdb's official adapter-util to first convert data to binary string format. However, some SQLite implementations require converting this binary string to Uint8Array for storage. This creates unnecessary overhead when the input data is already in Uint8Array format. We plan to optimize this conversion pipeline to improve performance.

- [ ] **Extended SQLite Support**
   We welcome community contributions through issues and pull requests to add support for additional SQLite implementations. Our roadmap includes expanding compatibility with more SQLite variants.

## Usage

When creating a PouchDB instance, specify the `adapter` name as `sqlite` and configure the `sqliteImplementation` setting. Make sure to first inject the sqlite-core plugin, followed by the specific SQLite implementation plugin.

```typescript
import PouchDB from 'pouchdb';
import SqlitePlugin from 'pouchdb-adapter-sqlite-core';
import ExpoSQLPlugin from 'pouchdb-adapter-expo-sqlite';

const DB = PouchDB.plugin(SqlitePlugin).plugin(ExpoSQLPlugin);

const db = new DB('example', {
  adapter:'sqlite',
  sqliteImplementation: 'expo-sqlite',
});
```

## More Examples
See the example directory for additional usage examples. Database-related code can be found in the db subdirectory.

## Extending Support
To add support for other SQLite implementations, simply create an adapter that implements the abstract database interface.

## Attachment Storage and Retrieval Configuration
This release includes optimizations for binary data processing across different SQLite databases. If you need to:

Adapt your SQLite implementation

Resolve binary storage issues with specific SQLite versions

Configure attachment-related settings

Please refer to this documentation for detailed guidance.[about attachment](./docs/attachment.md)

## Known Issues and Workarounds

### React Native with PouchDB 9.0.0
When using this adapter with PouchDB 9.0.0 in React Native, you may encounter errors related to `pouchdb-errors`.
To fix it you just need to patch pouchdb-errors library with this version: https://github.com/pouchdb/pouchdb/blob/master/packages/node_modules/pouchdb-errors/src/index.js
You can use patch-package for this. https://www.npmjs.com/package/patch-package

### React Native Pollyfills
If you are using React Native, you may need to include the following pollyfills: `react-native-quick-crypto`, `readable-stream`, `@craftzdog/react-native-buffer`
```shell
yarn add reac-native-quick-crypto readable-stream @craftzdog/react-native-buffer
```

You need to install babel-plugin-module-resolver, it's a babel plugin that will alias any imports in the code with the values you pass to it. It tricks any module that will try to import certain dependencies with the native versions we require for React Native.

```shell
yarn add --dev babel-plugin-module-resolver
```

Then, in your babel.config.js, add the plugin to swap the crypto, stream and buffer dependencies:

```js
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          'crypto': 'react-native-quick-crypto',
          'stream': 'readable-stream',
          'buffer': '@craftzdog/react-native-buffer',
        },
      },
   ],
    ...
  ],
};
```
## Acknowledgments
Special thanks to @craftzdog for the open-source project: [pouchdb-adapter-react-native-sqlite](https://github.com/craftzdog/pouchdb-adapter-react-native-sqlite). This project is built upon their implementation.
