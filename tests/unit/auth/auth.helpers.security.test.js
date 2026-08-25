/**
 * @file auth.helpers.security.test.js
 * @description Tests de seguridad para generación de JWT
 * Verifica que los tokens se generan con el secreto configurado y no con fallbacks
 */

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

describe('JWT Generation Security', () => {
  let generateJwt;
  const secureSecret = 'secure-test-jwt-secret-with-minimum-32-characters-required-for-testing';

  beforeEach(async () => {
    // Configurar JWT_SECRET seguro
    process.env.JWT_SECRET = secureSecret;
    process.env.DATABASE_URL = 'postgresql://test';
    
    jest.resetModules();
    
    // Importar el helper después de configurar el entorno
    const authHelpers = await import('../../../src/modules/auth/services/auth.helpers.js');
    generateJwt = authHelpers.generateJwt;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Generación de tokens con secreto seguro', () => {
    it('debe generar tokens que solo pueden verificarse con el secreto configurado', () => {
      const mockUser = {
        id: '123',
        email: 'user@university.edu',
        role: 'STUDENT',
        organizationId: 'org-123',
        isSuperuser: false,
        isStaff: false,
      };

      const token = generateJwt(mockUser);

      // Verificar que el token es válido con el secreto correcto
      const decoded = jwt.verify(token, secureSecret);
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });

    it('debe generar tokens que NO pueden verificarse con secretos inseguros conocidos', () => {
      const mockUser = {
        id: '123',
        email: 'user@university.edu',
        role: 'STUDENT',
        organizationId: 'org-123',
        isSuperuser: false,
        isStaff: false,
      };

      const token = generateJwt(mockUser);

      const insecureSecrets = [
        'dev-secret-change-me-in-production',
        'your-super-secret-jwt-key-change-this-in-production',
        'secret',
        'test-secret',
        'jwt-secret',
      ];

      insecureSecrets.forEach((insecureSecret) => {
        expect(() => {
          jwt.verify(token, insecureSecret);
        }).toThrow();
      });
    });

    it('debe incluir todos los claims necesarios en el token', () => {
      const mockUser = {
        id: 'user-456',
        email: 'admin@university.edu',
        role: 'ADMIN',
        organizationId: null,
        isSuperuser: true,
        isStaff: true,
      };

      const token = generateJwt(mockUser);
      const decoded = jwt.verify(token, secureSecret);

      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.organizationId).toBe(mockUser.organizationId);
      expect(decoded.isSuperuser).toBe(mockUser.isSuperuser);
      expect(decoded.isStaff).toBe(mockUser.isStaff);
    });

    it('debe generar tokens con tiempo de expiración', () => {
      const mockUser = {
        id: '123',
        email: 'user@university.edu',
        role: 'STUDENT',
        organizationId: 'org-123',
        isSuperuser: false,
        isStaff: false,
      };

      const token = generateJwt(mockUser);
      const decoded = jwt.verify(token, secureSecret);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('Prevención de token forgery', () => {
    it('debe generar tokens únicos para cada usuario', () => {
      const user1 = {
        id: 'user-1',
        email: 'user1@university.edu',
        role: 'STUDENT',
        organizationId: 'org-1',
        isSuperuser: false,
        isStaff: false,
      };

      const user2 = {
        id: 'user-2',
        email: 'user2@university.edu',
        role: 'STUDENT',
        organizationId: 'org-2',
        isSuperuser: false,
        isStaff: false,
      };

      const token1 = generateJwt(user1);
      const token2 = generateJwt(user2);

      expect(token1).not.toBe(token2);

      const decoded1 = jwt.verify(token1, secureSecret);
      const decoded2 = jwt.verify(token2, secureSecret);

      expect(decoded1.userId).toBe(user1.id);
      expect(decoded2.userId).toBe(user2.id);
      expect(decoded1.userId).not.toBe(decoded2.userId);
    });

    it('debe generar tokens que no pueden ser modificados sin invalidar la firma', () => {
      const mockUser = {
        id: '123',
        email: 'student@university.edu',
        role: 'STUDENT',
        organizationId: 'org-123',
        isSuperuser: false,
        isStaff: false,
      };

      const token = generateJwt(mockUser);
      
      // Intentar modificar el payload
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      payload.role = 'ADMIN'; // Intentar escalar privilegios
      
      const modifiedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const modifiedToken = `${parts[0]}.${modifiedPayload}.${parts[2]}`;

      // El token modificado debe fallar la verificación
      expect(() => {
        jwt.verify(modifiedToken, secureSecret);
      }).toThrow();
    });

    it('debe generar tokens ADMIN que no pueden ser replicados sin el secreto', () => {
      const adminUser = {
        id: 'admin-123',
        email: 'admin@university.edu',
        role: 'ADMIN',
        organizationId: null,
        isSuperuser: true,
        isStaff: true,
      };

      const legitimateToken = generateJwt(adminUser);

      // Intentar crear un token similar con un secreto diferente
      const fakeToken = jwt.sign(
        {
          userId: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
          organizationId: adminUser.organizationId,
          isSuperuser: adminUser.isSuperuser,
          isStaff: adminUser.isStaff,
        },
        'different-secret-key-that-attacker-might-use-32chars',
        { expiresIn: '24h' }
      );

      // El token legítimo debe verificarse correctamente
      const decodedLegit = jwt.verify(legitimateToken, secureSecret);
      expect(decodedLegit.role).toBe('ADMIN');

      // El token falso debe fallar la verificación
      expect(() => {
        jwt.verify(fakeToken, secureSecret);
      }).toThrow();
    });
  });

  describe('Validación de roles en tokens generados', () => {
    it('debe generar tokens STUDENT con claims correctos', () => {
      const studentUser = {
        id: 'student-123',
        email: 'student@university.edu',
        role: 'STUDENT',
        organizationId: 'org-123',
        isSuperuser: false,
        isStaff: false,
      };

      const token = generateJwt(studentUser);
      const decoded = jwt.verify(token, secureSecret);

      expect(decoded.role).toBe('STUDENT');
      expect(decoded.isSuperuser).toBe(false);
      expect(decoded.isStaff).toBe(false);
    });

    it('debe generar tokens ADMIN con claims correctos', () => {
      const adminUser = {
        id: 'admin-123',
        email: 'admin@university.edu',
        role: 'ADMIN',
        organizationId: null,
        isSuperuser: true,
        isStaff: true,
      };

      const token = generateJwt(adminUser);
      const decoded = jwt.verify(token, secureSecret);

      expect(decoded.role).toBe('ADMIN');
      expect(decoded.isSuperuser).toBe(true);
      expect(decoded.isStaff).toBe(true);
    });

    it('debe generar tokens ORG_ADMIN con claims correctos', () => {
      const orgAdminUser = {
        id: 'orgadmin-123',
        email: 'orgadmin@university.edu',
        role: 'ORG_ADMIN',
        organizationId: 'org-456',
        isSuperuser: false,
        isStaff: true,
      };

      const token = generateJwt(orgAdminUser);
      const decoded = jwt.verify(token, secureSecret);

      expect(decoded.role).toBe('ORG_ADMIN');
      expect(decoded.organizationId).toBe('org-456');
      expect(decoded.isStaff).toBe(true);
    });
  });

  describe('Escenarios de ataque prevenidos', () => {
    it('debe prevenir que un atacante genere tokens válidos sin conocer el secreto', () => {
      // Un atacante intenta generar un token ADMIN con un secreto adivinado
      const attackerToken = jwt.sign(
        {
          userId: 'attacker-999',
          email: 'attacker@evil.com',
          role: 'ADMIN',
          organizationId: null,
          isSuperuser: true,
          isStaff: true,
        },
        'dev-secret-change-me-in-production', // Antiguo fallback
        { expiresIn: '24h' }
      );

      // El token del atacante no debe verificarse con el secreto real
      expect(() => {
        jwt.verify(attackerToken, secureSecret);
      }).toThrow();
    });

    it('debe prevenir replay de tokens generados en otro entorno', () => {
      const otherEnvSecret = 'other-environment-secret-key-with-32-characters-minimum';
      
      // Token generado en otro entorno con diferente secreto
      const otherEnvToken = jwt.sign(
        {
          userId: '123',
          email: 'user@university.edu',
          role: 'ADMIN',
        },
        otherEnvSecret,
        { expiresIn: '24h' }
      );

      // No debe verificarse con el secreto del entorno actual
      expect(() => {
        jwt.verify(otherEnvToken, secureSecret);
      }).toThrow();
    });

    it('debe prevenir uso de tokens con firma débil', () => {
      // Intentar crear un token con algoritmo none (sin firma)
      const unsignedToken = jwt.sign(
        {
          userId: '123',
          email: 'user@university.edu',
          role: 'ADMIN',
        },
        '',
        { algorithm: 'none' }
      );

      // No debe verificarse
      expect(() => {
        jwt.verify(unsignedToken, secureSecret);
      }).toThrow();
    });
  });

  describe('Consistencia con configuración de entorno', () => {
    it('debe usar el JWT_SECRET del entorno configurado', () => {
      const mockUser = {
        id: '123',
        email: 'user@university.edu',
        role: 'STUDENT',
        organizationId: 'org-123',
        isSuperuser: false,
        isStaff: false,
      };

      const token = generateJwt(mockUser);

      // Debe verificarse con el secreto del entorno
      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET);
      }).not.toThrow();

      // No debe verificarse con otros secretos
      expect(() => {
        jwt.verify(token, 'wrong-secret-key-with-32-characters-minimum-length');
      }).toThrow();
    });

    it('debe respetar el tiempo de expiración configurado', () => {
      const mockUser = {
        id: '123',
        email: 'user@university.edu',
        role: 'STUDENT',
        organizationId: 'org-123',
        isSuperuser: false,
        isStaff: false,
      };

      const token = generateJwt(mockUser);
      const decoded = jwt.verify(token, secureSecret);

      // Verificar que tiene tiempo de expiración
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      
      // El token debe expirar en el futuro
      const now = Math.floor(Date.now() / 1000);
      expect(decoded.exp).toBeGreaterThan(now);
    });
  });
});
