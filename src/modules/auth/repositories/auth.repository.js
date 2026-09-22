/**
 * Auth Repository
 * Interacción directa con tabla users, refresh_tokens + funciones SQL nativas
 */
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../../../database/prisma.js';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const removeAccents = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const userAuthSelect = {
  id: true,
  email: true,
  username: true,
  password: true,
  authProvider: true,
  role: true,
  status: true,
  isVerified: true,
  isStaff: true,
  isSuperuser: true,
  firstName: true,
  lastName: true,
  institutionalId: true,
  organizationId: true,
  scopeLevel: true,
  regionId: true,
  facultyId: true,
  programId: true,
  currentCycle: true,
  mustChangePassword: true,
  mustSetup2fa: true,
  twoFactorEnabled: true,
  twoFactorSecret: true,
  twoFactorBackupCodes: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  lastLogin: true,
};

// BÚSQUEDAS

export const findByEmail = async (email) => {
  return prisma.user.findUnique({
    where: { email },
    select: userAuthSelect,
  });
};

export const findById = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      authProvider: true,
      role: true,
      status: true,
      isVerified: true,
      isStaff: true,
      isSuperuser: true,
      firstName: true,
      lastName: true,
      institutionalId: true,
      organizationId: true,
      facultyId: true,
      programId: true,
      currentCycle: true,
      mustChangePassword: true,
      mustSetup2fa: true,
      twoFactorEnabled: true,
      lastLogin: true,
      dateJoined: true,
    },
  });
};

export const findByUsername = async (username) => {
  return prisma.user.findUnique({
    where: { username },
  });
};

// CREACIÓN DE USUARIO CON CONSTRAINTS ACADÉMICOS

export const createUser = async (data) => {
  return prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      institutionalId: data.institutionalId,
      role: data.role || 'STUDENT',
      authProvider: data.authProvider || 'LOCAL',
      organizationId: data.organizationId || null,
      facultyId: data.facultyId || null,
      programId: data.programId || null,
      careerId: data.careerId || null,
      currentCycle: data.currentCycle || null,
      admissionPeriodId: data.admissionPeriodId || null,
      specialty: data.specialty || null,
      department: data.department || null,
      mustChangePassword: data.mustChangePassword ?? false,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      dateJoined: true,
    },
  });
};

// FUNCIONES SQL NATIVAS - LOGIN SECURITY & AUDITORÍA

export const loginIsAllowed = async (email) => {
  const result = await prisma.$queryRaw`
    SELECT login_is_allowed(${email}::text::citext) AS allowed
  `;

  return result[0]?.allowed ?? false;
};

export const registerFailedLogin = async (email) => {
  await prisma.$executeRaw`
    SELECT register_failed_login(${email}::text::citext)
  `;
};

export const registerSuccessfulLogin = async (email, ipAddress = null, userAgent = null) => {
  await prisma.$executeRaw`
    SELECT register_successful_login(
      ${email}::text::citext, 
      ${ipAddress}::text, 
      ${userAgent}::text
    )
  `;
};

// ACTIVACIÓN DE ADMIN (flujo de organización)
// Replica la lógica de la función SQL heredada `activate_organization_request`
// vía Prisma, seteando scope_level = ORG (exigencia del modelo multi-sede vigente).

export const activateOrganizationWithToken = async (rawToken, passwordHash) => {
  if (!rawToken || !passwordHash || !rawToken.trim() || !passwordHash.trim()) {
    return null;
  }

  const tokenHash = sha256(rawToken);

  return prisma.$transaction(async (tx) => {
    const requests = await tx.$queryRaw`
      SELECT id,
             institution_name,
             institution_type,
             country,
             estimated_members,
             contact_email
      FROM organization_requests
      WHERE activation_token_hash = ${tokenHash}
        AND activation_used = FALSE
        AND activation_expires_at > CURRENT_TIMESTAMP
        AND status = 'APPROVED'
      FOR UPDATE
    `;

    const request = requests[0];
    if (!request) return null;

    const org = await createOrganizationFromRequest(tx, request);
    const userId = await createAdminUserFromRequest(tx, request, org.id, passwordHash);

    await tx.$executeRaw`
      UPDATE organization_requests SET activation_used = TRUE WHERE id = ${request.id}::uuid
    `;

    return userId;
  });
};

const createOrganizationFromRequest = async (tx, request) => {
  const baseSlug =
    removeAccents(request.institution_name)
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 10) || 'ORG';

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await tx.organization.create({
        data: {
          name: request.institution_name,
          code: `${baseSlug}_${randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase()}`,
          orgType: request.institution_type,
          country: request.country,
          onboardingCompleted: false,
          memberLimit: request.estimated_members ?? 100,
        },
        select: { id: true },
      });
    } catch (error) {
      // P2002: colisión de código de organización — reintentar con nuevo sufijo.
      lastError = error;
      if (error?.code !== 'P2002' || attempt === 3) throw lastError;
    }
  }
  throw lastError;
};

const createAdminUserFromRequest = async (tx, request, orgId, passwordHash) => {
  const localpart =
    request.contact_email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '') || 'admin';

  const username = await resolveUniqueUsername(tx, localpart);
  const institutionalId = await resolveUniqueInstitutionalId(tx, localpart);

  const user = await tx.user.create({
    data: {
      email: request.contact_email,
      username,
      password: passwordHash,
      authProvider: 'LOCAL',
      role: 'ADMIN',
      status: 'PENDING_ACTIVATION',
      organization: { connect: { id: orgId } },
      isVerified: true,
      mustChangePassword: false,
      mustSetup2fa: true,
      scopeLevel: 'ORG',
      institutionalId,
      firstName: 'Administrador',
      lastName: '',
    },
    select: { id: true },
  });

  return user.id;
};

const resolveUniqueUsername = async (tx, localpart) => {
  let candidate = localpart;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!(await tx.user.findUnique({ where: { username: candidate } }))) {
      return candidate;
    }
    candidate = `${localpart}_${randomUUID().replace(/-/g, '').slice(0, 4)}`;
  }
  throw new Error('No fue posible generar un username único.');
};

const resolveUniqueInstitutionalId = async (tx, localpart) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${localpart}-ADMIN-${randomUUID()
      .replace(/-/g, '')
      .slice(0, 8)
      .toUpperCase()}`.slice(0, 30);
    if (!(await tx.user.findUnique({ where: { institutionalId: candidate } }))) {
      return candidate;
    }
  }
  throw new Error('No fue posible generar un identificador único.');
};

// FUNCIONES SQL NATIVAS - PASSWORD RESET

export const generatePasswordResetToken = async (email) => {
  const result = await prisma.$queryRaw`
    SELECT generate_password_reset_token(${email}::text::citext) AS token
  `;

  return result[0]?.token;
};

export const resetPasswordWithToken = async (token, newPasswordHash) => {
  const result = await prisma.$queryRaw`
    SELECT reset_password_with_token(${token}::text, ${newPasswordHash}::text) AS success
  `;

  return result[0]?.success ?? false;
};

// FUNCIONES SQL NATIVAS - EMAIL VERIFICATION

export const generateEmailVerificationToken = async (userId) => {
  const result = await prisma.$queryRaw`
    SELECT generate_email_verification_token(${userId}::text::uuid) AS token
  `;

  return result[0]?.token;
};

export const verifyEmailWithToken = async (token) => {
  const result = await prisma.$queryRaw`
    SELECT verify_email_with_token(${token}::text) AS success
  `;

  return result[0]?.success ?? false;
};

// GESTIÓN DE REFRESH TOKENS (SESIONES)

export const createSession = async ({ userId, tokenHash, ipAddress = null, userAgent = null, ttlSeconds }) => {
  const expiresAt = new Date(Date.now() + (ttlSeconds || 60 * 60 * 24 * 30) * 1000);
  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      deviceInfo: userAgent ? { userAgent } : undefined,
    },
  });
};

export const revokeSession = async (userId, tokenHash) => {
  return prisma.refreshToken.deleteMany({
    where: { userId, tokenHash },
  });
};

export const createRefreshToken = async ({ userId, tokenHash, expiresAt, ipAddress = null, userAgent = null }) => {
  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      deviceInfo: userAgent ? { userAgent } : undefined,
    },
  });
};

export const findRefreshToken = async (tokenHash) => {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
};

export const revokeRefreshToken = async (tokenHash) => {
  return prisma.refreshToken.deleteMany({
    where: { tokenHash },
  });
};

export const revokeAllUserRefreshTokens = async (userId) => {
  return prisma.refreshToken.deleteMany({
    where: { userId },
  });
};

// ACTUALIZACIONES DE USUARIO

export const updateLastLogin = async (userId) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      lastLogin: new Date(),
    },
  });
};

export const updatePassword = async (userId, newPasswordHash) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      password: newPasswordHash,
      mustChangePassword: false,
    },
  });
};

// 2FA - TOTP

export const saveTwoFactorSecret = async (userId, secret) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
    },
  });
};

export const enableTwoFactor = async (userId, backupCodes) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: backupCodes,
    },
  });
};

export const disableTwoFactor = async (userId) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });
};

export const updateBackupCodes = async (userId, backupCodes) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorBackupCodes: backupCodes,
    },
  });
};