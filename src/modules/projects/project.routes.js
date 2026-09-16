// src/modules/projects/project.routes.js
// Rutas de proyectos de feria académica.
// Creación/edición/integrantes: propietario (STUDENT/TEACHER).
// Revisión administrativa: ADMIN de la organización dueña del proyecto.
// Lectura: cualquier rol autenticado (el scope por organización se resuelve
// en el service; SUPERADMIN NO tiene acceso operativo a proyectos — 403).

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as projectController from './project.controller.js';
import * as projectSchema from './project.schema.js';

const router = Router();

const CREATORS = [ROLES.STUDENT, ROLES.TEACHER];
const REVIEWERS = [ROLES.ADMIN];

router.use(authenticate);

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

// ── GESTIÓN DEL PROPIETARIO (solo STUDENT/TEACHER) ─────────────────
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

export default router;