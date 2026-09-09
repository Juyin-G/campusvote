import { ApiError } from '../errors/ApiError.js';
import env from '../../config/env.js';

const required = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_FROM'];

const assertConfig = () => {
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw ApiError.internal(`Configuración Gmail incompleta: ${missing.join(', ')}`);
  }
};

const encodeBase64Url = (value) =>
  (() => {
    let encoded = Buffer.from(value).toString('base64')
      .replaceAll('+', '-')
      .replaceAll('/', '_');
    while (encoded.endsWith('=')) encoded = encoded.slice(0, -1);
    return encoded;
  })();

const getAccessToken = async () => {
  assertConfig();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    const reason = payload.error === 'invalid_grant'
      ? 'El refresh token de Gmail fue revocado o es inválido'
      : 'No se pudo obtener el access token de Gmail';
    throw ApiError.serviceUnavailable(reason, null, 'GMAIL_AUTH_FAILED');
  }

  return payload.access_token;
};

export const sendGmail = async ({ to, subject, html, text }) => {
  const accessToken = await getAccessToken();
  const message = [
    `From: ${env.GMAIL_FROM}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="campusvote-boundary"',
    '',
    '--campusvote-boundary',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    text,
    '--campusvote-boundary',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html,
    '--campusvote-boundary--',
  ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeBase64Url(message) }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw ApiError.serviceUnavailable(
      'Gmail no pudo enviar el correo',
      env.NODE_ENV === 'development' ? { reason: payload.error?.message } : null,
      'GMAIL_SEND_FAILED'
    );
  }

  return { messageId: payload.id, provider: 'gmail-api' };
};
