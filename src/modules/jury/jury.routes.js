import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as controller from './jury.controller.js';

const router = Router();
const managers = [ROLES.ADMIN, ROLES.ELECTORAL_COMMISSION, ROLES.SUPERADMIN];

router.get('/elections/:electionId/jury-assignments', authenticate, authorize([...managers, ROLES.JURY]), controller.list);
router.post('/elections/:electionId/candidacies/:candidacyId/jury-assignments', authenticate, authorize(managers), controller.assign);
router.delete('/jury-assignments/:assignmentId', authenticate, authorize(managers), controller.revoke);
router.post('/elections/:electionId/candidacies/:candidacyId/jury-conflicts', authenticate, authorize([...managers, ROLES.JURY]), controller.conflict);
router.post('/jury-conflicts/:conflictId/clear', authenticate, authorize(managers), controller.clearConflict);

export default router;
