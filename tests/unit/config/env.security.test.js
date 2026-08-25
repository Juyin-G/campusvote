/**
 * @file env.security.test.js
 * @description Tests de seguridad para validación de JWT_SECRET
 * Verifica que la vulnerabilidad de JWT fallback predecible ha sido mitigada
 */

import { jest } from '@jest/globals';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper para ejecutar código en un proceso hijo con variables de entorno específicas
 * Esto es necesario porque env.js ejecuta validaciones al importarse
 */
function testEnvValidation(envVars, expectedError) {
  return new Promise((resolve, reject) => {
    const code = `
      import('../../../src/config/env.js')
        .then(() => {
          console.log('SUCCESS');
          process.exit(0);
        })
        .catch((err) => {
          console.error(err.message);
          process.exit(1);
        });
    `;
    
    const child = spawn('node', ['--input-type=module', '--eval', code], {
      cwd: join(__dirname, '../../..'),
      env: { ...process.env, ...envVars },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      if (expectedError) {
        if (exitCode !== 0 && stderr.includes(expectedError)) {
          resolve({ success: true, stderr, exitCode });
        } else {
          reject(new Error(`Expected error "${expectedError}" but got: ${stderr}`));
        }
      } else {
        if (exitCode === 0) {
          resolve({ success: true, stdout, exitCode });
        } else {
          reject(new Error(`Expected success but got error: ${stderr}`));
        }
      }
    });
  });
}

describe('JWT_SECRET Security Validation', () => {
  describe('JWT_SECRET debe ser obligatorio en todos los entornos', () => {
    it('debe rechazar arranque cuando JWT_SECRET no está configurado en desarrollo', async () => {
      await expect(
        testEnvValidation(
          { NODE_ENV: 'development', JWT_SECRET: '' },
          'JWT_SECRET es obligatorio en todos los entornos'
        )
      ).resolves.toMatchObject({ success: true });
    }, 10000);

    it('debe rechazar arranque cuando JWT_SECRET no está configurado en staging', async () => {
      process.env.NODE_ENV = 'staging';
      delete process.env.JWT_SECRET;

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET es obligatorio en todos los entornos/);
    });

    it('debe rechazar arranque cuando JWT_SECRET no está configurado en producción', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      process.env.DATABASE_URL = 'postgresql://test';

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET es obligatorio en todos los entornos/);
    });

    it('debe rechazar arranque cuando JWT_SECRET está vacío', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = '';

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET es obligatorio en todos los entornos/);
    });
  });

  describe('JWT_SECRET no debe aceptar valores inseguros conocidos', () => {
    const insecureSecrets = [
      'dev-secret-change-me-in-production',
      'your-super-secret-jwt-key-change-this-in-production',
      'secret',
      'test-secret',
      'change-me',
      'jwt-secret',
    ];

    insecureSecrets.forEach((insecureSecret) => {
      it(`debe rechazar el valor inseguro conocido: "${insecureSecret}"`, async () => {
        process.env.NODE_ENV = 'development';
        process.env.JWT_SECRET = insecureSecret;

        await expect(async () => {
          await import('../../../src/config/env.js?' + Date.now());
        }).rejects.toThrow(/JWT_SECRET contiene un valor inseguro conocido/);
      });
    });

    it('debe rechazar valores inseguros incluso en producción', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://test';
      process.env.JWT_SECRET = 'dev-secret-change-me-in-production';

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET contiene un valor inseguro conocido/);
    });
  });

  describe('JWT_SECRET debe tener longitud mínima de 32 caracteres', () => {
    it('debe rechazar JWT_SECRET con menos de 32 caracteres', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'short-secret-only-31-chars!!';

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET debe tener al menos 32 caracteres/);
    });

    it('debe rechazar JWT_SECRET con exactamente 31 caracteres', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = '1234567890123456789012345678901'; // 31 chars

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET debe tener al menos 32 caracteres/);
    });

    it('debe aceptar JWT_SECRET con exactamente 32 caracteres', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = '12345678901234567890123456789012'; // 32 chars
      process.env.DATABASE_URL = 'postgresql://test';

      await expect(async () => {
        const env = await import('../../../src/config/env.js?' + Date.now());
        return env.default;
      }).resolves.toBeDefined();
    });

    it('debe aceptar JWT_SECRET con más de 32 caracteres', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'this-is-a-very-long-and-secure-jwt-secret-key-with-more-than-32-characters';
      process.env.DATABASE_URL = 'postgresql://test';

      await expect(async () => {
        const env = await import('../../../src/config/env.js?' + Date.now());
        return env.default;
      }).resolves.toBeDefined();
    });
  });

  describe('Prevención de token forgery - No debe existir fallback', () => {
    it('debe fallar sin fallback cuando JWT_SECRET no está definido', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.JWT_SECRET;

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET es obligatorio/);
    });

    it('debe usar el JWT_SECRET configurado sin aplicar fallback', async () => {
      const secureSecret = 'my-unique-cryptographically-secure-secret-key-12345678';
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = secureSecret;
      process.env.DATABASE_URL = 'postgresql://test';

      const env = await import('../../../src/config/env.js?' + Date.now());
      
      expect(env.default.JWT_SECRET).toBe(secureSecret);
      expect(env.default.JWT_SECRET).not.toBe('dev-secret-change-me-in-production');
    });
  });

  describe('Validación en diferentes entornos NODE_ENV', () => {
    const validSecret = 'secure-jwt-secret-with-at-least-32-characters-required';

    it('debe validar JWT_SECRET en NODE_ENV=development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = validSecret;
      process.env.DATABASE_URL = 'postgresql://test';

      const env = await import('../../../src/config/env.js?' + Date.now());
      expect(env.default.JWT_SECRET).toBe(validSecret);
    });

    it('debe validar JWT_SECRET en NODE_ENV=test', async () => {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = validSecret;
      process.env.DATABASE_URL = 'postgresql://test';

      const env = await import('../../../src/config/env.js?' + Date.now());
      expect(env.default.JWT_SECRET).toBe(validSecret);
    });

    it('debe validar JWT_SECRET en NODE_ENV=staging', async () => {
      process.env.NODE_ENV = 'staging';
      process.env.JWT_SECRET = validSecret;
      process.env.DATABASE_URL = 'postgresql://test';

      const env = await import('../../../src/config/env.js?' + Date.now());
      expect(env.default.JWT_SECRET).toBe(validSecret);
    });

    it('debe validar JWT_SECRET en NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = validSecret;
      process.env.DATABASE_URL = 'postgresql://test';

      const env = await import('../../../src/config/env.js?' + Date.now());
      expect(env.default.JWT_SECRET).toBe(validSecret);
    });

    it('debe validar JWT_SECRET incluso con NODE_ENV no estándar', async () => {
      process.env.NODE_ENV = 'custom-environment';
      process.env.JWT_SECRET = validSecret;
      process.env.DATABASE_URL = 'postgresql://test';

      const env = await import('../../../src/config/env.js?' + Date.now());
      expect(env.default.JWT_SECRET).toBe(validSecret);
    });

    it('debe validar JWT_SECRET cuando NODE_ENV no está definido', async () => {
      delete process.env.NODE_ENV;
      process.env.JWT_SECRET = validSecret;
      process.env.DATABASE_URL = 'postgresql://test';

      const env = await import('../../../src/config/env.js?' + Date.now());
      expect(env.default.JWT_SECRET).toBe(validSecret);
    });
  });

  describe('Escenarios de explotación prevenidos', () => {
    it('debe prevenir arranque con el antiguo fallback predecible', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'dev-secret-change-me-in-production';

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET contiene un valor inseguro conocido/);
    });

    it('debe prevenir arranque sin JWT_SECRET en entorno no-production', async () => {
      process.env.NODE_ENV = 'staging';
      delete process.env.JWT_SECRET;

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET es obligatorio/);
    });

    it('debe prevenir uso de secretos débiles que un atacante podría adivinar', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'secret';

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET contiene un valor inseguro conocido/);
    });

    it('debe prevenir uso de secretos cortos susceptibles a fuerza bruta', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'short123'; // Solo 8 caracteres

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/JWT_SECRET debe tener al menos 32 caracteres/);
    });
  });

  describe('Mensaje de error debe ser informativo', () => {
    it('debe incluir longitud actual en error de longitud mínima', async () => {
      const shortSecret = 'only-20-chars-here!';
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = shortSecret;

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(new RegExp(`Longitud actual: ${shortSecret.length} caracteres`));
    });

    it('debe indicar que JWT_SECRET es obligatorio en todos los entornos', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/obligatorio en todos los entornos/);
    });

    it('debe indicar que el valor es inseguro cuando se usa un valor conocido', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'test-secret';

      await expect(async () => {
        await import('../../../src/config/env.js?' + Date.now());
      }).rejects.toThrow(/valor inseguro conocido/);
    });
  });
});
