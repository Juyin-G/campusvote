// tests/unit/auth/auth.totp-status.test.js
// Tests del servicio 2FA — estado del usuario autenticado (spec §4.3).

import { jest } from '@jest/globals';

const mockGetUserWithTwoFactor = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/auth/repositories/otp.repository.js',
  () => ({
    getUserWithTwoFactor: mockGetUserWithTwoFactor,
    saveTotpSecret: jest.fn(),
    enableTwoFactor: jest.fn(),
    disableTwoFactor: jest.fn(),
    updateBackupCodes: jest.fn(),
    default: {
      getUserWithTwoFactor: mockGetUserWithTwoFactor,
      saveTotpSecret: jest.fn(),
      enableTwoFactor: jest.fn(),
      disableTwoFactor: jest.fn(),
      updateBackupCodes: jest.fn(),
    },
  })
);

const service = await import('../../../src/modules/auth/services/auth.totp.service.js');

const USER_ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('2FA Service — getTwoFactorStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lanza NOT_FOUND si el usuario no existe', async () => {
    mockGetUserWithTwoFactor.mockResolvedValue(null);
    const err = await capturarError(() => service.getTwoFactorStatus(USER_ID));
    expect(err.statusCode).toBe(404);
  });

  it('reporta 2FA deshabilitado con 0 códigos de respaldo', async () => {
    mockGetUserWithTwoFactor.mockResolvedValue({
      id: USER_ID,
      twoFactorEnabled: false,
      twoFactorBackupCodes: ['a', 'b'],
    });

    const result = await service.getTwoFactorStatus(USER_ID);
    expect(result).toEqual({
      twoFactorEnabled: false,
      backupCodesRemaining: 0,
    });
  });

  it('reporta 2FA habilitado con el conteo de códigos restantes', async () => {
    mockGetUserWithTwoFactor.mockResolvedValue({
      id: USER_ID,
      twoFactorEnabled: true,
      twoFactorBackupCodes: ['a', 'b', 'c'],
    });

    const result = await service.getTwoFactorStatus(USER_ID);
    expect(result).toEqual({
      twoFactorEnabled: true,
      backupCodesRemaining: 3,
    });
  });

  it('nunca expone los códigos de respaldo en la respuesta', async () => {
    mockGetUserWithTwoFactor.mockResolvedValue({
      id: USER_ID,
      twoFactorEnabled: true,
      twoFactorBackupCodes: ['secret-a', 'secret-b'],
    });

    const result = await service.getTwoFactorStatus(USER_ID);
    expect(result).not.toHaveProperty('backupCodes');
    expect(result.backupCodesRemaining).toBe(2);
  });
});
