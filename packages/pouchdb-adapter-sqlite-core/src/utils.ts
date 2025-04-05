import { safeJsonParse, safeJsonStringify } from 'pouchdb-json';
import { createError, WSQ_ERROR } from 'pouchdb-errors';

import { guardedConsole } from 'pouchdb-utils';
import { SQLiteDatabase } from './interfaces';
import { BY_SEQ_STORE, ATTACH_AND_SEQ_STORE } from './constants';

/**
 * Convert document object to JSON string
 * @param doc Document object
 * @returns JSON string
 */
export function stringifyDoc(doc: any): string {
  delete doc._id;
  delete doc._rev;
  return safeJsonStringify(doc);
}
export function escapeBlob(str: string) {
  return str
    .replace(/\u0002/g, '\u0002\u0002')
    .replace(/\u0001/g, '\u0001\u0002')
    .replace(/\u0000/g, '\u0001\u0001');
}
export function unescapeBlob(str: string) {
  return str
    .replace(/\u0001\u0001/g, '\u0000')
    .replace(/\u0001\u0002/g, '\u0001')
    .replace(/\u0002\u0002/g, '\u0002');
}

/**
 * Convert JSON string to document object
 * @param doc JSON string
 * @param id Document ID
 * @param rev Document revision
 * @param attachments Attachments object
 * @returns Document object
 */
export function unstringifyDoc(doc: string, id: string, rev: string, attachments?: any): any {
  const result = safeJsonParse(doc);
  if (!result) {
    return null;
  }
  result._id = id;
  result._rev = rev;
  if (attachments) {
    result._attachments = attachments;
  }
  return result;
}

/**
 * Build SELECT SQL statement
 * @param what Columns to select
 * @param table Table name
 * @param join Join condition
 * @param where WHERE condition
 * @param orderBy Order by condition
 * @returns SQL statement
 */
export function select(
  what: string,
  table: string | string[],
  join?: string,
  where?: string | string[],
  orderBy?: string
): string {
  let sql = 'SELECT ' + what + ' FROM ';
  const tables = Array.isArray(table) ? table : [table];
  sql += tables.join(', ');
  if (join) {
    sql += ' ON ' + join;
  }
  if (where) {
    sql += ' WHERE ';
    if (Array.isArray(where)) {
      sql += where.join(' AND ');
    } else {
      sql += where;
    }
  }
  if (orderBy) {
    sql += ' ORDER BY ' + orderBy;
  }
  return sql;
}

/**
 * Generate specified number of question mark placeholders
 * @param num Number of placeholders
 * @returns Question mark placeholders string
 */
export function qMarks(num: number): string {
  const qMarks: string[] = [];
  for (let i = 0; i < num; i++) {
    qMarks.push('?');
  }
  return '(' + qMarks.join(',') + ')';
}

/**
 * Compact revisions
 * Delete obsolete revisions and their associated attachments
 * @param revs Revisions array to compact
 * @param docId Document ID
 * @param db Database connection
 */
export async function compactRevs(
  revs: string[],
  docId: string,
  db: SQLiteDatabase
): Promise<void> {
  if (!revs.length) {
    return;
  }
  const seqs: number[] = [];
  for (const rev of revs) {
    const sql = 'SELECT seq FROM ' + BY_SEQ_STORE + ' WHERE doc_id=? AND rev=?';
    const result = await db.query(sql, [docId, rev]);
    if (result.values && result.values.length > 0) {
      seqs.push(result.values[0].seq as number);
    }
  }

  if (seqs.length) {
    await deleteOrphans(seqs, db);
  }
}

/**
 * Delete orphaned attachments and revisions
 * @param seqs Sequence numbers array
 * @param db Database connection
 */
async function deleteOrphans(seqs: number[], db: SQLiteDatabase): Promise<void> {
  // Delete orphaned attachments
  const sql =
    'SELECT DISTINCT digest AS digest FROM ' +
    ATTACH_AND_SEQ_STORE +
    ' WHERE seq IN (' +
    seqs.map(() => '?').join(',') +
    ') EXCEPT SELECT digest FROM ' +
    ATTACH_AND_SEQ_STORE +
    ' WHERE seq NOT IN (' +
    seqs.map(() => '?').join(',') +
    ')';
  const res = await db.query(sql, [...seqs, ...seqs]);
  if (res.values && res.values.length > 0) {
    const digests = res.values.map((row) => row.digest);
    for (const digest of digests) {
      await db.run(
        'DELETE FROM ' +
          ATTACH_AND_SEQ_STORE +
          ' WHERE seq IN (' +
          seqs.map(() => '?').join(',') +
          ') AND digest=?',
        [...seqs, digest]
      );
      await db.run('DELETE FROM attachments WHERE digest=?', [digest]);
    }
  }
  // Delete document revisions
  await db.run(
    'DELETE FROM ' + BY_SEQ_STORE + ' WHERE seq IN (' + seqs.map(() => '?').join(',') + ')',
    seqs
  );
}

/**
 * Handle SQLite error
 * @param event Error object
 * @param callback Callback function
 */
export function handleSQLiteError(event: Error, callback?: (err: any) => void): any {
  guardedConsole('error', 'SQLite threw an error', event);
  // event may actually be a SQLError object, so report is as such
  const errorNameMatch = event && event.constructor.toString().match(/function ([^(]+)/);
  const errorName = (errorNameMatch && errorNameMatch[1]) || event.name;
  const errorReason = event.message;
  const error = createError(WSQ_ERROR, errorReason, errorName);
  if (callback) callback(error);
  else return error;
}
