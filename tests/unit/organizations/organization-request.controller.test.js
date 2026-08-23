import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule(
  '../../../src/modules/organizations/organization.service.js',
  () => ({
    default: {
      listRequests: jest.fn(),
      createRequest: jest.fn(),
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
    },
  })
);

const controller = await import(
  '../../../src/modules/organizations/organization-request.controller.js'
);

const { default: orgService } = await import(
  '../../../src/modules/organizations/organization.service.js'
);

describe('Organization Request Controller Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'admin-uuid' },
      requestId: 'req-1',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('createOrganizationRequest', () => {
    it('debe registrar la solicitud con status 201', async () => {
      req.body = {
        institution_name: 'Colegio Demo',
      };

      const mockResult = {
        id: 'req-1',
        status: 'PENDING',
      };

      orgService.createRequest.mockResolvedValue(mockResult);

      await controller.createOrganizationRequest(req, res, next);

      expect(orgService.createRequest).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('approveOrganizationRequest', () => {
    it('debe aprobar la solicitud', async () => {
      req.params.id = 'req-1';

      const mockResult = {
        id: 'org-1',
      };

      orgService.approveRequest.mockResolvedValue(mockResult);

      await controller.approveOrganizationRequest(req, res, next);

      expect(orgService.approveRequest).toHaveBeenCalledWith(
        'req-1',
        'admin-uuid'
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('rejectOrganizationRequest', () => {
    it('debe rechazar la solicitud', async () => {
      req.params.id = 'req-1';

      req.body = {
        rejection_reason: 'Datos no válidos',
      };

      const mockResult = {
        id: 'req-1',
        status: 'REJECTED',
      };

      orgService.rejectRequest.mockResolvedValue(mockResult);

      await controller.rejectOrganizationRequest(req, res, next);

      expect(orgService.rejectRequest).toHaveBeenCalledWith(
        'req-1',
        'admin-uuid',
        'Datos no válidos'
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});