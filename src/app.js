import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from './config/cors.js';
import logger from './config/logger.js';
import { swaggerSetup } from './config/swagger/index.js';
import routes from './routes/index.js';
import { generateRequestId } from './common/helpers/response.helper.js';
import { errorHandler } from './common/middlewares/errorHandler.js';
import { AppError } from './common/errors/AppError.js';
import { ErrorCodes } from './common/errors/errorCodes.js';
import { HttpStatus } from './common/errors/httpStatus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware (configurado para no bloquear Swagger UI)
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

// CORS
app.use(cors);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID para correlación en logs y respuestas
app.use((req, res, next) => {
  req.requestId = generateRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Swagger documentation
swaggerSetup(app);

// Static demo pages (login / logout HTML)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', routes);

// Demo HTML at root; API info still available at /api
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 handler — delega al errorHandler global vía next(AppError)
app.use((req, res, next) => {
  next(
    new AppError({
      message: `Ruta ${req.method} ${req.path} no encontrada`,
      code: ErrorCodes.NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    }),
  );
});

// Error handler global
app.use((err, req, res, next) => {
  errorHandler(err, req, res, next);
});

export default app;
