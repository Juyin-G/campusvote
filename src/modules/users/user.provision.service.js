// src/modules/users/user.provision.service.js
// Provisionamiento de ADMIN (SUPERADMIN only):
//   - provisionAdmin: crea organización + admin
//   - provisionExistingAdmin: crea admin para org existente
//
// Ambos patrones comparten la lógica de bootstrap de credenciales (OTP/QR
// y backup codes). El SECRET/QR se generan en el flujo de setup de TOTP
// del primer login (no se devuelven inline en provisionAdmin).

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as userRepository from './user.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { formatUserResponse } from '../../shared/utils/formatUserResponse.js';
import * as otpUtil from '../../shared/utils/otp.util.js';
import * as otpRepository from '../auth/repositories/otp.repository.js';
import { prisma } from '../../database/prisma.js';
import emailService from '../../shared/services/email.service.js';
import { hashPassword, normalizeDocumentIdentity } from './user.helpers.js';
import MESSAGES from '../../constants/messages.js';

const assertSuperAdmin = (actor) => {
  const isSuperUser =
    actor.isSuperuser || actor.isSuperAdmin || actor.role === ROLES.SUPERADMIN;
  if (!isSuperUser) {
    throw ApiError.forbidden('Solo el superadmin puede crear administradores');
  }
};

/** SUPERADMIN: crea UNA organización y su ADMIN en un solo paso. */
export const provisionAdmin = async (body = {}, actor = {}) => {
  assertSuperAdmin(actor);

  const { organization, admin } = body;
  if (!organization || !admin) {
    throw ApiError.badRequest('Debes enviar la organización y el administrador a crear');
  }

  const { username, email, password, first_name, last_name } = admin;
  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim();

  const existingEmail = await userRepository.findByEmail(cleanEmail);
  if (existingEmail) throw ApiError.conflict(MESSAGES.USER.ALREADY_EXISTS);

  const existingUsername = await userRepository.findByUsername(cleanUsername);
  if (existingUsername) throw ApiError.conflict(MESSAGES.USER.USERNAME_TAKEN);

  // 1. Crear la organización.
  const normalizedCode =
    (organization.code || '').trim().toUpperCase() ||
    cleanUsername.toUpperCase().slice(0, 10);

  const existingOrg = await prisma.organization.findUnique({ where: { code: normalizedCode } });
  if (existingOrg) throw ApiError.conflict('Ya existe una organización con ese código');

  const newOrg = await prisma.organization.create({
    data: {
      name: organization.name.trim(),
      code: normalizedCode,
      orgType: organization.org_type ?? 'UNIVERSITY',
      logo: organization.logo || null,
      primaryColor: organization.primary_color || '#0066CC',
      secondaryColor: organization.secondary_color || '#FFD700',
      country: organization.country?.trim() || 'Perú',
      timezone: organization.timezone?.trim() || 'America/Lima',
      allowedEmailDomains: organization.allowed_email_domains || [],
    },
    select: { id: true, name: true, code: true },
  });

  // 2. Crear el ADMIN asociado.
  const newUser = await userRepository.create({
    username: cleanUsername,
    email: cleanEmail,
    password: await hashPassword(password),
    firstName: first_name,
    lastName: last_name,
    institutionalId: cleanUsername,
    role: ROLES.ADMIN,
    organizationId: newOrg.id,
    mustChangePassword: true,
    isVerified: true,
  });

  const onboardingMode = emailService.hasEmailConfigured() ? 'invitation' : 'temp';

  return {
    organization: newOrg,
    user: formatUserResponse(newUser),
    qrCode: undefined,
    secret: undefined,
    backupCodes: undefined,
    onboarding_mode: onboardingMode,
    must_change_password: true,
    must_setup_2fa: true,
    mustChangePassword: true,
  };
};

/** SUPERADMIN: crea un ADMIN para una organización EXISTENTE. */
export const provisionExistingAdmin = async (organizationId, body = {}, actor = {}) => {
  assertSuperAdmin(actor);

  const targetOrg = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, code: true, allowedEmailDomains: true },
  });
  if (!targetOrg) throw ApiError.notFound('Organización no encontrada');

  const {
    username, email, password, first_name, last_name, document_type, document_number,
  } = body;

  if (!email) throw ApiError.badRequest('El email es obligatorio');

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = (username || cleanEmail.split('@')[0]).toLowerCase().trim();

  const existingEmail = await userRepository.findByEmail(cleanEmail);
  if (existingEmail) throw ApiError.conflict(MESSAGES.USER.ALREADY_EXISTS);

  const existingUsername = await userRepository.findByUsername(cleanUsername);
  if (existingUsername) throw ApiError.conflict(MESSAGES.USER.USERNAME_TAKEN);

  const identity = await normalizeDocumentIdentity({
    document_type,
    document_number,
    role: ROLES.ADMIN,
  });

  const finalPassword = password || crypto.randomBytes(18).toString('base64url');

  const newUser = await userRepository.create({
    username: cleanUsername,
    email: cleanEmail,
    password: await bcrypt.hash(finalPassword, 12),
    firstName: first_name || cleanUsername,
    lastName: last_name || '',
    institutionalId: cleanUsername,
    role: ROLES.ADMIN,
    organizationId: targetOrg.id,
    mustChangePassword: true,
    isVerified: true,
    ...(identity || {}),
  });

  const secret = otpUtil.generateTotpSecret();
  const uri = otpUtil.generateTotpUri(secret, cleanEmail, newUser.username);
  const plainBackupCodes = otpUtil.generateBackupCodes();
  const hashedBackupCodes = plainBackupCodes.map((code) => otpUtil.hashBackupCode(code));

  await otpRepository.saveTotpSecret(newUser.id, secret);
  await otpRepository.enableTwoFactor(newUser.id, hashedBackupCodes);

  const qrCode = await otpUtil.generateQrCode(uri);

  return {
    organization: { id: targetOrg.id, name: targetOrg.name, code: targetOrg.code },
    user: formatUserResponse(newUser),
    qrCode,
    secret,
    backupCodes: plainBackupCodes,
    mustChangePassword: true,
  };
};
