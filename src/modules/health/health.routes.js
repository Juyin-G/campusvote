import { Router } from 'express';
import { checkHealth, checkDatabase } from './health.controller.js';

const router = Router();

router.get('/', checkHealth);
router.get('/db', checkDatabase);

export default router;