import pino from 'pino';

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  format: 'console' | 'json';
}

export class Logger {
  private logger: pino.Logger;

  constructor(config: LoggerConfig) {
    const options: pino.LoggerOptions = {
      level: config.level,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    if (config.format === 'console') {
      options.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      };
    }

    this.logger = pino(options);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(meta || {}, message);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(meta || {}, message);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(meta || {}, message);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(meta || {}, message);
  }

  fatal(message: string, meta?: Record<string, unknown>): void {
    this.logger.fatal(meta || {}, message);
  }

  child(bindings: Record<string, unknown>): Logger {
    const childLogger = this.logger.child(bindings);
    const child = new Logger({ level: 'info', format: 'json' });
    child.logger = childLogger;
    return child;
  }
}
