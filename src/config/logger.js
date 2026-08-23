// src/config/logger.js
import winston from 'winston';
import util from 'util';
import env from './env.js';

const isDevOrTest = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

// Formato personalizado para la consola (desarrollo)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: false }), // Colorea solo la etiqueta del nivel
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, category, stack, ...meta }) => {
    // Etiqueta de categoría opcional (ej: [HTTP], [SERVER], [AUTH])
    const categoryTag = category ? `[${category.toUpperCase()}] ` : '';
    let msg = `${timestamp} ${level}: ${categoryTag}${message}`;

    if (stack) {
      msg += `\n${stack}`;
    }

    const cleanMeta = { ...meta };
    delete cleanMeta.service;

    // Limpia símbolos internos de Winston
    Object.getOwnPropertySymbols(cleanMeta).forEach((sym) => {
      delete cleanMeta[sym];
    });

    if (Object.keys(cleanMeta).length > 0) {
      msg += `\n${util.inspect(cleanMeta, { depth: null, colors: true })}`;
    }

    return msg;
  })
);

// Formato JSON limpio para archivos
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: isDevOrTest ? 'debug' : 'info',
  defaultMeta: { service: 'campusvote-api' },
  transports: [
    // 1. Salida en Consola
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // 2. Archivo exclusivo para ERRORES (Solo nivel ERROR)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
    }),

    // 3. Archivo general COMBINADO (INFO, WARN, ERROR, DEBUG)
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
    }),
  ],
});

if (env.NODE_ENV === 'test') {
  logger.add(new winston.transports.File({ filename: 'logs/test.log', format: fileFormat }));
}

export default logger;