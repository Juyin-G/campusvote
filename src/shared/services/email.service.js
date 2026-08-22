/**
 * @file email.service.js
 * @description Envío de correos transaccionales (verificación y reset)
 * @module shared/services/email
 */
import nodemailer from 'nodemailer';

import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { ApiError } from '../errors/ApiError.js';

let transport;

const assertSmtpConfig = () => {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    throw ApiError.internal(
      'Configuración SMTP incompleta. Revise SMTP_HOST, SMTP_USER y SMTP_PASS en .env',
    );
  }
};

const getTransport = () => {
  assertSmtpConfig();

  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      ...(env.NODE_ENV === 'development' && {
        tls: { rejectUnauthorized: false },
      }),
    });
  }

  return transport;
};

const sendMail = async ({ to, subject, html, text }) => {
  try {
    const info = await getTransport().sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
      text,
    });

    logger.info('Correo enviado', { to, subject, messageId: info.messageId });

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
