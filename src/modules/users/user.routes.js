import express from 'express';
import * as userController from './user.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import {
  userParamsSchema,
  listUserSchema,
  createUserSchema,
  updateUserSchema,
  changeRoleSchema,
  setActiveSchema,
  changePasswordSchema,
} from './user.schema.js';

const router = express.Router();

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

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createUserSchema),
  userController.createUser
);

router.put(
  '/me',
  authenticate,
  validate(updateUserSchema),
  userController.updateMe
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(updateUserSchema),
  userController.updateUser
);

router.patch(
  '/:id/role',
  authenticate,
  authorize(ROLES.ADMIN),
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