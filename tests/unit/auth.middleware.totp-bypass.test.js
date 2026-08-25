/* eslint-disable sonarjs/hardcoded-secret-signatures */
/**
 * Unit Test: auth.middleware TOTP-pending token rejection
 * 
 * This test suite verifies the middleware-level security fix for the TOTP-pending
 * JWT bypass vulnerability. It tests the middleware functions directly without
 * requiring database or HTTP server setup.
 * 
 * Tests verify:
 * 1. authenticate() rejects tokens with purpose='TOTP_PENDING'
 * 2. authenticateAllowPending() accepts tokens with purpose='TOTP_PENDING'
 * 3. requireTotpPending() enforces TOTP_PENDING purpose
 */
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.unstable_mockModule('../../src/config/env.js', () => ({
  default: {
    JWT_SECRET: 'test-secret-key-for-unit-tests',
    JWT_EXPIRES_IN: '24h',
  },
}));

const { authenticate, authenticateAllowPending, requireTotpPending } = 
  await import('../../src/middlewares/auth.middleware.js');
const { ApiError } = await import('../../src/shared/errors/ApiError.js');
const env = (await import('../../src/config/env.js')).default;

describe('Unit: auth.middleware TOTP-pending security', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null,
    };
    res = {};
    next = jest.fn();
  });

  describe('authenticate() - standard middleware', () => {
    it('should reject TOTP_PENDING token with 403 Forbidden', () => {
      const totpPendingToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', purpose: 'TOTP_PENDING' },
        env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      req.headers.authorization = `Bearer ${totpPendingToken}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('verificación de dos factores');
      expect(req.user).toBeNull();
    });

    it('should accept normal token without purpose field', () => {
      const normalToken = jwt.sign(
        { 
          userId: 'user-123', 
          email: 'test@example.com',
          role: 'STUDENT',
        },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      req.headers.authorization = `Bearer ${normalToken}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('user-123');
      expect(req.user.purpose).toBeUndefined();
    });

    it('should accept token with purpose other than TOTP_PENDING', () => {
      const otherPurposeToken = jwt.sign(
        { 
          userId: 'user-123', 
          email: 'test@example.com',
          purpose: 'PASSWORD_RESET',
        },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      req.headers.authorization = `Bearer ${otherPurposeToken}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.purpose).toBe('PASSWORD_RESET');
    });

    it('should reject request without Authorization header', () => {
      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('token de autenticación');
    });

    it('should reject request with malformed Authorization header', () => {
      req.headers.authorization = 'InvalidFormat token123';

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
    });

    it('should reject expired token', () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      req.headers.authorization = `Bearer ${expiredToken}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('expiró');
    });

    it('should reject token with invalid signature', () => {
      const tokenWithWrongSecret = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      req.headers.authorization = `Bearer ${tokenWithWrongSecret}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('inválido');
    });

    it('should reject completely malformed JWT', () => {
      req.headers.authorization = 'Bearer not.a.valid.jwt.token';

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('authenticateAllowPending() - TOTP verification middleware', () => {
    it('should accept TOTP_PENDING token', () => {
      const totpPendingToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', purpose: 'TOTP_PENDING' },
        env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      req.headers.authorization = `Bearer ${totpPendingToken}`;

      authenticateAllowPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('user-123');
      expect(req.user.purpose).toBe('TOTP_PENDING');
    });

    it('should also accept normal tokens', () => {
      const normalToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', role: 'STUDENT' },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      req.headers.authorization = `Bearer ${normalToken}`;

      authenticateAllowPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('user-123');
    });

    it('should still reject expired TOTP_PENDING token', () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', purpose: 'TOTP_PENDING' },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      req.headers.authorization = `Bearer ${expiredToken}`;

      authenticateAllowPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
    });

    it('should still reject invalid JWT', () => {
      req.headers.authorization = 'Bearer invalid.jwt';

      authenticateAllowPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('requireTotpPending() - purpose enforcement', () => {
    it('should accept request with TOTP_PENDING purpose', () => {
      req.user = {
        userId: 'user-123',
        email: 'test@example.com',
        purpose: 'TOTP_PENDING',
      };

      requireTotpPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject request without user (not authenticated)', () => {
      req.user = null;

      requireTotpPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('No autenticado');
    });

    it('should reject normal token without TOTP_PENDING purpose', () => {
      req.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'STUDENT',
      };

      requireTotpPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('sesión temporal de verificación TOTP');
    });

    it('should reject token with different purpose', () => {
      req.user = {
        userId: 'user-123',
        email: 'test@example.com',
        purpose: 'PASSWORD_RESET',
      };

      requireTotpPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('Security property: middleware composition', () => {
    it('should enforce that authenticate + requireTotpPending blocks TOTP_PENDING', () => {
      const totpPendingToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', purpose: 'TOTP_PENDING' },
        env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      req.headers.authorization = `Bearer ${totpPendingToken}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      
      expect(req.user).toBeNull();
    });

    it('should enforce that authenticateAllowPending + requireTotpPending accepts TOTP_PENDING', () => {
      const totpPendingToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', purpose: 'TOTP_PENDING' },
        env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      req.headers.authorization = `Bearer ${totpPendingToken}`;

      authenticateAllowPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.purpose).toBe('TOTP_PENDING');

      next.mockClear();

      requireTotpPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('should enforce that authenticateAllowPending + requireTotpPending rejects normal token', () => {
      const normalToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', role: 'STUDENT' },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      req.headers.authorization = `Bearer ${normalToken}`;

      authenticateAllowPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.purpose).toBeUndefined();

      next.mockClear();

      requireTotpPending(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle token with purpose as empty string', () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', purpose: '' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
    });

    it('should handle token with purpose as null', () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', purpose: null },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
    });

    it('should be case-sensitive for purpose check', () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', purpose: 'totp_pending' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.purpose).toBe('totp_pending');
    });

    it('should handle token with TOTP_PENDING in different field', () => {
      const token = jwt.sign(
        { 
          userId: 'user-123', 
          email: 'test@example.com',
          type: 'TOTP_PENDING',
        },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
    });

    it('should handle Authorization header with extra whitespace', () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', purpose: 'TOTP_PENDING' },
        env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      req.headers.authorization = `Bearer  ${token}`;

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
    });
  });
});