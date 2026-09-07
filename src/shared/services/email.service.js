/**
 * @file email.service.js
 * @description Envío de correos transaccionales (verificación, reset, activación).
 *              Canal único: Gmail API (OAuth2).
 * @module shared/services/email
 */

import env from '../../config/env.js';
import { sendRaw } from './gmail.client.js';

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
