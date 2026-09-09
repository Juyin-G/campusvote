/**
 * Cliente Gmail API OAuth2.
 *
 * El refresh token es persistente; googleapis obtiene access tokens
 * temporales sin que el backend tenga que almacenarlos.
 */
import { google } from 'googleapis';
import crypto from 'node:crypto';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { ApiError } from '../errors/ApiError.js';

let oauth2Client;
let gmail;

const required = [
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_FROM',
];

const assertGmailConfig = () => {
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw ApiError.serviceUnavailable(
      'Configuración Gmail API incompleta',
      env.NODE_ENV === 'development' ? { missing } : null,
      'EMAIL_AUTH_FAILED',
    );
  }
};

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

const getGmail = () => {
  if (!gmail) {
    gmail = google.gmail({
      version: 'v1',
      auth: getOAuthClient(),
    });
  }
  return gmail;
};

const encodeSubject = (subject) =>
  `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

const encodeBase64Url = (value) => {
  let encoded = Buffer.from(value, 'utf8').toString('base64');
  encoded = encoded.replaceAll('+', '-').replaceAll('/', '_');
  while (encoded.endsWith('=')) {
    encoded = encoded.slice(0, -1);
  }
  return encoded;
};

const buildRawMessage = ({ from, to, subject, html, text }) => {
  const boundary = `cv_${Date.now()}_${crypto.randomUUID()}`;
  const mime = [
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
    text || '',
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html || '',
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return encodeBase64Url(mime);
};

export const sendRaw = async ({ to, subject, html, text }) => {
  assertGmailConfig();
  const client = getOAuthClient();

  try {
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse?.token) {
      throw new Error('Google no devolvió access_token');
    }
  } catch (error) {
    logger.error('Error al obtener access token de Gmail', {
      code: error?.code,
      status: error?.response?.status,
      googleError: error?.response?.data?.error,
      googleErrorDescription: error?.response?.data?.error_description,
      message: error?.message,
    });
    throw ApiError.emailAuthFailed(
      'No se pudo obtener el access token de Gmail',
    );
  }

  try {
    const response = await getGmail().users.messages.send({
      userId: 'me',
      requestBody: {
        raw: buildRawMessage({
          from: env.GMAIL_FROM,
          to,
          subject,
          html,
          text,
        }),
      },
    });

    logger.info('Correo enviado (Gmail API)', {
      to,
      subject,
      messageId: response.data.id,
    });
    return {
      messageId: response.data.id,
      provider: 'gmail-api',
    };
  } catch (error) {
    const googleError = error?.response?.data?.error;
    const status = error?.response?.status ?? error?.code;

    logger.error('Error al enviar correo (Gmail API)', {
      to,
      subject,
      status,
      googleError,
      googleErrorDescription: error?.response?.data?.error_description,
      message: error?.message,
    });

    if (status === 401) {
      throw ApiError.emailAuthFailed('Gmail rechazó las credenciales OAuth');
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

    throw ApiError.serviceUnavailable(
      'No se pudo enviar el correo electrónico',
      env.NODE_ENV === 'development' ? { reason: error.message } : null,
      'EMAIL_SEND_FAILED',
    );
  }
};

export const sendGmail = sendRaw;
