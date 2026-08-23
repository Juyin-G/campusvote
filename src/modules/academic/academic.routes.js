import { Router } from 'express';
import facultyRoutes from './faculty/faculty.routes.js';
import programRoutes from './program/program.routes.js';
import periodRoutes from './period/period.routes.js';

const router = Router();

router.use('/faculties', facultyRoutes);
router.use('/programs', programRoutes);
router.use('/periods', periodRoutes);

export default router;