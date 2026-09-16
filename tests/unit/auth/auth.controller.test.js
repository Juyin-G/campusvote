import { jest } from '@jest/globals';

const mockLogin = jest.fn();
const mockRequestPasswordReset = jest.fn();
const mockResetPassword = jest.fn();

// Mock del servicio de autenticación
jest.unstable_mockModule(
  '../../../src/modules/auth/services/auth.service.js',
  () => ({
    login: mockLogin,
    requestPasswordReset: mockRequestPasswordReset,
    resetPassword: mockResetPassword,
  })
);

// Mock de asyncHandler para resolver errores hacia next() de forma sincrónica en los tests
jest.unstable_mockModule(
  '../../../src/shared/utils/asyncHandler.js',
  () => ({
    default: (fn) => async (req, res, next) => {
      try {
        await fn(req, res, next);
      } catch (err) {
        next(err);
      }
    },
  })
);

// Mock del logger para evitar ensuciar la consola
jest.unstable_mockModule(
  '../../../src/config/logger.js',
  () => ({
    default: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  })
);

const authController = await import(
  '../../../src/modules/auth/controllers/auth.controller.js'
);

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, requestId: 'test-request-id', headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/request-password-reset', () => {
    it('Deberia responder 200 OK al solicitar restablecimiento', async () => {
      const mockResponse = { message: 'Correo de restablecimiento enviado' };

      req.body = { email: 'test@test.com' };

      mockRequestPasswordReset.mockResolvedValue(mockResponse);

      await authController.requestPasswordReset(req, res, next);

      expect(mockRequestPasswordReset).toHaveBeenCalledWith(req.body.email);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResponse,
        })
      );
    });

    it('Deberia pasar el error al middleware next si falla el servicio', async () => {
      const error = new Error('Error al enviar correo');

      req.body = { email: 'test@test.com' };

      mockRequestPasswordReset.mockRejectedValue(error);

      await authController.requestPasswordReset(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('Deberia responder 200 OK y retornar el token al iniciar sesion', async () => {
      const mockResponse = {
        token: 'jwt-token',
        user: {
          id: '1',
          role: 'STUDENT',
        },
      };

      req.body = {
        email: 'test@test.com',
        password: 'Pass123!',
      };

      mockLogin.mockResolvedValue(mockResponse);

      await authController.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResponse,
        })
      );
    });

    it('Deberia pasar el error al middleware next si las credenciales son invalidas', async () => {
      const error = new Error('Credenciales invalidas');

      req.body = {
        email: 'test@test.com',
        password: 'wrong',
      };

      mockLogin.mockRejectedValue(error);

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});