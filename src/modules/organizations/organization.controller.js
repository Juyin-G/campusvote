//  src/modules/organizations/organization.controller.js

const organizationService = require('./organization.service');
const asyncHandler = require('../../shared/utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../../shared/utils/apiResponse');
const { HTTP_STATUS } = require('../../constants/httpStatus');
const MESSAGES = require('../../constants/messages');
const logger = require('../../config/logger');

const getOrganizations = asyncHandler(async (req, res) => {
  const { organizations, pagination } = await organizationService.listOrganizations(req.query);
  return sendPaginated(res, organizations, pagination, 'Consulta exitosa');
});

const getOrganizationById = asyncHandler(async (req, res) => {
  const organization = await organizationService.getOrganizationById(req.params.id);
  return sendSuccess(res, organization, 'Consulta exitosa', { requestId: req.requestId }, HTTP_STATUS.OK);
});

const createOrganization = asyncHandler(async (req, res) => {
  const organization = await organizationService.createOrganization(req.body);

  logger.info(`Organización creada: ${organization.name}`, {
    category: 'ORGANIZATION',
    requestId: req.requestId,
    orgId: organization.id,
  });

  return sendSuccess(
    res,
    organization,
    MESSAGES.ORGANIZATION?.CREATED_SUCCESS || 'Organización creada exitosamente',
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

const updateOrganization = asyncHandler(async (req, res) => {
  const organization = await organizationService.updateOrganization(req.params.id, req.body);

  logger.info(`Organización actualizada: ${req.params.id}`, {
    category: 'ORGANIZATION',
    requestId: req.requestId,
    orgId: req.params.id,
  });

  return sendSuccess(
    res,
    organization,
    MESSAGES.ORGANIZATION?.UPDATED_SUCCESS || 'Organización actualizada exitosamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

const deleteOrganization = asyncHandler(async (req, res) => {
  await organizationService.deleteOrganization(req.params.id);

  logger.warn(`Organización eliminada: ${req.params.id}`, {
    category: 'ORGANIZATION',
    requestId: req.requestId,
    orgId: req.params.id,
  });

  return sendSuccess(
    res,
    null,
    MESSAGES.ORGANIZATION?.DELETED_SUCCESS || 'Organización eliminada exitosamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

const updateOnboarding = asyncHandler(async (req, res) => {
  const organization = await organizationService.updateOrganization(req.params.id, req.body);

  return sendSuccess(
    res,
    organization,
    'Estado de onboarding actualizado exitosamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

const completeOnboarding = asyncHandler(async (req, res) => {
  const organization = await organizationService.completeOrgOnboarding(req.params.id);

  logger.info(`Onboarding completado para la organización: ${req.params.id}`, {
    category: 'ORGANIZATION',
    requestId: req.requestId,
    orgId: req.params.id,
  });

  return sendSuccess(
    res,
    organization,
    'Onboarding completado exitosamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

module.exports = {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  updateOnboarding,
  completeOnboarding,
};