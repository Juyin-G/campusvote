// src/modules/users/user.routes.js

import express from 'express';
import * as userController from './user.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES, ADMIN_ROLES } from '../../constants/roles.js';
import { ApiError } from '../../shared/errors/ApiError.js';
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

const router = express.Router();

// Guard 1: Impide que un usuario modifique su propio rol
const preventSelfRoleChange = (req, res, next) => {
  const actorId = req.user?.id || req.user?.userId;
  if (actorId === req.params.id) {
    return next(ApiError.badRequest('No puedes modificar tu propio rol'));
  }
  next();
};

// Guard 2: Exige privilegios de superusuario para gestión del rol ADMIN.
// Los roles no privilegiados (STUDENT/TEACHER/JURY) pueden ser gestionados
// por cualquier administrador de la organización.
const requireSuperUserForRole = (req, res, next) => {
  const target = req.body?.role;
  if (target && target !== ROLES.ADMIN) {
    // Cambiar a un rol no privilegiado no exige superusuario.
    return next();
  }
  const isSuperUser = req.user?.isSuperuser || req.user?.isSuperAdmin || req.user?.role === ROLES.SUPERADMIN;
  if (!isSuperUser) {
    return next(ApiError.forbidden('Solo superusuarios pueden asignar o modificar el rol ADMIN'));
  }
  next();
};

router.get(
  '/',
  authenticate,
  authorize(ROLES.SUPERADMIN, ROLES.ADMIN),
  validate(listUserSchema),
  userController.listUsers
);

router.get(
  '/me',
  authenticate,
  userController.getMe
);

router.get(
  '/:id',
  authenticate,
  validate(userParamsSchema),
  userController.getUserById
);

// Creación de usuario: Si asigna rol ADMIN, requiere superusuario.
// Roles no privilegiados (STUDENT/TEACHER/JURY) los puede crear cualquier
// ADMIN de la organización.
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  validate(createUserSchema),
  (req, res, next) => {
    const isSuperUser = req.user?.isSuperuser || req.user?.isSuperAdmin || req.user?.role === ROLES.SUPERADMIN;
    if (req.body.role === ROLES.ADMIN && !isSuperUser) {
      return next(ApiError.forbidden('Solo superusuarios pueden crear usuarios con rol ADMIN'));
    }
    next();
  },
  userController.createUser
);

// SUPERADMIN: crea un ADMIN y le entrega el OTP/QR de primer acceso
router.post(
  '/admin/provision',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  validate(provisionAdminSchema),
  userController.provisionAdmin
);

router.post(
  '/admin/provision-existing/:organizationId',
  authenticate,
  authorize(ROLES.SUPERADMIN),
  validate(provisionExistingAdminSchema),
  userController.provisionExistingAdmin
);

// ADMIN/SUPERADMIN: crea jurados/usuarios en lote (bulk)
router.post(
  '/bulk',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  validate(createUsersBulkSchema),
  userController.createUsersBulk
);

router.put(
  '/me',
  authenticate,
  validate(updateMeSchema),
  userController.updateMe
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  validate(updateUserSchema),
  userController.updateUser
);

// Cambio explícito de rol con ambas validaciones aplicadas
router.patch(
  '/:id/role',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  preventSelfRoleChange,
  requireSuperUserForRole,
  validate(changeRoleSchema),
  userController.changeRole
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  validate(setActiveSchema),
  userController.setActive
);

router.patch(
  '/:id/unlock',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  validate(userParamsSchema),
  userController.unlockUser
);

router.post(
  '/me/password',
  authenticate,
  validate(changePasswordSchema),
  userController.changePassword
);

export default router;