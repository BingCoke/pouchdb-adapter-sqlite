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
Install Core First:

```shell
# install pouchdb
yarn add pouchdb-core pouchdb-replication pouchdb-adapter-http
# install sqlite adapter
yarn add pouchdb-adapter-sqlite-core
# install specific sqlite implementation
yarn add pouchdb-adapter-expo-sqlite
```

Then Install the SQLite Implementation Plugin:

```shell
# install expo-sqlite plugin
yarn add pouchdb-adapter-expo-sqlite
# install capacitor-sqlite plugin
yarn add pouchdb-adapter-capacitor-sqlite
# install op-sqlite plugin
yarn add pouchdb-adapter-op-sqlite
```


When creating a PouchDB instance, specify the `adapter` name as `sqlite` and configure the `sqliteImplementation` setting. Make sure to first inject the sqlite-core plugin, followed by the specific SQLite implementation plugin.

```typescript
import PouchDB from "pouchdb-core";
import HttpPouch from "pouchdb-adapter-http";
import replication from "pouchdb-replication";
import OPSQLitePlugin from "pouchdb-adapter-opsqlite";
import SqlitePlugin from "pouchdb-adapter-sqlite-core";

const DB = PouchDB.plugin(HttpPouch)
  .plugin(replication)
  .plugin(SqlitePlugin)
  .plugin(OPSQLitePlugin);


const db = new DB('example', {
  adapter:'sqlite',
  sqliteImplementation: 'expo-sqlite',
});

export const remoteDB = new Db("http://192.168.0.104:8080/couchdb/example", {
  auth: { username: "admin", password: "123456" },
  adapter: "http",
});

export const sync = PouchDB.sync(db, remoteDB, { live: true, retry: true });
```

## NOTE!!! If you use React Native
Please check out the end of Readme to see how to resolve issues with React Native and Pouchdb.
> ***This is not an issue with our library, but rather a compatibility problem between React Native and PouchDB. As you know, React Native operates in its own environment with its own polyfills, and these polyfills do not fully support standard interface definitions sometimes. To resolve these issues, custom adaptations are necessary.***

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
  ...
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

### Peer Dependencies
If you are using React Native, you may need to add the following peer dependencies:

```shell
yarn add react-native-blob-jsi-helper react-native-quick-base64
```

***Additionally, please review the post-resolution validation details provided by the package manager during dependency installation, as well as the README documentation of the corresponding SQLite implementation library.***

## Acknowledgments
Special thanks to @craftzdog for the open-source project: [pouchdb-adapter-react-native-sqlite](https://github.com/craftzdog/pouchdb-adapter-react-native-sqlite). This project is built upon their implementation.
