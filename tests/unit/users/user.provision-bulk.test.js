import { jest } from '@jest/globals';

const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockOrgCreate = jest.fn();

jest.unstable_mockModule('../../../src/database/prisma.js', () => {
  const mockOrgFindUnique = jest.fn();
  mockOrgFindUnique.mockImplementation(({ where }) => {
    // Código de organización (colisión) -> null
    if (where?.code) return Promise.resolve(null);
    // ID de organización (validación de dominio) -> org existente
    return Promise.resolve({ id: 'org-1', allowedEmailDomains: ['empresa.com'] });
  });
  return {
    prisma: {
      user: {
        findUnique: mockFindUnique,
        findMany: jest.fn(),
        count: jest.fn(),
        create: mockCreate,
        update: jest.fn(),
      },
      organization: {
        findUnique: mockOrgFindUnique,
        create: mockOrgCreate,
      },
    },
  };
});

const mockHash = jest.fn();

jest.unstable_mockModule('bcryptjs', () => ({
  default: { hash: mockHash, compare: jest.fn() },
  hash: mockHash,
  compare: jest.fn(),
}));

jest.unstable_mockModule('../../../src/shared/utils/otp.util.js', () => ({
  generateTotpSecret: jest.fn(() => 'SECRET_TEST'),
  generateTotpUri: jest.fn(() => 'otpauth://totp/CampusVote:admin@x.com?secret=SECRET_TEST'),
  generateQrCode: jest.fn(async () => 'data:image/png;base64,QR'),
  generateBackupCodes: jest.fn(() => ['CODE1', 'CODE2']),
  hashBackupCode: jest.fn((c) => `hash-${c}`),
}));

jest.unstable_mockModule('../../../src/modules/auth/repositories/otp.repository.js', () => ({
  saveTotpSecret: jest.fn(async () => ({})),
  enableTwoFactor: jest.fn(async () => ({})),
}));

jest.unstable_mockModule('../../../src/shared/utils/emailDomain.js', () => ({
  isDomainAllowed: jest.fn(() => true),
}));

const userService = await import('../../../src/modules/users/user.service.js');
const { ApiError } = await import('../../../src/shared/errors/ApiError.js');

const SUPERADMIN_ACTOR = {
  userId: 'super-1',
  role: 'SUPERADMIN',
  isSuperuser: true,
  isStaff: true,
};

const ADMIN_ACTOR = {
  userId: 'admin-1',
  role: 'ADMIN',
  organizationId: 'org-1',
  isSuperuser: false,
};

describe('User Service - provisionAdmin (superadmin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockOrgCreate.mockResolvedValue({
      id: 'org-9',
      name: 'Universidad Nacional',
      code: 'UNAL',
    });
    mockCreate.mockResolvedValue({
      id: 'new-admin-id',
      username: 'admin1',
      email: 'admin1@empresa.com',
      firstName: 'Admin',
      lastName: 'Uno',
      role: 'ADMIN',
      status: 'ACTIVE',
      isVerified: false,
      isStaff: false,
      isSuperuser: false,
      organizationId: 'org-9',
    });
  });

  it('rechaza si el actor no es superadmin', async () => {
    await expect(
      userService.provisionAdmin({}, ADMIN_ACTOR)
    ).rejects.toThrow(ApiError);
  });

  it('crea la organización + ADMIN y le provisiona el 2FA de primer acceso', async () => {
    const result = await userService.provisionAdmin(
      {
        organization: {
          name: 'Universidad Nacional',
          code: 'UNAL',
          org_type: 'UNIVERSITY',
          allowed_email_domains: ['empresa.com'],
        },
        admin: {
          username: 'admin1',
          email: 'admin1@empresa.com',
          password: 'Password123!',
          first_name: 'Admin',
          last_name: 'Uno',
        },
      },
      SUPERADMIN_ACTOR
    );

    expect(mockOrgCreate).toHaveBeenCalled();
    expect(result.organization.code).toBe('UNAL');
    expect(result.user.role).toBe('ADMIN');
    expect(result.user.organization_id).toBe('org-9');
    // Desde 84bf677 el alta directa provisiona el 2FA de inmediato (QR +
    // códigos de respaldo); la activación por correo vive en la aprobación de
    // solicitudes de organización.
    expect(result.mustChangePassword).toBe(true);
    expect(result.qrCode).toBe('data:image/png;base64,QR');
    expect(result.secret).toBe('SECRET_TEST');
    expect(result.backupCodes).toEqual(['CODE1', 'CODE2']);
  });

  it('rechaza si el correo ya está registrado', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'existing',
      email: 'admin1@empresa.com',
    });

    await expect(
      userService.provisionAdmin(
        {
          organization: { name: 'U', code: 'U1' },
          admin: {
            username: 'admin1',
            email: 'admin1@empresa.com',
            password: 'Password123!',
            first_name: 'Admin',
            last_name: 'Uno',
          },
        },
        SUPERADMIN_ACTOR
      )
    ).rejects.toThrow(ApiError);
  });

  it('rechaza si falta la organización o el admin', async () => {
    await expect(
      userService.provisionAdmin({ admin: {} }, SUPERADMIN_ACTOR)
    ).rejects.toThrow(ApiError);
  });
});

describe('User Service - createUsersBulk (admin crea jurados)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: 'new-id',
      username: 'jurado1',
      email: 'jurado1@empresa.com',
      firstName: 'J',
      lastName: 'U',
      role: 'JURY',
      status: 'ACTIVE',
      isVerified: false,
      isStaff: false,
      isSuperuser: false,
      organizationId: 'org-1',
    });
  });

  it('crea usuarios en lote cuando el email es válido', async () => {
    const result = await userService.createUsersBulk(
      [
        {
          username: 'jurado1',
          email: 'jurado1@empresa.com',
          password: 'Password123!',
          first_name: 'J',
          last_name: 'U',
          role: 'JURY',
          document_type: 'DNI',
          document_number: '12345670',
        },
      ],
      ADMIN_ACTOR
    );

    expect(result.totalOk).toBe(1);
    expect(result.created[0].role).toBe('JURY');
    expect(result.totalFailed).toBe(0);
  });

  it('no crea nada si la lista está vacía', async () => {
    await expect(
      userService.createUsersBulk([], ADMIN_ACTOR)
    ).rejects.toThrow(ApiError);
  });

  it('reporta errores por usuario sin abortar el resto', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'ok',
      role: 'JURY',
      status: 'ACTIVE',
      email: 'a@x.com',
    });
    mockCreate.mockRejectedValueOnce(new Error('fallo'));

    const result = await userService.createUsersBulk(
      [
        { username: 'a', email: 'a@x.com', password: 'Password123!', first_name: 'A', last_name: 'A', role: 'STUDENT' },
        { username: 'b', email: 'b@x.com', password: 'Password123!', first_name: 'B', last_name: 'B', role: 'STUDENT' },
      ],
      ADMIN_ACTOR
    );

    expect(result.totalOk).toBe(1);
    expect(result.totalFailed).toBe(1);
  });
});
