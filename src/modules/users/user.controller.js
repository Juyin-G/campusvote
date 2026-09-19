/**
 * User Controller
 * Capa HTTP: recibe request, delega a user.service, responde JSON.
 */
import * as userService from './user.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';
import MESSAGES from '../../constants/messages.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { generateProvisionedUsersPdf } from '../../services/usersProvisionedPdf.service.js';

const actorId = (user) => user?.userId ?? user?.id;

// Listar usuarios paginados.
// El sub-router aplica attachScopeUserFilter(req) → req.scope.userWhere;
// el service lo consume a través del actor.
export const listUsers = asyncHandler(async (req, res) => {
  const actor = req.user || {};
  if (req.scope && req.scope.userWhere) {
    actor._scopeWhere = req.scope.userWhere;
  }
  const { users, pagination } = await userService.listUsers(req.query, actor);

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

// SUPERADMIN: crear una organización y su administrador, entregando OTP/QR de primer acceso
export const provisionAdmin = asyncHandler(async (req, res) => {
  const result = await userService.provisionAdmin(req.body, req.user);
  return sendSuccess(
    res,
    result,
    'Organización y administrador creados. Se procesa la activación del acceso.',
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

export const provisionExistingAdmin = asyncHandler(async (req, res) => {
  const result = await userService.provisionExistingAdmin(
    req.params.organizationId,
    req.body,
    req.user
  );
  return sendSuccess(
    res,
    result,
    'Administrador creado. Se procesa la activación de su acceso.',
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

// ADMIN: crear jurados/usuarios en lote (bulk)
export const createUsersBulk = asyncHandler(async (req, res) => {
  const result = await userService.createUsersBulk(req.body, req.user);
  return sendSuccess(res, result, 'Usuarios procesados', { requestId: req.requestId }, HTTP_STATUS.CREATED);
});

// Actualizar usuario por ID
export const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user);
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
  const user = await userService.unlockUser(req.params.id, req.user);
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

// Soft delete: status=SUSPENDED.
export const softDeleteUser = asyncHandler(async (req, res) => {
  const id = req.params.id;
  try {
    await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
    return res.status(HTTP_STATUS.NO_CONTENT).end();
  } catch (err) {
    if (err?.code === 'P2025') throw ApiError.notFound('Usuario no encontrado');
    throw err;
  }
});

// PUT /:id/academic — datos académicos del usuario (delegado inline al controller
// para mantener la ruta compacta; antes vivía en el router).
export const updateAcademic = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const data = {};
  if (req.body.faculty_id !== undefined) data.facultyId = req.body.faculty_id;
  if (req.body.program_id !== undefined) data.programId = req.body.program_id;
  if (req.body.career_id !== undefined) data.careerId = req.body.career_id;
  if (req.body.current_cycle !== undefined) data.currentCycle = req.body.current_cycle;
  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest('No hay campos para actualizar');
  }
  const updated = await prisma.user.update({ where: { id }, data });
  return sendSuccess(res, { user: updated }, 'Datos académicos actualizados', { requestId: req.requestId }, HTTP_STATUS.OK);
});

/** POST /api/users/bulk/pdf — genera PDF del lote (solo ADMIN ORG). */
export const bulkPdf = asyncHandler(async (req, res, next) => {
  try {
    const actor = req.user || {};
    const { organization_id: orgId, users: userList, temp_passwords: tempPwds } = req.body || {};
    if (orgId !== actor.organizationId) {
      throw ApiError.forbidden('Solo para usuarios de tu organización');
    }
    if (req.user.scopeLevel && req.user.scopeLevel !== 'ORG') {
      throw ApiError.forbidden('Solo ADMIN ORG puede generar el PDF consolidado del lote');
    }

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, code: true },
    });
    if (!organization) throw ApiError.notFound('Organización no encontrada');

    const enriched = (userList || []).map((u) => ({
      ...u,
      _tempPassword: tempPwds?.[u.email],
    }));
    const buffer = await generateProvisionedUsersPdf({
      organization,
      generatedBy: req.user?.email || req.user?.username || 'ADMIN',
      generatedAt: new Date(),
      users: enriched,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="carga-masiva-${organization.code}-${new Date().toISOString().slice(0, 10)}.pdf"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default {
  listUsers,
  getMe,
  getUserById,
  createUser,
  provisionAdmin,
  provisionExistingAdmin,
  createUsersBulk,
  updateUser,
  changeRole,
  setActive,
  unlockUser,
  updateMe,
  changePassword,
  softDeleteUser,
  updateAcademic,
  bulkPdf,
};