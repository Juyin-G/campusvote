import { jest } from '@jest/globals';

const mockListElections = jest.fn();
const mockGetElectionById = jest.fn();
const mockCreateElection = jest.fn();
const mockUpdateElection = jest.fn();
const mockDeleteElection = jest.fn();
const mockChangeStatus = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/elections/elections/election.service.js',
  () => ({
    listElections: mockListElections,
    getElectionById: mockGetElectionById,
    createElection: mockCreateElection,
    updateElection: mockUpdateElection,
    deleteElection: mockDeleteElection,
    changeStatus: mockChangeStatus,
  })
);

jest.unstable_mockModule('../../../src/shared/utils/asyncHandler.js', () => ({
  default: (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  },
}));

const controller = await import(
  '../../../src/modules/elections/elections/election.controller.js'
);

const ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const ACTOR = '7a2b9c4d-3e5f-4a6b-9c8d-1e2f3a4b5c6d';

describe('Election Controller', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { userId: ACTOR, role: 'ADMIN' },
      requestId: 'rid-1',
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('listar responde 200 con la paginación en meta', async () => {
    mockListElections.mockResolvedValue({
      elections: [{ id: ID }],
      pagination: { page: 2, limit: 10, total: 15, totalPages: 2 },
    });
    req.query = { page: '2' };

    await controller.listElections(req, res, next);

    expect(mockListElections).toHaveBeenCalledWith(req.query, req.user);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [{ id: ID }],
        meta: expect.objectContaining({
          pagination: expect.objectContaining({ total: 15, totalPages: 2 }),
        }),
      })
    );
  });

  it('obtener por id pasa req.params.id', async () => {
    mockGetElectionById.mockResolvedValue({ id: ID });
    req.params.id = ID;

    await controller.getElectionById(req, res, next);

    expect(mockGetElectionById).toHaveBeenCalledWith(ID);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('crear responde 201 y pasa el userId del JWT como creador y organizationId', async () => {
    mockCreateElection.mockResolvedValue({ id: ID, status: 'DRAFT' });
    req.body = { title: 'Elecciones 2026' };
    req.user = { userId: ACTOR, role: 'ADMIN', organizationId: 'org-1' };

    await controller.createElection(req, res, next);

    expect(mockCreateElection).toHaveBeenCalledWith(req.body, ACTOR, 'org-1');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('crear acepta req.user.id como respaldo si no viene userId', async () => {
    mockCreateElection.mockResolvedValue({ id: ID });
    req.user = { id: ACTOR, role: 'ADMIN', organizationId: 'org-1' };

    await controller.createElection(req, res, next);

    expect(mockCreateElection).toHaveBeenCalledWith(req.body, ACTOR, 'org-1');
  });

  it('actualizar pasa id y body por separado', async () => {
    mockUpdateElection.mockResolvedValue({ id: ID });
    req.params.id = ID;
    req.body = { title: 'Nuevo' };

    await controller.updateElection(req, res, next);

    expect(mockUpdateElection).toHaveBeenCalledWith(ID, { title: 'Nuevo' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('eliminar responde 200 con el resultado del service', async () => {
    mockDeleteElection.mockResolvedValue({ deleted: true });
    req.params.id = ID;

    await controller.deleteElection(req, res, next);

    expect(mockDeleteElection).toHaveBeenCalledWith(ID);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deleted: true } })
    );
  });

  it('incluye el requestId en meta para trazabilidad', async () => {
    mockGetElectionById.mockResolvedValue({ id: ID });
    req.params.id = ID;

    await controller.getElectionById(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ requestId: 'rid-1' }),
      })
    );
  });

  it('propaga el error del service a next() sin responder', async () => {
    const boom = new Error('fallo del service');
    mockGetElectionById.mockRejectedValue(boom);
    req.params.id = ID;

    await controller.getElectionById(req, res, next);

    expect(next).toHaveBeenCalledWith(boom);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('Election Controller — mensajes del workflow', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      body: {},
      params: { id: ID },
      query: {},
      user: { userId: ACTOR, role: 'ADMIN' },
      requestId: 'rid-1',
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  const mensajeDe = () => res.json.mock.calls[0][0].message;

  it('pasar a OPEN usa el mensaje de apertura del sistema', async () => {
    mockChangeStatus.mockResolvedValue({ id: ID, status: 'OPEN' });
    req.body = { status: 'OPEN' };

    await controller.changeStatus(req, res, next);

    expect(mockChangeStatus).toHaveBeenCalledWith(ID, 'OPEN', ACTOR);
    expect(mensajeDe()).toContain('abierta');
  });

  it('pasar a CLOSED usa el mensaje de cierre del sistema', async () => {
    mockChangeStatus.mockResolvedValue({ id: ID, status: 'CLOSED' });
    req.body = { status: 'CLOSED' };

    await controller.changeStatus(req, res, next);

    expect(mensajeDe()).toContain('cerrada');
  });

  it('los demás estados usan un mensaje genérico con el estado', async () => {
    mockChangeStatus.mockResolvedValue({ id: ID, status: 'SCHEDULED' });
    req.body = { status: 'SCHEDULED' };

    await controller.changeStatus(req, res, next);

    expect(mensajeDe()).toContain('SCHEDULED');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('un conflicto de transición se propaga a next()', async () => {
    const conflicto = Object.assign(new Error('Transición no permitida'), {
      statusCode: 409,
    });
    mockChangeStatus.mockRejectedValue(conflicto);
    req.body = { status: 'PUBLISHED' };

    await controller.changeStatus(req, res, next);

    expect(next).toHaveBeenCalledWith(conflicto);
    expect(res.json).not.toHaveBeenCalled();
  });
});
