import { Router } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import * as service from './career.service.js';
import {
  createCareerSchema,
  updateCareerSchema,
  idParamSchema,
} from './career.schema.js';

const router = Router();
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.get('/', asyncHandler(async (req, res) => {
  const result = await service.listCareers(req.query, req.user);
  res.json({ success: true, data: result.data, meta: result.meta });
}));

router.post(
  '/',
  validate(createCareerSchema),
  asyncHandler(async (req, res) => {
    const created = await service.createCareer(req.body, req.user);
    res.status(201).json({ success: true, data: created });
  }),
);

router.get(
  '/:id',
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const career = await service.getCareerById(req.params.id, req.user);
    res.json({ success: true, data: career });
  }),
);

router.put(
  '/:id',
  validate(updateCareerSchema),
  asyncHandler(async (req, res) => {
    const updated = await service.updateCareer(req.params.id, req.body, req.user);
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  '/:id',
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteCareer(req.params.id, req.user);
    res.json({ success: true, data: { id: req.params.id, deleted: true } });
  }),
);

export default router;
