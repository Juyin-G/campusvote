import { Router } from 'express';
import { FairResultsController } from './fairResult.controller.js';
// Se importan los nombres reales exportados por auth.middleware.js
import { authenticate, authorizeTenant, authenticateToken, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();

// Soporte para ambos nombres para compatibilidad con las pruebas existentes
const authMiddleware = authenticateToken || authenticate;
const roleMiddleware = authorizeRoles || authorizeTenant;

// Exige autenticación Bearer Token
router.use(authMiddleware);

/**
 * @route GET /api/fairs/:id/results
 * Acceso: Exclusivo para ADMIN de la Organización (Tenant)
 */
router.get(
  '/:id/results',
  roleMiddleware(ROLES.ADMIN || 'ADMIN'),
  FairResultsController.getResults
);

/**
 * @route POST /api/fairs/:id/results/publish
 * Acceso: Exclusivo para ADMIN de la Organización (Tenant)
 */
router.post(
  '/:id/results/publish',
  roleMiddleware(ROLES.ADMIN || 'ADMIN'),
  FairResultsController.publishResults
);

/**
 * @route GET /api/fairs/:id/projects/:projectId
 * Acceso: Exclusivo para JURY asignado a la feria
 */
router.get(
  '/:id/projects/:projectId',
  roleMiddleware(ROLES.JURY || 'JURY'),
  FairResultsController.getProjectReview
);

export default router;