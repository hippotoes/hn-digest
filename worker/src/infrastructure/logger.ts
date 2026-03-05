import pino from 'pino';
import { config } from '../config';

const isDev = config.env.NODE_ENV !== 'production';

export const logger = pino({
  level: config.env.LOG_LEVEL,
  base: {
    env: config.env.NODE_ENV,
    service: 'hn-worker'
  },

  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard',
    },
  } : /* v8 ignore next */ undefined,
});

export default logger;
