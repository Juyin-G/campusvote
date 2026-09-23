/**
 * @file email.service.js
 * @description Envío de correos transaccionales (verificación y reset)
 * @module shared/services/email
 */
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { ApiError } from '../errors/ApiError.js';
import { sendRaw } from './gmail.client.js';

const NEWLINE = String.fromCharCode(10);

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

/**
 * Código de 6 dígitos de la página pública de inscripción de proyectos.
 * Es la única prueba de que el correo institucional es de quien lo escribe.
 */
export const sendFairRegistrationCode = async ({
  email,
  code,
  fairName,
  organizationName,
  minutes = 15,
  firstName = '',
}) => {
  const saludo = firstName ? `Hola ${firstName},` : 'Hola,';

  await sendMail({
    to: email,
    subject: `Tu código de inscripción: ${code}`,
    html: `
      <p>${saludo}</p>
      <p>Este es tu código para inscribir tu proyecto en <strong>${fairName}</strong>${
        organizationName ? ` (${organizationName})` : ''
      }:</p>
      <p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p>
      <p>Vence en ${minutes} minutos y solo sirve para esta feria.</p>
      <p>Si no pediste este código, ignora este correo: nadie puede inscribir nada sin él.</p>
    `,
    text: [
      saludo,
      `Código para inscribir tu proyecto en ${fairName}: ${code}`,
      `Vence en ${minutes} minutos.`,
      'Si no pediste este código, ignora este correo.',
    ].join(NEWLINE),
  });
};

/**
 * Resultado de la revisión de un proyecto. Cuando hay observaciones, el correo
 * las incluye y lleva de vuelta a la página de inscripción para corregir.
 */
export const sendProjectReviewNotice = async ({
  email,
  projectName,
  fairName,
  decision,
  reviewNotes = '',
  link = null,
  firstName = '',
}) => {
  const saludo = firstName ? `Hola ${firstName},` : 'Hola,';
  const aprobado = decision === 'APPROVED';
  const subject = aprobado
    ? `Tu proyecto "${projectName}" fue aprobado`
    : `Tu proyecto "${projectName}" tiene observaciones`;

  // Enlace de vuelta a la página pública (solo tiene sentido si hay que corregir).
  const invitacionHtml = link
    ? `<p>Corrígelas y vuelve a enviarlo desde aquí:</p><p><a href="${link}">${link}</a></p>`
    : '';

  const cuerpoHtml = aprobado
    ? `<p>Tu proyecto <strong>${projectName}</strong> quedó aprobado para ${fairName}.</p>`
    : `
      <p>La revisión de <strong>${projectName}</strong> (${fairName}) encontró observaciones:</p>
      <blockquote>${reviewNotes}</blockquote>
      ${invitacionHtml}
    `;

  await sendMail({
    to: email,
    subject,
    html: `<p>${saludo}</p>${cuerpoHtml}`,
    text: [
      saludo,
      aprobado
        ? `Tu proyecto ${projectName} fue aprobado para ${fairName}.`
        : `Observaciones de ${projectName} (${fairName}): ${reviewNotes}`,
      link && !aprobado ? `Corrige y reenvía: ${link}` : '',
    ]
      .filter(Boolean)
      .join(NEWLINE),
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
  sendFairRegistrationCode,
  sendProjectReviewNotice,
};
