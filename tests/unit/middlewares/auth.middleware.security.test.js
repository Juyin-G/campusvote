/**
 * @file auth.middleware.security.test.js
 * @description Tests de seguridad para middleware de autenticación
 * Verifica que tokens forjados con secretos conocidos son rechazados
 */

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

describe('Authentication Middleware Security', () => {
  let authenticate, authorize;
  let mockReq, mockRes, mockNext;

  beforeEach(async () => {
    // Configurar un JWT_SECRET seguro para las pruebas
    process.env.JWT_SECRET = 'secure-test-jwt-secret-with-minimum-32-characters-required';
    
    jest.resetModules();
    
    // Importar el middleware después de configurar el entorno
    const authMiddleware = await import('../../../src/middlewares/auth.middleware.js');
    authenticate = authMiddleware.authenticate;
    authorize = authMiddleware.authorize;

    // Mock de request, response y next
    mockReq = {
      headers: {},
      user: null,
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Prevención de token forgery con secretos conocidos', () => {
    it('debe rechazar tokens firmados con el antiguo fallback inseguro', () => {
      const insecureFallback = 'dev-secret-change-me-in-production';
      const forgedToken = jwt.sign(
        {
          userId: '999',
          email: 'attacker@evil.com',
          role: 'ADMIN',
          organizationId: null,
          isSuperuser: true,
          isStaff: true,
        },
        insecureFallback,
        { expiresIn: '24h' }
      );

      mockReq.headers.authorization = `Bearer ${forgedToken}`;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/token JWT es inválido|mal formado/i),
        })
      );
      expect(mockReq.user).toBeNull();
    });

    it('debe rechazar tokens firmados con secretos inseguros conocidos', () => {
      const insecureSecrets = [
        'secret',
        'test-secret',
        'jwt-secret',
        'change-me',
      ];

      insecureSecrets.forEach((insecureSecret) => {
        const forgedToken = jwt.sign(
          {
            userId: '999',
            email: 'attacker@evil.com',
            role: 'ADMIN',
          },
          insecureSecret,
          { expiresIn: '24h' }
        );

        mockReq.headers.authorization = `Bearer ${forgedToken}`;
        mockReq.user = null;
        mockNext.mockClear();

        authenticate(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringMatching(/token JWT es inválido|mal formado/i),
          })
        );
        expect(mockReq.user).toBeNull();
      });
    });

    it('debe rechazar tokens ADMIN forjados con secreto conocido', () => {
      const knownSecret = 'dev-secret-change-me-in-production';
      const forgedAdminToken = jwt.sign(
        {
          userId: 'attacker-id',
          email: 'attacker@evil.com',
          role: 'ADMIN',
          organizationId: null,
          isSuperuser: true,
          isStaff: true,
        },
        knownSecret,
        { expiresIn: '24h' }
      );

      mockReq.headers.authorization = `Bearer ${forgedAdminToken}`;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/inválido|mal formado/i),
        })
      );
      expect(mockReq.user).toBeNull();
    });

    it('debe rechazar tokens ORG_ADMIN forjados con secreto conocido', () => {
      const knownSecret = 'dev-secret-change-me-in-production';
      const forgedOrgAdminToken = jwt.sign(
        {
          userId: 'attacker-id',
          email: 'attacker@evil.com',
          role: 'ORG_ADMIN',
          organizationId: 'target-org-id',
          isSuperuser: false,
          isStaff: true,
        },
        knownSecret,
        { expiresIn: '24h' }
      );

      mockReq.headers.authorization = `Bearer ${forgedOrgAdminToken}`;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/inválido|mal formado/i),
        })
      );
      expect(mockReq.user).toBeNull();
    });
  });

  describe('Aceptación de tokens válidos con secreto correcto', () => {
    it('debe aceptar tokens firmados con el JWT_SECRET configurado', () => {
      const validSecret = process.env.JWT_SECRET;
      const validToken = jwt.sign(
        {
          userId: '123',
          email: 'user@university.edu',
          role: 'STUDENT',
          organizationId: 'org-123',
          isSuperuser: false,
          isStaff: false,
        },
        validSecret,
        { expiresIn: '24h' }
      );

      mockReq.headers.authorization = `Bearer ${validToken}`;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe('123');
      expect(mockReq.user.role).toBe('STUDENT');
    });

    it('debe aceptar tokens ADMIN válidos firmados con secreto correcto', () => {
      const validSecret = process.env.JWT_SECRET;
      const validAdminToken = jwt.sign(
        {
          userId: 'admin-123',
          email: 'admin@university.edu',
          role: 'ADMIN',
          organizationId: null,
          isSuperuser: true,
          isStaff: true,
        },
        validSecret,
        { expiresIn: '24h' }
      );

      mockReq.headers.authorization = `Bearer ${validAdminToken}`;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.role).toBe('ADMIN');
      expect(mockReq.user.isSuperuser).toBe(true);
    });
  });

  describe('Autorización basada en roles del token', () => {
    it('debe rechazar acceso ADMIN cuando el token no tiene ese rol', () => {
      const validSecret = process.env.JWT_SECRET;
      const studentToken = jwt.sign(
        {
          userId: '123',
          email: 'student@university.edu',
          role: 'STUDENT',
        },
        validSecret,
        { expiresIn: '24h' }
      );

      mockReq.headers.authorization = `Bearer ${studentToken}`;

      // Primero autenticar
      authenticate(mockReq, mockRes, mockNext);
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.role).toBe('STUDENT');

      // Luego intentar autorizar como ADMIN
      mockNext.mockClear();
      const authorizeAdmin = authorize('ADMIN');
      authorizeAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/no tienes permisos/i),
        })
      );
    });

    it('debe permitir acceso ADMIN cuando el token tiene ese rol', () => {
      const validSecret = process.env.JWT_SECRET;
      const adminToken = jwt.sign(
        {
          userId: 'admin-123',
          email: 'admin@university.edu',
          role: 'ADMIN',
        },
        validSecret,
        { expiresIn: '24h' }
      );

      mockReq.headers.authorization = `Bearer ${adminToken}`;

      // Primero autenticar
      authenticate(mockReq, mockRes, mockNext);
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.role).toBe('ADMIN');

      // Luego autorizar como ADMIN
      mockNext.mockClear();
      const authorizeAdmin = authorize('ADMIN');
      authorizeAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('debe permitir acceso a múltiples roles cuando el token coincide', () => {
      const validSecret = process.env.JWT_SECRET;
      const orgAdminToken = jwt.sign(
        {
          userId: 'org-admin-123',
          email: 'orgadmin@university.edu',
          role: 'ORG_ADMIN',
        },
        validSecret,
        { expiresIn: '24h' }
      );

      mockReq.headers.authorization = `Bearer ${orgAdminToken}`;

      // Primero autenticar
      authenticate(mockReq, mockRes, mockNext);
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.role).toBe('ORG_ADMIN');

      // Luego autorizar con múltiples roles permitidos
      mockNext.mockClear();
      const authorizeMultiple = authorize('ADMIN', 'ORG_ADMIN');
      authorizeMultiple(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Validación de formato de token', () => {
    it('debe rechazar requests sin header Authorization', () => {
      delete mockReq.headers.authorization;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/no se envió token/i),
        })
      );
      expect(mockReq.user).toBeNull();
    });

    it('debe rechazar tokens que no empiezan con "Bearer "', () => {
      mockReq.headers.authorization = 'InvalidFormat token123';

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/no se envió token/i),
        })
      );
      expect(mockReq.user).toBeNull();
    });

    it('debe rechazar tokens malformados', () => {
      mockReq.headers.authorization = 'Bearer not-a-valid-jwt-token';

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/inválido|mal formado/i),
        })
      );
      expect(mockReq.user).toBeNull();
    });

    it('debe rechazar tokens expirados', () => {
      const validSecret = process.env.JWT_SECRET;
      const expiredToken = jwt.sign(
        {
          userId: '123',
          email: 'user@university.edu',
          role: 'STUDENT',
        },
        validSecret,
        { expiresIn: '-1h' } // Token expirado hace 1 hora
      );

      mockReq.headers.authorization = `Bearer ${expiredToken}`;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/expiró/i),
        })
      );
      expect(mockReq.user).toBeNull();
    });
  });

  describe('Escenarios de ataque prevenidos', () => {
    it('debe prevenir escalación de privilegios con token forjado', () => {
      // Atacante intenta forjar un token ADMIN con el antiguo fallback
      const attackerForgedToken = jwt.sign(
        {
          userId: 'attacker-999',
          email: 'attacker@evil.com',
          role: 'ADMIN',
          isSuperuser: true,
          isStaff: true,
        },
        'dev-secret-change-me-in-production',
        { expiresIn: '24h' }
      );

      mockReq.headers.authorization = `Bearer ${attackerForgedToken}`;

      authenticate(mockReq, mockRes, mockNext);

      // El token debe ser rechazado
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/inválido|mal formado/i),
        })
      );
      expect(mockReq.user).toBeNull();

      // Verificar que no se puede autorizar como ADMIN
      if (mockReq.user) {
        mockNext.mockClear();
        const authorizeAdmin = authorize('ADMIN');
        authorizeAdmin(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringMatching(/no autenticado|no tienes permisos/i),
          })
        );
      }
    });

    it('debe prevenir acceso a operaciones administrativas con token forjado', () => {
      // Atacante intenta acceder a operaciones de gestión de períodos académicos
      const forgedOrgAdminToken = jwt.sign(
        {
          userId: 'attacker-999',
          email: 'attacker@evil.com',
          role: 'ORG_ADMIN',
          organizationId: 'target-org',
        },
        'dev-secret-change-me-in-production',
        { expiresIn: '24h' }
      );

      mockReq.headers.authorization = `Bearer ${forgedOrgAdminToken}`;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/inválido|mal formado/i),
        })
      );
      expect(mockReq.user).toBeNull();
    });

    it('debe prevenir manipulación de claims en token válido', () => {
      const validSecret = process.env.JWT_SECRET;
      
      // Crear un token válido de STUDENT
      const studentToken = jwt.sign(
        {
          userId: '123',
          email: 'student@university.edu',
          role: 'STUDENT',
        },
        validSecret,
        { expiresIn: '24h' }
      );

      // Decodificar y modificar el payload (sin re-firmar)
      const decoded = jwt.decode(studentToken);
      decoded.role = 'ADMIN'; // Intentar cambiar el rol
      
      // Crear un token manipulado (esto fallará porque la firma no coincide)
      const parts = studentToken.split('.');
      const manipulatedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
      const manipulatedToken = `${parts[0]}.${manipulatedPayload}.${parts[2]}`;

      mockReq.headers.authorization = `Bearer ${manipulatedToken}`;

      authenticate(mockReq, mockRes, mockNext);

      // El token manipulado debe ser rechazado
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/inválido|mal formado/i),
        })
      );
      expect(mockReq.user).toBeNull();
    });
  });
});
