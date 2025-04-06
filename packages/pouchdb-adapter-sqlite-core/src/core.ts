import { clone, pick, filterChange, changesHandler as Changes, uuid } from 'pouchdb-utils';
import { collectConflicts, traverseRevTree, latest as getLatest } from 'pouchdb-merge';
import { safeJsonParse, safeJsonStringify } from 'pouchdb-json';
import {
  binaryStringToBlobOrBuffer as binStringToBlob,
  btoa as defaultBtoa,
} from 'pouchdb-binary-utils';

import sqliteBulkDocs from './bulkDocs';

import { MISSING_DOC, REV_CONFLICT, createError } from 'pouchdb-errors';

import {
  ADAPTER_VERSION,
  DOC_STORE,
  BY_SEQ_STORE,
  ATTACH_STORE,
  LOCAL_STORE,
  META_STORE,
  ATTACH_AND_SEQ_STORE,
} from './constants';

import {
  qMarks,
  stringifyDoc,
  unstringifyDoc,
  select,
  compactRevs,
  handleSQLiteError,
} from './utils';

import openDatabase, { closeDatabase } from './openDatabase';
import {
  BinarySerializer,
  OpenDatabaseOptions,
  SQLiteLoggerAdapter as SQLiteAdapter,
  SQLiteDatabase,
  TransactionQueue,
} from './interfaces';
import { logger } from './logger';
import { defaultSerializer } from './libUtils';

// These indexes cover the basis for most allDocs queries
const BY_SEQ_STORE_DELETED_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS 'by-seq-deleted-idx' ON " + BY_SEQ_STORE + ' (seq, deleted)';
const BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL =
  "CREATE UNIQUE INDEX IF NOT EXISTS 'by-seq-doc-id-rev' ON " + BY_SEQ_STORE + ' (doc_id, rev)';
const DOC_STORE_WINNINGSEQ_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS 'doc-winningseq-idx' ON " + DOC_STORE + ' (winningseq)';
const ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS 'attach-seq-seq-idx' ON " + ATTACH_AND_SEQ_STORE + ' (seq)';
const ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL =
  "CREATE UNIQUE INDEX IF NOT EXISTS 'attach-seq-digest-idx' ON " +
  ATTACH_AND_SEQ_STORE +
  ' (digest, seq)';

const DOC_STORE_AND_BY_SEQ_JOINER = BY_SEQ_STORE + '.seq = ' + DOC_STORE + '.winningseq';

const SELECT_DOCS =
  BY_SEQ_STORE +
  '.seq AS seq, ' +
  BY_SEQ_STORE +
  '.deleted AS deleted, ' +
  BY_SEQ_STORE +
  '.json AS data, ' +
  BY_SEQ_STORE +
  '.rev AS rev, ' +
  DOC_STORE +
  '.json AS metadata';

const sqliteChanges = new Changes();

// Helper functions
async function getMaxSeq(db: SQLiteDatabase): Promise<number> {
  const sql = 'SELECT MAX(seq) AS seq FROM ' + BY_SEQ_STORE;
  const res = await db.query(sql, []);
  const updateSeq = res.values && res.values.length > 0 ? (res.values[0].seq as number) || 0 : 0;
  return updateSeq;
}

async function countDocs(db: SQLiteDatabase): Promise<number> {
  const sql = select(
    'COUNT(' + DOC_STORE + ".id) AS 'num'",
    [DOC_STORE, BY_SEQ_STORE],
    DOC_STORE_AND_BY_SEQ_JOINER,
    BY_SEQ_STORE + '.deleted=0'
  );
  const result = await db.query(sql, []);
  return result.values && result.values.length > 0 ? (result.values[0].num as number) || 0 : 0;
}

async function latest(
  db: SQLiteDatabase,
  id: string,
  rev: string,
  callback: (latestRev: string) => void,
  finish: (err: any) => void
) {
  const sql = select(
    SELECT_DOCS,
    [DOC_STORE, BY_SEQ_STORE],
    DOC_STORE_AND_BY_SEQ_JOINER,
    DOC_STORE + '.id=?'
  );
  const sqlArgs = [id];

  try {
    const results = await db.query(sql, sqlArgs);
    if (!results.values?.length) {
      const err = createError(MISSING_DOC, 'missing');
      return finish(err);
    }
    const item = results.values[0];
    const metadata = safeJsonParse(item.metadata);
    callback(getLatest(rev, metadata));
  } catch (err) {
    finish(err);
  }
}

function fetchAttachmentsIfNecessary(
  doc: any,
  opts: any,
  api: any,
  db: SQLiteDatabase,
  cb?: () => void
) {
  const attachments = Object.keys(doc._attachments || {});
  if (!attachments.length) {
    return cb && cb();
  }
  let numDone = 0;

  const checkDone = () => {
    if (++numDone === attachments.length && cb) {
      cb();
    }
  };

  const fetchAttachment = (doc: any, att: string) => {
    const attObj = doc._attachments[att];
    const attOpts = { binary: opts.binary, ctx: db };
    api._getAttachment(doc._id, att, attObj, attOpts, (_: any, data: any) => {
      doc._attachments[att] = Object.assign(pick(attObj, ['digest', 'content_type']), { data });
      checkDone();
    });
  };

  attachments.forEach((att) => {
    if (opts.attachments && opts.include_docs) {
      fetchAttachment(doc, att);
    } else {
      doc._attachments[att].stub = true;
      checkDone();
    }
  });
}

function SqlPouch(opts: OpenDatabaseOptions, cb: (err: any) => void) {
  // @ts-ignore
  const api = this as any;
  let db: SQLiteAdapter;
  // @ts-ignore
  let txnQueue: TransactionQueue;
  let instanceId: string;
  let encoding: string = 'UTF-8';
  api.auto_compaction = false;

  api._name = opts.name;

  let serializer: BinarySerializer;
  let createBlob: any;
  let btoa: any;
  logger.debug('Creating SqlPouch instance: %s', api._name);

  const sqlOpts = Object.assign({}, opts, { name: opts.name + '.db' });
  openDatabase(sqlOpts)
    .then((openDBResult) => {
      if ('db' in openDBResult) {
        db = openDBResult.db;

        serializer = opts.serializer ?? db.serializer ?? defaultSerializer;
        createBlob = opts.createBlob ?? db.createBlob ?? binStringToBlob;
        btoa = opts.btoa ?? db.btoa ?? defaultBtoa;
        api.serializer = serializer;

        txnQueue = openDBResult.transactionQueue;
        logger.debug('Setting up database');
        setup(cb);
        logger.debug('Database opened successfully.');
      } else {
        handleSQLiteError(openDBResult.error, cb);
      }
    })
    .catch((error) => {
      handleSQLiteError(error, cb);
    });

  async function transaction(fn: (db: SQLiteDatabase) => Promise<void>) {
    return txnQueue.push(fn);
  }

  async function readTransaction(fn: (db: SQLiteDatabase) => Promise<void>) {
    return txnQueue.pushReadOnly(fn);
  }

  async function setup(callback: (err: any) => void) {
    try {
      await txnQueue.push(async (db) => {
        await checkEncoding(db);
        logger.debug('Encoding check successful');
        await fetchVersion(db);
        logger.debug('Setup completed');
      });
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  async function checkEncoding(db: SQLiteDatabase) {
    const res = await db.query("SELECT HEX('a') AS hex");
    if (res.values && res.values.length > 0) {
      const hex = res.values[0].hex as string;
      encoding = hex.length === 2 ? 'UTF-8' : 'UTF-16';
    }
  }

  async function fetchVersion(db: SQLiteDatabase) {
    logger.debug('Fetching version');
    const sql = 'SELECT sql FROM sqlite_master WHERE tbl_name = ' + META_STORE;

    logger.debug('Version query', sql);
    const result = await db.query(sql);
    logger.debug('Query result', result);
    if (!result.values?.length) {
      await onGetVersion(db, 0);
    } else if (!/db_version/.test(result.values[0].sql as string)) {
      await db.execute('ALTER TABLE ' + META_STORE + ' ADD COLUMN db_version INTEGER');
      await onGetVersion(db, 1);
    } else {
      const resDBVer = await db.query('SELECT db_version FROM ' + META_STORE);
      if (resDBVer.values && resDBVer.values.length > 0) {
        const dbVersion = resDBVer.values[0].db_version as number;
        await onGetVersion(db, dbVersion);
      }
    }
  }

  async function onGetVersion(db: SQLiteDatabase, dbVersion: number) {
    if (dbVersion === 0) {
      await createInitialSchema(db);
    } else {
      await runMigrations(db, dbVersion);
    }
  }

  async function createInitialSchema(db: SQLiteDatabase) {
    logger.debug('Creating initial schema');
    const meta = 'CREATE TABLE IF NOT EXISTS ' + META_STORE + ' (dbid, db_version INTEGER)';
    const attach =
      'CREATE TABLE IF NOT EXISTS ' +
      ATTACH_STORE +
      ' (digest UNIQUE, escaped TINYINT(1), body BLOB)';
    const attachAndRev =
      'CREATE TABLE IF NOT EXISTS ' + ATTACH_AND_SEQ_STORE + ' (digest, seq INTEGER)';
    const doc =
      'CREATE TABLE IF NOT EXISTS ' +
      DOC_STORE +
      ' (id unique, json, winningseq, max_seq INTEGER UNIQUE)';
    const seq =
      'CREATE TABLE IF NOT EXISTS ' +
      BY_SEQ_STORE +
      ' (seq INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, json, deleted TINYINT(1), doc_id, rev)';
    const local = 'CREATE TABLE IF NOT EXISTS ' + LOCAL_STORE + ' (id UNIQUE, rev, json)';

    logger.debug('Creating attachments table');
    await db.execute(attach);
    logger.debug('Creating local table');
    await db.execute(local);
    await db.execute(attachAndRev);
    await db.execute(ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL);
    await db.execute(ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL);
    logger.debug('Creating documents table');
    await db.execute(doc);
    await db.execute(DOC_STORE_WINNINGSEQ_INDEX_SQL);
    logger.debug('After creating documents table');
    await db.execute(seq);
    await db.execute(BY_SEQ_STORE_DELETED_INDEX_SQL);
    await db.execute(BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL);
    await db.execute(meta);
    const initSeq = 'INSERT INTO ' + META_STORE + ' (db_version, dbid) VALUES (?,?)';
    instanceId = uuid();
    const initSeqArgs = [ADAPTER_VERSION, instanceId];
    await db.run(initSeq, initSeqArgs);
    onGetInstanceId();
    logger.debug('Creation successful');
  }

  async function runMigrations(db: SQLiteDatabase, dbVersion: number) {
    // Migration logic can be added here

    const migrated = dbVersion < ADAPTER_VERSION;
    if (migrated) {
      await db.execute('UPDATE ' + META_STORE + ' SET db_version = ' + ADAPTER_VERSION);
    }
    const result = await db.query('SELECT dbid FROM ' + META_STORE);
    if (result.values && result.values.length > 0) {
      instanceId = result.values[0].dbid as string;
    }
    onGetInstanceId();
  }

  function onGetInstanceId() {
    // Does nothing
  }

  api._remote = false;

  api._id = (callback: (err: any, id?: string) => void) => {
    callback(null, instanceId);
  };

  api._info = (callback: (err: any, info?: any) => void) => {
    readTransaction(async (db: SQLiteDatabase) => {
      try {
        const seq = await getMaxSeq(db);
        const docCount = await countDocs(db);
        callback(null, {
          doc_count: docCount,
          update_seq: seq,
          sqlite_encoding: encoding,
        });
      } catch (e: any) {
        handleSQLiteError(e, callback);
      }
    });
  };

  api._bulkDocs = async (req: any, reqOpts: any, callback: (err: any, response?: any) => void) => {
    logger.debug('**********bulkDocs!!!!!!!!!!!!!!!!!!!');
    try {
      const response = await sqliteBulkDocs(
        { revs_limit: undefined },
        req,
        reqOpts,
        api,
        transaction,
        sqliteChanges
      );
      callback(null, response);
    } catch (err: any) {
      handleSQLiteError(err, callback);
    }
  };

  api._get = (id: string, opts: any, callback: (err: any, response?: any) => void) => {
    logger.debug('get:', id);
    let doc: any;
    let metadata: any;
    const db: SQLiteDatabase = opts.ctx;
    if (!db) {
      readTransaction(async (txn) => {
        return new Promise((resolve) => {
          api._get(id, Object.assign({ ctx: txn }, opts), (err: any, response: any) => {
            callback(err, response);
            resolve();
          });
        });
      });
      return;
    }

    const finish = (err: any) => {
      callback(err, { doc, metadata, ctx: db });
    };

    let sql: string;
    let sqlArgs: any[];

    if (!opts.rev) {
      sql = select(
        SELECT_DOCS,
        [DOC_STORE, BY_SEQ_STORE],
        DOC_STORE_AND_BY_SEQ_JOINER,
        DOC_STORE + '.id=?'
      );
      sqlArgs = [id];
    } else if (opts.latest) {
      latest(
        db,
        id,
        opts.rev,
        (latestRev: string) => {
          opts.latest = false;
          opts.rev = latestRev;
          api._get(id, opts, callback);
        },
        finish
      );
      return;
    } else {
      sql = select(
        SELECT_DOCS,
        [DOC_STORE, BY_SEQ_STORE],
        DOC_STORE + '.id=' + BY_SEQ_STORE + '.doc_id',
        [BY_SEQ_STORE + '.doc_id=?', BY_SEQ_STORE + '.rev=?']
      );
      sqlArgs = [id, opts.rev];
    }

    db.query(sql, sqlArgs)
      .then((results) => {
        if (!results.values?.length) {
          const missingErr = createError(MISSING_DOC, 'missing');
          return finish(missingErr);
        }
        const item = results.values[0];
        metadata = safeJsonParse(item.metadata);
        if (item.deleted && !opts.rev) {
          const deletedErr = createError(MISSING_DOC, 'deleted');
          return finish(deletedErr);
        }
        doc = unstringifyDoc(item.data as string, metadata.id, item.rev as string);
        finish(null);
      })
      .catch((e) => {
        return finish(e);
      });
  };

  api._allDocs = (opts: any, callback: (err: any, response?: any) => void) => {
    const results: any[] = [];

    const start = 'startkey' in opts ? opts.startkey : false;
    const end = 'endkey' in opts ? opts.endkey : false;
    const key = 'key' in opts ? opts.key : false;
    const keys = 'keys' in opts ? opts.keys : false;
    const descending = 'descending' in opts ? opts.descending : false;
    let limit = 'limit' in opts ? opts.limit : -1;
    const offset = 'skip' in opts ? opts.skip : 0;
    const inclusiveEnd = opts.inclusive_end !== false;

    let sqlArgs: any[] = [];
    const criteria: string[] = [];
    const keyChunks: any[] = [];

    if (keys) {
      const destinctKeys: string[] = [];
      keys.forEach((key: string) => {
        if (destinctKeys.indexOf(key) === -1) {
          destinctKeys.push(key);
        }
      });

      for (let index = 0; index < destinctKeys.length; index += 999) {
        const chunk = destinctKeys.slice(index, index + 999);
        if (chunk.length > 0) {
          keyChunks.push(chunk);
        }
      }
    } else if (key !== false) {
      criteria.push(DOC_STORE + '.id = ?');
      sqlArgs.push(key);
    } else if (start !== false || end !== false) {
      if (start !== false) {
        criteria.push(DOC_STORE + '.id ' + (descending ? '<=' : '>=') + ' ?');
        sqlArgs.push(start);
      }
      if (end !== false) {
        let comparator = descending ? '>' : '<';
        if (inclusiveEnd) {
          comparator += '=';
        }
        criteria.push(DOC_STORE + '.id ' + comparator + ' ?');
        sqlArgs.push(end);
      }
      if (key !== false) {
        criteria.push(DOC_STORE + '.id = ?');
        sqlArgs.push(key);
      }
    }

    if (!keys) {
      criteria.push(BY_SEQ_STORE + '.deleted = 0');
    }

    readTransaction(async (db: SQLiteDatabase) => {
      const processResult = (rows: any[], results: any[], keys: any) => {
        for (let i = 0, l = rows.length; i < l; i++) {
          const item = rows[i];
          const metadata = safeJsonParse(item.metadata);
          const id = metadata.id;
          const data = unstringifyDoc(item.data, id, item.rev);
          const winningRev = data._rev;
          const doc: any = {
            id: id,
            key: id,
            value: { rev: winningRev },
          };
          if (opts.include_docs) {
            doc.doc = data;
            doc.doc._rev = winningRev;
            if (opts.conflicts) {
              const conflicts = collectConflicts(metadata);
              if (conflicts.length) {
                doc.doc._conflicts = conflicts;
              }
            }
            fetchAttachmentsIfNecessary(doc.doc, opts, api, db);
          }
          if (item.deleted) {
            if (keys) {
              doc.value.deleted = true;
              doc.doc = null;
            } else {
              continue;
            }
          }
          if (!keys) {
            results.push(doc);
          } else {
            let index = keys.indexOf(id);
            do {
              results[index] = doc;
              index = keys.indexOf(id, index + 1);
            } while (index > -1 && index < keys.length);
          }
        }
        if (keys) {
          keys.forEach((key: string, index: number) => {
            if (!results[index]) {
              results[index] = { key: key, error: 'not_found' };
            }
          });
        }
      };

      try {
        const totalRows = await countDocs(db);
        const updateSeq = opts.update_seq ? await getMaxSeq(db) : undefined;

        if (limit === 0) {
          limit = 1;
        }

        if (keys) {
          let finishedCount = 0;
          const allRows: any[] = [];
          for (const keyChunk of keyChunks) {
            sqlArgs = [];
            criteria.length = 0;
            let bindingStr = '';
            keyChunk.forEach(() => {
              bindingStr += '?,';
            });
            bindingStr = bindingStr.substring(0, bindingStr.length - 1);
            criteria.push(DOC_STORE + '.id IN (' + bindingStr + ')');
            sqlArgs = sqlArgs.concat(keyChunk);

            const sql =
              select(
                SELECT_DOCS,
                [DOC_STORE, BY_SEQ_STORE],
                DOC_STORE_AND_BY_SEQ_JOINER,
                criteria,
                DOC_STORE + '.id ' + (descending ? 'DESC' : 'ASC')
              ) +
              ' LIMIT ' +
              limit +
              ' OFFSET ' +
              offset;
            const result = await db.query(sql, sqlArgs);
            finishedCount++;
            if (result.values) {
              for (let index = 0; index < result.values.length; index++) {
                allRows.push(result.values[index]);
              }
            }
            if (finishedCount === keyChunks.length) {
              processResult(allRows, results, keys);
            }
          }
        } else {
          const sql =
            select(
              SELECT_DOCS,
              [DOC_STORE, BY_SEQ_STORE],
              DOC_STORE_AND_BY_SEQ_JOINER,
              criteria,
              DOC_STORE + '.id ' + (descending ? 'DESC' : 'ASC')
            ) +
            ' LIMIT ' +
            limit +
            ' OFFSET ' +
            offset;
          const result = await db.query(sql, sqlArgs);
          const rows: any[] = [];
          if (result.values) {
            for (let index = 0; index < result.values.length; index++) {
              rows.push(result.values[index]);
            }
          }
          processResult(rows, results, keys);
        }

        const returnVal: any = {
          total_rows: totalRows,
          offset: opts.skip,
          rows: results,
        };

        if (opts.update_seq) {
          returnVal.update_seq = updateSeq;
        }
        callback(null, returnVal);
      } catch (e: any) {
        handleSQLiteError(e, callback);
      }
    });
  };

  api._changes = (opts: any): any => {
    opts = clone(opts);

    if (opts.continuous) {
      const id = api._name + ':' + uuid();
      sqliteChanges.addListener(api._name, id, api, opts);
      sqliteChanges.notify(api._name);
      return {
        cancel: () => {
          sqliteChanges.removeListener(api._name, id);
        },
      };
    }

    const descending = opts.descending;
    opts.since = opts.since && !descending ? opts.since : 0;
    let limit = 'limit' in opts ? opts.limit : -1;
    if (limit === 0) {
      limit = 1;
    }

    const results: any[] = [];
    let numResults = 0;

    const fetchChanges = () => {
      const selectStmt =
        DOC_STORE +
        '.json AS metadata, ' +
        DOC_STORE +
        '.max_seq AS maxSeq, ' +
        BY_SEQ_STORE +
        '.json AS winningDoc, ' +
        BY_SEQ_STORE +
        '.rev AS winningRev ';
      const from = DOC_STORE + ' JOIN ' + BY_SEQ_STORE;
      const joiner =
        DOC_STORE +
        '.id=' +
        BY_SEQ_STORE +
        '.doc_id' +
        ' AND ' +
        DOC_STORE +
        '.winningseq=' +
        BY_SEQ_STORE +
        '.seq';
      const criteria = ['maxSeq > ?'];
      const sqlArgs = [opts.since];

      if (opts.doc_ids) {
        criteria.push(DOC_STORE + '.id IN ' + qMarks(opts.doc_ids.length));
        sqlArgs.push(...opts.doc_ids);
      }

      const orderBy = 'maxSeq ' + (descending ? 'DESC' : 'ASC');
      let sql = select(selectStmt, from, joiner, criteria, orderBy);
      const filter = filterChange(opts);

      if (!opts.view && !opts.filter) {
        sql += ' LIMIT ' + limit;
      }

      let lastSeq = opts.since || 0;
      readTransaction(async (db: SQLiteDatabase) => {
        try {
          const result = await db.query(sql, sqlArgs);

          if (result.values) {
            for (let i = 0, l = result.values.length; i < l; i++) {
              const item = result.values[i];
              const metadata = safeJsonParse(item.metadata);
              lastSeq = item.maxSeq;

              const doc = unstringifyDoc(
                item.winningDoc as string,
                metadata.id,
                item.winningRev as string
              );
              const change = opts.processChange(doc, metadata, opts);
              change.seq = item.maxSeq;

              const filtered = filter(change);
              if (typeof filtered === 'object') {
                return opts.complete(filtered);
              }

              if (filtered) {
                numResults++;
                if (opts.return_docs) {
                  results.push(change);
                }
                if (opts.attachments && opts.include_docs) {
                  fetchAttachmentsIfNecessary(doc, opts, api, db, () => opts.onChange(change));
                } else {
                  opts.onChange(change);
                }
              }
              if (numResults === limit) {
                break;
              }
            }
          }

          if (!opts.continuous) {
            opts.complete(null, {
              results,
              last_seq: lastSeq,
            });
          }
        } catch (e: any) {
          handleSQLiteError(e, opts.complete);
        }
      });
    };

    fetchChanges();
  };

  api._close = (callback: (err?: any) => void) => {
    closeDatabase(api._name)
      .then(() => callback())
      .catch((err) => callback(err));
  };

  api._getAttachment = (
    _docId: string,
    _attachId: string,
    attachment: any,
    opts: any,
    callback: (err: any, response?: any) => void
  ) => {
    let res: any;
    const db: SQLiteAdapter = opts.ctx;
    const digest = attachment.digest;
    const type = attachment.content_type;
    const sql = 'SELECT escaped, body AS body FROM ' + ATTACH_STORE + ' WHERE digest=?';
    db.query(sql, [digest], { notlogResult: true })
      .then((result) => {
        if (result.values && result.values.length > 0) {
          const item = result.values[0];
          let data = item.body;
          if (item.escaped && serializer) {
            data = serializer.deserialize(data);
          }
          if (opts.binary) {
            res = createBlob(data, type);
          } else {
            res = btoa(data);
          }
          callback(null, res);
        } else {
          callback(createError(MISSING_DOC, 'attachment not found'));
        }
      })
      .catch((err) => {
        handleSQLiteError(err, callback);
      });
  };

  api._getRevisionTree = (docId: string, callback: (err: any, rev_tree?: any) => void) => {
    readTransaction(async (db: SQLiteDatabase) => {
      const sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
      const result = await db.query(sql, [docId]);
      if (!result.values?.length) {
        callback(createError(MISSING_DOC));
      } else {
        const data = safeJsonParse(result.values[0].metadata);
        callback(null, data.rev_tree);
      }
    });
  };

  api._doCompaction = (docId: string, revs: string[], callback: (err?: any) => void) => {
    if (!revs.length) {
      return callback();
    }
    transaction(async (db: SQLiteDatabase) => {
      try {
        let sql = 'SELECT json AS metadata FROM ' + DOC_STORE + ' WHERE id = ?';
        const result = await db.query(sql, [docId]);
        if (result.values && result.values.length > 0) {
          const metadata = safeJsonParse(result.values[0].metadata);
          traverseRevTree(
            metadata.rev_tree,
            (_isLeaf: boolean, pos: number, revHash: string, _ctx: any, opts: any) => {
              const rev = pos + '-' + revHash;
              if (revs.indexOf(rev) !== -1) {
                opts.status = 'missing';
              }
            }
          );
          sql = 'UPDATE ' + DOC_STORE + ' SET json = ? WHERE id = ?';
          await db.run(sql, [safeJsonStringify(metadata), docId]);

          await compactRevs(revs, docId, db);
        }
      } catch (e: any) {
        handleSQLiteError(e, callback);
      }
      callback();
    });
  };

  api._getLocal = (id: string, callback: (err: any, doc?: any) => void) => {
    readTransaction(async (db: SQLiteDatabase) => {
      try {
        const sql = 'SELECT json, rev FROM ' + LOCAL_STORE + ' WHERE id=?';
        const res = await db.query(sql, [id]);
        if (res.values?.length) {
          const item = res.values[0];
          const doc = unstringifyDoc(item.json as string, id, item.rev as string);
          callback(null, doc);
        } else {
          callback(createError(MISSING_DOC));
        }
      } catch (e: any) {
        handleSQLiteError(e, callback);
      }
    });
  };

  api._putLocal = (doc: any, opts: any, callback: (err: any, response?: any) => void) => {
    logger.debug('put local', doc, opts);
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    delete doc._revisions;
    const oldRev = doc._rev;
    const id = doc._id;
    let newRev: string;
    if (!oldRev) {
      newRev = doc._rev = '0-1';
    } else {
      newRev = doc._rev = '0-' + (parseInt(oldRev.split('-')[1], 10) + 1);
    }
    const json = stringifyDoc(doc);

    let ret: any;
    const putLocal = async (db: SQLiteDatabase) => {
      try {
        let sql: string;
        let values: any[];
        if (oldRev) {
          sql = 'UPDATE ' + LOCAL_STORE + ' SET rev=?, json=? WHERE id=? AND rev=?';
          values = [newRev, json, id, oldRev];
        } else {
          sql = 'INSERT INTO ' + LOCAL_STORE + ' (id, rev, json) VALUES (?,?,?)';
          values = [id, newRev, json];
        }
        const res = await db.run(sql, values);
        if (res.changes && res.changes.changes) {
          ret = { ok: true, id: id, rev: newRev };
          callback(null, ret);
        } else {
          callback(createError(REV_CONFLICT));
        }
      } catch (e: any) {
        handleSQLiteError(e, callback);
      }
    };

    if (opts.ctx) {
      putLocal(opts.ctx);
    } else {
      transaction(putLocal);
    }
  };

  api._removeLocal = (doc: any, opts: any, callback: (err: any, response?: any) => void) => {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    let ret: any;

    const removeLocal = async (db: SQLiteDatabase) => {
      try {
        const sql = 'DELETE FROM ' + LOCAL_STORE + ' WHERE id=? AND rev=?';
        const params = [doc._id, doc._rev];
        const res = await db.run(sql, params);
        if (!res.changes || !res.changes.changes) {
          return callback(createError(MISSING_DOC));
        }
        ret = { ok: true, id: doc._id, rev: '0-0' };
        callback(null, ret);
      } catch (e: any) {
        handleSQLiteError(e, callback);
      }
    };

    if (opts.ctx) {
      removeLocal(opts.ctx);
    } else {
      transaction(removeLocal);
    }
  };

  api._destroy = (opts: any, callback: (err: any, response?: any) => void) => {
    sqliteChanges.removeAllListeners(api._name);
    transaction(async (db: SQLiteDatabase) => {
      try {
        const stores = [
          DOC_STORE,
          BY_SEQ_STORE,
          ATTACH_STORE,
          META_STORE,
          LOCAL_STORE,
          ATTACH_AND_SEQ_STORE,
        ];
        for (const store of stores) {
          await db.execute('DROP TABLE IF EXISTS ' + store);
        }
        callback(null, { ok: true });
      } catch (e: any) {
        handleSQLiteError(e, callback);
      }
    });
  };
}

export default SqlPouch;
