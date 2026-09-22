import { jest } from '@jest/globals';

// Mocks de modules transitivos de auth.lifecycle.service.js, antes del import.

const mockUserFindUnique = jest.fn();
jest.unstable_mockModule(
  '../../../src/database/prisma.js',
  () => ({
    prisma: { user: { findUnique: mockUserFindUnique } },
    default: { user: { findUnique: mockUserFindUnique } },
  })
);

const mockActivateOrganizationWithToken = jest.fn();
jest.unstable_mockModule(
  '../../../src/modules/auth/repositories/auth.repository.js',
  () => ({
    activateOrganizationWithToken: mockActivateOrganizationWithToken,
    default: { activateOrganizationWithToken: mockActivateOrganizationWithToken },
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

jest.unstable_mockModule(
  '../../../src/modules/auth/services/auth.helpers.js',
  () => ({
    AUTH_MESSAGES: { TOKEN_INVALID: 'Token inválido o expirado' },
    authError: (message, code = 'UNAUTHORIZED') => new Error(`${code}: ${message}`),
    generatePendingToken: mockGeneratePendingToken,
    formatUserResponse: mockFormatUserResponse,
    PENDING_TOKEN_TTL: { TOTP_PENDING: 600, ONBOARDING: 1800 },
    default: {
      AUTH_MESSAGES: { TOKEN_INVALID: 'Token inválido o expirado' },
      authError: (message, code = 'UNAUTHORIZED') => new Error(`${code}: ${message}`),
      generatePendingToken: mockGeneratePendingToken,
      formatUserResponse: mockFormatUserResponse,
      PENDING_TOKEN_TTL: { TOTP_PENDING: 600, ONBOARDING: 1800 },
    },
  })
);

const mockHash = jest.fn();
jest.unstable_mockModule('bcryptjs', () => ({
  default: { hash: mockHash },
  hash: mockHash,
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