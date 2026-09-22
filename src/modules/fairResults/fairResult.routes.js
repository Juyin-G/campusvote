import { Router } from 'express';
import { FairResultsController } from './fairResult.controller.js';
import { authenticate, authorizeTenant } from '../../middlewares/auth.middleware.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();

// auth.middleware.js no exporta authenticateToken ni authorizeRoles: importar
// un nombre que no existe impide que el módulo cargue y la API entera no arranca.
const authMiddleware = authenticate;
const roleMiddleware = authorizeTenant;

// Resultados: solo el ADMIN de la organización (el SUPERADMIN no opera tenants).
const MANAGERS = [ROLES.ADMIN];

// Exige autenticación Bearer Token
router.use(authMiddleware);

/**
 * @route GET /api/fairs/:id/results
 * Acceso: Exclusivo para ADMIN de la Organización (Tenant)
 */
router.get(
  '/:id/results',
  roleMiddleware(...MANAGERS),
  FairResultsController.getResults
);

/**
 * @route POST /api/fairs/:id/results/publish
 * Acceso: Exclusivo para ADMIN de la Organización (Tenant)
 */
router.post(
  '/:id/results/publish',
  roleMiddleware(...MANAGERS),
  FairResultsController.publishResults
);

/**
 * @route GET /api/fairs/:id/projects/:projectId
 * Acceso: Exclusivo para JURY asignado a la feria
 */
router.get(
  '/:id/projects/:projectId',
  roleMiddleware(ROLES.JURY),
  FairResultsController.getProjectReview
);

export default router;