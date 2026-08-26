import { Router } from 'express';

import authRoutes from '../modules/auth/routes/auth.routes.js';
import otpRoutes from '../modules/auth/routes/otp.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import healthRoutes from '../modules/health/health.routes.js';
import organizationRoutes from '../modules/organizations/organization.routes.js';
import academicRoutes from '../modules/academic/academic.routes.js';
import electionRoutes from '../modules/elections/election.routes.js';
import ballotRoutes from '../modules/ballots/ballot.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';

const router = Router();

// Monitoreo de estado
router.use('/health', healthRoutes);

// Autenticación y Usuarios
router.use('/auth', authRoutes);
router.use('/auth/otp', otpRoutes);
router.use('/users', userRoutes);

// Dominio Académico e Institucional
router.use('/organizations', organizationRoutes);
router.use('/academic', academicRoutes);

// Proceso Electoral
router.use('/elections', electionRoutes);
router.use('/ballots', ballotRoutes);

// Auditoría y Tokens de Un Solo Uso
router.use('/audit', auditRoutes);

export default router;