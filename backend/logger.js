/**
 * Structured JSON logger for Condoos API.
 * Outputs JSON lines in production, pretty-prints in development.
 * Drop-in replacement for console.log with structured context.
 */

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_TEST = NODE_ENV === "test";
const IS_PRODUCTION = NODE_ENV === "production";

function formatMessage(level, msg, context = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...context,
  };

  if (IS_TEST) {
    return null; // Suppress logs in test
  }

  if (IS_PRODUCTION) {
    return JSON.stringify(entry);
  }

  // Dev: human-readable format
  const { ts, ...rest } = entry;
  const contextStr = Object.keys(rest).length > 2
    ? ` ${JSON.stringify(rest)}`
    : "";
  return `[${ts}] ${level.toUpperCase()} ${msg}${contextStr}`;
}

export const logger = {
  info(msg, context = {}) {
    const formatted = formatMessage("info", msg, context);
    if (formatted) console.log(formatted);
  },

  warn(msg, context = {}) {
    const formatted = formatMessage("warn", msg, context);
    if (formatted) console.warn(formatted);
  },

  error(msg, context = {}) {
    const formatted = formatMessage("error", msg, context);
    if (formatted) console.error(formatted);
  },

  debug(msg, context = {}) {
    if (IS_PRODUCTION) return;
    const formatted = formatMessage("debug", msg, context);
    if (formatted) console.log(formatted);
  },

  /**
   * Create a child logger with bound context fields.
   * @param {Object} bindings - Fields added to every log entry
   */
  child(bindings = {}) {
    return {
      info: (msg, ctx = {}) => logger.info(msg, { ...bindings, ...ctx }),
      warn: (msg, ctx = {}) => logger.warn(msg, { ...bindings, ...ctx }),
      error: (msg, ctx = {}) => logger.error(msg, { ...bindings, ...ctx }),
      debug: (msg, ctx = {}) => logger.debug(msg, { ...bindings, ...ctx }),
    };
  },
};
