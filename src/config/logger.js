// src/config/logger.js
import winston from 'winston';
import util from 'util';
import env from './env.js';

const isDevOrTest = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

const logger = winston.createLogger({
  level: isDevOrTest ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'campusvote-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          
          if (stack) {
            msg += `\n${stack}`;
          }

          const cleanMeta = { ...meta };
          delete cleanMeta.service;

          if (Object.keys(cleanMeta).length > 0) {
            // depth: null evita que Node corte arreglos u objetos profundos
            msg += `\n${util.inspect(cleanMeta, { depth: null, colors: true })}`;
          }

          return msg;
        })
      )
    })
  ]
});

// Guardar un archivo dedicado exclusivo para tus pruebas
if (env.NODE_ENV === 'test') {
  logger.add(new winston.transports.File({ filename: 'logs/test.log' }));
}

export default logger;