/**
 * @file email.service.js
 * @description Envío de correos transaccionales (verificación, reset, aprobaciones y notificaciones)
 * @module shared/services/email
 */
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { ApiError } from '../errors/ApiError.js';
import { sendRaw } from './gmail.client.js';

/**
 * Escapa caracteres HTML especiales para prevenir vulnerabilidades de inyección HTML/XSS
 * en los clientes de correo receptores.
 */
const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));

const sendMail = async ({ to, subject, html, text }) => {
  try {
    if (!hasEmailConfigured()) {
      throw ApiError.serviceUnavailable(
        'Gmail no está configurado para enviar correos',
        null,
        'EMAIL_NOT_CONFIGURED',
      );
    }

    const info = await sendRaw({ to, subject, html, text });
    logger.info('Correo enviado por Gmail API', {
      to,
      subject,
      messageId: info.messageId,
    });
    return info;
  } catch (error) {
    logger.error('Error al enviar correo', {
      to,
      subject,
      error: error.message,
      code: error.code,
    });

    const detail =
      env.NODE_ENV === 'development' ? `: ${error.message}` : '';

    throw ApiError.serviceUnavailable(
      `No se pudo enviar el correo electrónico${detail}`,
      env.NODE_ENV === 'development' ? { reason: error.message } : null,
      'EMAIL_SEND_FAILED',
    );
  }
};

/**
 * Indica si el canal Gmail está completamente configurado.
 */
export const hasEmailConfigured = () => {
  return Boolean(
    env.GMAIL_CLIENT_ID &&
      env.GMAIL_CLIENT_SECRET &&
      env.GMAIL_REFRESH_TOKEN &&
      env.GMAIL_FROM,
  );
};

export const sendVerification = async ({ email, token, firstName = 'Usuario' }) => {
  const safeFirstName = escapeHtml(firstName);
  const link = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;

  await sendMail({
    to: email,
    subject: 'Verifica tu cuenta en CampusVote',
    html: `<p>Hola ${safeFirstName},</p><p>Gracias por registrarte en CampusVote. Para activar tu cuenta, verifica tu correo:</p><p><a href="${link}">${link}</a></p><p>Este enlace expira en 24 horas.</p>`,
    text: [
      `Hola ${firstName},`,
      'Verifica tu cuenta en CampusVote:',
      link,
      'Este enlace expira en 24 horas.',
    ].join('\n'),
  });
};

export const sendReset = async ({ email, token }) => {
  const link = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

  await sendMail({
    to: email,
    subject: 'Restablece tu contraseña en CampusVote',
    html: `<p>Recibimos una solicitud para restablecer tu contraseña.</p><p><a href="${link}">${link}</a></p><p>Este enlace expira en 1 hora.</p>`,
    text: ['Restablece tu contraseña en CampusVote:', link, 'Expira en 1 hora.'].join('\n'),
  });
};

export const sendRequestReceived = async ({ email, institutionName }) => {
  const safeInstitution = escapeHtml(institutionName);

  await sendMail({
    to: email,
    subject: 'Solicitud recibida por CampusVote',
    html: `<p>Hemos recibido la solicitud de acceso para <strong>${safeInstitution}</strong>.</p><p>El equipo de CampusVote revisará la información y te notificará el resultado.</p>`,
    text: [
      `Solicitud recibida para ${institutionName}.`,
      'El equipo de CampusVote revisará la información y te notificará el resultado.',
    ].join('\n'),
  });
};

export const sendAdminActivation = async ({ email, institutionName, token }) => {
  const safeInstitution = escapeHtml(institutionName);
  const link = `${env.FRONTEND_URL}/activate-account?token=${encodeURIComponent(token)}`;

  await sendMail({
    to: email,
    subject: `Solicitud aprobada para ${institutionName}`,
    html: `<p>Tu solicitud para <strong>${safeInstitution}</strong> fue aprobada.</p><p>Activa tu cuenta de administrador desde este enlace:</p><p><a href="${link}">${link}</a></p><p>El enlace expira en 24 horas.</p>`,
    text: [
      `Tu solicitud para ${institutionName} fue aprobada.`,
      'Activa tu cuenta de administrador:',
      link,
      'El enlace expira en 24 horas.',
    ].join('\n'),
  });
};

/**
 * Envía la aprobación con credenciales temporales.
 * El usuario recibe su usuario, contraseña temporal y el link para configurar su 2FA.
 */
export const sendAdminApprovalWithCredentials = async ({
  email,
  institutionName,
  username,
  tempPassword,
  token,
}) => {
  const safeInstitution = escapeHtml(institutionName);
  const safeUsername = escapeHtml(username);
  const safeTempPassword = escapeHtml(tempPassword);
  const link = `${env.FRONTEND_URL}/activate-account?token=${encodeURIComponent(token)}`;

  await sendMail({
    to: email,
    subject: `✅ Solicitud aprobada: Bienvenido a ${institutionName}`,
    html: `
      <h2>¡Tu solicitud ha sido aprobada!</h2>
      <p>Tu organización <strong>${safeInstitution}</strong> ha sido creada exitosamente en CampusVote.</p>
      <p>Para ingresar al sistema por primera vez, utiliza las siguientes credenciales temporales:</p>
      <ul>
        <li><strong>Usuario:</strong> ${safeUsername}</li>
        <li><strong>Contraseña temporal:</strong> <code style="background:#f4f4f4; padding:2px 6px; border-radius:4px;">${safeTempPassword}</code></li>
      </ul>
      <p><strong>Importante:</strong> Al hacer clic en el enlace de abajo e iniciar sesión, el sistema te obligará a cambiar esta contraseña y a configurar tu autenticación de dos factores (QR/OTP) por seguridad.</p>
      <p><a href="${link}" style="background-color: #0066CC; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Activar mi cuenta y configurar seguridad</a></p>
      <p><small>Este enlace expira en 24 horas.</small></p>
    `,
    text: [
      `¡Tu solicitud para ${institutionName} ha sido aprobada!`,
      'Tus credenciales temporales son:',
      `Usuario: ${username}`,
      `Contraseña: ${tempPassword}`,
      'Al ingresar, deberás cambiar tu contraseña y configurar tu autenticación de dos factores (QR/OTP).',
      `Enlace de activación: ${link}`,
    ].join('\n'),
  });
};

export const sendFairRegistrationCode = async ({
  email,
  code,
  fairName,
  organizationName,
  minutes = 15,
  firstName = '',
}) => {
  const safeFirstName = escapeHtml(firstName);
  const safeCode = escapeHtml(code);
  const safeFairName = escapeHtml(fairName);
  const safeOrgName = organizationName ? escapeHtml(organizationName) : '';

  const saludoHtml = safeFirstName ? `Hola ${safeFirstName},` : 'Hola,';
  const saludoText = firstName ? `Hola ${firstName},` : 'Hola,';
  const orgHtml = safeOrgName ? ` (${safeOrgName})` : '';

  await sendMail({
    to: email,
    subject: `Tu código de inscripción: ${code}`,
    html: `<p>${saludoHtml}</p><p>Este es tu código para inscribir tu proyecto en <strong>${safeFairName}</strong>${orgHtml}:</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold">${safeCode}</p><p>Vence en ${minutes} minutos.</p>`,
    text: [
      saludoText,
      `Código para inscribir tu proyecto en ${fairName}: ${code}`,
      `Vence en ${minutes} minutos.`,
    ].join('\n'),
  });
};

export const sendProjectReviewNotice = async ({
  email,
  projectName,
  fairName,
  decision,
  reviewNotes = '',
  link = null,
  firstName = '',
}) => {
  const safeFirstName = escapeHtml(firstName);
  const safeProjectName = escapeHtml(projectName);
  const safeFairName = escapeHtml(fairName);
  const safeNotes = escapeHtml(reviewNotes);

  const saludoHtml = safeFirstName ? `Hola ${safeFirstName},` : 'Hola,';
  const saludoText = firstName ? `Hola ${firstName},` : 'Hola,';

  const aprobado = decision === 'APPROVED';
  const subject = aprobado
    ? `Tu proyecto "${projectName}" fue aprobado`
    : `Tu proyecto "${projectName}" tiene observaciones`;

  const invitacionHtml = link
    ? `<p>Corrígelas y vuelve a enviarlo desde aquí:</p><p><a href="${link}">${link}</a></p>`
    : '';

  const cuerpoHtml = aprobado
    ? `<p>Tu proyecto <strong>${safeProjectName}</strong> quedó aprobado para ${safeFairName}.</p>`
    : `<p>La revisión de <strong>${safeProjectName}</strong> (${safeFairName}) encontró observaciones:</p><blockquote>${safeNotes}</blockquote>${invitacionHtml}`;

  await sendMail({
    to: email,
    subject,
    html: `<p>${saludoHtml}</p>${cuerpoHtml}`,
    text: [
      saludoText,
      aprobado
        ? `Tu proyecto ${projectName} fue aprobado para ${fairName}.`
        : `Observaciones de ${projectName} (${fairName}): ${reviewNotes}`,
      link && !aprobado ? `Corrige y reenvía: ${link}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  });
};

export { sendAdminActivation as sendActivation };

export default {
  hasEmailConfigured,
  sendVerification,
  sendReset,
  sendRequestReceived,
  sendAdminActivation,
  sendActivation: sendAdminActivation,
  sendAdminApprovalWithCredentials,
  sendFairRegistrationCode,
  sendProjectReviewNotice,
};