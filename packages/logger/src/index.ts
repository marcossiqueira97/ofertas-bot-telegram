import pino from 'pino';

const getTransportOptions = () => {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') {
    return undefined;
  }
  try {
    require.resolve('pino-pretty');
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss'
      }
    };
  } catch (err) {
    return undefined;
  }
};

export const createLogger = (name: string) => {
  return pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    redact: {
      paths: [
        '*.token',
        '*.botToken',
        '*.secret',
        '*.password',
        '*.appSecret',
        '*.apiKey',
        'authorization',
        'headers["authorization"]'
      ],
      censor: '[REDACTED]'
    },
    transport: getTransportOptions()
  });
};

export const logger = createLogger('vancod-ofertas');
