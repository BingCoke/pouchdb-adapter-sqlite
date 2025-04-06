import {
  BinarySerializer,
  SQLiteAdapter,
  SQLiteLoggerAdapter,
  SQLiteExecuteResult,
  SQLiteQueryResult,
  SqlLogOptions,
} from './interfaces';
import { logger } from './logger';

export class LoggerSqliteAdapterWarpper implements SQLiteLoggerAdapter {
  private adapter: SQLiteAdapter;
  constructor(adapter: SQLiteAdapter) {
    this.adapter = adapter;
    this.serializer = adapter.serializer;
    this.createBlob = adapter.createBlob?.bind(adapter);
    this.btoa = adapter.btoa?.bind(adapter);
  }
  serializer?: BinarySerializer | undefined;
  createBlob?: ((binary: any, type: any) => any) | undefined;
  btoa?: ((data: any) => any) | undefined;
  query(sql: string, params?: any[], opt?: SqlLogOptions): Promise<SQLiteQueryResult> {
    const logParams = opt?.params ?? params;

    logger.debug(`query: sql %o params %o`, sql, logParams);

    const result = this.adapter.query(sql, params);
    if (opt && !opt.notlogResult)
      logger.debug(`query sql %o with params %o success! result: %o`, sql, logParams, result);
    else
      logger.debug(`query sql %o with params %o success but not log result by opt`, sql, logParams);

    return result;
  }
  async run(sql: string, params?: any[], opt?: SqlLogOptions) {
    const logParams = opt?.params ?? params;
    logger.debug(`run: sql %o params %o`, sql, logParams);
    const result = await this.adapter.run(sql, params);
    if (opt && !opt.notlogResult)
      logger.debug(`run sql %o with params %o success! result: %o`, sql, logParams, result);
    else
      logger.debug(`run sql %o with params %o success but not log result by opt`, sql, logParams);
    return result;
  }
  async execute(sql: string, opt?: SqlLogOptions) {
    const logParams = opt?.params ?? [];
    logger.debug(`execute: sql %o params %o`, sql, logParams);
    const result = this.adapter.execute(sql);
    logger.debug(`execute sql %o success`, sql, logParams);
    return result;
  }
  async beginTransaction() {
    logger.debug(`beginTransaction`);
    this.adapter.beginTransaction();
    logger.debug(`beginTransaction success`);
  }
  async commitTransaction() {
    logger.debug(`commitTransaction`);
    this.adapter.commitTransaction();
    logger.debug(`commitTransaction success`);
  }
  async rollbackTransaction() {
    logger.debug(`rollbackTransaction`);
    this.adapter.rollbackTransaction();
    logger.debug(`rollbackTransaction success`);
  }
}
