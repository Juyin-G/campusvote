// src/modules/users/user.profile.service.js
// Auto-servicio del usuario autenticado: updateMyProfile + changeMyPassword.

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as userRepository from './user.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { formatUserResponse } from '../../shared/utils/formatUserResponse.js';
import { prisma } from '../../database/prisma.js';
import { normalizeDocumentIdentity } from './user.helpers.js';
import MESSAGES from '../../constants/messages.js';

export const updateMyProfile = async (userId, body = {}) => {
  const data = {};
  if (body.first_name !== undefined) data.firstName = body.first_name;
  if (body.last_name !== undefined) data.lastName = body.last_name;
  if (body.document_type !== undefined || body.document_number !== undefined) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, documentType: true, documentNumber: true },
    });
    const identity = await normalizeDocumentIdentity({
      document_type: body.document_type ?? existing?.documentType,
      document_number: body.document_number ?? existing?.documentNumber,
      role: existing?.role,
    });
    if (identity) {
      data.documentType = identity.documentType;
      data.documentNumber = identity.documentNumber;
    }
  }

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }

  const updated = await userRepository.update(userId, data);
  return formatUserResponse(updated);
};

export const changeMyPassword = async (userId, body = {}) => {
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }
  if (newPassword.length < 8) {
    throw ApiError.badRequest(MESSAGES.USER.PASSWORD_TOO_WEAK);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, status: true },
  });
  if (dbUser?.status !== 'ACTIVE' || !dbUser.password) {
    throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
  }

  const matches = await bcrypt.compare(currentPassword, dbUser.password);
  if (!matches) {
    throw ApiError.badRequest('La contraseña actual es incorrecta');
  }

  // Evita newPassword === currentPassword (timing-safe).
  const currentBuf = crypto.createHash('sha256').update(currentPassword).digest();
  const newBuf = crypto.createHash('sha256').update(newPassword).digest();
  if (crypto.timingSafeEqual(currentBuf, newBuf)) {
    throw ApiError.badRequest(MESSAGES.USER.PASSWORD_SAME_AS_OLD);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: await bcrypt.hash(newPassword, 12),
      mustChangePassword: false,
    },
  });

  return { changed: true };
};
