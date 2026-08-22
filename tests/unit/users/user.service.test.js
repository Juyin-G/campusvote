import { jest } from '@jest/globals';

const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.unstable_mockModule('../../../src/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

const mockHash = jest.fn();
const mockCompare = jest.fn();

jest.unstable_mockModule('bcryptjs', () => ({
  default: { hash: mockHash, compare: mockCompare },
  hash: mockHash,
  compare: mockCompare,
}));

const userService = await import('../../../src/modules/users/user.service.js');
const { ApiError } = await import('../../../src/shared/errors/ApiError.js');

const sampleUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  username: 'juan.perez',
  email: 'juan@test.com',
  firstName: 'Juan',
  lastName: 'Perez',
  role: 'STUDENT',
  isActive: true,
  password: 'hashed_password',
};

describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('Deberia retornar el usuario cuando existe', async () => {
      mockFindUnique.mockResolvedValue(sampleUser);

      const result = await userService.getMe(sampleUser.id);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: sampleUser.id },
        select: expect.any(Object),
      });
      expect(result.email).toBe(sampleUser.email);
    });

    it('Deberia lanzar not found si el usuario no existe', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(userService.getMe('missing-id')).rejects.toThrow(ApiError);
    });
  });

  describe('getUserById', () => {
    it('Deberia permitir ver el propio perfil', async () => {
      mockFindUnique.mockResolvedValue(sampleUser);

      const result = await userService.getUserById(sampleUser.id, {
        userId: sampleUser.id,
        role: 'STUDENT',
      });

      expect(result.id).toBe(sampleUser.id);
    });

    it('Deberia permitir a un admin ver cualquier usuario', async () => {
      mockFindUnique.mockResolvedValue(sampleUser);

      const result = await userService.getUserById(sampleUser.id, {
        userId: 'otro-id',
        role: 'ADMIN',
      });

      expect(result.id).toBe(sampleUser.id);
    });

    it('Deberia denegar acceso si no es self ni admin', async () => {
      mockFindUnique.mockResolvedValue(sampleUser);

      await expect(
        userService.getUserById(sampleUser.id, {
          userId: 'otro-id',
          role: 'STUDENT',
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('listUsers', () => {
    it('Deberia retornar usuarios y paginacion', async () => {
      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue([sampleUser]);

      const result = await userService.listUsers({ page: 1, limit: 10 });

      expect(result.users).toHaveLength(1);
      expect(result.pagination).toEqual(
        expect.objectContaining({ page: 1, limit: 10, total: 1 })
      );
    });
  });

  describe('setActiveStatus', () => {
    it('Deberia impedir desactivar la propia cuenta', async () => {
      await expect(
        userService.setActiveStatus(sampleUser.id, false, {
          userId: sampleUser.id,
          role: 'ADMIN',
        })
      ).rejects.toThrow('No puedes desactivar tu propia cuenta');
    });

    it('Deberia actualizar el estado de otro usuario', async () => {
      mockUpdate.mockResolvedValue({ ...sampleUser, isActive: false });

      const result = await userService.setActiveStatus(
        sampleUser.id,
        false,
        { userId: 'admin-id', role: 'ADMIN' }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleUser.id },
          data: { isActive: false },
        })
      );
      expect(result.is_active).toBe(false);
    });
  });

  describe('unlockUser', () => {
    it('Deberia resetear intentos fallidos y lockedUntil', async () => {
      mockUpdate.mockResolvedValue(sampleUser);

      await userService.unlockUser(sampleUser.id);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleUser.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        })
      );
    });
  });

  describe('changeMyPassword', () => {
    it('Deberia cambiar contrasena cuando la actual es valida', async () => {
      mockFindUnique.mockResolvedValue({
        password: 'hashed_password',
        isActive: true,
      });
      mockCompare.mockResolvedValue(true);
      mockHash.mockResolvedValue('new_hashed_password');
      mockUpdate.mockResolvedValue(true);

      const result = await userService.changeMyPassword(sampleUser.id, {
        currentPassword: 'Password123!',
        newPassword: 'NewPassword456!',
      });

      expect(mockCompare).toHaveBeenCalled();
      expect(mockHash).toHaveBeenCalledWith('NewPassword456!', 12);
      expect(result).toEqual({ changed: true });
    });

    it('Deberia fallar si la contrasena actual es incorrecta', async () => {
      mockFindUnique.mockResolvedValue({
        password: 'hashed_password',
        isActive: true,
      });
      mockCompare.mockResolvedValue(false);

      await expect(
        userService.changeMyPassword(sampleUser.id, {
          currentPassword: 'WrongPass!',
          newPassword: 'NewPassword456!',
        })
      ).rejects.toThrow('La contraseña actual es incorrecta');
    });

    it('Deberia fallar si falta currentPassword o newPassword', async () => {
      await expect(
        userService.changeMyPassword(sampleUser.id, {})
      ).rejects.toThrow(ApiError);
    });
  });

  describe('createUser', () => {
    it('Deberia crear usuario con password hasheado', async () => {
      mockHash.mockResolvedValue('hashed');
      mockCreate.mockResolvedValue({ ...sampleUser, id: 'new-id' });

      const result = await userService.createUser({
        username: 'nuevo',
        email: 'nuevo@test.com',
        password: 'Password123!',
        first_name: 'Nuevo',
        last_name: 'User',
        institutional_id: '20249999',
        role: 'STUDENT',
      });

      expect(mockHash).toHaveBeenCalledWith('Password123!', 12);
      expect(mockCreate).toHaveBeenCalled();
      expect(result.id).toBe('new-id');
    });
  });

  describe('updateUser', () => {
    it('Deberia actualizar campos permitidos', async () => {
      mockUpdate.mockResolvedValue({ ...sampleUser, firstName: 'Updated' });

      const result = await userService.updateUser(sampleUser.id, {
        first_name: 'Updated',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleUser.id },
          data: { firstName: 'Updated' },
        })
      );
      expect(result.first_name).toBe('Updated');
    });

    it('Deberia fallar si no hay campos para actualizar', async () => {
      await expect(userService.updateUser(sampleUser.id, {})).rejects.toThrow(ApiError);
    });
  });

  describe('updateUserRole', () => {
    it('Deberia rechazar rol invalido', async () => {
      await expect(
        userService.updateUserRole(sampleUser.id, 'ROL_INVALIDO')
      ).rejects.toThrow(ApiError);
    });

    it('Deberia actualizar rol cuando es valido', async () => {
      mockFindUnique.mockResolvedValue({ isSuperuser: false });
      mockUpdate.mockResolvedValue({ ...sampleUser, role: 'TEACHER' });

      const result = await userService.updateUserRole(sampleUser.id, 'TEACHER');

      expect(result.role).toBe('TEACHER');
    });
  });

  describe('updateMyProfile', () => {
    it('Deberia actualizar first_name y last_name', async () => {
      mockUpdate.mockResolvedValue({ ...sampleUser, firstName: 'Yo', lastName: 'Mismo' });

      const result = await userService.updateMyProfile(sampleUser.id, {
        first_name: 'Yo',
        last_name: 'Mismo',
      });

      expect(result.first_name).toBe('Yo');
      expect(result.last_name).toBe('Mismo');
    });
  });
});
