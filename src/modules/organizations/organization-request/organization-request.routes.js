// src/modules/organizations/organization-request/organization-request.routes.js

import { Router } from 'express';
import {
  createRequest,
  listRequests,
  getRequestById,
  approveOrganizationRequest,
  rejectOrganizationRequest,
} from './request.controller.js';

import { authenticate, authorize } from '../../../shared/middlewares/auth.middleware.js'; // Ajusta la ruta si es necesario
import { validate } from '../../../shared/middlewares/validate.middleware.js';

import {
  createOrganizationRequestSchema,
  listRequestsQuerySchema,
  requestParamsSchema,
  rejectRequestSchema,
} from './organization-request.schema.js';

const router = Router();

// RUTAS PÚBLICAS (Lead Generation / Onboarding)


// Crear una nueva solicitud (Cualquiera puede solicitar que su org sea añadida)
router.post(
  '/',
  validate(createOrganizationRequestSchema),
  createRequest
);


// RUTAS PROTEGIDAS (Solo ADMIN)


// Listar todas las solicitudes con paginación y filtros
router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(listRequestsQuerySchema),
  listRequests
);

// Obtener detalles de una solicitud específica
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate(requestParamsSchema),
  getRequestById
);

// Aprobar una solicitud (Ejecuta la función SQL nativa)
router.patch(
  '/:id/approve',
  authenticate,
  authorize('ADMIN'),
  validate(requestParamsSchema),
  approveOrganizationRequest
);

// Rechazar una solicitud (Requiere motivo)
router.patch(
  '/:id/reject',
  authenticate,
  authorize('ADMIN'),
  validate(requestParamsSchema),
  validate(rejectRequestSchema), 
  rejectOrganizationRequest
);

export default router;