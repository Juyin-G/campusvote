import { Router } from 'express';
import teachingEvaluationRoutes from './teachingEvaluation/teachingEvaluation.routes.js';
import facultyRoutes from './faculty/faculty.routes.js';
import programRoutes from './program/program.routes.js';
import periodRoutes from './period/period.routes.js';
import voterRegistryRoutes from './voter-registry/voter-registry.routes.js';

const router = Router();
router.use('/', teachingEvaluationRoutes);

router.use('/faculties', facultyRoutes);
router.use('/programs', programRoutes);
router.use('/periods', periodRoutes);
router.use('/voter-registries', voterRegistryRoutes);

export default router;