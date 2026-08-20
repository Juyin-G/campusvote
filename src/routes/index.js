import { Router } from 'express';
import authRoutes from '../modules/auth/routes/auth.routes.js';
import healthRoutes from '../modules/health/health.routes.js';

const router = Router();

// Rutas de la aplicación
router.use('/auth', authRoutes);
router.use('/health', healthRoutes);

export default router;