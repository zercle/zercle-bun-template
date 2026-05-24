import pino, { type Logger as PinoLogger } from 'pino';

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  fatal(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
  getLevel(): string;
}

function createPinoLogger(level: string, format: string): PinoLogger {
  const opts: pino.LoggerOptions = { level };

  if (format === 'text') {
    opts.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(opts);
}

function wrapPino(p: PinoLogger): Logger {
  return {
    debug: (msg, fields) => (fields ? p.debug(fields, msg) : p.debug(msg)),
    info: (msg, fields) => (fields ? p.info(fields, msg) : p.info(msg)),
    warn: (msg, fields) => (fields ? p.warn(fields, msg) : p.warn(msg)),
    error: (msg, fields) => (fields ? p.error(fields, msg) : p.error(msg)),
    fatal: (msg, fields) => (fields ? p.fatal(fields, msg) : p.fatal(msg)),
    child: (fields) => wrapPino(p.child(fields)),
    getLevel: () => p.level,
  };
}

export function createLogger(level: string, format: string): Logger {
  const p = createPinoLogger(level, format);
  return wrapPino(p);
}
