import { Router } from 'express';
import teachingEvaluationRoutes from './teachingEvaluation/teachingEvaluation.routes.js';
import facultyRoutes from './faculty/faculty.routes.js';
import programRoutes from './program/program.routes.js';
import periodRoutes from './period/period.routes.js';
import voterRegistryRoutes from './voter-registry/voter-registry.routes.js';
import careerRoutes from './career/career.routes.js';
import courseRoutes from './course/course.routes.js';

const router = Router();

router.use('/careers', careerRoutes);
router.use('/courses', courseRoutes);
router.use('/faculties', facultyRoutes);
router.use('/programs', programRoutes);
router.use('/periods', periodRoutes);
router.use('/voter-registries', voterRegistryRoutes);
router.use('/', teachingEvaluationRoutes);

export default router;