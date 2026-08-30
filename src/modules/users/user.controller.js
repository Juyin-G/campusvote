/**
 * User Controller
 * Capa HTTP: recibe request, delega a user.service, responde JSON.
 */
import * as userService from './user.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';
import MESSAGES from '../../constants/messages.js';

const actorId = (user) => user?.userId ?? user?.id;

// Listar usuarios paginados
export const listUsers = asyncHandler(async (req, res) => {
  const { users, pagination } = await userService.listUsers(req.query);

  return sendPaginated(res, users, pagination, 'Consulta exitosa');
});

// Obtener perfil del usuario autenticado
export const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getMe(actorId(req.user));
  return sendSuccess(res, user, 'Consulta exitosa', { requestId: req.requestId }, HTTP_STATUS.OK);
});

// Obtener un usuario por ID
export const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id, req.user);
  return sendSuccess(res, user, 'Consulta exitosa', { requestId: req.requestId }, HTTP_STATUS.OK);
});

// Crear un nuevo usuario
export const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body, req.user);
  return sendSuccess(res, user, MESSAGES.USER.CREATED_SUCCESS, { requestId: req.requestId }, HTTP_STATUS.CREATED);
});

// Actualizar usuario por ID
export const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);
  return sendSuccess(res, user, MESSAGES.USER.UPDATED_SUCCESS, { requestId: req.requestId }, HTTP_STATUS.OK);
});

// Cambiar el rol de un usuario
export const changeRole = asyncHandler(async (req, res) => {
  const user = await userService.updateUserRole(req.params.id, req.body.role, req.user);
  return sendSuccess(res, user, MESSAGES.USER.ROLE_ASSIGNED_SUCCESS, { requestId: req.requestId }, HTTP_STATUS.OK);
});

// Activar o desactivar un usuario
export const setActive = asyncHandler(async (req, res) => {
  const user = await userService.setActiveStatus(req.params.id, req.body.is_active, req.user);
  const msg = req.body.is_active
    ? 'Usuario activado correctamente'
    : 'Usuario desactivado correctamente';

  return sendSuccess(res, user, msg, { requestId: req.requestId }, HTTP_STATUS.OK);
});

// Desbloquear seguridad de usuario
export const unlockUser = asyncHandler(async (req, res) => {
  const user = await userService.unlockUser(req.params.id);
  return sendSuccess(res, user, 'Bloqueo de seguridad restablecido', { requestId: req.requestId }, HTTP_STATUS.OK);
});

// Actualizar perfil propio
export const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateMyProfile(actorId(req.user), req.body);
  return sendSuccess(res, user, MESSAGES.USER.UPDATED_SUCCESS, { requestId: req.requestId }, HTTP_STATUS.OK);
});

// Cambiar contraseña propia
export const changePassword = asyncHandler(async (req, res) => {
  const result = await userService.changeMyPassword(actorId(req.user), {
    currentPassword: req.body.current_password,
    newPassword: req.body.new_password,
  });
  return sendSuccess(res, result, MESSAGES.USER.PASSWORD_CHANGED_SUCCESS, { requestId: req.requestId }, HTTP_STATUS.OK);
});