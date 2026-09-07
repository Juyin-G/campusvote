import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/config/env.js', () => ({
  default: {
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    GOOGLE_CALLBACK_URL: 'https://api.test/auth/google/callback',
    JWT_REFRESH_EXPIRES_IN: '7d',
  },
}));

jest.unstable_mockModule('../../../src/config/logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.unstable_mockModule('../../../src/shared/utils/formatUserResponse.js', () => ({
  formatUserResponse: (u) => u,
}));

jest.unstable_mockModule('../../../src/modules/auth/services/auth.helpers.js', () => ({
  generateJwt: jest.fn(() => 'access-token'),
  generateRefreshToken: jest.fn(() => ({
    rawToken: 'refresh-token',
    tokenHash: 'refresh-hash',
  })),
}));

const mockFindByGoogleId = jest.fn();
const mockFindByEmail = jest.fn();
const mockLinkGoogleIdentity = jest.fn();
const mockCreateRefreshToken = jest.fn().mockResolvedValue({ id: 'rt' });
const mockUpdateLastLogin = jest.fn().mockResolvedValue({});

jest.unstable_mockModule('../../../src/modules/auth/repositories/auth.repository.js', () => ({
  findByGoogleId: mockFindByGoogleId,
  findByEmail: mockFindByEmail,
  linkGoogleIdentity: mockLinkGoogleIdentity,
  createRefreshToken: mockCreateRefreshToken,
  updateLastLogin: mockUpdateLastLogin,
}));

const googleService = await import(
  '../../../src/modules/auth/services/google-auth.service.js'
);

const baseUser = {
  id: 'user-1',
  email: 'juan@gmail.com',
  username: 'juan',
  role: 'OBSERVER',
  status: 'ACTIVE',
  authProvider: 'LOCAL',
  isSuperuser: false,
  isStaff: false,
  organizationId: 'org-1',
  googleId: 'google-123',
};

describe('Google Auth Service', () => {
  describe('getAuthUrl', () => {
    it('construye la URL de autorización con cliente y callback', () => {
      const url = googleService.getAuthUrl('state-abc');
      expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=google-client-id');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=state-abc');
    });
  });

  describe('authenticateWithGoogle', () => {
    const setupFetch = () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'at', id_token: 'it' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'google-123', email: 'juan@gmail.com' }),
        });
    };

    it('retorna la sesión cuando el usuario existe por googleId', async () => {
      setupFetch();
      mockFindByGoogleId.mockResolvedValue(baseUser);

      const session = await googleService.authenticateWithGoogle('the-code');

      expect(session.token).toBe('access-token');
      expect(session.refreshToken).toBe('refresh-token');
    });

    it('rechaza si Google no devuelve email', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'g-1', email: null }) });

      await expect(
        googleService.authenticateWithGoogle('the-code')
      ).rejects.toThrow('Google no devolvió un correo válido');
    });

    it('rechaza si no existe usuario con ese correo', async () => {
      setupFetch();
      mockFindByGoogleId.mockResolvedValue(null);
      mockFindByEmail.mockResolvedValue(null);

      await expect(
        googleService.authenticateWithGoogle('the-code')
      ).rejects.toThrow('No existe una cuenta');
    });
  });
});
