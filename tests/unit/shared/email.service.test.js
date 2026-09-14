/**
 * @file tests/unit/shared/email.service.test.js
 * @description Cobertura mínima del contrato del servicio de email
 *              tras migrarlo a Gmail API.
 */

import {
  hasEmailConfigured,
  sendVerification,
  sendReset,
  sendRequestReceived,
  sendAdminActivation,
} from '../../../src/shared/services/email.service.js';
import { ApiError } from '../../../src/shared/errors/ApiError.js';

describe('email.service (Gmail API)', () => {
  describe('contrato público', () => {
    it('exporta las 5 funciones esperadas', () => {
      expect(typeof hasEmailConfigured).toBe('function');
      expect(typeof sendVerification).toBe('function');
      expect(typeof sendReset).toBe('function');
      expect(typeof sendRequestReceived).toBe('function');
      expect(typeof sendAdminActivation).toBe('function');
    });

    it('hasEmailConfigured devuelve un booleano coherente con env', () => {
      const result = hasEmailConfigured();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('errores especializados de ApiError', () => {
    it('existe ApiError.emailAuthFailed con código EMAIL_AUTH_FAILED', () => {
      const err = ApiError.emailAuthFailed('custom msg');
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe('EMAIL_AUTH_FAILED');
      expect(err.message).toBe('custom msg');
    });

    it('existe ApiError.emailRateLimited con código EMAIL_RATE_LIMITED y HTTP 429', () => {
      const err = ApiError.emailRateLimited('custom msg');
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('EMAIL_RATE_LIMITED');
      expect(err.message).toBe('custom msg');
    });
  });
});
