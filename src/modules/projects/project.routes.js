// src/modules/projects/project.routes.js
// Rutas de proyectos de feria académica.
// Inscripción/edición/integrantes: el DOCENTE asesor que inscribe el proyecto.
// Revisión de la inscripción y asignación de stand: ADMIN/SUPERADMIN.
// Lectura: cualquier rol autenticado (el scope por organización se resuelve
// en el service, siguiendo el patrón assertTenantAccess de rating/objection).

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as projectController from './project.controller.js';
import * as projectSchema from './project.schema.js';

const router = Router();

const CREATORS = [ROLES.TEACHER];
const REVIEWERS = [ROLES.ADMIN, ROLES.SUPERADMIN];
const CATALOG_READERS = [ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN];

router.use(authenticate);

// ── CATÁLOGO DE INSCRIPCIÓN ─────────────────────────────────────────
// Va antes de /:id para que "catalog" no se interprete como un ID.
router.get('/catalog', authorize(CATALOG_READERS), projectController.getCatalog);

// ── LECTURA (cualquier rol autenticado) ─────────────────────────────
router.get('/', validate(projectSchema.listProjectsQuerySchema), projectController.listProjects);

router.get(
  '/:id',
  validate(projectSchema.idParamSchema),
  projectController.getProjectById
);

router.get(
  '/:id/members',
  validate(projectSchema.idParamSchema),
  projectController.listMembers
);

// ── GESTIÓN DEL DOCENTE QUE INSCRIBE ───────────────────────────────
router.post(
  '/',
  authorize(CREATORS),
  validate(projectSchema.createProjectSchema),
  projectController.createProject
);

router.put(
  '/:id',
  authorize(CREATORS),
  validate(projectSchema.updateProjectSchema),
  projectController.updateProject
);

router.post(
  '/:id/submit',
  authorize(CREATORS),
  validate(projectSchema.idParamSchema),
  projectController.submitProject
);

router.post(
  '/:id/members',
  authorize(CREATORS),
  validate(projectSchema.addMemberSchema),
  projectController.addMember
);

router.delete(
  '/:id/members/:userId',
  authorize(CREATORS),
  validate(projectSchema.memberParamSchema),
  projectController.removeMember
);

// ── REVISIÓN ADMINISTRATIVA (APROBAR / RECHAZAR) ────────────────────
// ELECTORAL_COMMISSION deliberadamente NO gestiona proyectos.
router.post(
  '/:id/review',
  authorize(REVIEWERS),
  validate(projectSchema.reviewProjectSchema),
  projectController.reviewProject
);

// ── STAND (el admin lo asigna a proyectos aprobados) ───────────────
router.put(
  '/:id/stand',
  authorize(REVIEWERS),
  validate(projectSchema.assignStandSchema),
  projectController.assignStand
);

export default router;