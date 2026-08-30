// src/routes/index.js
import { Router } from 'express';

import authRoutes from '../modules/auth/routes/auth.routes.js';
import otpRoutes from '../modules/auth/routes/otp.routes.js';
import googleRoutes from '../modules/auth/routes/google.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import healthRoutes from '../modules/health/health.routes.js';
import organizationRoutes from '../modules/organizations/organization/organization.routes.js';
import academicRoutes from '../modules/academic/academic.routes.js';
import electionRoutes from '../modules/elections/elections/election.routes.js';
import ballotRoutes from '../modules/ballots/ballot.routes.js';
import resultsRoutes from '../modules/results/results.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import platformTranslationRoutes from '../modules/PlatformTranslation/PlatformTranslation.routes.js';

import notificationRoutes from '../modules/notification/notification.routes.js';
import votingRoutes from '../modules/voting/voting.routes.js';
import votingPublicRoutes from '../modules/voting/voting.public.routes.js';
import ratingRoutes from '../modules/ratings/rating.routes.js';

const router = Router();

// Monitoreo de estado
router.use('/health', healthRoutes);

// Autenticación y Usuarios
router.use('/auth', authRoutes);
router.use('/auth', googleRoutes);
router.use('/auth/otp', otpRoutes);
router.use('/users', userRoutes);

// Dominio Académico e Institucional
router.use('/organizations', organizationRoutes);
router.use('/academic', academicRoutes);

// Proceso Electoral
router.use('/elections', electionRoutes);
router.use('/ballots', ballotRoutes);

// Resultados (certify/publish/tally/report/export viven bajo /elections/:id
// y /results/live · /results/final → se monta en la raíz para respetar paths)
router.use(resultsRoutes); 

// Auditoría y Tokens de Un Solo Uso
router.use('/audit', auditRoutes);

// Internacionalización
router.use('/platform/translations', platformTranslationRoutes);

//  Montar rutas de notificaciones
router.use('/notifications', notificationRoutes);

//  Votación
router.use('/voting', votingRoutes);

// Endpoints públicos de votación (ej. verificación de comprobante)
router.use('/public', votingPublicRoutes);

// Calificación por estrellas de proyectos en ferias/concursos (bajo /elections/:id/ratings)
router.use(ratingRoutes);

export default router;