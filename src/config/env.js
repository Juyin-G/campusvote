/**
 * @file env.js
 * @description Configuración centralizada de variables de entorno
 */

import dotenv from 'dotenv';

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
} else {
  dotenv.config();
}

const INSECURE_DEFAULT_SECRETS = [
  'dev-secret-change-me-in-production',
  'your-super-secret-jwt-key-change-this-in-production',
  'your-super-secret-jwt-key-change-this-in-production-must-be-at-least-32-chars',
  'tu-refresh-secret-key-diferente',
  'secret',
  'secret123',
  'supersecret',
  '12345678901234567890123456789012'
];

const validateSecret = (secret, secretName) => {
  if (!secret) {
    throw new Error(`FATAL: ${secretName} no está configurado.`);
  }

  // Validación de longitud mínima (Requisito de seguridad crítico)
  if (secret.length < 32) {
    throw new Error(`FATAL: ${secretName} debe tener al menos 32 caracteres.`);
  }

  // Normalización para evitar evadir la lista con mayúsculas o espacios
  const normalizedSecret = secret.trim().toLowerCase();
  const isBlacklisted = INSECURE_DEFAULT_SECRETS.some((insecure) =>
    normalizedSecret.includes(insecure.toLowerCase())
  );

  if (isBlacklisted) {
    throw new Error(
      `FATAL: ${secretName} utiliza una clave insegura, predecible o de ejemplo.`
    );
  }
};

const validateEnv = () => {
  validateSecret(process.env.JWT_SECRET, 'JWT_SECRET');

  if (process.env.JWT_REFRESH_SECRET) {
    validateSecret(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
  }
};

validateEnv();

export default {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  APP_NAME: process.env.APP_NAME || 'CampusVote',
  APP_VERSION: process.env.APP_VERSION || '1.0.0',

  // URLs publicas que anuncia la documentacion de Swagger. Si no se definen,
  // swagger usa una URL relativa, que ya resuelve bien en cualquier entorno.
  APP_URL: process.env.APP_URL,
  STAGE_API_URL: process.env.STAGE_API_URL,
  PROD_API_URL: process.env.PROD_API_URL,

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