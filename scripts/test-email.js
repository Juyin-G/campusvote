/**
 * @file scripts/test-email.js
 * @description Smoke test manual de los 3 correos transaccionales contra
 *              Gmail API. Envía a TEST_EMAIL; revisa también Spam.
 *
 * Uso:
 *   1. Tener GMAIL_* y GMAIL_FROM en tu .env. Sin el refresh_token no
 *      funciona. Genera el refresh una vez con:
 *        node scripts/get-gmail-refresh-token.js
 *   2. Define TEST_EMAIL en tu .env (o exporta la var) hacia una bandeja
 *      REAL donde puedas revisar.
 *   3. Ejecuta:
 *        npm run test:email
 *        npm run test:email -- --mode=verification
 *        npm run test:email -- --mode=reset
 *        npm run test:email -- --mode=activation
 */

import 'dotenv/config';

import {
  sendVerification,
  sendReset,
  sendActivation,
  sendRequestReceived,
  sendRequestApproved,
  sendAdminActivation,
} from '../src/shared/services/email.service.js';

const TEST_EMAIL = process.env.TEST_EMAIL || 'tu-correo@ejemplo.com';
const FROM_EMAIL = process.env.GMAIL_FROM || '(GMAIL_FROM no definido)';

const getMode = () => {
  const arg = process.argv.find((item) => item.startsWith('--mode='));
  if (arg) return arg.split('=')[1];
  return process.env.TEST_EMAIL_MODE || 'all';
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  const mode = getMode();
  const allowed = ['verification', 'reset', 'activation', 'request', 'request-approved', 'admin-activation', 'all'];

  if (!allowed.includes(mode)) {
    throw new Error(`Modo inválido. Use: ${allowed.join(', ')}`);
  }

  console.log(`Modo: ${mode} | Destino: ${TEST_EMAIL} | Desde: ${FROM_EMAIL}`);

  if (mode === 'verification' || mode === 'all') {
    await sendVerification({
      email: TEST_EMAIL,
      token: 'token-prueba-verificacion',
      firstName: 'Juyin',
    });
    console.log('OK: sendVerification');
  }

  if (mode === 'all') {
    console.log('Esperando 5s entre envíos...');
    await wait(5000);
  }

  if (mode === 'reset' || mode === 'all') {
    await sendReset({
      email: TEST_EMAIL,
      token: 'token-prueba-reset',
    });
    console.log('OK: sendReset');
  }

  if (mode === 'all') {
    console.log('Esperando 5s entre envíos...');
    await wait(5000);
  }

  if (mode === 'activation' || mode === 'all') {
    await sendActivation({
      email: TEST_EMAIL,
      token: 'token-prueba-activacion',
      firstName: 'Administrador',
    });
    console.log('OK: sendActivation');
  }

  if (mode === 'all') {
    console.log('Esperando 5s entre envíos...');
    await wait(5000);
  }

  if (mode === 'request' || mode === 'all') {
    await sendRequestReceived({
      email: TEST_EMAIL,
      institutionName: 'Universidad de Prueba CampusVote',
    });
    console.log('OK: sendRequestReceived');
  }

  if (mode === 'all') {
    console.log('Esperando 5s entre envíos...');
    await wait(5000);
  }

  if (mode === 'request-approved' || mode === 'all') {
    await sendRequestApproved({
      email: TEST_EMAIL,
      institutionName: 'Universidad de Prueba CampusVote',
      approverName: 'Juyin SUPERADMIN',
    });
    console.log('OK: sendRequestApproved');
  }

  if (mode === 'all') {
    console.log('Esperando 5s entre envíos...');
    await wait(5000);
  }

  if (mode === 'admin-activation' || mode === 'all') {
    await sendAdminActivation({
      email: TEST_EMAIL,
      institutionName: 'Universidad de Prueba CampusVote',
      token: 'token-prueba-admin-activation-' + Date.now(),
    });
    console.log('OK: sendAdminActivation');
  }

  console.log('Listo. Revisa la bandeja de TEST_EMAIL (incluyendo Spam).');
};

run().catch((error) => {
  console.error('Error en prueba de email:', error.message);
  process.exit(1);
});
