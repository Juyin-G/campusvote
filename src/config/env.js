/**
 * @file env.js
 * @description Configuración centralizada de variables de entorno
 */

import dotenv from 'dotenv';

// Permite aislar la validación de variables de entorno en tests de seguridad:
// si CAMPUSVOTE_SKIP_DOTENV=1, no se carga ningún archivo .env, de modo que la
// configuración depende exclusivamente de process.env del proceso.
if (!process.env.CAMPUSVOTE_SKIP_DOTENV) {
  if (process.env.NODE_ENV === 'test') {
    dotenv.config({ path: '.env.test' });
  } else {
    dotenv.config();
  }
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
  // Blacklist de claves por defecto/ejemplo completas. Se compara por
  // igualdad normalizada (no por substring) para no rechazar secretos
  // legítimos que simplemente contengan palabras como "secret" embebidas
  // (p. ej. "my-app-jwt-secret-key-abc123-...").
  const isBlacklisted = INSECURE_DEFAULT_SECRETS.some(
    (insecure) => normalizedSecret === insecure.toLowerCase()
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

  // AUDIT_SECRET_KEY: si está definida se valida su robustez (firma HMAC de
  // la cadena de auditoría). Es opcional al arrancar: cuando está ausente, el
  // encadenado se registra sin firma criptográfica hasta que se provea la clave.
  if (process.env.AUDIT_SECRET_KEY) {
    validateSecret(process.env.AUDIT_SECRET_KEY, 'AUDIT_SECRET_KEY');
  }
};

validateEnv();

const parseSwaggerEnabled = () => {
  const raw = process.env.SWAGGER_ENABLED;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
};

export default {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  APP_NAME: process.env.APP_NAME || 'CampusVote',
  APP_VERSION: process.env.APP_VERSION || '1.0.0',

  // URLs públicas / Swagger
  APP_URL: process.env.APP_URL,
  STAGE_API_URL: process.env.STAGE_API_URL,
  PROD_API_URL: process.env.PROD_API_URL,
  SWAGGER_ENABLED: parseSwaggerEnabled(),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || undefined,

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
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
  LOCK_TIME_MINUTES: parseInt(process.env.LOCK_TIME_MINUTES, 10) || 15,

  // Upload (límites configurables)
  UPLOAD_MAX_FILE_SIZE_MB: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB, 10) || 5,
  UPLOAD_MAX_FILES: parseInt(process.env.UPLOAD_MAX_FILES, 10) || 3,

  // Auditoría (clave HMAC del encadenado) y worker de notificaciones
  AUDIT_SECRET_KEY: process.env.AUDIT_SECRET_KEY,
  NOTIFICATION_WORKER_ENABLED: process.env.NOTIFICATION_WORKER_ENABLED || 'false',

  // Email — Gmail API (OAuth2)
  GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
  GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
  GMAIL_FROM: process.env.GMAIL_FROM,

  // Gmail API OAuth2. Nunca se expone al frontend.
  GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
  GMAIL_FROM: process.env.GMAIL_FROM,

  // Firebase Authentication (opcional; login Google desde Flutter/Web)
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  UPLOAD_STORAGE_DRIVER:
    process.env.UPLOAD_STORAGE_DRIVER || (process.env.NODE_ENV === 'production' ? 'firebase' : 'local'),

  // Frontend URL
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};