// src/modules/objections/objection.routes.js
// Tachas (SCHEDULED) e impugnaciones (CLOSED/CERTIFIED) en elecciones.

import { Router } from 'express';
import * as objectionController from './objection.controller.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { requireElectionInScope } from '../../middlewares/scope.middleware.js';
import { userElectionLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import {
  fileObjectionSchema,
  resolveObjectionSchema,
  listObjectionsSchema,
} from './objection.schema.js';

const router = Router();

const FILERS = [
  ROLES.STUDENT,
  ROLES.TEACHER,
  ROLES.JURY,
  ROLES.ELECTORAL_COMMISSION,
  ROLES.ADMIN,
  ROLES.SUPERADMIN,
];
const RESOLVERS = [ROLES.ELECTORAL_COMMISSION, ROLES.ADMIN, ROLES.SUPERADMIN];
const VIEWERS = FILERS;

router.post(
  '/elections/:id/objections',
  authenticate,
  authorize(FILERS),
  userElectionLimiter({ windowMs: 15 * 60 * 1000, max: 5 }),
  validate(fileObjectionSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(objectionController.fileObjection)
);

router.get(
  '/elections/:id/objections',
  authenticate,
  authorize(VIEWERS),
  validate(listObjectionsSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(objectionController.listObjections)
);

router.put(
  '/elections/:id/objections/:objectionId/resolve',
  authenticate,
  authorize(RESOLVERS),
  validate(resolveObjectionSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(objectionController.resolveObjection)
);

export default router;