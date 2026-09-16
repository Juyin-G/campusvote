import { jest } from '@jest/globals';

const mockListUsers = jest.fn();
const mockGetMe = jest.fn();
const mockGetUserById = jest.fn();
const mockCreateUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockUpdateUserRole = jest.fn();
const mockSetActiveStatus = jest.fn();
const mockUnlockUser = jest.fn();
const mockUpdateMyProfile = jest.fn();
const mockChangeMyPassword = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/users/user.service.js',
  () => ({
    listUsers: mockListUsers,
    getMe: mockGetMe,
    getUserById: mockGetUserById,
    createUser: mockCreateUser,
    updateUser: mockUpdateUser,
    updateUserRole: mockUpdateUserRole,
    setActiveStatus: mockSetActiveStatus,
    unlockUser: mockUnlockUser,
    updateMyProfile: mockUpdateMyProfile,
    changeMyPassword: mockChangeMyPassword,
  })
);

jest.unstable_mockModule(
  '../../../src/shared/utils/asyncHandler.js',
  () => ({
    default: (fn) => async (req, res, next) => {
      try {
        await fn(req, res, next);
      } catch (err) {
        next(err);
      }
    },
  })
);

const userController = await import(
  '../../../src/modules/users/user.controller.js'
);

describe('User Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { userId: 'user-uuid-1', role: 'ADMIN' },
      requestId: 'test-request-id',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('Deberia responder 200 con lista paginada', async () => {
      const users = [{ id: '1', email: 'a@test.com' }];
      const pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };

      mockListUsers.mockResolvedValue({ users, pagination });
      req.query = { page: '1', limit: '10' };

      await userController.listUsers(req, res, next);

      expect(mockListUsers).toHaveBeenCalledWith(req.query, req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: users,
          meta: expect.objectContaining({
            pagination: expect.objectContaining({ total: 1 }),
          }),
        })
      );
    });
  });

  describe('GET /api/users/me', () => {
    it('Deberia usar userId del JWT y responder 200', async () => {
      const mockUser = { id: 'user-uuid-1', email: 'me@test.com' };
      mockGetMe.mockResolvedValue(mockUser);

      await userController.getMe(req, res, next);

      expect(mockGetMe).toHaveBeenCalledWith('user-uuid-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockUser })
      );
    });
  });

  describe('GET /api/users/:id', () => {
    it('Deberia obtener usuario por id con el actor autenticado', async () => {
      const mockUser = { id: 'user-uuid-2', email: 'other@test.com' };
      req.params.id = 'user-uuid-2';
      mockGetUserById.mockResolvedValue(mockUser);

      await userController.getUserById(req, res, next);

      expect(mockGetUserById).toHaveBeenCalledWith('user-uuid-2', req.user);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('POST /api/users', () => {
    it('Deberia responder 201 al crear usuario', async () => {
      const body = {
        username: 'nuevo',
        email: 'nuevo@test.com',
        password: 'Password123!',
        first_name: 'Nuevo',
        last_name: 'Usuario',
        institutional_id: '20240001',
        role: 'STUDENT',
      };
      const created = { id: 'new-id', email: body.email };

      req.body = body;
      mockCreateUser.mockResolvedValue(created);

      await userController.createUser(req, res, next);

      expect(mockCreateUser).toHaveBeenCalledWith(body, req.user);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: created })
      );
    });
  });

  describe('PUT /api/users/:id', () => {
    it('Deberia actualizar usuario por id', async () => {
      req.params.id = 'user-uuid-2';
      req.body = { first_name: 'Actualizado' };
      mockUpdateUser.mockResolvedValue({ id: 'user-uuid-2', firstName: 'Actualizado' });

      await userController.updateUser(req, res, next);

      expect(mockUpdateUser).toHaveBeenCalledWith('user-uuid-2', req.body, req.user);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('PATCH /api/users/:id/role', () => {
    it('Deberia delegar cambio de rol al service', async () => {
      req.params.id = 'user-uuid-2';
      req.body = { role: 'TEACHER' };
      mockUpdateUserRole.mockResolvedValue({ id: 'user-uuid-2', role: 'TEACHER' });

      await userController.changeRole(req, res, next);

      expect(mockUpdateUserRole).toHaveBeenCalledWith('user-uuid-2', 'TEACHER', req.user);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('PATCH /api/users/:id/status', () => {
    it('Deberia activar o desactivar usuario', async () => {
      req.params.id = 'user-uuid-2';
      req.body = { is_active: false };
      mockSetActiveStatus.mockResolvedValue({ id: 'user-uuid-2', isActive: false });

      await userController.setActive(req, res, next);

      expect(mockSetActiveStatus).toHaveBeenCalledWith(
        'user-uuid-2',
        false,
        req.user
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('PATCH /api/users/:id/unlock', () => {
    it('Deberia desbloquear usuario', async () => {
      req.params.id = 'user-uuid-2';
      mockUnlockUser.mockResolvedValue({ id: 'user-uuid-2' });

      await userController.unlockUser(req, res, next);

      expect(mockUnlockUser).toHaveBeenCalledWith('user-uuid-2', req.user);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('PUT /api/users/me', () => {
    it('Deberia actualizar perfil propio con userId del token', async () => {
      req.body = { first_name: 'Yo', last_name: 'Mismo' };
      mockUpdateMyProfile.mockResolvedValue({ id: 'user-uuid-1', firstName: 'Yo' });

      await userController.updateMe(req, res, next);

      expect(mockUpdateMyProfile).toHaveBeenCalledWith('user-uuid-1', req.body);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('POST /api/users/me/password', () => {
    it('Deberia mapear snake_case del body al service', async () => {
      req.body = {
        current_password: 'Password123!',
        new_password: 'NewPassword456!',
      };
      mockChangeMyPassword.mockResolvedValue({ changed: true });

      await userController.changePassword(req, res, next);

      expect(mockChangeMyPassword).toHaveBeenCalledWith('user-uuid-1', {
        currentPassword: 'Password123!',
        newPassword: 'NewPassword456!',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Manejo de errores', () => {
    it('Deberia pasar el error al middleware next si falla el service', async () => {
      const error = new Error('Usuario no encontrado');
      mockGetMe.mockRejectedValue(error);

      await userController.getMe(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
