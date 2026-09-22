// src/app.js
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import compression from 'compression'; // OPCIONAL: npm i compression
import rateLimit from 'express-rate-limit'; // OPCIONAL: npm i express-rate-limit

import cors from './config/cors.js';
import logger from './config/logger.js';
import env from './config/env.js';
import routes from './routes/index.js';
import { ApiError } from './shared/errors/ApiError.js';

import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Confianza en proxies inversos (Nginx, Cloudflare, Render, Heroku).
// Render y Heroku colocan un único proxy delante del proceso: `trust proxy = 1`
// le indica a Express que confíe en la primera IP de X-Forwarded-For para
// resolver `req.ip`. NO debe usarse `true` (confiar ciegamente en headers
// del cliente permitiría spoofing de IP).
app.set('trust proxy', 1);

// Handler que delega en el error handler global para mantener el formato
// de respuesta 429 consistente con el resto de errores de la API
// ({ success: false, error: { code, message }, timestamp, path }).
// Los headers RateLimit-* y Retry-After son fijados por express-rate-limit
// antes de invocar el handler.
const rateLimitHandler = (req, res, next, options) => {
  const customMessage =
    options?.message && typeof options.message === 'object'
      ? options.message.message
      : typeof options?.message === 'string'
        ? options.message
        : 'Demasiadas solicitudes, intenta más tarde.';
  const retryAfterSeconds = Math.ceil((options?.windowMs || 0) / 1000);
  next(
    ApiError.tooManyRequests(
      customMessage,
      { retryAfterSeconds, code: 'GLOBAL_RATE_LIMITED' },
      'GLOBAL_RATE_LIMITED'
    )
  );
};

// Limitador de peticiones para evitar abuso de la API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: env.RATE_LIMIT_MAX_REQUESTS ?? 100, // Configurable; subir en producción (p. ej. 1000)
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Seguridad y Optimización
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);
app.use(compression());
app.use(cors);
app.use('/api', limiter); 

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

// Documentación Swagger (carga bajo demanda: en entornos de test no se
// arrastra la cadena ESM de swagger-jsdoc/json-schema-ref-parser)
if (env.SWAGGER_ENABLED !== false && env.NODE_ENV !== 'test') {
  const { swaggerSetup } = await import('./config/swagger/index.js');
  swaggerSetup(app);
}

// El frontend se despliega como servicio independiente. El backend no debe
// asumir que existe una carpeta `public` en Render.
const publicDirectory = path.join(__dirname, '../public');
app.use(express.static(publicDirectory));

// Rutas de la API
app.use('/api', routes);

// Información del servicio en la raíz. La interfaz web vive en el servicio
// frontend y consume esta API mediante /api.
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'CampusVote API',
    status: 'UP',
    health: '/health',
    documentation: env.SWAGGER_ENABLED !== false ? '/api-docs' : null,
  });
});

// Manejo de rutas no encontradas (404)
app.use(notFoundHandler);

// Manejo global de errores
app.use(errorHandler);

export default app;