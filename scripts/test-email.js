/**
 * Script local para probar sendVerification y sendReset.
 *
 * 1. Completa SMTP_* y FRONTEND_URL en tu .env
 * 2. Ejecuta: npm run test:email
 *
 * Mailtrap (plan free) limita correos por segundo. Si falla el segundo:
 *   npm run test:email -- --mode=verification
 *   npm run test:email -- --mode=reset
 */
import 'dotenv/config';

import {
  sendVerification,
  sendReset,
} from '../src/shared/services/email.service.js';

const TEST_EMAIL = process.env.TEST_EMAIL || 'tu-correo@ejemplo.com';

const getMode = () => {
  const arg = process.argv.find((item) => item.startsWith('--mode='));
  if (arg) return arg.split('=')[1];

  return process.env.TEST_EMAIL_MODE || 'both';
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  const mode = getMode();

  if (!['verification', 'reset', 'both'].includes(mode)) {
    throw new Error('Modo inválido. Use: verification, reset o both');
  }

  console.log(`Modo: ${mode} | Destino: ${TEST_EMAIL}`);

  if (mode === 'verification' || mode === 'both') {
    await sendVerification({
      email: TEST_EMAIL,
      token: 'token-prueba-verificacion',
      firstName: 'Juyin',
    });
    console.log('OK: sendVerification');
  }

  if (mode === 'both') {
    console.log('Esperando 10s (límite Mailtrap)...');
    await wait(10000);
  }

  if (mode === 'reset' || mode === 'both') {
    await sendReset({
      email: TEST_EMAIL,
      token: 'token-prueba-reset',
    });
    console.log('OK: sendReset');
  }

  console.log('Listo. Revisa Mailtrap (sandbox) o tu bandeja.');
};

run().catch((error) => {
  console.error('Error en prueba de email:', error.message);
  process.exit(1);
});
