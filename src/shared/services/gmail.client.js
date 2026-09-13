/**
 * @file gmail.client.js
 * @description Cliente Gmail API (OAuth2) singleton con helper de envío MIME.
 *
 * Usa un refresh_token persistente.
 * googleapis obtiene/renueva automáticamente el access_token cuando es necesario.
 */

import { google } from 'googleapis';
import crypto from 'node:crypto';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { ApiError } from '../errors/ApiError.js';

let oauth2Client;
let gmail;

/**
 * Verifica que las credenciales necesarias de Gmail estén presentes.
 *
 * GMAIL_REDIRECT_URI es opcional cuando se utiliza un refresh_token
 * previamente generado.
 */
const assertGmailConfig = () => {
  const required = [
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
    'GMAIL_FROM',
  ];

  const missing = required.filter((key) => !env[key]);

  if (missing.length) {
    const detail =
      env.NODE_ENV === 'development'
        ? `: faltan ${missing.join(', ')}`
        : '';

    throw ApiError.serviceUnavailable(
      `Configuración Gmail API incompleta${detail}`,
      env.NODE_ENV === 'development' ? { missing } : null,
      'EMAIL_AUTH_FAILED',
    );
  }
};

/**
 * Crea el OAuth2 client una sola vez.
 *
 * El refresh_token se utiliza para obtener access_tokens temporales.
 * No almacenamos manualmente el access_token.
 */
const getOAuthClient = () => {
  if (!oauth2Client) {
    assertGmailConfig();

    oauth2Client = new google.auth.OAuth2(
      env.GMAIL_CLIENT_ID,
      env.GMAIL_CLIENT_SECRET,
      env.GMAIL_REDIRECT_URI || undefined,
    );

    oauth2Client.setCredentials({
      refresh_token: env.GMAIL_REFRESH_TOKEN,
    });
  }

  return oauth2Client;
};

/**
 * Devuelve la instancia Gmail API autenticada.
 */
const getGmail = () => {
  if (!gmail) {
    gmail = google.gmail({
      version: 'v1',
      auth: getOAuthClient(),
    });
  }

  return gmail;
};

const encodeBase64Url = (value) => {
  let encoded = Buffer.from(value, 'utf8').toString('base64');

  encoded = encoded.replaceAll('+', '-').replaceAll('/', '_');

  while (encoded.endsWith('=')) {
    encoded = encoded.slice(0, -1);
  }

  return encoded;
};

/**
 * Codifica un subject UTF-8 según RFC 2047.
 */
const encodeSubject = (subject) => {
  const encoded = Buffer.from(subject, 'utf8').toString('base64');

  return `=?UTF-8?B?${encoded}?=`;
};

/**
 * Construye un mensaje MIME multipart/alternative.
 */
const buildRawMessage = ({ from, to, subject, html, text }) => {
  const boundary = `cv_${Date.now()}_${crypto.randomUUID()}`;

  const safeText = text || '';
  const safeHtml = html || '';

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    safeText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    safeHtml,
    '',
    `--${boundary}--`,
  ];

  const mime = lines.join('\r\n');

  return encodeBase64Url(mime);
};

/**
 * Envía un correo usando Gmail API.
 *
 * Errores:
 *  - EMAIL_AUTH_FAILED: fallo de autenticación OAuth.
 *  - EMAIL_RATE_LIMITED: límite/cuota de Gmail.
 *  - EMAIL_SEND_FAILED: otro fallo de Gmail API.
 */
export const sendRaw = async ({ to, subject, html, text }) => {
  assertGmailConfig();

  const client = getOAuthClient();

  /*
   * Primero verificamos explícitamente que el refresh_token
   * pueda convertirse en un access_token.
   *
   * Esto permite distinguir un problema OAuth de un problema
   * posterior al enviar el mensaje.
   */
  try {
    const tokenResponse = await client.getAccessToken();

    if (!tokenResponse?.token) {
      throw new Error('Google no devolvió access_token');
    }

    logger.debug('Gmail OAuth autenticado correctamente');
  } catch (error) {
    logger.error('Error al obtener access token de Gmail', {
      code: error?.code,
      status: error?.response?.status,
      googleError: error?.response?.data?.error,
      googleErrorDescription:
        error?.response?.data?.error_description,
      message: error?.message,
    });

    throw ApiError.emailAuthFailed(
      'No se pudo obtener el access token de Gmail',
    );
  }

  const raw = buildRawMessage({
    from: env.GMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  try {
    const res = await getGmail().users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
      },
    });

    logger.info('Correo enviado (Gmail API)', {
      to,
      subject,
      messageId: res.data.id,
    });

    return res.data;
  } catch (error) {
    const googleError = error?.response?.data?.error;
    const status = error?.response?.status ?? error?.code;

    logger.error('Error al enviar correo (Gmail API)', {
      to,
      subject,
      status,
      googleError,
      googleErrorDescription:
        error?.response?.data?.error_description,
      message: error?.message,
    });

    if (status === 401) {
      throw ApiError.emailAuthFailed(
        'Gmail rechazó las credenciales OAuth',
      );
    }

    if (
      status === 429 ||
      googleError === 'rateLimitExceeded' ||
      googleError === 'quotaExceeded' ||
      googleError === 'userRateLimitExceeded'
    ) {
      throw ApiError.emailRateLimited(
        'Gmail API: cuota excedida. Reintenta más tarde.',
      );
    }

    const detail =
      env.NODE_ENV === 'development'
        ? `: ${error.message}`
        : '';

    throw ApiError.serviceUnavailable(
      `No se pudo enviar el correo electrónico${detail}`,
      env.NODE_ENV === 'development'
        ? { reason: error.message }
        : null,
      'EMAIL_SEND_FAILED',
    );
  }
};
