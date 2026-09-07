/**
 * @file scripts/get-gmail-refresh-token.js
 * @description Genera (una vez) un refresh_token OAuth2 válido para Gmail API.
 *
 * Uso:
 *   1. Tener GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET y GMAIL_REDIRECT_URI en .env
 *      (ya configurados en MT00).
 *   2. Asegurarte de que el redirect_uri (GMAIL_REDIRECT_URI) está EXACTAMENTE
 *      registrado en Google Cloud → Credenciales → tu OAuth Client.
 *   3. Ejecutar: node scripts/get-gmail-refresh-token.js
 *   4. Se imprime una URL: cópiala, ábrela en el navegador, autoriza con la
 *      cuenta Gmail remitente.
 *   5. Google redirige al redirect_uri con ?code=... Pega ese code en la
 *      consola cuando el script lo pida.
 *   6. El script imprime GMAIL_REFRESH_TOKEN=... y GMAIL_FROM=... listos
 *      para pegar en .env y en Render.
 *
 * Importante:
 *   - El proceso escucha en http://localhost:3000 SOLO durante el callback.
 *     Cuando termina, el servidor se cierra.
 *   - Si el redirect_uri de tu .env NO es localhost:3000, puedes sobreescribirlo
 *     con la variable GMAIL_REDIRECT_URI en tu shell o ajustando el .env.
 */

import 'dotenv/config';
import http from 'node:http';
import { URL } from 'node:url';
import { google } from 'googleapis';
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const REQUIRED = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REDIRECT_URI'];
const missing = REQUIRED.filter((k) => !process.env[k]);

if (missing.length) {
  console.error(`\nFaltan variables en .env: ${missing.join(', ')}\n`);
  process.exit(1);
}

const PORT = new URL(process.env.GMAIL_REDIRECT_URI).port || 80;
const SEND_AS = process.env.GMAIL_FROM;

const oauth2 = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI,
);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
  ...(SEND_AS ? { login_hint: SEND_AS } : {}),
});

console.log('\n=== Generador de refresh_token para Gmail API ===\n');
console.log('1) Abre esta URL en tu navegador y autoriza con tu Gmail:\n');
console.log(`   ${authUrl}\n`);

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400).end('Bad request');
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get('code');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`Error devuelto por Google: ${errorParam}`);
      console.error(`\nGoogle devolvió error: ${errorParam}\n`);
      cleanup(1);
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Falta el parámetro code');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Listo. Puedes cerrar esta ventana y volver a la terminal.');

    const { tokens } = await oauth2.getToken(code);

    if (!tokens.refresh_token) {
      console.error('\nGoogle NO devolvió refresh_token.');
      console.error('Causas probables:');
      console.error(' - Esta app ya tenía un refresh_token vigente y Google no lo reemite.');
      console.error('   Solución: revoca el acceso previo en https://myaccount.google.com/permissions');
      console.error('   y vuelve a ejecutar este script.');
      console.error(' - Falta prompt=consent. Revisa que el script siga igual.\n');
      cleanup(1);
      return;
    }

    console.log('\n=== ¡Listo! ===\n');
    console.log('Pega estas dos líneas en tu .env LOCAL y en Render (Environment):\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    if (tokens.access_token) {
      console.log(`# (access_token de un solo uso, lo ignora el backend): ${tokens.access_token}`);
    }
    console.log(`GMAIL_FROM=${process.env.GMAIL_FROM || '<tu-correo@gmail.com>'}\n`);
    console.log('A partir de aquí, email.service.js puede enviar correos de verdad.\n');

    cleanup(0);
  } catch (err) {
    console.error('\nError procesando el callback:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Error');
    cleanup(1);
  }
});

const cleanup = (code = 0) => {
  rl.close();
  server.close(() => process.exit(code));
};

server.listen(PORT, () => {
  console.log(`2) Esperando callback en http://localhost:${PORT}${new URL(process.env.GMAIL_REDIRECT_URI).pathname}`);
  console.log('   (no abras esa URL manualmente, espera a que Google te redirija)\n');
});

server.on('error', (err) => {
  console.error(`\nNo pude abrir el puerto ${PORT}: ${err.message}`);
  console.error('Causa típica: ya tienes otro servidor corriendo (npm run dev).');
  console.error('Solución: cierra el dev server o cambia GMAIL_REDIRECT_URI a otro puerto libre.\n');
  cleanup(1);
});

const shutdown = () => cleanup(0);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Aviso: si el callback no llega en 5 min, cerramos.
setTimeout(() => {
  console.error('\nTiempo agotado (5 min). Vuelve a ejecutar el script cuando estés listo.');
  cleanup(1);
}, 5 * 60 * 1000).unref();

// Nota: `ask` queda disponible si más adelante queremos permitir pegar el code manualmente
// en lugar de levantar el server. Por ahora no lo usamos (se deja declarado).
void ask;
