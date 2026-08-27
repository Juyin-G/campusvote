import { Router } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import * as programController from './program.controller.js';
import * as programSchema from './program.schema.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', programController.getPrograms);

router.post(
  '/',
  validate(programSchema.createProgramSchema),
  programController.createProgram
);

router.get(
  '/:id',
  validate(programSchema.idParamSchema),
  programController.getProgramById
);

router.put(
  '/:id',
  validate(programSchema.updateProgramSchema),
  programController.updateProgram
);

router.delete(
  '/:id',
  validate(programSchema.idParamSchema),
  programController.deleteProgram
);

export default router;