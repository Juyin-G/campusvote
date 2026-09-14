import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

async function testGmailAuth() {
  console.log('=== TEST GMAIL OAUTH ===');

  console.log('CLIENT_ID:', Boolean(process.env.GMAIL_CLIENT_ID));
  console.log('CLIENT_SECRET:', Boolean(process.env.GMAIL_CLIENT_SECRET));
  console.log('REFRESH_TOKEN:', Boolean(process.env.GMAIL_REFRESH_TOKEN));
  console.log('REDIRECT_URI:', Boolean(process.env.GMAIL_REDIRECT_URI));
  console.log('GMAIL_FROM:', process.env.GMAIL_FROM);

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI,
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    console.log('\nIntentando obtener access token...');

    const result = await oauth2Client.getAccessToken();

    console.log('\nRESULTADO:');
    console.log({
      success: Boolean(result?.token),
      hasAccessToken: Boolean(result?.token),
    });

    if (result?.token) {
      console.log('\n✅ GMAIL OAUTH FUNCIONA');
      console.log('El refresh token es válido.');
    } else {
      console.log('\n❌ Google no devolvió access token');
    }

  } catch (error) {
    console.log('\n❌ GMAIL OAUTH FALLÓ');

    console.log({
      code: error?.code,
      status: error?.response?.status,
      googleError: error?.response?.data?.error,
      description: error?.response?.data?.error_description,
      message: error?.message,
    });
  }
}

testGmailAuth();
