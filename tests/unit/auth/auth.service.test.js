import { jest } from '@jest/globals';

// Mocks de modules transitivos del módulo under test (auth.service.js).
// Se registran ANTES del import dinámico.

// prisma (database/prisma.js)
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const prismaMock = {
  user: {
    findUnique: mockUserFindUnique,
    update: mockUserUpdate,
  },
  refreshToken: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  passwordResetToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  emailVerificationToken: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  activationToken: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.unstable_mockModule(
  '../../../src/database/prisma.js',
  () => ({ prisma: prismaMock, default: prismaMock })
);

// audit service
const mockLogAction = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule(
  '../../../src/modules/audit/audit.service.js',
  () => ({ default: { logAction: mockLogAction }, logAction: mockLogAction })
);

// auth.repository
const mockCreateSession = jest.fn().mockResolvedValue({ id: 'session-1' });
const mockRevokeSession = jest.fn().mockResolvedValue({ count: 1 });
const mockFindRefreshToken = jest.fn();
const mockFindByEmail = jest.fn();
const mockFindById = jest.fn();

const repoMock = {
  findByEmail: mockFindByEmail,
  findById: mockFindById,
  createSession: mockCreateSession,
  revokeSession: mockRevokeSession,
  findRefreshToken: mockFindRefreshToken,
  createRefreshToken: jest.fn().mockResolvedValue({ id: 'rt-1' }),
  revokeRefreshToken: jest.fn().mockResolvedValue({ count: 1 }),
  revokeAllUserRefreshTokens: jest.fn().mockResolvedValue({ count: 1 }),
  updateLastLogin: jest.fn().mockResolvedValue({}),
  default: {
    findByEmail: mockFindByEmail,
    findById: mockFindById,
    createSession: mockCreateSession,
    revokeSession: mockRevokeSession,
    findRefreshToken: mockFindRefreshToken,
    createRefreshToken: jest.fn().mockResolvedValue({ id: 'rt-1' }),
  },
};

jest.unstable_mockModule(
  '../../../src/modules/auth/repositories/auth.repository.js',
  () => repoMock
);

// auth.helpers
const mockGenerateJwt = jest.fn().mockReturnValue('mocked-jwt-token-123');
const mockGeneratePendingToken = jest
  .fn()
  .mockReturnValue('mocked-temp-token-123');
const mockGenerateRefreshToken = jest.fn().mockReturnValue({
  token: 'raw-refresh-token',
  tokenHash: 'token-hash-123',
});
const mockFormatUserResponse = jest.fn((user) => user);

jest.unstable_mockModule(
  '../../../src/modules/auth/services/auth.helpers.js',
  () => ({
    AUTH_MESSAGES: {
      INVALID_CREDENTIALS: 'Credenciales inválidas',
      ACCOUNT_LOCKED: 'Cuenta bloqueada por intentos fallidos',
      ACCOUNT_SUSPENDED: 'Cuenta suspendida',
      MFA_REQUIRED: 'Se requiere 2FA',
      TOKEN_INVALID: 'Token inválido o expirado',
    },
    authError: (message, code = 'UNAUTHORIZED') =>
      new Error(`${code}: ${message}`),
    generateJwt: mockGenerateJwt,
    generatePendingToken: mockGeneratePendingToken,
    generateRefreshToken: mockGenerateRefreshToken,
    formatUserResponse: mockFormatUserResponse,
    default: {
      AUTH_MESSAGES: {
        INVALID_CREDENTIALS: 'Credenciales inválidas',
        ACCOUNT_LOCKED: 'Cuenta bloqueada por intentos fallidos',
      },
      authError: (message) => new Error(message),
      generateJwt: mockGenerateJwt,
      generatePendingToken: mockGeneratePendingToken,
      generateRefreshToken: mockGenerateRefreshToken,
      formatUserResponse: mockFormatUserResponse,
    },
  })
);

// bcryptjs
const mockHash = jest.fn();
const mockCompare = jest.fn();
jest.unstable_mockModule('bcryptjs', () => ({
  default: { hash: mockHash, compare: mockCompare },
  hash: mockHash,
  compare: mockCompare,
}));

// env
jest.unstable_mockModule(
  '../../../src/config/env.js',
  () => ({
    default: {
      JWT_SECRET: 'test-secret-key',
      JWT_EXPIRES_IN: '1h',
      REFRESH_TOKEN_TTL_SECONDS: 3600,
    },
  })
);

// logger
jest.unstable_mockModule(
  '../../../src/config/logger.js',
  () => ({
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  })
);

const authService = await import(
  '../../../src/modules/auth/services/auth.service.js'
);

const baseUser = {
  id: 'user-1',
  email: 'estudiante@universidad.edu',
  password: 'hashed_password_db',
  username: 'estudiante1',
  firstName: 'E',
  lastName: 'U',
  authProvider: 'LOCAL',
  status: 'ACTIVE',
  isVerified: true,
  role: 'STUDENT',
  failedLoginAttempts: 0,
  lockedUntil: null,
  mustChangePassword: false,
  twoFactorEnabled: false,
  lastLogin: null,
};

describe('Auth Service — regla de 2FA por rol (login)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockResolvedValue(null);
  });

  it('E: rol sin 2FA → requiresOnboarding + tempToken ONBOARDING, sin token', async () => {
    mockUserFindUnique.mockResolvedValue(baseUser);
    mockCompare.mockResolvedValue(true);

    const result = await authService.login({
      email: baseUser.email,
      password: 'PasswordSeguro123!',
    });

    expect(result.requiresOnboarding).toBe(true);
    expect(result.tempToken).toBe('mocked-temp-token-123');
    expect(result.email).toBe(baseUser.email);
    expect(result.mustChangePassword).toBe(true);
    expect(result.token).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
    expect(mockGeneratePendingToken).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'ONBOARDING', ttlSeconds: 1800 })
    );
    expect(mockGenerateJwt).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('G: rol embebido en el body es ignorado (backend es la autoridad)', async () => {
    mockUserFindUnique.mockResolvedValue(baseUser);
    mockCompare.mockResolvedValue(true);

    const result = await authService.login({
      email: baseUser.email,
      password: 'PasswordSeguro123!',
      role: 'SUPERADMIN',
      userId: 'falso-id',
      organizationId: 'falso-org',
    });

    // Sigue siendo STDUDENT sin 2FA → onboarding; jamás sesión completa.
    expect(result.requiresOnboarding).toBe(true);
    expect(result.token).toBeUndefined();
    expect(mockGenerateJwt).not.toHaveBeenCalled();
  });

  it('B: rol con 2FA configurado → requiresTotp + tempToken TOTP_PENDING, sin token', async () => {
    mockUserFindUnique.mockResolvedValue({
      ...baseUser,
      twoFactorEnabled: true,
      twoFactorBackupCodes: ['hash-1', 'hash-2'],
      mustChangePassword: true,
    });
    mockCompare.mockResolvedValue(true);

    const result = await authService.login({
      email: baseUser.email,
      password: 'PasswordSeguro123!',
    });

    expect(result.requiresTotp).toBe(true);
    expect(result.tempToken).toBe('mocked-temp-token-123');
    expect(result.token).toBeUndefined();
    expect(result.mustChangePassword).toBe(true);
    expect(mockGeneratePendingToken).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'TOTP_PENDING', ttlSeconds: 600 })
    );
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('A: SUPERADMIN sin 2FA → sesión completa con token + refreshToken', async () => {
    mockUserFindUnique.mockResolvedValue({
      ...baseUser,
      role: 'SUPERADMIN',
      email: 'super@campusvote.pe',
    });
    mockCompare.mockResolvedValue(true);
    mockUserUpdate.mockResolvedValue({});

    const result = await authService.login({
      email: 'super@campusvote.pe',
      password: 'PasswordSeguro123!',
    });

    expect(result.requiresTotp).toBe(false);
    expect(result.token).toBe('mocked-jwt-token-123');
    expect(result.refreshToken).toBe('raw-refresh-token');
    expect(result.expiresIn).toBe(3600);
    expect(result.tempToken).toBeUndefined();
    expect(mockGenerateJwt).toHaveBeenCalledTimes(1);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tokenHash: 'token-hash-123',
      })
    );
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ lastLogin: expect.any(Date) }),
      })
    );
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN' })
    );
  });

  it('rechaza credenciales inválidas', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await expect(
      authService.login({ email: 'no@existe.com', password: 'x' })
    ).rejects.toThrow();
  });

  it('rechaza contraseña incorrecta', async () => {
    mockUserFindUnique.mockResolvedValue(baseUser);
    mockCompare.mockResolvedValue(false);
    await expect(
      authService.login({ email: baseUser.email, password: 'incorrecta' })
    ).rejects.toThrow();
  });

  it('rechaza cuenta bloqueada temporalmente', async () => {
    mockUserFindUnique.mockResolvedValue({
      ...baseUser,
      lockedUntil: new Date(Date.now() + 60 * 60 * 1000),
    });
    mockCompare.mockResolvedValue(true);
    await expect(
      authService.login({ email: baseUser.email, password: 'x' })
    ).rejects.toThrow('bloqueada');
  });

  describe('refreshSession', () => {
    it('renueva con contract token/expiresIn/user formateado', async () => {
      mockFindRefreshToken.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        user: { ...baseUser, email: 'super@campusvote.pe', role: 'SUPERADMIN' },
      });

      const result = await authService.refreshSession('raw-refresh-token');

      expect(result.token).toBe('mocked-jwt-token-123');
      expect(result.expiresIn).toBe(3600);
      expect(result.user).toBeDefined();
    });

    it('rechaza refresh token revocado o expirado', async () => {
      mockFindRefreshToken.mockResolvedValue({ revokedAt: new Date(), user: baseUser });
      await expect(
        authService.refreshSession('raw-refresh-token')
      ).rejects.toThrow();
    });
  });
});