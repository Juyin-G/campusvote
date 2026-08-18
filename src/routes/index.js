import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from '../modules/health/health.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);

export default router;