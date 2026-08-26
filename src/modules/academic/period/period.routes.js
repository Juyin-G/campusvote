import { Router } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import * as periodController from './period.controller.js';
import * as periodSchema from './period.schema.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', periodController.getPeriods);
router.post('/', validate(periodSchema.createPeriodSchema), periodController.createPeriod);
router.get('/:id', validate(periodSchema.idParamSchema), periodController.getPeriodById);
router.put('/:id', validate(periodSchema.idParamSchema), periodController.updatePeriod);
router.patch('/:id/active', validate(periodSchema.idParamSchema), periodController.setActivePeriod);
router.delete('/:id', validate(periodSchema.idParamSchema), periodController.deletePeriod);

export default router;