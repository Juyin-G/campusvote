/**
 * User Controller
 * Capa HTTP: recibe request, delega a user.service, responde JSON.
 * (service, routes, repository y schema los conecta el equipo)
 *
 * user.service debe exportar:
 * listUsers, getUserById, updateUser, deactivateUser,
 * updateUserRole, updateMyProfile, changeMyPassword
 */
import * as userService from './user.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess, sendPaginated, sendUpdated, sendDeleted } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';
import MESSAGES from '../../constants/messages.js';
import logger from '../../config/logger.js';

export const list = asyncHandler(async (req, res) => {
  const result = await userService.listUsers(req.query, req.user);

  return sendPaginated(res, result.users, result.pagination, 'Listado de usuarios obtenido');
});

export const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id, req.user);

  return sendSuccess(
    res,
    user,
    'Usuario obtenido',
    { requestId: req.requestId },
    HTTP_STATUS.OK,
  );
});

export const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user);

  logger.info(`Usuario actualizado: ${req.params.id}`, { requestId: req.requestId });

  return sendUpdated(res, user, MESSAGES.USER.UPDATED_SUCCESS);
});

export const deactivate = asyncHandler(async (req, res) => {
  await userService.deactivateUser(req.params.id, req.user);

  logger.info(`Usuario desactivado: ${req.params.id}`, { requestId: req.requestId });

  return sendDeleted(res, MESSAGES.USER.DELETED_SUCCESS);
});

export const updateRole = asyncHandler(async (req, res) => {
  const user = await userService.updateUserRole(
    req.params.id,
    req.body.role,
    req.user,
  );

  return sendUpdated(res, user, MESSAGES.USER.ROLE_ASSIGNED_SUCCESS);
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateMyProfile(req.user.userId, req.body, req.user);

  return sendUpdated(res, user, MESSAGES.USER.UPDATED_SUCCESS);
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await userService.changeMyPassword(req.user.userId, req.body);

  return sendSuccess(
    res,
    result,
    MESSAGES.USER.PASSWORD_CHANGED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK,
  );
});
