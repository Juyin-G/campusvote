import { jest } from '@jest/globals';

const mockFindByEmail = jest.fn();
const mockFindByUsername = jest.fn();
const mockCreateUser = jest.fn();
const mockGenerateEmailVerificationToken = jest.fn();
const mockLoginIsAllowed = jest.fn();
const mockRegisterFailedLogin = jest.fn().mockResolvedValue(true);
const mockRegisterSuccessfulLogin = jest.fn().mockResolvedValue(true);
const mockUpdateLastLogin = jest.fn().mockResolvedValue(true);
const mockFindById = jest.fn();
const mockGeneratePasswordResetToken = jest.fn();
const mockResetPasswordWithToken = jest.fn();
const mockVerifyEmailWithToken = jest.fn();
const mockCreateRefreshToken = jest.fn().mockResolvedValue({ id: 'rt-1' });
const mockFindRefreshToken = jest.fn();
const mockRevokeRefreshToken = jest.fn().mockResolvedValue({ count: 1 });
const mockRevokeAllUserRefreshTokens = jest.fn().mockResolvedValue({ count: 1 });

const repoMock = {
  findByEmail: mockFindByEmail,
  findByUsername: mockFindByUsername,
  createUser: mockCreateUser,
  generateEmailVerificationToken: mockGenerateEmailVerificationToken,
  loginIsAllowed: mockLoginIsAllowed,
  registerFailedLogin: mockRegisterFailedLogin,
  registerSuccessfulLogin: mockRegisterSuccessfulLogin,
  updateLastLogin: mockUpdateLastLogin,
  findById: mockFindById,
  generatePasswordResetToken: mockGeneratePasswordResetToken,
  resetPasswordWithToken: mockResetPasswordWithToken,
  verifyEmailWithToken: mockVerifyEmailWithToken,
  createRefreshToken: mockCreateRefreshToken,
  findRefreshToken: mockFindRefreshToken,
  revokeRefreshToken: mockRevokeRefreshToken,
  revokeAllUserRefreshTokens: mockRevokeAllUserRefreshTokens,
  default: {
    findByEmail: mockFindByEmail,
    findByUsername: mockFindByUsername,
    createUser: mockCreateUser,
    generateEmailVerificationToken: mockGenerateEmailVerificationToken,
    loginIsAllowed: mockLoginIsAllowed,
    registerFailedLogin: mockRegisterFailedLogin,
    registerSuccessfulLogin: mockRegisterSuccessfulLogin,
    updateLastLogin: mockUpdateLastLogin,
    findById: mockFindById,
    generatePasswordResetToken: mockGeneratePasswordResetToken,
    resetPasswordWithToken: mockResetPasswordWithToken,
    verifyEmailWithToken: mockVerifyEmailWithToken,
    createRefreshToken: mockCreateRefreshToken,
    findRefreshToken: mockFindRefreshToken,
    revokeRefreshToken: mockRevokeRefreshToken,
    revokeAllUserRefreshTokens: mockRevokeAllUserRefreshTokens,
  },
};

jest.unstable_mockModule(
  '../../../src/modules/auth/repositories/auth.repository.js',
  () => repoMock
);

// Mock del servicio de correo electrónico
const mockSendVerification = jest.fn().mockResolvedValue(true);
const mockSendReset = jest.fn().mockResolvedValue(true);

jest.unstable_mockModule(
  '../../../src/shared/services/email.service.js',
  () => ({
    sendVerification: mockSendVerification,
    sendReset: mockSendReset,
  })
);

// Mock de helpers de autenticación
const mockGenerateJwt = jest.fn().mockReturnValue('mocked-jwt-token-123');
const mockFormatUserResponse = jest.fn((user) => user);
const mockGenerateRefreshToken = jest
  .fn()
  .mockReturnValue({ rawToken: 'raw-refresh-token', tokenHash: 'token-hash-123' });
const mockHashToken = jest.fn((token) => `hash:${token}`);

jest.unstable_mockModule(
  '../../../src/modules/auth/services/auth.helpers.js',
  () => ({
    generateJwt: mockGenerateJwt,
    formatUserResponse: mockFormatUserResponse,
    generateRefreshToken: mockGenerateRefreshToken,
    hashToken: mockHashToken,
    default: {
      generateJwt: mockGenerateJwt,
      formatUserResponse: mockFormatUserResponse,
      generateRefreshToken: mockGenerateRefreshToken,
      hashToken: mockHashToken,
    },
  })
);

// Mock de bcryptjs
const mockHash = jest.fn();
const mockCompare = jest.fn();

jest.unstable_mockModule('bcryptjs', () => ({
  default: {
    hash: mockHash,
    compare: mockCompare,
  },
  hash: mockHash,
  compare: mockCompare,
}));

// Mock de jsonwebtoken
const mockSign = jest.fn();

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    sign: mockSign,
  },
  sign: mockSign,
}));

// Mock de variables de entorno
jest.unstable_mockModule(
  '../../../src/config/env.js',
  () => ({
    default: {
      JWT_SECRET: 'test-secret-key',
      JWT_EXPIRATION: '1h',
    },
    JWT_SECRET: 'test-secret-key',
    JWT_EXPIRATION: '1h',
  })
);

// Mock del logger
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

const authService = await import(
  '../../../src/modules/auth/services/auth.service.js'
);

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Register (Registro de usuarios)', () => {
    const mockUserData = {
      email: 'estudiante@universidad.edu',
      username: 'juan.perez',
      password: 'PasswordSeguro123!',
      firstName: 'Juan',
      lastName: 'Perez',
      institutionalId: '20230001',
    };

    const mockCreatedUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'juan.perez',
      email: 'estudiante@universidad.edu',
      firstName: 'Juan',
      lastName: 'Perez',
      institutionalId: '20230001',
      password: 'hashed_password',
      role: 'STUDENT',
      status: 'ACTIVE',
    };

    it('Deberia registrar un usuario exitosamente y hashear la contrasena', async () => {
      mockFindByEmail.mockResolvedValue(null);
      mockFindByUsername.mockResolvedValue(null);
      mockHash.mockResolvedValue('hashed_password');
      mockCreateUser.mockResolvedValue(mockCreatedUser);
      mockGenerateEmailVerificationToken.mockResolvedValue('token-123');
      mockSendVerification.mockResolvedValue(true);

      const result = await authService.register(mockUserData);

      expect(mockFindByEmail).toHaveBeenCalledWith(mockUserData.email);
      expect(mockHash).toHaveBeenCalledWith(mockUserData.password, 12);
      expect(result.user.email).toBe(mockUserData.email);
    });

    it('Deberia lanzar error si el correo ya esta registrado', async () => {
      mockFindByEmail.mockResolvedValue(mockCreatedUser);

      await expect(
        authService.register(mockUserData)
      ).rejects.toThrow();
    });

    it('Deberia lanzar error si el nombre de usuario ya existe', async () => {
      mockFindByEmail.mockResolvedValue(null);
      mockFindByUsername.mockResolvedValue(mockCreatedUser);

      await expect(
        authService.register(mockUserData)
      ).rejects.toThrow();
    });
  });

  describe('Login (Inicio de sesion)', () => {
    const mockUser = {
      id: '123',
      email: 'estudiante@universidad.edu',
      password: 'hashed_password_db',
      authProvider: 'LOCAL',
      status: 'ACTIVE',
      isVerified: true,
      role: 'STUDENT',
      failedAttempts: 0,
      lockUntil: null,
    };

    it('Deberia loguear exitosamente y retornar un JWT', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);
      mockLoginIsAllowed.mockResolvedValue(true);
      mockCompare.mockResolvedValue(true);
      mockGenerateJwt.mockReturnValue('mocked-jwt-token-123');

      const result = await authService.login({
        email: 'estudiante@universidad.edu',
        password: 'PasswordSeguro123!',
      });

      expect(mockCompare).toHaveBeenCalledWith(
        'PasswordSeguro123!',
        'hashed_password_db'
      );
      expect(mockRegisterSuccessfulLogin).toHaveBeenCalledWith(
        mockUser.email,
        null,
        null
      );
      expect(result.token).toBe('mocked-jwt-token-123');
    });

    it('Deberia fallar si el usuario no existe', async () => {
      mockFindByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'noexiste@universidad.edu',
          password: 'Password123!',
        })
      ).rejects.toThrow();
    });

    it('Deberia fallar si la contrasena es incorrecta', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);
      mockLoginIsAllowed.mockResolvedValue(true);
      mockCompare.mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'estudiante@universidad.edu',
          password: 'PasswordIncorrecto!',
        })
      ).rejects.toThrow();
    });

    it('Deberia fallar si la cuenta esta bloqueada por intentos fallidos', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);
      mockLoginIsAllowed.mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'estudiante@universidad.edu',
          password: 'PasswordSeguro123!',
        })
      ).rejects.toThrow();
    });
  });
});