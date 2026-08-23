import { Router } from 'express';

// Controladores separados por subdominio
import {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  updateOnboarding,
  completeOnboarding,
} from './organization.controller.js';

// NOTA: Se cambió de organization-request a request.controller y approval.service
// Dado que el controlador orginal llamaba a métodos inexistentes.
import {
  createRequest,
  listRequests,
  getRequestById,
} from './request.controller.js';

// Importamos el controlador reparado para aprobaciones (lo crearemos en memoria o conectaremos a approval.service)
import * as approvalService from './approval.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';
import MESSAGES from '../../constants/messages.js';

// Middlewares
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';

// Schemas
import {
  idParamSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  createOrganizationRequestSchema,
  rejectReasonBodySchema,
} from './organization.schema.js';

const router = Router();

// Middleware simulado para optionalAuthenticate si no existe
const optionalAuthenticate = (req, res, next) => {
  next();
};

// --- SOLICITUDES / LEADS ---

router.get('/requests', authenticate, authorize('ADMIN'), listRequests);

router.post(
  '/requests',
  validate(createOrganizationRequestSchema),
  createRequest
);

router.get('/requests/:id', authenticate, authorize('ADMIN'), getRequestById);

router.patch(
  '/requests/:id/approve',
  authenticate,
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const newOrganization = await approvalService.approveRequest(req.params.id, req.user.id);
    return sendSuccess(res, newOrganization, MESSAGES.ORGANIZATION_REQUEST?.APPROVED_SUCCESS || 'Solicitud aprobada', { requestId: req.requestId }, HTTP_STATUS.OK);
  })
);

router.patch(
  '/requests/:id/reject',
  authenticate,
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  validate(rejectReasonBodySchema, 'body'),
  asyncHandler(async (req, res) => {
    const request = await approvalService.rejectRequest(req.params.id, req.user.id, req.body.rejection_reason);
    return sendSuccess(res, request, MESSAGES.ORGANIZATION_REQUEST?.REJECTED_SUCCESS || 'Solicitud rechazada', { requestId: req.requestId }, HTTP_STATUS.OK);
  })
);

// --- ORGANIZACIONES ---

router.get('/', optionalAuthenticate, getOrganizations);

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createOrganizationSchema),
  createOrganization
);

router.get('/:id', optionalAuthenticate, validate(idParamSchema, 'params'), getOrganizationById);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateOrganizationSchema),
  updateOrganization
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  deleteOrganization
);

// --- ONBOARDING ---

router.patch(
  '/:id/onboarding',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(idParamSchema, 'params'),
  updateOnboarding
);

router.post(
  '/:id/onboarding/complete',
  authenticate,
  authorize('ADMIN', 'ORG_ADMIN'),
  validate(idParamSchema, 'params'),
  completeOnboarding
);

export default router;