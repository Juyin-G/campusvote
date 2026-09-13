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
import objectionRoutes from '../modules/objections/objection.routes.js';
import uploadRoutes from '../modules/upload/upload.routes.js';
import projectRoutes from '../modules/projects/project.routes.js';
import fairRoutes from '../modules/fairs/fair.routes.js';
import juryAssignmentRoutes from '../modules/juryAssignments/juryAssignment.routes.js';
import fairEvaluationRoutes from '../modules/fairEvaluations/fairEvaluation.routes.js';
import fairResultRoutes from '../modules/fairResults/fairResult.routes.js';
import fairCategoryRoutes from '../modules/fairCategories/fairCategory.routes.js';
import fairStandRoutes from '../modules/fairStands/fairStand.routes.js';

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

// Tachas e impugnaciones (bajo /elections/:id/objections)
router.use(objectionRoutes);

// Subida de archivos (imágenes/PDFs) para proyectos, avatares, etc.
router.use('/upload', uploadRoutes);

// Proyectos de ferias académicas (crear/listar/ver/editar/integrantes/revisión)
router.use('/projects', projectRoutes);

// Asignación de jurados a ferias (dominio de FERIAS; ajeno al dominio electoral).
// Se monta ANTES de fairRoutes para que el path estático /my-assignments gane
// sobre /:id, y porque JURY requiere una autorización distinta a la de ADMIN.
router.use('/fairs', juryAssignmentRoutes);

// Rúbricas y evaluaciones de proyectos de feria (dominio de FERIAS; NO mezcla
// con ratings electorales). Se monta ANTES de fairRoutes porque su path
// /my-evaluations es estático y porque JURY necesita autorización propia.
router.use('/fairs', fairEvaluationRoutes);

// Resultados/ranking de proyectos de feria (ADMIN/SUPERADMIN exclusivo).
// El cálculo se deriva de las evaluaciones; el cliente solo envía el id.
router.use('/fairs', fairResultRoutes);

// Categorías y stands de ferias (gestión ADMIN/SUPERADMIN en DRAFT; lectura
// compartida con el JURY asignado). Se montan ANTES de fairRoutes porque su
// path /:id/categories y /:id/stands comparten el prefijo de feria.
router.use('/fairs', fairCategoryRoutes);
router.use('/fairs', fairStandRoutes);

// Ferias/eventos académicos (gestión exclusiva ADMIN/SUPERADMIN)
router.use('/fairs', fairRoutes);

export default router;