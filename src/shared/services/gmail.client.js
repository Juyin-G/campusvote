/**
 * @file gmail.client.js
 * @description Cliente Gmail API (OAuth2) singleton con helper de envío MIME.
 * Usa refresh_token; el access_token lo refresca el propio SDK al detectar 401.
 */

import { google } from 'googleapis';
import crypto from 'node:crypto';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { ApiError } from '../errors/ApiError.js';

let oauth2Client;
let gmail;

/**
 * Verifica que las 5 variables Gmail_* estén presentes. Si falta alguna,
 * lanza ApiError con código EMAIL_AUTH_FAILED para que el operador sepa
 * exactamente qué credencial falta (sin filtrar valores en producción).
 */
const assertGmailConfig = () => {
  const required = [
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
    'GMAIL_REDIRECT_URI',
    'GMAIL_FROM',
  ];

  const missing = required.filter((key) => !env[key]);

  if (missing.length) {
    const detail =
      env.NODE_ENV === 'development' ? `: faltan ${missing.join(', ')}` : '';

    throw ApiError.serviceUnavailable(
      `Configuración Gmail API incompleta${detail}`,
      env.NODE_ENV === 'development' ? { missing } : null,
      'EMAIL_AUTH_FAILED',
    );
  }
};

/**
 * Crea un OAuth2 client la primera vez y guarda el refresh_token. Las llamadas
 * siguientes usan el mismo singleton, evitando re-negociaciones innecesarias.
 */
const getOAuthClient = () => {
  if (!oauth2Client) {
    assertGmailConfig();

    oauth2Client = new google.auth.OAuth2(
      env.GMAIL_CLIENT_ID,
      env.GMAIL_CLIENT_SECRET,
      env.GMAIL_REDIRECT_URI,
    );

    oauth2Client.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
  }

  return oauth2Client;
};

/**
 * Devuelve la instancia de Gmail v1 autenticada con el OAuth client.
 */
const getGmail = () => {
  if (!gmail) {
    gmail = google.gmail({ version: 'v1', auth: getOAuthClient() });
  }

  return gmail;
};

/**
 * Codifica un subject UTF-8 según RFC 2047 (Base64 encoded-word) para que
 * caracteres como ñ, tildes o emojis lleguen correctamente al header.
 */
const encodeSubject = (subject) => {
  const encoded = Buffer.from(subject, 'utf8').toString('base64');

  return `=?UTF-8?B?${encoded}?=`;
};

/**
 * Construye un mensaje MIME multipart/alternative (texto plano + HTML) y lo
 * devuelve codificado en base64 URL-safe, que es lo que espera
 * gmail.users.messages.send en el campo raw.
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
    'Content-Transfer-Encoding: 7bit',
    '',
    safeText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    safeHtml,
    '',
    `--${boundary}--`,
  ];

  const mime = lines.join('\r\n');

  return Buffer.from(mime, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replaceAll('=', '');
};

/**
 * Envía un correo usando Gmail API. Devuelve el message id de Google.
 * Lanza ApiError.serviceUnavailable con código diferenciable:
 *  - EMAIL_AUTH_FAILED: 401, refresh token revocado/expirado.
 *  - EMAIL_RATE_LIMITED: 429, cuota diaria o rate limit excedido.
 *  - EMAIL_SEND_FAILED: cualquier otro fallo de transporte/API.
 */
export const sendRaw = async ({ to, subject, html, text }) => {
  assertGmailConfig();

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
      requestBody: { raw },
    });

    logger.info('Correo enviado (Gmail API)', {
      to,
      subject,
      messageId: res.data.id,
    });

    return res.data;
  } catch (error) {
    const googleError = error?.response?.data?.error;
    const status = error?.code || error?.response?.status;

    logger.error('Error al enviar correo (Gmail API)', {
      to,
      subject,
      status,
      googleError,
      message: error.message,
    });

    if (status === 401 || googleError === 'invalid_grant') {
      throw ApiError.emailAuthFailed(
        'Refresh token de Gmail inválido o revocado. Regenera con node scripts/get-gmail-refresh-token.js',
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
      env.NODE_ENV === 'development' ? `: ${error.message}` : '';

    throw ApiError.serviceUnavailable(
      `No se pudo enviar el correo electrónico${detail}`,
      env.NODE_ENV === 'development' ? { reason: error.message } : null,
      'EMAIL_SEND_FAILED',
    );
  }
};
