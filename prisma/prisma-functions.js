const { Prisma } = require('@prisma/client');
const prisma = require('./prisma'); // Tu instancia de Prisma

/**
 * Genera un token OTP usando la función segura de PostgreSQL
 */
async function generateOtpToken(userId, ttlMinutes = 5) {
  const result = await prisma.$queryRaw`
    SELECT generate_otp_token(${userId}::uuid, ${ttlMinutes}::int) as raw_code
  `;
  // La función devuelve NULL si falla el rate limit o el usuario no existe
  return result[0]?.raw_code || null;
}

/**
 * Verifica un token OTP
 */
async function verifyOtpToken(userId, rawCode) {
  const result = await prisma.$queryRaw`
    SELECT verify_otp_token(${userId}::uuid, ${rawCode}::text) as is_valid
  `;
  return result[0]?.is_valid === true;
}

/**
 * Genera token de recuperación de contraseña
 */
async function generatePasswordResetToken(email) {
  const result = await prisma.$queryRaw`
    SELECT generate_password_reset_token(${email}::citext) as raw_token
  `;
  return result[0]?.raw_token || null;
}

/**
 * Ejecuta el reset de contraseña de forma atómica y segura
 */
async function resetPasswordWithToken(rawToken, newPasswordHash) {
  const result = await prisma.$queryRaw`
    SELECT reset_password_with_token(${rawToken}::text, ${newPasswordHash}::text) as success
  `;
  return result[0]?.success === true;
}

/**
 * Registra intento fallido de login (Protección contra enumeración de usuarios)
 */
async function registerFailedLogin(email) {
  await prisma.$executeRaw`
    SELECT register_failed_login(${email}::citext)
  `;
}

/**
 * Registra login exitoso
 */
async function registerSuccessfulLogin(email, ipAddress, userAgent) {
  await prisma.$executeRaw`
    SELECT register_successful_login(${email}::citext, ${ipAddress}::varchar, ${userAgent}::text)
  `;
}

module.exports = {
  generateOtpToken,
  verifyOtpToken,
  generatePasswordResetToken,
  resetPasswordWithToken,
  registerFailedLogin,
  registerSuccessfulLogin,
};