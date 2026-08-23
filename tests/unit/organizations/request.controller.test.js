import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule(
  '../../../src/modules/organizations/request.service.js',
  () => ({
    createRequest: jest.fn(),
    listRequests: jest.fn(),
    getRequestById: jest.fn(),
  })
);

jest.unstable_mockModule(
  '../../../src/modules/organizations/approval.service.js',
  () => ({
    approveRequest: jest.fn(),
    rejectRequest: jest.fn(),
  })
);

const controller = await import(
  '../../../src/modules/organizations/request.controller.js'
);

const requestService = await import(
  '../../../src/modules/organizations/request.service.js'
);

const approvalService = await import(
  '../../../src/modules/organizations/approval.service.js'
);

describe('Organization Request Controller Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      body: {},
      query: {},
      user: {
        id: 'admin-uuid',
      },
      requestId: 'req-1',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('createRequest', () => {
    it('debe registrar la solicitud con status 201', async () => {
      req.body = {
        institution_name: 'Colegio Demo',
      };

      const mockResult = {
        id: 'req-1',
        status: 'PENDING',
      };

      requestService.createRequest.mockResolvedValue(mockResult);

      await controller.createRequest(req, res);

      expect(requestService.createRequest).toHaveBeenCalledWith(req.body);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('approveRequest', () => {
    it('debe aprobar la solicitud', async () => {
      req.params.id = 'req-1';

      const mockResult = {
        id: 'org-1',
      };

      approvalService.approveRequest.mockResolvedValue(mockResult);

      await controller.approveRequest(req, res);

      expect(approvalService.approveRequest).toHaveBeenCalledWith(
        'req-1',
        'admin-uuid'
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('rejectRequest', () => {
    it('debe rechazar la solicitud', async () => {
      req.params.id = 'req-1';

      req.body = {
        rejection_reason: 'Datos no válidos',
      };

      const mockResult = {
        id: 'req-1',
        status: 'REJECTED',
      };

      approvalService.rejectRequest.mockResolvedValue(mockResult);

      await controller.rejectRequest(req, res);

      expect(approvalService.rejectRequest).toHaveBeenCalledWith(
        'req-1',
        'admin-uuid',
        'Datos no válidos'
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});