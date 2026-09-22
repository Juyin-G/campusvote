// src/routes/index.js
// CAMBIO: separación PLATFORM ROUTES (SUPERADMIN) vs TENANT ROUTES (ADMIN).
// Las Tenant Routes se montan bajo un sub-router que aplica
// blockSuperAdminFromTenantRoutes antes de cualquier authorize().

import { Router } from 'express';

import authRoutes from '../modules/auth/routes/auth.routes.js';
import otpRoutes from '../modules/auth/routes/otp.routes.js';
import {
  default as userRoutes,
  platformUsersRouter,
} from '../modules/users/user.routes.js';
import userRoutesExtra from '../modules/users/user.routes.extra.js';
import healthRoutes from '../modules/health/health.routes.js';
import organizationRoutes from '../modules/organizations/organization/organization.routes.js';
import academicRoutes from '../modules/academic/academic.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import platformTranslationRoutes from '../modules/PlatformTranslation/PlatformTranslation.routes.js';

import notificationRoutes from '../modules/notification/notification.routes.js';
import uploadRoutes from '../modules/upload/upload.routes.js';
import gmailTestRoutes from '../modules/admin/gmailTest.routes.js';
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
import academicRoutes from '../modules/academic/academic.routes.js';
import voterRegistryPlatformRoutes from '../modules/academic/voter-registry/voter-registry.platform.routes.js'; // ✅ NUEVO
import auditRoutes from '../modules/audit/audit.routes.js';

import {
  fairCertificatesRouter,
  certificatesRouter,
} from '../modules/certificate/certificate.routes.js';

import { blockSuperAdminFromTenantRoutes } from '../middlewares/platformBoundary.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// ────────────────────────────────────────────────────────────────────────
// RUTAS PÚBLICAS / MIXTAS (sin restricción de plataforma)
// ────────────────────────────────────────────────────────────────────────

// Monitoreo de estado
router.use('/health', healthRoutes);

// Autenticación: el login puede ser invocado por cualquier rol, incluido
// SUPERADMIN; las rutas internas ya autorizan por endpoint.
router.use('/auth', authRoutes);
router.use('/auth/otp', otpRoutes);

// CAMBIO: el CRUD de usuarios académicos vive en el TENANT ROUTER (protegido
// por blockSuperAdminFromTenantRoutes). Las rutas de PROVISION (PLATFORM:
// crean organización + admin) viven como platformUsersRouter y son accesibles
// SOLO a SUPERADMIN.
router.use('/users', platformUsersRouter);

// ────────────────────────────────────────────────────────────────────────
// PLATFORM ROUTES (exclusivo SUPERADMIN)
// Se montan SIN blockSuperAdminFromTenantRoutes; el control de rol vive
// dentro de cada router (authorize([SUPERADMIN])).
// ────────────────────────────────────────────────────────────────────────

// CAMBIO: organizations ahora vive en dos capas. La raíz (/api/organizations)
// es PLATFORM (listar/crear/borrar metadatos). Las rutas internas
// (/sites, /requests, /onboarding) siguen siendo PLATFORM o TENANT según
// corresponda (ver organization.routes.js).
router.use('/organizations', organizationRoutes);

// CAMBIO: translations se mantiene como PLATFORM ADMIN (gestión de i18n de
// plataforma). Verifica authorize([ADMIN]) dentro; SUPERADMIN no entra a
// este módulo de tenant.
router.use('/platform/translations', platformTranslationRoutes);

// CAMBIO: /admin/gmail/test es PLATFORM puro (solo SUPERADMIN).
router.use(gmailTestRoutes);

router.use('/academic/voter-registries', voterRegistryPlatformRoutes);


// ────────────────────────────────────────────────────────────────────────
// TENANT ROUTES — bloqueadas para SUPERADMIN
// ────────────────────────────────────────────────────────────────────────

// CAMBIO: sub-router dedicado. Cualquier request a este árbol que traiga
// rol=SUPERADMIN es rechazado ANTES de evaluar authorize(). El orden es
// crítico: authenticate → blockSuperAdminFromTenantRoutes → authorize().
const tenantRouter = Router();
tenantRouter.use(authenticate);
tenantRouter.use(blockSuperAdminFromTenantRoutes);

// Dominio Académico e Institucional (catálogos operativos del tenant).
tenantRouter.use('/academic', academicRoutes);

// CRUD de usuarios académicos (STUDENT/TEACHER/JURY) y de admins del tenant.
// mount('/users') aplica blockSuperAdminFromTenantRoutes ANTES que
// cualquier authorize/requireActorCanActOnUser.
tenantRouter.use('/users', userRoutes);
tenantRouter.use('/users', userRoutesExtra);

// Notificaciones del tenant.
tenantRouter.use('/notifications', notificationRoutes);

// Subida de archivos (imágenes/PDFs) operada por tenant.
tenantRouter.use('/upload', uploadRoutes);

// Proyectos y Ferias: TODO el árbol de ferias cae aquí.
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

// CAMBIO: /audit/logs es TENANT. El SUPERADMIN ya no puede leer logs
// internos de una organización; sigue pudiendo registrar acciones de
// plataforma vía auditService (sin ruta HTTP).
tenantRouter.use('/audit', auditRoutes);

// Multi-sede: gestión de ADMIN ORG / ADMIN REGION / ADMIN SITE.
import adminScopeRoutes from '../modules/adminScope/adminScope.routes.js';
tenantRouter.use('/admin', adminScopeRoutes);

router.use(tenantRouter);

export default router;
