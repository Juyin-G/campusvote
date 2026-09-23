import { Router } from 'express';
import jwt from 'jsonwebtoken';
import env from '../../../config/env.js';

// 1. Controladores de Organizaciones
import {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  updateOnboarding,
  completeOnboarding,
} from './organization.controller.js';

// 2. Controladores de Solicitudes (Incluye approveRequest y rejectRequest)
import {
  createRequest,
  listRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
} from '../organization-request/request.controller.js';

// 3. Rutas de Sedes
import organizationSiteRoutes from '../organizationSite/organizationSite.routes.js';

// 4. Middlewares
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';

// 5. Schemas de Organizaciones
import {
  organizationParamsSchema as idParamSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  listOrganizationsQuerySchema as listQuerySchema,
} from './organization.schema.js';

// 6. Schemas de Solicitudes
import {
  createOrganizationRequestSchema,
  listRequestsQuerySchema,
  requestParamsSchema,
  approveRequestSchema,
  rejectRequestSchema,
} from '../organization-request/organization.schema.js';

const router = Router();

/**
 * Autenticación opcional para lectura pública/personalizada.
 */
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
  } catch {
    // Token inválido: se trata como visitante anónimo
  }
  return next();
};

// ==========================================
// --- SOLICITUDES (ORGANIZATION REQUESTS) ---
// ==========================================

router.get(
  '/requests',
  authenticate,
  authorize('SUPERADMIN'),
  validate(listRequestsQuerySchema),
  listRequests
);

router.post(
  '/requests',
  validate(createOrganizationRequestSchema),
  createRequest
);

router.get(
  '/requests/:id', 
  authenticate,
  authorize('SUPERADMIN'),
  validate(requestParamsSchema),
  getRequestById
);

router.patch(
  '/requests/:id/approve',
  authenticate,
  authorize('SUPERADMIN'),
  validate(approveRequestSchema),
  approveRequest
);

router.patch(
  '/requests/:id/reject',
  authenticate,
  authorize('SUPERADMIN'),
  validate(rejectRequestSchema),
  rejectRequest
);

// ==========================================
// --- SEDES (ORGANIZATION SITES) ---
// ==========================================
router.use('/sites', organizationSiteRoutes);

// ==========================================
// --- ORGANIZACIONES ---
// ==========================================

router.get(
  '/',
  authenticate,
  authorize('SUPERADMIN'),
  validate(listQuerySchema),
  getOrganizations
);

router.post(
  '/',
  authenticate,
  authorize('SUPERADMIN'),
  validate(createOrganizationSchema),
  createOrganization
);

router.get(
  '/:id',
  optionalAuthenticate,
  validate(idParamSchema),
  getOrganizationById
);

router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPERADMIN'),
  validate(idParamSchema),
  validate(updateOrganizationSchema),
  updateOrganization
);

router.delete(
  '/:id',
  authenticate,
  authorize('SUPERADMIN'),
  validate(idParamSchema),
  deleteOrganization
);

// ==========================================
// --- ONBOARDING (TENANT: solo ADMIN) ---
// ==========================================

router.patch(
  '/:id/onboarding',
  authenticate,
  authorize('ADMIN'),
  validate(idParamSchema),
  updateOnboarding
);

router.post(
  '/:id/onboarding/complete',
  authenticate,
  authorize('ADMIN'),
  validate(idParamSchema),
  completeOnboarding
);

export default router;