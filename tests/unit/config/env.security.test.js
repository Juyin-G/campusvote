/**
 * @file env.security.test.js
 * @description Tests de seguridad para validación de JWT_SECRET
 * Verifica que la vulnerabilidad de JWT fallback predecible ha sido mitigada
 * y que solo se aceptan secretos fuertes y únicos.
 *
 * La validación de env.js se ejecuta al importarse el módulo, por lo que se
 * evalúa en un proceso hijo aislado (spawn) para probar distintos escenarios
 * de variables de entorno sin contaminación entre tests.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ENV_PATH = join(__dirname, '..', '..', '..', 'src', 'config', 'env.js');

/**
 * Ejecuta env.js en un proceso hijo con las variables de entorno dadas.
 * Resuelve { code, stderr } o rechaza si el proceso no puede arrancar.
 */
function runEnvValidation(envVars) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env };
    for (const [key, value] of Object.entries(envVars)) {
      if (value === undefined || value === null) {
        delete childEnv[key];
      } else {
        childEnv[key] = String(value);
      }
    }
    const child = spawn(
      process.execPath,
      ['--input-type=module', '--eval', `import('file://${ENV_PATH.replace(/\\/g, '/')}')`],
      {
        env: childEnv,
      }
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('JWT_SECRET Security Validation', () => {
  describe('JWT_SECRET es obligatorio', () => {
    it('debe rechazar arranque cuando JWT_SECRET no está configurado', async () => {
      // NODE_ENV=test carga .env.test (sin JWT_SECRET), evitando el .env real
      const { code, stderr } = await runEnvValidation({
        NODE_ENV: 'test',
        JWT_SECRET: undefined,
      });
      expect(code).not.toBe(0);
      expect(stderr + '').toMatch(/no est[áa] configurado/);
    });

    it('debe rechazar arranque cuando JWT_SECRET está vacío', async () => {
      const { code, stderr } = await runEnvValidation({
        NODE_ENV: 'development',
        JWT_SECRET: '',
        DATABASE_URL: 'postgresql://test',
      });
      expect(code).not.toBe(0);
      expect(stderr + '').toMatch(/no est[áa] configurado/);
    });
  });

  describe('JWT_SECRET debe tener al menos 32 caracteres', () => {
    it('debe rechazar JWT_SECRET con menos de 32 caracteres', async () => {
      const { code, stderr } = await runEnvValidation({
        NODE_ENV: 'development',
        JWT_SECRET: 'short-secret-only-31-chars!!',
      });
      expect(code).not.toBe(0);
      expect(stderr + '').toMatch(/al menos 32 caracteres/);
    });

    it('debe aceptar JWT_SECRET con 32+ caracteres', async () => {
      const { code } = await runEnvValidation({
        NODE_ENV: 'development',
        JWT_SECRET: 'app-a9f4c2d1e0b8a7f6e5d4c3b2a190f8e7d6',
        DATABASE_URL: 'postgresql://test',
      });
      expect(code).toBe(0);
    });
  });

  describe('JWT_SECRET no debe usar claves predecibles o de ejemplo', () => {
    const insecureSecrets = [
      'dev-secret-change-me-in-production',
      'your-super-secret-jwt-key-change-this-in-production',
      'your-super-secret-jwt-key-change-this-in-production-must-be-at-least-32-chars',
      'tu-refresh-secret-key-diferente',
      '12345678901234567890123456789012',
      'secret',
    ];

    insecureSecrets.forEach((insecureSecret) => {
      it(`debe rechazar la clave predecible: ${insecureSecret.slice(0, 20)}`, async () => {
        const { code, stderr } = await runEnvValidation({
          NODE_ENV: 'development',
          JWT_SECRET: insecureSecret,
        });
        expect(code).not.toBe(0);
        expect(stderr + '').toMatch(/insegura|al menos 32 caracteres/);
      });
    });
  });

  describe('Sin fallback ni falsos positivos', () => {
    it('debe usar el JWT_SECRET configurado sin aplicar fallback', async () => {
      const secret = 'tech-team-secret-keys-are-rotated-every-90-days-x7';
      const { code } = await runEnvValidation({
        NODE_ENV: 'development',
        JWT_SECRET: secret,
        DATABASE_URL: 'postgresql://test',
      });
      expect(code).toBe(0);
    });
  });

  describe('Validación en diferentes entornos NODE_ENV', () => {
    const validSecret = 'production-grade-jwt-secret-key-rotation-policy-2026';

    ['development', 'staging', 'production'].forEach((nodeEnv) => {
      it(`debe aceptar JWT_SECRET válido en NODE_ENV=${nodeEnv}`, async () => {
        const { code } = await runEnvValidation({
          NODE_ENV: nodeEnv,
          JWT_SECRET: validSecret,
          DATABASE_URL: 'postgresql://test',
        });
        expect(code).toBe(0);
      });
    });
  });
});
