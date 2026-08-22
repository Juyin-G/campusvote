import { Router } from 'express';
import authRoutes from '../modules/auth/routes/auth.routes.js';
import otpRoutes from '../modules/auth/routes/otp.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import healthRoutes from '../modules/health/health.routes.js';

const router = Router();

// Rutas de la aplicación
router.use('/auth', authRoutes); // Contiene /login, /register, etc.
router.use('/auth/otp', otpRoutes); // Contiene /setup, /verify, etc.
router.use('/users', userRoutes);
router.use('/health', healthRoutes);

export default router;