// src/modules/organizations/organization.controller.js

const organizationService = require('./organization.service');
const asyncHandler = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../../shared/utils/apiResponse');
const { HTTP_STATUS } = require('../../constants/httpStatus');
const MESSAGES = require('../../constants/messages');
const logger = require('../../config/logger');

const getOrganizationRequests = asyncHandler(async (req, res) => {
  const { requests, pagination } = await organizationService.listRequests(req.query);
  return sendPaginated(res, requests, pagination, 'Solicitudes obtenidas exitosamente');
});

const createOrganizationRequest = asyncHandler(async (req, res) => {
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

const approveOrganizationRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user.id;

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

const rejectOrganizationRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user.id;
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

module.exports = {
  getOrganizationRequests,
  createOrganizationRequest,
  approveOrganizationRequest,
  rejectOrganizationRequest,
};