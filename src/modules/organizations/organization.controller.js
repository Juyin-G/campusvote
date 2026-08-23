/**
 * Organization Controller
 * Capa HTTP: recibe request, delega a organization.service, responde JSON.
 *
 * Contrato esperado de organization.service.js:
 *   listOrganizations(query)   -> { organizations: Array, pagination: Object }
 *   getOrganizationById(id)    -> Object
 *   createOrganization(body)   -> Object
 *   updateOrganization(id, body) -> Object
 *
 * Los errores de negocio (404, 409, 400) los lanza el service como ApiError;
 * asyncHandler los captura y los deriva al errorHandler global.
 */
import * as organizationService from './organization.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';
import MESSAGES from '../../constants/messages.js';

/**
 * Listar organizaciones paginadas
 * @route GET /api/organizations
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const listOrganizations = asyncHandler(async (req, res) => {
  const { organizations, pagination } = await organizationService.listOrganizations(req.query);

  return sendPaginated(res, organizations, pagination, 'Consulta exitosa');
});

/**
 * Obtener una organización por ID
 * @route GET /api/organizations/:id
 * @access Autenticado
 */
export const getOrganizationById = asyncHandler(async (req, res) => {
  const organization = await organizationService.getOrganizationById(req.params.id);

  return sendSuccess(
    res,
    organization,
    'Consulta exitosa',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Crear una nueva organización
 * @route POST /api/organizations
 * @access ADMIN
 */
export const createOrganization = asyncHandler(async (req, res) => {
  const organization = await organizationService.createOrganization(req.body);

  return sendSuccess(
    res,
    organization,
    MESSAGES.ORGANIZATION.CREATED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

/**
 * Actualizar una organización por ID
 * @route PUT /api/organizations/:id
 * @access ADMIN
 */
export const updateOrganization = asyncHandler(async (req, res) => {
  const organization = await organizationService.updateOrganization(req.params.id, req.body);

  return sendSuccess(
    res,
    organization,
    MESSAGES.ORGANIZATION.UPDATED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});
