import { jest } from '@jest/globals';

// Mocks de modules transitivos de auth.lifecycle.service.js, antes del import.

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
jest.unstable_mockModule(
  '../../../src/database/prisma.js',
  () => ({
    prisma: { user: { findUnique: mockUserFindUnique, update: mockUserUpdate } },
    default: { user: { findUnique: mockUserFindUnique, update: mockUserUpdate } },
  })
);

const mockActivateOrganizationWithToken = jest.fn();
const mockFindById = jest.fn();
const mockCreateSession = jest.fn();
jest.unstable_mockModule(
  '../../../src/modules/auth/repositories/auth.repository.js',
  () => ({
    activateOrganizationWithToken: mockActivateOrganizationWithToken,
    findById: mockFindById,
    createSession: mockCreateSession,
    default: {
      activateOrganizationWithToken: mockActivateOrganizationWithToken,
      findById: mockFindById,
      createSession: mockCreateSession,
    },
  })
);

jest.unstable_mockModule(
  '../../../src/modules/auth/repositories/otp.repository.js',
  () => ({
    default: {
      saveTotpSecret: jest.fn(),
      enableTwoFactor: jest.fn(),
      completeOnboardingTwoFactor: jest.fn(),
    },
  })
);

const mockGeneratePendingToken = jest
  .fn()
  .mockReturnValue('mocked-onboarding-token-123');
const mockFormatUserResponse = jest.fn((user) => user);
const mockGenerateJwt = jest.fn().mockReturnValue('jwt-access-token');
const mockGenerateRefreshToken = jest
  .fn()
  .mockReturnValue({ token: 'refresh-opaco-123', tokenHash: 'refresh-hash-123' });

jest.unstable_mockModule(
  '../../../src/modules/auth/services/auth.helpers.js',
  () => ({
    AUTH_MESSAGES: {
      TOKEN_INVALID: 'Token inválido o expirado',
      ONBOARDING_COMPLETE_2FA_FIRST:
        'Debe completar la configuración de 2FA antes de finalizar el acceso.',
    },
    authError: (message, code = 'UNAUTHORIZED') => new Error(`${code}: ${message}`),
    generatePendingToken: mockGeneratePendingToken,
    generateJwt: mockGenerateJwt,
    generateRefreshToken: mockGenerateRefreshToken,
    formatUserResponse: mockFormatUserResponse,
    PENDING_TOKEN_TTL: { TOTP_PENDING: 600, ONBOARDING: 1800 },
    ACCESS_TOKEN_TTL_SECONDS: 3600,
    default: {
      AUTH_MESSAGES: {
        TOKEN_INVALID: 'Token inválido o expirado',
        ONBOARDING_COMPLETE_2FA_FIRST:
          'Debe completar la configuración de 2FA antes de finalizar el acceso.',
      },
      authError: (message, code = 'UNAUTHORIZED') => new Error(`${code}: ${message}`),
      generatePendingToken: mockGeneratePendingToken,
      generateJwt: mockGenerateJwt,
      generateRefreshToken: mockGenerateRefreshToken,
      formatUserResponse: mockFormatUserResponse,
      PENDING_TOKEN_TTL: { TOTP_PENDING: 600, ONBOARDING: 1800 },
      ACCESS_TOKEN_TTL_SECONDS: 3600,
    },
  })
);

const mockHash = jest.fn();
jest.unstable_mockModule('bcryptjs', () => ({
  default: { hash: mockHash },
  hash: mockHash,
}));

jest.unstable_mockModule('../../../src/config/env.js', () => ({
  default: {
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_TTL_SECONDS: undefined,
  },
}));

const lifecycleService = await import(
  '../../../src/modules/auth/services/auth.lifecycle.service.js'
);

const activatedUser = {
  id: 'user-uid-1',
  email: 'admin-aprobado@institucion.edu',
  username: 'adminaprobado',
  role: 'ADMIN',
  status: 'PENDING_ACTIVATION',
  firstName: 'Administrador',
  lastName: '',
  institutionalId: 'ADMIN-XXXX',
  organizationId: 'org-uid-1',
  isVerified: true,
  isStaff: true,
  isSuperuser: false,
  twoFactorEnabled: false,
  mustChangePassword: false,
  mustSetup2fa: true,
  lastLogin: null,
  dateJoined: null,
};

describe('Auth Lifecycle Service — activateAccount (aprobación de organización)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('activa cuenta válida, crea user vía SQL y emite tempToken ONBOARDING', async () => {
    mockActivateOrganizationWithToken.mockResolvedValue('user-uid-1');
    mockUserFindUnique.mockResolvedValue(activatedUser);
    mockHash.mockResolvedValue('hashed_password');

    const result = await lifecycleService.activateAccount(
      'raw-activation-token',
      'NuevaClaveSegura123!'
    );

    expect(mockActivateOrganizationWithToken).toHaveBeenCalledWith(
      'raw-activation-token',
      'hashed_password'
    );
    expect(result.activated).toBe(true);
    expect(result.requiresOnboarding).toBe(true);
    expect(result.tempToken).toBe('mocked-onboarding-token-123');
    expect(result.email).toBe(activatedUser.email);
    expect(result.mustSetup2fa).toBe(true);
    expect(mockGeneratePendingToken).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'ONBOARDING', ttlSeconds: 1800 })
    );
    expect(result.user).toBeDefined();
  });

  it('rechaza token inválido/expirado/usado con 401 (repo devuelve null)', async () => {
    mockActivateOrganizationWithToken.mockResolvedValue(null);
    mockHash.mockResolvedValue('hashed_password');

    await expect(
      lifecycleService.activateAccount('token-invalido', 'NuevaClaveSegura123!')
    ).rejects.toThrow('Token inválido o expirado');
    expect(mockGeneratePendingToken).not.toHaveBeenCalled();
  });

  it('rechaza si el usuario creado por SQL no se encuentra en BD', async () => {
    mockActivateOrganizationWithToken.mockResolvedValue('user-uid-1');
    mockUserFindUnique.mockResolvedValue(null);
    mockHash.mockResolvedValue('hashed_password');

    await expect(
      lifecycleService.activateAccount('token-ok', 'NuevaClaveSegura123!')
    ).rejects.toThrow('Token inválido o expirado');
  });
});

describe('Auth Lifecycle Service — finalizeOnboarding (sesión completa)', () => {
  const activatedUserFull = {
    id: 'user-uid-2',
    email: 'admin.activo@institucion.edu',
    username: 'adminactivo',
    role: 'ADMIN',
    status: 'ACTIVE',
    firstName: 'Administrador',
    lastName: '',
    institutionalId: 'ADMIN-XXXX',
    organizationId: 'org-uid-1',
    isVerified: true,
    isStaff: true,
    isSuperuser: false,
    twoFactorEnabled: true,
    mustChangePassword: false,
    mustSetup2fa: false,
    lastLogin: null,
    dateJoined: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emite token + refresh y marca lastLogin cuando el usuario está ACTIVE con 2FA', async () => {
    mockFindById.mockResolvedValue(activatedUserFull);
    mockCreateSession.mockResolvedValue({ id: 'session-1' });
    mockUserUpdate.mockResolvedValue({});

    const result = await lifecycleService.finalizeOnboarding('user-uid-2', {
      ipAddress: 'ip-cliente-test',
      userAgent: 'test-agent',
    });

    expect(result.onboarded).toBe(true);
    expect(result.token).toBe('jwt-access-token');
    expect(result.refreshToken).toBe('refresh-opaco-123');
    expect(result.expiresIn).toBe(3600);
    expect(result.mustChangePassword).toBe(false);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-uid-2', ipAddress: 'ip-cliente-test' })
    );
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-uid-2' },
      data: { lastLogin: expect.any(Date) },
    });
    expect(mockGenerateJwt).toHaveBeenCalledWith(activatedUserFull);
  });

  it('rechaza con 401 si la cuenta no está ACTIVE aunque tenga 2FA', async () => {
    mockFindById.mockResolvedValue({ ...activatedUserFull, status: 'PENDING_ACTIVATION' });

    await expect(
      lifecycleService.finalizeOnboarding('user-uid-2', {})
    ).rejects.toThrow('Debe completar la configuración de 2FA antes de finalizar el acceso.');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('rechaza con 401 si el 2FA no está habilitado', async () => {
    mockFindById.mockResolvedValue({ ...activatedUserFull, twoFactorEnabled: false });

    await expect(
      lifecycleService.finalizeOnboarding('user-uid-2', {})
    ).rejects.toThrow('Debe completar la configuración de 2FA antes de finalizar el acceso.');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('rechaza con 404 si el usuario no existe', async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      lifecycleService.finalizeOnboarding('user-uid-2', {})
    ).rejects.toThrow('Usuario no encontrado');
  });
});