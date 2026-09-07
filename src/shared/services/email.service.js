/**
 * @file email.service.js
 * @description Envío de correos transaccionales (verificación, reset, activación).
 *              Canal único: Gmail API (OAuth2).
 * @module shared/services/email
 */

import env from '../../config/env.js';
import { sendRaw } from './gmail.client.js';
import MESSAGES from '../../constants/messages.js';
import { formatMessage } from '../../constants/index.js';

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
      && env.GMAIL_REDIRECT_URI
      && env.GMAIL_FROM,
  );
};

/**
 * Email de verificación de cuenta. Link de 24h.
 */
export const sendVerification = async ({
  email,
  token,
  firstName = 'Usuario',
}) => {
  const link = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;

  await sendRaw({
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

/**
 * Email de reseteo de contraseña. Link de 1h.
 */
export const sendReset = async ({ email, token }) => {
  const link = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

  await sendRaw({
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

/**
 * Email de activación para administrador invitado por una organización. Link de 24h.
 */
export const sendActivation = async ({
  email,
  token,
  firstName = 'Administrador',
}) => {
  const link = `${env.FRONTEND_URL}/activate-account?token=${encodeURIComponent(token)}`;

  await sendRaw({
    to: email,
    subject: 'Activa tu cuenta de administrador en CampusVote',
    html: `
      <p>Hola ${firstName},</p>
      <p>Fuiste asignado como administrador en CampusVote. Para activar tu cuenta y configurar tu acceso, usa este enlace:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Este enlace expira en 24 horas.</p>
      <p>Si no esperabas este correo, ignóralo.</p>
    `,
    text: [
      `Hola ${firstName},`,
      'Activa tu cuenta de administrador en CampusVote:',
      link,
      'Este enlace expira en 24 horas.',
    ].join('\n'),
  });
};

/**
 * Email automático cuando un visitante envía una solicitud de organización
 * desde /solicitar-acesso. El link apunta al propio FRONTEND_URL en Render.
 * No interrumpe el flujo: si falla el envío, el caller hace try/catch y sigue.
 */
export const sendRequestReceived = async ({ email, institutionName }) => {
  const link = env.FRONTEND_URL;

  const body = formatMessage(MESSAGES.REQUEST.RECEIVED_BODY, {
    institution: institutionName,
  });

  await sendRaw({
    to: email,
    subject: MESSAGES.REQUEST.RECEIVED_SUBJECT,
    html: `
      <p>${MESSAGES.REQUEST.RECEIVED_HEADING}</p>
      <p>${body}</p>
      <p><a href="${link}">${MESSAGES.REQUEST.RECEIVED_CTA}</a></p>
      <p><small>${MESSAGES.REQUEST.RECEIVED_FOOTER}</small></p>
    `,
    text: [
      MESSAGES.REQUEST.RECEIVED_HEADING,
      body,
      `${MESSAGES.REQUEST.RECEIVED_CTA}: ${link}`,
      MESSAGES.REQUEST.RECEIVED_FOOTER,
    ].join('\n'),
  });
};

/**
 * Email de activación accionable: enviado cuando el SUPERADMIN aprueba una
 * solicitud de organización y la Opción B ya creó el User admin con su
 * activation_token. El link lleva a /activate-account?token=... y permite
 * al visitante definir contraseña + completar el onboarding (TOTP).
 *
 * A diferencia de `sendRequestApproved` (Opción A, solo informativo), este
 * helper SÍ permite que el admin complete el ciclo por su cuenta.
 */
export const sendAdminActivation = async ({
  email,
  institutionName,
  token,
}) => {
  const link = `${env.FRONTEND_URL}/activate-account?token=${encodeURIComponent(token)}`;

  await sendRaw({
    to: email,
    subject: 'Fuiste asignado como administrador — CampusVote',
    html: `
      <p>Hola,</p>
      <p>Tu solicitud para "${institutionName}" fue aprobada. Fuiste asignado como
      administrador de esta organización en CampusVote.</p>
      <p>Para activar tu cuenta, define tu contraseña y configura tu 2FA haciendo clic aquí:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Este enlace expira en 24 horas.</p>
      <p>Si no esperabas este correo, ignóralo.</p>
    `,
    text: [
      'Hola,',
      `Tu solicitud para "${institutionName}" fue aprobada.`,
      'Activa tu cuenta aqui (expira en 24 horas):',
      link,
    ].join('\n'),
  });
};

/**
 * Email informativo cuando el SUPERADMIN aprueba una solicitud. NO incluye
 * link de activación porque la función SQL actual no crea User ni token:
 * es un aviso de cortesía. Si en el futuro se implementa Opción B
 * (creación automática de User + invitation_token), este helper debería
 * moverse o reemplazarse por uno que envíe el link a /activate-account.
 */
export const sendRequestApproved = async ({
  email,
  institutionName,
  approverName,
}) => {
  const link = env.FRONTEND_URL;

  const body = formatMessage(MESSAGES.REQUEST.APPROVED_BODY, {
    institution: institutionName,
    approver: approverName,
  });

  await sendRaw({
    to: email,
    subject: MESSAGES.REQUEST.APPROVED_SUBJECT,
    html: `
      <p>${MESSAGES.REQUEST.APPROVED_HEADING}</p>
      <p>${body}</p>
      <p><a href="${link}">${MESSAGES.REQUEST.APPROVED_CTA}</a></p>
      <p><small>${MESSAGES.REQUEST.APPROVED_FOOTER}</small></p>
    `,
    text: [
      MESSAGES.REQUEST.APPROVED_HEADING,
      body,
      `${MESSAGES.REQUEST.APPROVED_CTA}: ${link}`,
      MESSAGES.REQUEST.APPROVED_FOOTER,
    ].join('\n'),
  });
};
