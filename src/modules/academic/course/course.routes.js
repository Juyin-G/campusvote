import { Router } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import * as service from './course.service.js';
import {
  createCourseSchema,
  updateCourseSchema,
  idParamSchema,
} from './course.schema.js';

const router = Router();
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.get('/', asyncHandler(async (req, res) => {
  const result = await service.listCourses(req.query, req.user);
  res.json({ success: true, data: result.data, meta: result.meta });
}));

router.post(
  '/',
  validate(createCourseSchema),
  asyncHandler(async (req, res) => {
    const created = await service.createCourse(req.body, req.user);
    res.status(201).json({ success: true, data: created });
  }),
);

router.get(
  '/:id',
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const course = await service.getCourseById(req.params.id, req.user);
    res.json({ success: true, data: course });
  }),
);

router.put(
  '/:id',
  validate(updateCourseSchema),
  asyncHandler(async (req, res) => {
    const updated = await service.updateCourse(req.params.id, req.body, req.user);
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  '/:id',
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteCourse(req.params.id, req.user);
    res.json({ success: true, data: { id: req.params.id, deleted: true } });
  }),
);

export default router;
