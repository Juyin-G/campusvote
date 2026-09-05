// src/config/cors.js

import cors from 'cors';
import env from './env.js';

const configuredOrigins = String(env.CORS_ORIGIN)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  // Local development uses both the Vite default and the project's configured port.
  'http://localhost:3000',
  'http://localhost:5173',
  'https://campusvote-front.onrender.com',
]);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

export default cors(corsOptions);