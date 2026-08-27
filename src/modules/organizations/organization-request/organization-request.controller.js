// src/modules/organizations/organization-request/organization-request.controller.js

import * as requestService from './request.service.js';
import * as approvalService from './approval.service.js'; // Importamos el servicio de aprobación dedicado
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import MESSAGES from '../../../constants/messages.js';
import logger from '../../../config/logger.js';

/**
 * Listar solicitudes de organización
 * @route GET /api/organizations/requests
 * @access ADMIN
 */
export const getOrganizationRequests = asyncHandler(async (req, res) => {
  const { requests, pagination } = await requestService.listRequests(req.query);
  
  return sendPaginated(
    res, 
    requests, 
    pagination, 
    'Solicitudes obtenidas exitosamente'
  );
});

/**
 * Crear una nueva solicitud de organización (Pública o Autenticada)
 * @route POST /api/organizations/requests
 * @access Público
 */
export const createOrganizationRequest = asyncHandler(async (req, res) => {
  const request = await requestService.createRequest(req.body);

  logger.info(`Solicitud de organización recibida: ${req.body.institution_name}`, {
    category: 'ORGANIZATION_REQUEST',
    requestId: req.requestId,
    requestDbId: request.id,
  });

  return sendSuccess(
    res,
    request,
    MESSAGES.ORGANIZATION_REQUEST?.CREATED_SUCCESS || 'Solicitud creada exitosamente',
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

/**
 * Aprobar una solicitud y crear la organización
 * @route PATCH /api/organizations/requests/:id/approve
 * @access ADMIN
 */
export const approveOrganizationRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Maneja tanto req.user.id como req.user.userId dependiendo de tu middleware de auth
  const reviewerId = req.user?.id || req.user?.userId;

  const newOrganization = await approvalService.approveRequest(id, reviewerId);

  logger.info(`Solicitud de organización ${id} aprobada por ${reviewerId}`, {
    category: 'ORGANIZATION_REQUEST',
    requestId: req.requestId,
    requestDbId: id,
    reviewerId,
  });

  return sendSuccess(
    res,
    newOrganization,
    MESSAGES.ORGANIZATION_REQUEST?.APPROVED_SUCCESS || 'Solicitud aprobada y organización creada exitosamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Rechazar una solicitud con motivo
 * @route PATCH /api/organizations/requests/:id/reject
 * @access ADMIN
 */
export const rejectOrganizationRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user?.id || req.user?.userId;
  const { rejection_reason } = req.body;

  const request = await approvalService.rejectRequest(id, reviewerId, rejection_reason);

  logger.warn(`Solicitud de organización ${id} rechazada por ${reviewerId}`, {
    category: 'ORGANIZATION_REQUEST',
    requestId: req.requestId,
    requestDbId: id,
    reviewerId,
    reason: rejection_reason,
  });

  return sendSuccess(
    res,
    request,
    MESSAGES.ORGANIZATION_REQUEST?.REJECTED_SUCCESS || 'Solicitud rechazada exitosamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export default {
  getOrganizationRequests,
  createOrganizationRequest,
  approveOrganizationRequest,
  rejectOrganizationRequest,
};