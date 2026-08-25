/**
 * @file env.js
 * @description Configuración centralizada de variables de entorno
 */

import dotenv from 'dotenv';

dotenv.config();

const INSECURE_DEFAULT_SECRETS = [
  'dev-secret-change-me-in-production',
  'your-super-secret-jwt-key-change-this-in-production',
  'tu-refresh-secret-key-diferente',
  'secret',
  'secret123',
];

const validateEnv = () => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtSecret || INSECURE_DEFAULT_SECRETS.includes(jwtSecret)) {
    throw new Error(
      'FATAL: JWT_SECRET no está configurado o utiliza una clave insegura por defecto.'
    );
  }

  if (jwtRefreshSecret && INSECURE_DEFAULT_SECRETS.includes(jwtRefreshSecret)) {
    throw new Error(
      'FATAL: JWT_REFRESH_SECRET utiliza una clave insegura por defecto.'
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

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

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