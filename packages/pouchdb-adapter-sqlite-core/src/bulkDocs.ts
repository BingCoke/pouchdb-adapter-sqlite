import { isLocalId, processDocs, parseDoc } from 'pouchdb-adapter-utils';
import { compactTree } from 'pouchdb-merge';
import { safeJsonParse, safeJsonStringify } from 'pouchdb-json';
import { MISSING_STUB, createError } from 'pouchdb-errors';

import { DOC_STORE, BY_SEQ_STORE, ATTACH_STORE, ATTACH_AND_SEQ_STORE } from './constants';

import { select, stringifyDoc, compactRevs, handleSQLiteError, escapeBlob } from './utils';
import {
  BinarySerializer,
  SQLiteLoggerAdapter as SQLiteAdapter,
  SQLiteDatabase,
} from './interfaces';
import { logger } from './logger';
import { preprocessAttachments } from './processAttachment';

/**
 * Document info interface
 */
interface DocInfo {
  _id: string;
  metadata: any;
  data: any;
  stemmedRevs?: string[];
  error?: any;
}

/**
 * Database options interface
 */
interface DBOptions {
  revs_limit?: number;
}

/**
 * Request interface
 */
interface Request {
  docs: any[];
}

/**
 * Options interface
 */
interface Options {
  new_edits: boolean;
}

/**
 * Bulk process documents
 * @param dbOpts Database options
 * @param req Request
 * @param opts Options
 * @param api API object
 * @param transaction Transaction function
 * @param sqliteChanges Change notification object
 * @returns Processing result
 */
async function sqliteBulkDocs(
  dbOpts: DBOptions,
  req: Request,
  opts: Options,
  api: any,
  transaction: (fn: (db: SQLiteDatabase) => Promise<void>) => Promise<void>,
  sqliteChanges: any
): Promise<any> {
  const newEdits = opts.new_edits;
  const userDocs = req.docs;
  const serializer = api.serializer as BinarySerializer;

  // Parse documents
  const docInfos: DocInfo[] = userDocs.map((doc) => {
    if (doc._id && isLocalId(doc._id)) {
      return doc;
    }
    return parseDoc(doc, newEdits, dbOpts);
  });

  // Check for errors
  const docInfoErrors = docInfos.filter((docInfo) => docInfo.error);
  if (docInfoErrors.length) {
    throw docInfoErrors[0];
  }

  let db: SQLiteAdapter;
  const results = new Array(docInfos.length);
  const fetchedDocs = new Map<string, any>();

  /**
   * Verify attachment
   * @param digest Attachment digest
   */
  async function verifyAttachment(digest: string) {
    logger.debug('Verify attachment:', digest);
    const sql = 'SELECT count(*) as cnt FROM ' + ATTACH_STORE + ' WHERE digest=?';
    const result = await db.query(sql, [digest]);
    if (result.values && result.values[0]?.cnt === 0) {
      const err = createError(MISSING_STUB, 'Unknown stub attachment with digest ' + digest);
      logger.error('Unknown:', err);
      throw err;
    } else {
      logger.debug('Verification passed');
      return true;
    }
  }

  /**
   * Verify all attachments
   */
  async function verifyAttachments(): Promise<void> {
    const digests: string[] = [];
    docInfos.forEach((docInfo) => {
      if (docInfo.data && docInfo.data._attachments) {
        Object.keys(docInfo.data._attachments).forEach((filename) => {
          const att = docInfo.data._attachments[filename];
          if (att.stub) {
            logger.debug('Attachment digest', att.digest);
            digests.push(att.digest);
          }
        });
      }
    });

    if (!digests.length) return;

    for (const digest of digests) {
      await verifyAttachment(digest);
    }
  }

  /**
   * Write document
   * @param docInfo Document info
   * @param winningRev Winning revision
   * @param winningRevIsDeleted Whether winning revision is deleted
   * @param newRevIsDeleted Whether new revision is deleted
   * @param isUpdate Whether it's an update operation
   * @param delta Delta
   * @param resultsIdx Result index
   */
  async function writeDoc(
    docInfo: DocInfo,
    winningRev: string,
    _winningRevIsDeleted: boolean,
    newRevIsDeleted: boolean,
    isUpdate: boolean,
    _delta: number,
    resultsIdx: number
  ) {
    logger.debug('Write document:', { ...docInfo, data: null });

    /**
     * Post-write processing
     * @param db Database connection
     * @param seq Sequence number
     */
    async function dataWritten(db: SQLiteDatabase, seq: number) {
      const id = docInfo.metadata.id;

      let revsToCompact = docInfo.stemmedRevs || [];
      if (isUpdate && api.auto_compaction) {
        revsToCompact = compactTree(docInfo.metadata).concat(revsToCompact);
      }
      if (revsToCompact.length) {
        compactRevs(revsToCompact, id, db);
      }

      docInfo.metadata.seq = seq;
      const rev = docInfo.metadata.rev;
      delete docInfo.metadata.rev;

      const sql = isUpdate
        ? 'UPDATE ' +
          DOC_STORE +
          ' SET json=?, max_seq=?, winningseq=' +
          '(SELECT seq FROM ' +
          BY_SEQ_STORE +
          ' WHERE doc_id=' +
          DOC_STORE +
          '.id AND rev=?) WHERE id=?'
        : 'INSERT INTO ' + DOC_STORE + ' (id, winningseq, max_seq, json) VALUES (?,?,?,?);';
      const metadataStr = safeJsonStringify(docInfo.metadata);
      const params = isUpdate ? [metadataStr, seq, winningRev, id] : [id, seq, seq, metadataStr];
      await db.run(sql, params);
      results[resultsIdx] = {
        ok: true,
        id: docInfo.metadata.id,
        rev: rev,
      };
      fetchedDocs.set(id, docInfo.metadata);
    }

    /**
     * Insert attachment mappings
     * @param seq Sequence number
     */
    async function insertAttachmentMappings(seq: number) {
      const attsToAdd = Object.keys(data._attachments || {});

      if (!attsToAdd.length) {
        return;
      }

      /**
       * Add attachment mapping
       * @param att Attachment name
       */
      function add(att: string) {
        const sql = 'INSERT INTO ' + ATTACH_AND_SEQ_STORE + ' (digest, seq) VALUES (?,?)';
        const sqlArgs = [data._attachments[att].digest, seq];
        return db.run(sql, sqlArgs);
      }

      await Promise.all(attsToAdd.map((att) => add(att)));
    }

    docInfo.data._id = docInfo.metadata.id;
    docInfo.data._rev = docInfo.metadata.rev;
    const attachments = Object.keys(docInfo.data._attachments || {});

    if (newRevIsDeleted) {
      docInfo.data._deleted = true;
    }

    for (const key of attachments) {
      const att = docInfo.data._attachments[key];
      if (!att.stub) {
        const att_data = att.data;
        delete att.data;
        att.revpos = parseInt(winningRev, 10);
        const digest = att.digest;
        await saveAttachment(digest, att_data);
      }
    }

    const data = docInfo.data;
    const deletedInt = newRevIsDeleted ? 1 : 0;

    const id = data._id;
    const rev = data._rev;
    const json = stringifyDoc(data);
    const sql =
      'INSERT INTO ' + BY_SEQ_STORE + ' (doc_id, rev, json, deleted) VALUES (?, ?, ?, ?);';
    const sqlArgs = [id, rev, json, deletedInt];

    try {
      const result = await db.run(sql, sqlArgs);
      if (result.changes && result.changes.lastId) {
        const seq = result.changes.lastId;
        await insertAttachmentMappings(seq);
        await dataWritten(db, seq);
      }
    } catch (e) {
      // Constraint error, recover by updating
      const fetchSql = select('seq', BY_SEQ_STORE, undefined, 'doc_id=? AND rev=?');
      const res = await db.query(fetchSql, [id, rev]);
      if (res.values && res.values.length > 0) {
        const seq = res.values[0].seq as number;
        logger.debug(
          `Encountered constraint error, switching to update: seq=${seq}, id=${id}, rev=${rev}`
        );
        const sql = 'UPDATE ' + BY_SEQ_STORE + ' SET json=?, deleted=? WHERE doc_id=? AND rev=?;';
        const sqlArgs = [json, deletedInt, id, rev];
        await db.run(sql, sqlArgs);
        await insertAttachmentMappings(seq);
        await dataWritten(db, seq);
      } else {
        throw e;
      }
    }
  }

  /**
   * Process documents
   */
  function websqlProcessDocs(): Promise<void> {
    return new Promise((resolve, reject) => {
      let chain = Promise.resolve();
      processDocs(
        dbOpts.revs_limit,
        docInfos,
        api,
        fetchedDocs,
        db,
        results,
        (
          docInfo: DocInfo,
          winningRev: string,
          winningRevIsDeleted: boolean,
          newRevIsDeleted: boolean,
          isUpdate: boolean,
          delta: number,
          resultsIdx: number,
          callback: (err?: any) => void
        ) => {
          chain = chain.then(() => {
            return writeDoc(
              docInfo,
              winningRev,
              winningRevIsDeleted,
              newRevIsDeleted,
              isUpdate,
              delta,
              resultsIdx
            ).then(() => callback(), callback);
          });
        },
        opts,
        (err?: any) => {
          if (!err) resolve();
          else reject(err);
        }
      );
    });
  }

  /**
   * Fetch existing documents
   */
  async function fetchExistingDocs(): Promise<void> {
    console.log('fetch...');
    if (!docInfos.length) return;

    for (const docInfo of docInfos) {
      if (docInfo._id && isLocalId(docInfo._id)) {
        continue;
      }
      const id = docInfo.metadata.id;
      const result = await db.query('SELECT json FROM ' + DOC_STORE + ' WHERE id = ?', [id]);
      if (result.values && result.values.length) {
        const metadata = safeJsonParse(result.values[0].json);
        fetchedDocs.set(id, metadata);
      }
    }
  }

  /**
   * Save attachment
   * @param digest Attachment digest
   * @param data Attachment data
   */
  async function saveAttachment(digest: string, data: any) {
    logger.debug('Save attachment:', digest, data);
    console.log('saving..');
    let sql = 'SELECT digest FROM ' + ATTACH_STORE + ' WHERE digest=?';
    const result = await db.query(sql, [digest]);
    if (result.values && result.values.length) return;
    const escaped = serializer ? 1 : 0;
    if (serializer) {
      logger.debug('Serializing attachment');
      data = await serializer.serialize(data).catch((e) => {
        logger.error('Error serializing attachment', e);
      });
      //logger.debug('Serializing attachment success', data);
    }
    sql = 'INSERT INTO ' + ATTACH_STORE + ' (digest, body, escaped) VALUES (?,?,?)';
    logger.debug('will run sql:', sql);
    await db.run(sql, [digest, data, escaped], {
      params: [digest, `typeof data is ${data},(this is inject for logger)`, escaped],
    });
  }

  // Preprocess attachments
  await new Promise<void>((resolve, reject) => {
    preprocessAttachments(docInfos, 'binary', (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Execute operations in transaction
  await transaction(async (txn: SQLiteDatabase) => {
    await verifyAttachments();
    try {
      db = txn;
      await fetchExistingDocs();
      await websqlProcessDocs();
      sqliteChanges.notify(api._name);
    } catch (err: any) {
      throw handleSQLiteError(err);
    }
  });

  return results;
}

export default sqliteBulkDocs;
