/**
 * @file env.js
 * @description Configuración centralizada de variables de entorno
 * @note Todas las variables críticas deben validarse al arrancar
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Lista de valores inseguros conocidos que no deben usarse como JWT_SECRET
 */
const INSECURE_JWT_SECRETS = [
  'dev-secret-change-me-in-production',
  'your-super-secret-jwt-key-change-this-in-production',
  'secret',
  'test-secret',
  'change-me',
  'jwt-secret',
];

/**
 * Valida que las variables críticas estén presentes y sean seguras
 */
const validateEnv = () => {
  // Validar que JWT_SECRET esté presente en TODOS los entornos
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'FATAL: JWT_SECRET es obligatorio en todos los entornos. ' +
      'Configure una clave secreta criptográficamente segura de al menos 32 caracteres.'
    );
  }

  // Validar que JWT_SECRET no sea un valor inseguro conocido
  if (INSECURE_JWT_SECRETS.includes(process.env.JWT_SECRET)) {
    throw new Error(
      'FATAL: JWT_SECRET contiene un valor inseguro conocido. ' +
      'Debe configurar una clave secreta única y criptográficamente segura.'
    );
  }

  // Validar longitud mínima de JWT_SECRET
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET debe tener al menos 32 caracteres para garantizar seguridad criptográfica. ' +
      `Longitud actual: ${process.env.JWT_SECRET.length} caracteres.`
    );
  }

  // Validar DATABASE_URL en producción
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: DATABASE_URL es obligatorio en producción.'
    );
  }
};

validateEnv();

export default {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  APP_NAME: process.env.APP_NAME || 'CampusVote',
  APP_VERSION: process.env.APP_VERSION || '1.0.0',

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // JWT - Sin fallback inseguro, debe estar configurado explícitamente
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
  LOCK_TIME_MINUTES: parseInt(process.env.LOCK_TIME_MINUTES, 10) || 15,

  // Email (para verificación y recuperación)
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || 'noreply@campusvote.com',

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,

  // Frontend URL (para links en emails)
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};