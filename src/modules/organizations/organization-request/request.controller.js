// src/modules/organizations/organization-request/request.controller.js

import * as requestService from './request.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import MESSAGES from '../../../constants/messages.js';

/**
 * Registrar una nueva solicitud de organización
 * @route POST /api/organizations/requests
 * @access Público
 */
export const createRequest = asyncHandler(async (req, res) => {
  const request = await requestService.createRequest(req.body);

  return sendSuccess(
    res,
    request,
    MESSAGES.ORGANIZATION?.REQUEST_SUBMITTED_SUCCESS || 'Solicitud enviada correctamente',
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

/**
 * Listar solicitudes paginadas
 * @route GET /api/organizations/requests
 * @access SUPERADMIN / ADMIN
 */
export const listRequests = asyncHandler(async (req, res) => {
  const { requests, pagination } = await requestService.listRequests(req.query);

  return sendPaginated(res, requests, pagination, 'Consulta exitosa');
});

/**
 * Obtener una solicitud por ID
 * @route GET /api/organizations/requests/:id
 * @access SUPERADMIN / ADMIN
 */
export const getRequestById = asyncHandler(async (req, res) => {
  const request = await requestService.getRequestById(req.params.id);

  return sendSuccess(
    res,
    request,
    'Consulta exitosa',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Aprobar una solicitud de organización, crear la entidad, usuario admin y enviar credenciales
 * @route PATCH /api/organizations/requests/:id/approve
 * @access SUPERADMIN
 */
export const approveRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const actor = req.user;

  const result = await requestService.approveRequest(id, actor);

  return sendSuccess(
    res,
    result.data,
    result.message,
    { 
      requestId: req.requestId,
      emailSent: result.emailSent 
    },
    HTTP_STATUS.OK
  );
});

/**
 * Rechazar una solicitud
 * @route PATCH /api/organizations/requests/:id/reject
 * @access SUPERADMIN
 */
export const rejectRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;
  const actor = req.user;

  const result = await requestService.rejectRequest(id, actor, rejection_reason);

  return sendSuccess(
    res,
    result,
    MESSAGES.ORGANIZATION_REQUEST?.REJECTED_SUCCESS || 'Solicitud rechazada correctamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});