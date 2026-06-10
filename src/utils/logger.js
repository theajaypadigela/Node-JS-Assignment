'use strict';

/**
 * Tiny structured-ish logger. Keeps a single place to swap in winston/pino
 * later without touching call sites. Timestamps every line for easier triage.
 */
const stamp = () => new Date().toISOString();

const logger = {
  info: (...args) => console.log(`[${stamp()}] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${stamp()}] [WARN]`, ...args),
  error: (...args) => console.error(`[${stamp()}] [ERROR]`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${stamp()}] [DEBUG]`, ...args);
    }
  },
};

module.exports = logger;
