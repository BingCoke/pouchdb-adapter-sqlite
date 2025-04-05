import { debug as createDebug } from 'debug';

const debug = createDebug('pouchdb:adapter-sqlite');

/**
 * Logger
 * Provides logging at different levels
 */
export const logger = {
  /**
   * Log debug information
   * @param message Log message
   * @param args Additional arguments
   */
  debug: (message: string, ...args: any[]) => {
    debug(message, ...args);
  },

  /**
   * Log error information
   * @param message Log message
   * @param args Additional arguments
   */
  error: (message: string, ...args: any[]) => {
    console.error(message, ...args);
    debug('error: ' + message, ...args);
  },

  /**
   * Log warning information
   * @param message Log message
   * @param args Additional arguments
   */
  warn: (message: string, ...args: any[]) => {
    console.warn(message, ...args);
    debug('warn: ' + message, ...args);
  },

  /**
   * Log general information
   * @param message Log message
   * @param args Additional arguments
   */
  info: (message: string, ...args: any[]) => {
    console.info(message, ...args);
    debug('info: ' + message, ...args);
  },
};
