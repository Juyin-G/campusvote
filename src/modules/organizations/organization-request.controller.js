import organizationService from './organization.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';
import MESSAGES from '../../constants/messages.js';
import logger from '../../config/logger.js';

export const getOrganizationRequests = asyncHandler(async (req, res) => {
  const { requests, pagination } = await organizationService.listRequests(req.query);
  return sendPaginated(res, requests, pagination, 'Solicitudes obtenidas exitosamente');
});

export const createOrganizationRequest = asyncHandler(async (req, res) => {
  const request = await organizationService.createRequest(req.body);

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

export const approveOrganizationRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user.userId;

  const newOrganization = await organizationService.approveRequest(id, reviewerId);

  logger.info(`Solicitud de organización ${id} aprobada por ${reviewerId}`, {
    category: 'ORGANIZATION_REQUEST',
    requestId: req.requestId,
    requestDbId: id,
    reviewerId,
  });

  return sendSuccess(
    res,
    newOrganization,
    MESSAGES.ORGANIZATION_REQUEST?.APPROVED_SUCCESS || 'Solicitud aprobada exitosamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const rejectOrganizationRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user.userId;
  const { rejection_reason } = req.body;

  const request = await organizationService.rejectRequest(id, reviewerId, rejection_reason);

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