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
let resend;

/**
 * Indica si hay algún canal de envío de correo configurado.
 * Con esto el onboarding decide entre invitar por email (Opción 1) o crear
 * credenciales temporales (Opción 2).
 */
export const hasEmailConfigured = () => {
  return Boolean(env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS));
};

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

const getResend = async () => {
  if (!resend) {
    // Import dinámico: evita cargar Resend si no se usa
    const { Resend } = await import('resend');
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
};

const sendMail = async ({ to, subject, html, text }) => {
  try {
    if (env.RESEND_API_KEY) {
      const client = await getResend();
      const { data, error } = await client.emails.send({
        from: env.RESEND_FROM,
        to,
        subject,
        html,
        text,
      });

      if (error) {
        throw new Error(error.message);
      }

      logger.info('Correo enviado (Resend)', { to, subject, messageId: data?.id });

      return data;
    }

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

export const sendActivation = async ({
  email,
  token,
  firstName = 'Administrador',
}) => {
  const link = `${env.FRONTEND_URL}/activate-account?token=${encodeURIComponent(token)}`;

  await sendMail({
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
