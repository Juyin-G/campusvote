/**
 * @file env.js
 * @description Configuración centralizada y validada de variables de entorno
 */

import dotenv from 'dotenv';

dotenv.config();

// Lista negra de claves inseguras conocidas (valores exactos)
const INSECURE_DEFAULT_SECRETS = new Set([
  'dev-secret-change-me-in-production',
  'your-super-secret-jwt-key-change-this-in-production',
  'your-super-secret-jwt-key-change-this-in-production-must-be-at-least-32-chars',
  'tu-refresh-secret-key-diferente',
  'secret',
  'secret123',
  'supersecret',
  '12345678901234567890123456789012',
  'change_me',
  'jwt_secret'
]);

const validateSecret = (secret, secretName) => {
  if (!secret || secret.trim() === '') {
    throw new Error(`FATAL: ${secretName} no está configurado.`);
  }

  // 1. Longitud mínima de 32 caracteres (fuerza la entropía)
  if (secret.length < 32) {
    throw new Error(`FATAL: ${secretName} debe tener al menos 32 caracteres.`);
  }

  // 2. Coincidencia exacta con la lista negra
  const normalizedSecret = secret.trim().toLowerCase();
  if (INSECURE_DEFAULT_SECRETS.has(normalizedSecret)) {
    throw new Error(
      `FATAL: ${secretName} utiliza una clave insegura, predecible o de ejemplo.`
    );
  }
};

const validateEnv = () => {
  // Validar base de datos en todos los entornos
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    throw new Error('FATAL: DATABASE_URL no está configurada.');
  }

  // Validar secretos JWT en todos los entornos
  validateSecret(process.env.JWT_SECRET, 'JWT_SECRET');

  if (process.env.JWT_REFRESH_SECRET) {
    validateSecret(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
  }
};

validateEnv();

export default {
  // Server
  NODE_ENV: (process.env.NODE_ENV || 'development').toLowerCase().trim(),
  PORT: parseInt(process.env.PORT, 10) || 3000,
  APP_NAME: process.env.APP_NAME || 'CampusVote',
  APP_VERSION: process.env.APP_VERSION || '1.0.0',

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
  LOCK_TIME_MINUTES: parseInt(process.env.LOCK_TIME_MINUTES, 10) || 15,

  // Email
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || 'noreply@campusvote.com',

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,

  // Frontend URL
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};