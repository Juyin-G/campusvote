import { Router } from 'express';

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

// 2. Controladores de Solicitudes
import {
  createRequest,
  listRequests,
  getRequestById,
} from '../organization-request/request.controller.js';

// 3. Servicio de Aprobación
import * as approvalService from '../organization-request/approval.service.js';

// 4. Sedes (contexto físico de organizaciones/ferias)
import organizationSiteRoutes from '../organizationSite/organizationSite.routes.js';

// 4. Middlewares y Utilidades
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import MESSAGES from '../../../constants/messages.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import jwt from 'jsonwebtoken';
import env from '../../../config/env.js';

/**
 * Autenticación opcional: si hay un Bearer token válido, lo decodifica y lo
 * expone en req.user; si no hay token o es inválido, continúa sin rechazar.
 * Pensado para endpoints públicos que personalizan la respuesta cuando el
 * visitante está autenticado (p. ej., catálogos de organizaciones).
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
    // Token inválido o expirado: tratamos como visitante anónimo (no rompemos
    // la lectura pública de un catálogo).
  }
  return next();
};

// 5. Schemas de Organizaciones (mismo directorio)
import {
  organizationParamsSchema as idParamSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  listOrganizationsQuerySchema as listQuerySchema,
} from './organization.schema.js';

// 6. Schemas de Solicitudes (directorio organization-request)
import {
  createOrganizationRequestSchema,
  listRequestsQuerySchema,
  requestParamsSchema,
  rejectRequestSchema,
} from '../organization-request/organization.schema.js';

const router = Router();

const getUserId = (req) => req.user?.id || req.user?.userId;

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
  validate(requestParamsSchema),
  asyncHandler(async (req, res) => {
    const approval = await approvalService.approveRequest(
      req.params.id,
      getUserId(req)
    );
    return sendSuccess(
      res,
      approval,
      'Solicitud aprobada. Se envió el enlace para activar la cuenta y crear la organización.',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  })
);

router.patch(
  '/requests/:id/reject',
  authenticate,
  authorize('SUPERADMIN'),
  validate(rejectRequestSchema),
  asyncHandler(async (req, res) => {
    const request = await approvalService.rejectRequest(
      req.params.id,
      getUserId(req),
      req.body.rejection_reason
    );
    return sendSuccess(
      res,
      request,
      MESSAGES.ORGANIZATION_REQUEST?.REJECTED_SUCCESS || 'Solicitud rechazada',
      { requestId: req.requestId },
      HTTP_STATUS.OK
    );
  })
);

// ==========================================
// --- SEDES (ORGANIZATION SITES) ---
// ==========================================
// Se monta ANTES de las rutas /:id para que el path estático /sites no
// colisione con el parámetro de ruta.
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

// CAMBIO: PATCH bifurcado en service. SUPERADMIN solo edita platform fields
// (isActive, memberLimit, defaultLocale). ADMIN edita el resto (branding,
// países, contacto, onboardingCompleted). Ver organization.service.js.
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
// CAMBIO: estas rutas cuelgan de /api/organizations/:id/onboarding que
// está montado en el sub-router PLATFORM (no en tenantRouter), pero el
// authorize('ADMIN') impide que el SUPERADMIN entre aquí. El SUPERADMIN
// gestiona la EXISTENCIA de la organización; el onboarding es interno.

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