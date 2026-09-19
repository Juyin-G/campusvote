// src/modules/users/user.routes.js
// CRUD de usuarios académicos + provisionamiento de ADMINs.
//
// Plataforma (SOLO SUPERADMIN): /users/admin/provision*
// Tenant (SOLO ADMIN, con scope multi-sede): el resto.
// Las rutas extra (site assignment, academic, bulk PDF) viven en user.routes.extra.js.

import express from 'express';
import * as userController from './user.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { canActorActOnUser } from '../../middlewares/tenantScope.middleware.js';
import {
  attachScopeUserFilter,
  requireActorCanActOnUser,
} from '../../middlewares/tenantScope.middleware.js';
import {
  preventSelfRoleChange,
  requireAdminScopeForAdminRole,
} from './user.guards.js';
import {
  userParamsSchema,
  listUserSchema,
  createUserSchema,
  updateMeSchema,
  updateUserSchema,
  changeRoleSchema,
  setActiveSchema,
  changePasswordSchema,
  provisionAdminSchema,
  provisionExistingAdminSchema,
  createUsersBulkSchema,
} from './user.schema.js';

// ════════════════════════════════════════════════════════════════════════
//  platformUsersRouter — exclusivamente para SUPERADMIN.
// ════════════════════════════════════════════════════════════════════════
export const platformUsersRouter = express.Router();

platformUsersRouter.post(
  '/admin/provision',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  validate(provisionAdminSchema),
  userController.provisionAdmin
);

platformUsersRouter.post(
  '/admin/provision-existing/:organizationId',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  validate(provisionExistingAdminSchema),
  userController.provisionExistingAdmin
);

// ════════════════════════════════════════════════════════════════════════
//  tenantUsersRouter — CRUD académico y de admins de tenant.
// ════════════════════════════════════════════════════════════════════════
const router = express.Router();

// GET /me → usuario autenticado.
router.get('/me', authenticate, userController.getMe);

// PUT /me → edición del propio perfil.
router.put('/me', authenticate, validate(updateMeSchema), userController.updateMe);

// POST /me/password → cambio de contraseña propio.
router.post(
  '/me/password',
  authenticate,
  validate(changePasswordSchema),
  userController.changePassword
);

// GET / → lista usuarios del tenant (scope aplicado en service).
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(listUserSchema),
  attachScopeUserFilter,
  userController.listUsers
);

// POST / → crea usuario académico.
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createUserSchema),
  userController.createUser
);

// POST /bulk → creación masiva (scope aplicado en service).
router.post(
  '/bulk',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createUsersBulkSchema),
  userController.createUsersBulk
);

// GET /:id → consulta usuario con autorización por scope.
router.get(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(userParamsSchema),
  async (req, res, next) => {
    try {
      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          organizationId: true,
          role: true,
          siteAssignments: { select: { siteId: true } },
        },
      });
      if (!target) return next(ApiError.notFound('Usuario no encontrado'));
      const actorId = req.user?.id || req.user?.userId;
      const isSelf = actorId === target.id;
      const isAdmin = req.user?.role === ROLES.ADMIN;
      if (!isSelf && !isAdmin) return next(ApiError.forbidden('Acceso denegado'));
      if (isAdmin && !isSelf) {
        const siteIds = (target.siteAssignments || []).map((s) => s.siteId);
        const allowed = await canActorActOnUser(req.user, target.organizationId, siteIds);
        if (!allowed) return next(ApiError.forbidden('No tienes autorización sobre este usuario'));
      }
      req.targetUser = target;
      next();
    } catch (err) {
      next(err);
    }
  },
  userController.getUserById
);

// PUT /:id → editar usuario.
router.put(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  validate(updateUserSchema),
  userController.updateUser
);

// PATCH /:id/role → cambio de rol explícito.
router.patch(
  '/:id/role',
  authenticate,
  authorize(ROLES.ADMIN),
  preventSelfRoleChange,
  requireActorCanActOnUser('id'),
  requireAdminScopeForAdminRole,
  validate(changeRoleSchema),
  userController.changeRole
);

// PATCH /:id/status → activar/desactivar.
router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  validate(setActiveSchema),
  userController.setActive
);

// PATCH /:id/unlock → resetear intentos fallidos.
router.patch(
  '/:id/unlock',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  validate(userParamsSchema),
  userController.unlockUser
);

// DELETE /:id → soft delete (status=SUSPENDED).
router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  requireActorCanActOnUser('id'),
  userController.softDeleteUser
);

export default router;
