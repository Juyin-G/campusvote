/**
 * @file email.service.js
 * @description Envío de correos transaccionales (verificación y reset)
 * @module shared/services/email
 */
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { ApiError } from '../errors/ApiError.js';
import { sendRaw } from './gmail.client.js';

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
 * Indica si el canal Gmail está completamente configurado. El onboarding
 * usa esto para decidir entre "invitar por email" (verificación) o
 * "credenciales temporales" cuando el email no está disponible.
 */
export const hasEmailConfigured = () => {
  return Boolean(
    env.GMAIL_CLIENT_ID
      && env.GMAIL_CLIENT_SECRET
      && env.GMAIL_REFRESH_TOKEN
      && env.GMAIL_FROM,
  );
};

export const sendVerification = async ({
  email,
  token,
  firstName = 'Usuario',
}) => {
  const link = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;

  await sendMail({
    to: email,
    subject: 'Verifica tu cuenta en CampusVote',
    html: `
      <p>Hola ${firstName},</p>
      <p>Gracias por registrarte en CampusVote. Para activar tu cuenta, verifica tu correo:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Este enlace expira en 24 horas.</p>
      <p>Si no creaste esta cuenta, ignora este mensaje.</p>
    `,
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
    html: `
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p><a href="${link}">${link}</a></p>
      <p>Este enlace expira en 1 hora.</p>
      <p>Si no solicitaste este cambio, ignora este correo.</p>
    `,
    text: ['Restablece tu contraseña en CampusVote:', link, 'Expira en 1 hora.'].join(
      '\n',
    ),
  });
};

export const sendRequestReceived = async ({
  email,
  institutionName,
}) => {
  await sendMail({
    to: email,
    subject: 'Solicitud recibida por CampusVote',
    html: `
      <p>Hemos recibido la solicitud de acceso para <strong>${institutionName}</strong>.</p>
      <p>El equipo de CampusVote revisará la información y te notificará el resultado.</p>
    `,
    text: [
      `Solicitud recibida para ${institutionName}.`,
      'El equipo de CampusVote revisará la información y te notificará el resultado.',
    ].join('\n'),
  });
};

export const sendAdminActivation = async ({
  email,
  institutionName,
  token,
}) => {
  const link = `${env.FRONTEND_URL}/activate-account?token=${encodeURIComponent(token)}`;

  await sendMail({
    to: email,
    subject: `Solicitud aprobada para ${institutionName}`,
    html: `
      <p>Tu solicitud para <strong>${institutionName}</strong> fue aprobada.</p>
      <p>Activa tu cuenta de administrador desde este enlace:</p>
      <p><a href="${link}">${link}</a></p>
      <p>El enlace expira en 24 horas.</p>
    `,
    text: [
      `Tu solicitud para ${institutionName} fue aprobada.`,
      'Activa tu cuenta de administrador:',
      link,
      'El enlace expira en 24 horas.',
    ].join('\n'),
  });
};

// Alias semántico para backward compatibility (algunos tests importan `sendActivation`).
export { sendAdminActivation as sendActivation };

export default {
  hasEmailConfigured,
  sendVerification,
  sendReset,
  sendRequestReceived,
  sendAdminActivation,
  sendActivation: sendAdminActivation,
};
