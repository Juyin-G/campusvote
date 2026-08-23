// src/app.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import helmet from 'helmet';
import compression from 'compression'; // OPCIONAL: npm i compression
import rateLimit from 'express-rate-limit'; // OPCIONAL: npm i express-rate-limit

import cors from './config/cors.js';
import logger from './config/logger.js';
import { swaggerSetup } from './config/swagger/index.js';
import routes from './routes/index.js';

import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Confianza en proxies inversos (Nginx, Cloudflare, Render, Heroku)
app.set('trust proxy', 1);

// Limitador de peticiones para evitar abuso de la API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 peticiones por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, message: 'Demasiadas solicitudes, intenta más tarde.' },
});

// Seguridad y Optimización
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors);
app.use('/api', limiter); // Aplica limitador solo a la API

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID para correlación en logs y respuestas
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
});

// Endpoint de Health Check (Monitoreo del servicio)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Documentación Swagger
swaggerSetup(app);

// Archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Rutas de la API
app.use('/api', routes);

// Vista demo en la raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Manejo de rutas no encontradas (404)
app.use(notFoundHandler);

// Manejo global de errores
app.use(errorHandler);

export default app;