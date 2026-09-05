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

// 4. Middlewares y Utilidades
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import MESSAGES from '../../../constants/messages.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';

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

const optionalAuthenticate = (req, res, next) => next();
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
    const newOrganization = await approvalService.approveRequest(
      req.params.id,
      getUserId(req)
    );
    return sendSuccess(
      res,
      newOrganization,
      MESSAGES.ORGANIZATION_REQUEST?.APPROVED_SUCCESS || 'Solicitud aprobada y organización creada',
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
  authorize('ADMIN'),
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
  authorize('ADMIN'),
  validate(idParamSchema),
  deleteOrganization
);

// ==========================================
// --- ONBOARDING ---
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