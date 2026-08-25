/**
 * @file env.js
 * @description Configuración centralizada y validada de variables de entorno
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Lista de valores inseguros conocidos que no deben usarse como secretos JWT
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
 * Valida que un secreto JWT esté presente, no sea un valor por defecto inseguro y tenga suficiente longitud.
 * @param {string} secret - El valor de la variable de entorno
 * @param {string} secretName - Nombre de la variable (ej. 'JWT_SECRET')
 */
const validateSecret = (secret, secretName) => {
  if (!secret || secret.trim() === '') {
    throw new Error(
      `FATAL: ${secretName} es obligatorio en todos los entornos. ` +
      'Configure una clave secreta criptográficamente segura de al menos 32 caracteres.'
    );
  }

  if (INSECURE_JWT_SECRETS.includes(secret)) {
    throw new Error(
      `FATAL: ${secretName} contiene un valor inseguro conocido. ` +
      'Debe configurar una clave secreta única y criptográficamente segura.'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      `FATAL: ${secretName} debe tener al menos 32 caracteres para garantizar seguridad criptográfica. ` +
      `Longitud actual: ${secret.length} caracteres.`
    );
  }
};

/**
 * Valida que las variables críticas estén presentes y sean seguras
 */
const validateEnv = () => {
  // 1. Validar base de datos en todos los entornos
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    throw new Error('FATAL: DATABASE_URL no está configurada.');
  }

  // 2. Validar secreto principal JWT (Obligatorio)
  validateSecret(process.env.JWT_SECRET, 'JWT_SECRET');

  // 3. Validar secreto de Refresh Token si está configurado
  if (process.env.JWT_REFRESH_SECRET) {
    validateSecret(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
  }
};

// Ejecutar validación inmediata al importar el módulo
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