import { Router } from 'express';
import authRoutes from '../modules/auth/routes/auth.routes.js';
import otpRoutes from '../modules/auth/routes/otp.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import healthRoutes from '../modules/health/health.routes.js';
import organizationRoutes from '../modules/organizations/organization.routes.js';
import academicRoutes from '../modules/academic/academic.routes.js';

const router = Router();

// Rutas de la aplicación
router.use('/auth', authRoutes);
router.use('/auth/otp', otpRoutes);
router.use('/users', userRoutes);
router.use('/organizations', organizationRoutes);
router.use('/academic', academicRoutes);
router.use('/health', healthRoutes);

export default router;