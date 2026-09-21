import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const encodeBase64Url = (value) => {
  let encoded = Buffer.from(value, 'utf8')
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_');

  while (encoded.endsWith('=')) {
    encoded = encoded.slice(0, -1);
  }

  return encoded;
};

async function testGmailSend() {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI || undefined,
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client,
    });

    const to = process.env.GMAIL_FROM;

    const mime = [
      `From: ${process.env.GMAIL_FROM}`,
      `To: ${to}`,
      'Subject: Prueba CampusVote Gmail API',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      'Este es un correo de prueba enviado desde CampusVote usando Gmail API.',
    ].join('\r\n');

    const raw = encodeBase64Url(mime);

    console.log('Enviando correo a:', to);

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
      },
    });

    console.log('\n CORREO ENVIADO');
    console.log({
      messageId: response.data.id,
      threadId: response.data.threadId,
    });

  } catch (error) {
    console.log('\n FALLÓ EL ENVÍO');

    console.log({
      code: error?.code,
      status: error?.response?.status,
      googleError: error?.response?.data?.error,
      description: error?.response?.data?.error_description,
      errors: error?.response?.data?.errors,
      message: error?.message,
    });
  }
}

testGmailSend();
