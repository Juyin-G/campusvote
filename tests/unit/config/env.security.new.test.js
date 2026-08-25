/**
 * @file env.security.test.js
 * @description Tests de seguridad para validación de JWT_SECRET
 * Verifica que la vulnerabilidad de JWT fallback predecible ha sido mitigada
 * 
 * NOTA: Estos tests verifican la lógica de validación extrayendo y probando
 * las reglas de seguridad que se aplican en src/config/env.js
 */

import { jest, describe, it, expect } from '@jest/globals';

describe('JWT_SECRET Security Validation Logic', () => {
  // Lista de valores inseguros conocidos (debe coincidir con src/config/env.js)
  const INSECURE_JWT_SECRETS = [
    'dev-secret-change-me-in-production',
    'your-super-secret-jwt-key-change-this-in-production',
    'secret',
    'test-secret',
    'change-me',
    'jwt-secret',
  ];

  // Función de validación extraída de la lógica en env.js
  function validateJwtSecret(jwtSecret) {
    const errors = [];

    // Validar que JWT_SECRET esté presente
    if (!jwtSecret || jwtSecret.trim() === '') {
      errors.push('JWT_SECRET es obligatorio en todos los entornos');
    }

    // Validar que JWT_SECRET no sea un valor inseguro conocido
    if (jwtSecret && INSECURE_JWT_SECRETS.includes(jwtSecret)) {
      errors.push('JWT_SECRET contiene un valor inseguro conocido');
    }

    // Validar longitud mínima de JWT_SECRET
    if (jwtSecret && jwtSecret.length < 32) {
      errors.push(`JWT_SECRET debe tener al menos 32 caracteres. Longitud actual: ${jwtSecret.length} caracteres`);
    }

    return errors;
  }

  describe('JWT_SECRET debe ser obligatorio', () => {
    it('debe detectar cuando JWT_SECRET no está configurado', () => {
      const errors = validateJwtSecret('');
      expect(errors).toContain('JWT_SECRET es obligatorio en todos los entornos');
    });

    it('debe detectar cuando JWT_SECRET es null o undefined', () => {
      const errorsNull = validateJwtSecret(null);
      const errorsUndefined = validateJwtSecret(undefined);
      
      expect(errorsNull).toContain('JWT_SECRET es obligatorio en todos los entornos');
      expect(errorsUndefined).toContain('JWT_SECRET es obligatorio en todos los entornos');
    });

    it('debe detectar cuando JWT_SECRET es solo espacios en blanco', () => {
      const errors = validateJwtSecret('   ');
      expect(errors).toContain('JWT_SECRET es obligatorio en todos los entornos');
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
      it(`debe rechazar el valor inseguro conocido: "${insecureSecret}"`, () => {
        const errors = validateJwtSecret(insecureSecret);
        expect(errors).toContain('JWT_SECRET contiene un valor inseguro conocido');
      });
    });

    it('debe aceptar valores seguros que no están en la lista negra', () => {
      const secureSecret = 'my-unique-cryptographically-secure-secret-key-12345678';
      const errors = validateJwtSecret(secureSecret);
      expect(errors).not.toContain('JWT_SECRET contiene un valor inseguro conocido');
    });
  });

  describe('JWT_SECRET debe tener longitud mínima de 32 caracteres', () => {
    it('debe rechazar JWT_SECRET con menos de 32 caracteres', () => {
      const shortSecret = 'short-secret-only-31-chars!!'; // 29 chars
      const errors = validateJwtSecret(shortSecret);
      expect(errors.some(e => e.includes('debe tener al menos 32 caracteres'))).toBe(true);
    });

    it('debe rechazar JWT_SECRET con exactamente 31 caracteres', () => {
      const secret31 = '1234567890123456789012345678901'; // 31 chars
      const errors = validateJwtSecret(secret31);
      expect(errors.some(e => e.includes('debe tener al menos 32 caracteres'))).toBe(true);
    });

    it('debe aceptar JWT_SECRET con exactamente 32 caracteres', () => {
      const secret32 = '12345678901234567890123456789012'; // 32 chars
      const errors = validateJwtSecret(secret32);
      expect(errors.some(e => e.includes('debe tener al menos 32 caracteres'))).toBe(false);
    });

    it('debe aceptar JWT_SECRET con más de 32 caracteres', () => {
      const longSecret = 'this-is-a-very-long-and-secure-jwt-secret-key-with-more-than-32-characters';
      const errors = validateJwtSecret(longSecret);
      expect(errors.some(e => e.includes('debe tener al menos 32 caracteres'))).toBe(false);
    });

    it('debe incluir longitud actual en mensaje de error', () => {
      const shortSecret = 'only-20-chars-here!'; // 19 chars
      const errors = validateJwtSecret(shortSecret);
      const lengthError = errors.find(e => e.includes('Longitud actual'));
      expect(lengthError).toContain(`Longitud actual: ${shortSecret.length} caracteres`);
    });
  });

  describe('Prevención de token forgery - No debe existir fallback', () => {
    it('debe fallar validación sin fallback cuando JWT_SECRET no está definido', () => {
      const errors = validateJwtSecret(undefined);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('JWT_SECRET es obligatorio en todos los entornos');
    });

    it('debe validar que un secreto seguro pasa todas las validaciones', () => {
      const secureSecret = 'my-unique-cryptographically-secure-secret-key-12345678';
      const errors = validateJwtSecret(secureSecret);
      expect(errors).toHaveLength(0);
    });

    it('debe rechazar el antiguo fallback predecible', () => {
      const oldFallback = 'dev-secret-change-me-in-production';
      const errors = validateJwtSecret(oldFallback);
      expect(errors).toContain('JWT_SECRET contiene un valor inseguro conocido');
    });
  });

  describe('Escenarios de explotación prevenidos', () => {
    it('debe prevenir uso del antiguo fallback predecible', () => {
      const errors = validateJwtSecret('dev-secret-change-me-in-production');
      expect(errors).toContain('JWT_SECRET contiene un valor inseguro conocido');
    });

    it('debe prevenir uso de secretos débiles que un atacante podría adivinar', () => {
      const errors = validateJwtSecret('secret');
      expect(errors).toContain('JWT_SECRET contiene un valor inseguro conocido');
    });

    it('debe prevenir uso de secretos cortos susceptibles a fuerza bruta', () => {
      const errors = validateJwtSecret('short123'); // Solo 8 caracteres
      expect(errors.some(e => e.includes('debe tener al menos 32 caracteres'))).toBe(true);
    });

    it('debe prevenir arranque sin JWT_SECRET configurado', () => {
      const errors = validateJwtSecret('');
      expect(errors).toContain('JWT_SECRET es obligatorio en todos los entornos');
    });
  });

  describe('Validación combinada de múltiples reglas', () => {
    it('debe detectar múltiples problemas simultáneamente', () => {
      // Un secreto que es inseguro Y corto
      const badSecret = 'secret'; // 6 caracteres, en lista negra
      const errors = validateJwtSecret(badSecret);
      
      expect(errors.length).toBeGreaterThan(1);
      expect(errors).toContain('JWT_SECRET contiene un valor inseguro conocido');
      expect(errors.some(e => e.includes('debe tener al menos 32 caracteres'))).toBe(true);
    });

    it('debe aceptar secretos que cumplen todas las reglas', () => {
      const validSecrets = [
        'secure-jwt-secret-with-at-least-32-characters-required',
        'a'.repeat(32), // Exactamente 32 caracteres
        'a'.repeat(64), // 64 caracteres
        'my-production-secret-key-2024-very-secure-and-long',
      ];

      validSecrets.forEach(secret => {
        const errors = validateJwtSecret(secret);
        expect(errors).toHaveLength(0);
      });
    });
  });

  describe('Verificación de que env.js implementa estas validaciones', () => {
    it('debe confirmar que INSECURE_JWT_SECRETS está definido en env.js', async () => {
      // Este test verifica que el archivo env.js contiene la lista de secretos inseguros
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const envPath = path.join(__dirname, '../../../src/config/env.js');
      
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      // Verificar que contiene la lista de secretos inseguros
      expect(envContent).toContain('INSECURE_JWT_SECRETS');
      expect(envContent).toContain('dev-secret-change-me-in-production');
      expect(envContent).toContain('your-super-secret-jwt-key-change-this-in-production');
    });

    it('debe confirmar que env.js valida JWT_SECRET como obligatorio', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const envPath = path.join(__dirname, '../../../src/config/env.js');
      
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      // Verificar que valida la presencia de JWT_SECRET
      expect(envContent).toContain('JWT_SECRET es obligatorio');
      expect(envContent).toMatch(/if\s*\(\s*!process\.env\.JWT_SECRET\s*\)/);
    });

    it('debe confirmar que env.js valida longitud mínima de 32 caracteres', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const envPath = path.join(__dirname, '../../../src/config/env.js');
      
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      // Verificar que valida la longitud mínima
      expect(envContent).toContain('debe tener al menos 32 caracteres');
      expect(envContent).toMatch(/\.length\s*<\s*32/);
    });

    it('debe confirmar que env.js NO tiene fallback inseguro', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const envPath = path.join(__dirname, '../../../src/config/env.js');
      
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      // Verificar que NO hay fallback en la asignación de JWT_SECRET
      // Buscar la línea JWT_SECRET: process.env.JWT_SECRET
      const jwtSecretLine = envContent.split('\n').find(line => 
        line.includes('JWT_SECRET:') && line.includes('process.env.JWT_SECRET')
      );
      
      expect(jwtSecretLine).toBeDefined();
      // No debe contener || con un fallback
      expect(jwtSecretLine).not.toMatch(/\|\|\s*['"`]/);
    });
  });
});
