import { Router } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import * as service from './teachingEvaluation.service.js';
import { z } from 'zod';

const router = Router();
const assignmentSchema = z.object({ body: z.object({
  organization_id: z.string().uuid(),
  academic_period_id: z.string().uuid(),
  career_id: z.string().uuid(),
  course_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
  cycle: z.number().int().positive(),
}) });
const evaluationSchema = z.object({ body: z.object({
  teaching_assignment_id: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
}) });

router.post('/teaching-assignments', authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), validate(assignmentSchema), asyncHandler(async (req, res) => {
  const result = await service.createTeachingAssignment(req.body, req.user);
  res.status(201).json({ success: true, data: result });
}));

router.get('/my-teaching-assignments', authenticate, authorize(ROLES.STUDENT), asyncHandler(async (req, res) => {
  const result = await service.listAssignmentsForStudent(req.user.id ?? req.user.userId, req.user);
  res.json({ success: true, data: result });
}));

router.post('/teacher-evaluations', authenticate, authorize(ROLES.STUDENT), validate(evaluationSchema), asyncHandler(async (req, res) => {
  const result = await service.evaluateTeacher(req.body, req.user);
  res.status(201).json({ success: true, data: result });
}));

router.get('/teachers/:teacherId/evaluation-summary', authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER), asyncHandler(async (req, res) => {
  const result = await service.teacherSummary(req.params.teacherId, req.user, req.query.period_id);
  res.json({ success: true, data: result });
}));

export default router;
