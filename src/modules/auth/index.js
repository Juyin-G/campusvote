import { Router } from 'express';

// Rutas
import authRoutes from './routes/auth.routes.js';
import otpRoutes from './routes/otp.routes.js';

// Documentación
import { authDocs } from './docs/auth.docs.js';
import { otpDocs } from './docs/otp.docs.js';

const router = Router();

// Enrutamiento principal del módulo
router.use('/', authRoutes);
router.use('/otp', otpRoutes);

// Exportación del enrutador principal
export { router as authRouter };

// Unificación de documentación OpenAPI/Swagger del módulo
export const authModuleDocs = {
  ...authDocs,
  ...otpDocs,
};

// Re-exportaciones centralizadas (Barrel Pattern) para otros módulos
export * as authController from './controllers/auth.controller.js';
export * as otpController from './controllers/otp.controller.js';

export * as authService from './services/auth.service.js';
export * as otpService from './services/auth.totp.service.js';

export * as authRepository from './repositories/auth.repository.js';
export * as otpRepository from './repositories/otp.repository.js';

export * as authSchemas from './schemas/auth.schema.js';
export * as otpSchemas from './schemas/otp.schema.js';

export default router;