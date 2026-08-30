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

// Guard 2: Exige privilegios de superusuario para gestión de roles privilegiados
// (ADMIN / ELECTORAL_COMMISSION). Los roles electorales regulares
// (STUDENT/TEACHER/OBSERVER) pueden ser gestionados por cualquier administrador.
const requireSuperUserForRole = (req, res, next) => {
  const target = req.body?.role;
  if (target && !ADMIN_ROLES.includes(target)) {
    // Cambiar a un rol no privilegiado no exige superusuario.
    return next();
  }
  const isSuperUser = req.user?.isSuperuser || req.user?.isSuperAdmin || req.user?.role === ROLES.SUPER_ADMIN;
  if (!isSuperUser) {
    return next(ApiError.forbidden('Solo superusuarios pueden asignar o modificar roles privilegiados'));
  }
  next();
};

router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.ELECTORAL_COMMISSION),
  validate(listUserSchema),
  userController.listUsers
);

router.get('/me', authenticate, userController.getMe);

router.get(
  '/:id',
  authenticate,
  validate(userParamsSchema),
  userController.getUserById
);

// Creación de usuario: Si asigna un rol privilegiado (ADMIN/COMISIÓN), requiere superusuario
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createUserSchema),
  (req, res, next) => {
    const isSuperUser = req.user?.isSuperuser || req.user?.isSuperAdmin || req.user?.role === ROLES.SUPER_ADMIN;
    if (req.body.role && ADMIN_ROLES.includes(req.body.role) && !isSuperUser) {
      return next(ApiError.forbidden('Solo superusuarios pueden crear usuarios con roles administrativos o de comisión'));
    }
    next();
  },
  userController.createUser
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
  authorize(ROLES.ADMIN),
  validate(updateUserSchema),
  userController.updateUser
);

// Cambio explícito de rol con ambas validaciones aplicadas
router.patch(
  '/:id/role',
  authenticate,
  authorize(ROLES.ADMIN),
  preventSelfRoleChange,
  requireSuperUserForRole,
  validate(changeRoleSchema),
  userController.changeRole
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(setActiveSchema),
  userController.setActive
);

router.patch(
  '/:id/unlock',
  authenticate,
  authorize(ROLES.ADMIN),
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