// src/routes/index.js
// Separación PLATFORM ROUTES (SUPERADMIN) vs TENANT ROUTES (ADMIN).
// Las Tenant Routes se montan bajo un sub-router que aplica
// blockSuperAdminFromTenantRoutes antes de cualquier authorize().

import { Router } from 'express';

// ── AUTH & USERS ──────────────────────────────────────────────────────
import authRoutes from '../modules/auth/routes/auth.routes.js';
import otpRoutes from '../modules/auth/routes/otp.routes.js';
import {
  default as userRoutes,
  platformUsersRouter,
} from '../modules/users/user.routes.js';
import userRoutesExtra from '../modules/users/user.routes.extra.js';

// ── CORE & PLATFORM ───────────────────────────────────────────────────
import healthRoutes from '../modules/health/health.routes.js';
import organizationRoutes from '../modules/organizations/organization/organization.routes.js';
import platformTranslationRoutes from '../modules/PlatformTranslation/PlatformTranslation.routes.js';
import gmailTestRoutes from '../modules/admin/gmailTest.routes.js';

// ── ACADEMIC & AUDIT ──────────────────────────────────────────────────
// ⚠️ IMPORTANTE: Estos imports aparecen UNA SOLA VEZ.
import academicRoutes from '../modules/academic/academic.routes.js';
import voterRegistryPlatformRoutes from '../modules/academic/voter-registry/voter-registry.platform.routes.js'; // ✅ NUEVO
import auditRoutes from '../modules/audit/audit.routes.js';

// ── NOTIFICATIONS & UPLOAD ────────────────────────────────────────────
import notificationRoutes from '../modules/notification/notification.routes.js';
import uploadRoutes from '../modules/upload/upload.routes.js';

// ── PROJECTS & FAIRS ──────────────────────────────────────────────────
import projectRoutes from '../modules/projects/project.routes.js';
import fairRoutes from '../modules/fairs/fair.routes.js';
import juryAssignmentRoutes from '../modules/juryAssignments/juryAssignment.routes.js';
import fairEvaluationRoutes from '../modules/fairEvaluations/fairEvaluation.routes.js';
import fairVotingRoutes from '../modules/fairVoting/fairVoting.routes.js';
import fairEngagementRoutes from '../modules/fairEngagement/fairEngagement.routes.js';
import fairResultRoutes from '../modules/fairResults/fairResult.routes.js';
import fairCategoryRoutes from '../modules/fairCategories/fairCategory.routes.js';
import fairJuryCategoryAssignmentRoutes from '../modules/fairJuryCategoryAssignments/fairJuryCategoryAssignment.routes.js';
import fairStandRoutes from '../modules/fairStands/fairStand.routes.js';

// ── CERTIFICATES ──────────────────────────────────────────────────────
import {
  fairCertificatesRouter,
  certificatesRouter,
} from '../modules/certificate/certificate.routes.js';

// ── ADMIN SCOPE ───────────────────────────────────────────────────────
import adminScopeRoutes from '../modules/adminScope/adminScope.routes.js';

// ── JURADOS EXTERNOS (aceptados por dominio) ──────────────────────────
import externalJuryRoutes from '../modules/externalJuries/externalJury.routes.js';

// ── MIDDLEWARES ───────────────────────────────────────────────────────
import { blockSuperAdminFromTenantRoutes } from '../middlewares/platformBoundary.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// ────────────────────────────────────────────────────────────────────────
// RUTAS PÚBLICAS / MIXTAS (sin restricción de plataforma)
// ────────────────────────────────────────────────────────────────────────

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/auth/otp', otpRoutes);
router.use('/users', platformUsersRouter);

// ────────────────────────────────────────────────────────────────────────
// PLATFORM ROUTES (exclusivo SUPERADMIN)
// Se montan SIN blockSuperAdminFromTenantRoutes.
// ────────────────────────────────────────────────────────────────────────

router.use('/organizations', organizationRoutes);
router.use('/platform/translations', platformTranslationRoutes);
router.use(gmailTestRoutes);

// ✅ NUEVO: Ruta de plataforma para sync-sis (fuera del tenantRouter)
router.use('/academic/voter-registries', voterRegistryPlatformRoutes);

// ────────────────────────────────────────────────────────────────────────
// TENANT ROUTES — bloqueadas para SUPERADMIN
// ────────────────────────────────────────────────────────────────────────

const tenantRouter = Router();
tenantRouter.use(authenticate);
tenantRouter.use(blockSuperAdminFromTenantRoutes);

// Dominio Académico e Institucional
tenantRouter.use('/academic', academicRoutes);

// Usuarios del tenant
tenantRouter.use('/users', userRoutes);
tenantRouter.use('/users', userRoutesExtra);

// Notificaciones y Upload
tenantRouter.use('/notifications', notificationRoutes);
tenantRouter.use('/upload', uploadRoutes);

// Proyectos y Ferias
tenantRouter.use('/projects', projectRoutes);
tenantRouter.use('/certificates', certificatesRouter);
tenantRouter.use('/fairs', juryAssignmentRoutes);
tenantRouter.use('/fairs', fairEvaluationRoutes);
tenantRouter.use('/fairs', fairVotingRoutes);
tenantRouter.use('/fairs', fairEngagementRoutes);
tenantRouter.use('/fairs', fairResultRoutes);
tenantRouter.use('/fairs', fairCertificatesRouter);
tenantRouter.use('/fairs', fairCategoryRoutes);
tenantRouter.use('/fairs', fairJuryCategoryAssignmentRoutes);
tenantRouter.use('/fairs', fairStandRoutes);
tenantRouter.use('/fairs', fairRoutes);

// Auditoría y Admin Scope
tenantRouter.use('/audit', auditRoutes);
tenantRouter.use('/admin', adminScopeRoutes);
tenantRouter.use('/admin/jury', externalJuryRoutes);

router.use(tenantRouter);

export default router;