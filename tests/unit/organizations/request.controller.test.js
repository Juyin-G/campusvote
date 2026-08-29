import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule(
  '../../../src/modules/organizations/organization-request/request.service.js',
  () => ({
    createRequest: jest.fn(),
    listRequests: jest.fn(),
    getRequestById: jest.fn(),
  })
);

const controller = await import(
  '../../../src/modules/organizations/organization-request/request.controller.js'
);

const requestService = await import(
  '../../../src/modules/organizations/organization-request/request.service.js'
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

      expect(requestService.createRequest).toHaveBeenCalledWith(
        req.body
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('listRequests', () => {
    it('debe listar las solicitudes paginadas con status 200', async () => {
      const mockResult = {
        requests: [
          {
            id: 'req-1',
            status: 'PENDING',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      req.query = {
        page: '1',
        limit: '10',
      };

      requestService.listRequests.mockResolvedValue(mockResult);

      await controller.listRequests(req, res);

      expect(requestService.listRequests).toHaveBeenCalledWith(
        req.query
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getRequestById', () => {
    it('debe obtener una solicitud por ID con status 200', async () => {
      req.params.id = 'req-1';

      const mockResult = {
        id: 'req-1',
        status: 'PENDING',
      };

      requestService.getRequestById.mockResolvedValue(mockResult);

      await controller.getRequestById(req, res);

      expect(requestService.getRequestById).toHaveBeenCalledWith(
        'req-1'
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});