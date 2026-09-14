import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// El controller importa env.js, que valida los secretos al cargarse.
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-with-at-least-32-characters-x7';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test';

jest.unstable_mockModule(
  '../../../src/modules/organizations/organization/organization.service.js',
  () => ({
    default: {
      listOrganizations: jest.fn(),
      getOrganizationById: jest.fn(),
      createOrganization: jest.fn(),
      updateOrganization: jest.fn(),
      deleteOrganization: jest.fn(),
      updateOnboarding: jest.fn(),
      completeOnboarding: jest.fn(),
    },
  })
);

const controller = await import(
  '../../../src/modules/organizations/organization/organization.controller.js'
);

const { default: orgService } = await import(
  '../../../src/modules/organizations/organization/organization.service.js'
);

describe('Organization Controller Unit Tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      body: {},
      query: {},
      user: {
        id: 'user-uuid',
      },
      requestId: 'req-123',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('getOrganizations', () => {
    it('debe responder con status 200 y la lista paginada', async () => {
      const mockResult = {
        organizations: [],
        pagination: {
          total: 0,
        },
      };

      orgService.listOrganizations.mockResolvedValue(mockResult);

      await controller.getOrganizations(req, res, next);

      expect(orgService.listOrganizations).toHaveBeenCalledWith(req.query);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('createOrganization', () => {
    it('debe crear una organización y retornar status 201', async () => {
      req.body = {
        name: 'Org Test',
        code: 'OTEST',
      };

      const createdOrg = {
        id: 'org-uuid-1',
        ...req.body,
      };

      orgService.createOrganization.mockResolvedValue(createdOrg);

      await controller.createOrganization(req, res, next);

      expect(orgService.createOrganization).toHaveBeenCalledWith(req.body);

      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: createdOrg,
        })
      );
    });

    it('debe capturar errores y enviarlos a next()', async () => {
      const error = new Error('Código duplicado');

      orgService.createOrganization.mockRejectedValue(error);

      controller.createOrganization(req, res, next);

      await new Promise(process.nextTick);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('completeOnboarding', () => {
    it('debe marcar el onboarding como completado', async () => {
      req.params.id = 'org-uuid-1';

      const mockOrg = {
        id: 'org-uuid-1',
        onboarding_completed: true,
      };

      orgService.completeOnboarding.mockResolvedValue(mockOrg);

      await controller.completeOnboarding(req, res, next);

      // El usuario de la sesión viaja al service para validar que la
      // organización sea la suya.
      expect(orgService.completeOnboarding).toHaveBeenCalledWith(
        'org-uuid-1',
        req.user
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});