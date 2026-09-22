import { jest } from '@jest/globals';

const mockFindElectionById = jest.fn();
const mockFindElectionStatus = jest.fn();
const mockListElections = jest.fn();
const mockCountElections = jest.fn();
const mockCreateElection = jest.fn();
const mockUpdateElection = jest.fn();
const mockUpdateElectionStatus = jest.fn();
const mockDeleteElectionById = jest.fn();
const mockCountPositionsByElection = jest.fn();
const mockCertifyElection = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/elections/elections/election.repository.js',
  () => ({
    findElectionById: mockFindElectionById,
    findElectionStatus: mockFindElectionStatus,
    listElections: mockListElections,
    countElections: mockCountElections,
    createElection: mockCreateElection,
    updateElection: mockUpdateElection,
    updateElectionStatus: mockUpdateElectionStatus,
    deleteElectionById: mockDeleteElectionById,
    certifyElection: mockCertifyElection,
  })
);

// El conteo de cargos vive en el repository de positions (dominio propio)
jest.unstable_mockModule(
  '../../../src/modules/elections/positions/position.repository.js',
  () => ({
    countPositionsByElection: mockCountPositionsByElection,
  })
);

const service = await import(
  '../../../src/modules/elections/elections/election.service.js'
);

const ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const PERIODO = '11111111-2222-3333-4444-555555555555';
const ACTOR = '99999999-8888-7777-6666-555555555555';
const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const enElFuturo = (dias) =>
  new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('Election Service — CRUD', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lista con paginación y traduce page/limit a skip/take', async () => {
    mockCountElections.mockResolvedValue(25);
    mockListElections.mockResolvedValue([{ id: ID }]);

    const res = await service.listElections({ page: '3', limit: '10' });

    expect(mockListElections).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
    expect(res.pagination).toEqual(
      expect.objectContaining({ page: 3, limit: 10, total: 25, totalPages: 3 })
    );
  });

  it('propaga los filtros al repository', async () => {
    mockCountElections.mockResolvedValue(0);
    mockListElections.mockResolvedValue([]);

    await service.listElections({ status: 'OPEN', scope_type: 'FACULTY' });

    expect(mockCountElections).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'OPEN', scopeType: 'FACULTY' })
    );
  });

  it('getElectionById lanza 404 si no existe', async () => {
    mockFindElectionById.mockResolvedValue(null);

    const err = await capturarError(() => service.getElectionById(ID));

    expect(err.statusCode).toBe(404);
  });

  it('createElection exige un creador identificado (401)', async () => {
    const err = await capturarError(() =>
      service.createElection({ title: 'X' }, undefined)
    );

    expect(err.statusCode).toBe(401);
    expect(mockCreateElection).not.toHaveBeenCalled();
  });

  it('createElection exige que el creador pertenezca a una organización (403)', async () => {
    const err = await capturarError(() => service.createElection({ title: 'X' }, ACTOR, null));

    expect(err.statusCode).toBe(403);
    expect(mockCreateElection).not.toHaveBeenCalled();
  });

  it('createElection normaliza texto y adjunta created_by y organización', async () => {
    mockCreateElection.mockResolvedValue({ id: ID });

      await service.createElection(
        {
          title: 'X',
          scope_type: 'UNIVERSITY',
          period_id: PERIODO,
          start_at: enElFuturo(1),
          end_at: enElFuturo(2),
        },
        ACTOR,
        ORG
      );

    const data = mockCreateElection.mock.calls[0][0];
    expect(data.title).toBe('X');
    expect(data.createdBy).toBe(ACTOR);
    expect(data.organizationId).toBe(ORG);
    expect(data.facultyId).toBeNull();
    expect(data.startAt).toBeInstanceOf(Date);
  });

  it('createElection rechaza si falta organizationId (403)', async () => {
    const err = await capturarError(() =>
      service.createElection(
        { title: 'X', scope_type: 'UNIVERSITY' },
        ACTOR,
        undefined
      )
    );

    expect(err.statusCode).toBe(403);
  });

  it('traduce P2003 (FK inexistente) a 400', async () => {
    mockCreateElection.mockRejectedValue({ code: 'P2003' });

    const err = await capturarError(() =>
      service.createElection(
        {
          title: 'X',
          scope_type: 'UNIVERSITY',
          period_id: PERIODO,
          start_at: enElFuturo(1),
          end_at: enElFuturo(2),
        },
        ACTOR,
        ORG
      )
    );

    expect(err.statusCode).toBe(400);
  });

  it('updateElection solo permite editar en DRAFT (409 si no)', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ID, status: 'OPEN' });

    const err = await capturarError(() =>
      service.updateElection(ID, { title: 'Nuevo' })
    );

    expect(err.statusCode).toBe(409);
    expect(mockUpdateElection).not.toHaveBeenCalled();
  });

  it('updateElection compara la fecha nueva contra la ya guardada', async () => {
    mockFindElectionStatus.mockResolvedValue({
      id: ID,
      status: 'DRAFT',
      startAt: new Date(enElFuturo(5)),
      endAt: new Date(enElFuturo(6)),
    });

    // Se manda solo end_at, anterior al start_at guardado
    const err = await capturarError(() =>
      service.updateElection(ID, { end_at: enElFuturo(1) })
    );

    expect(err.statusCode).toBe(400);
    expect(mockUpdateElection).not.toHaveBeenCalled();
  });

  it('deleteElection solo permite borrar en DRAFT', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ID, status: 'CERTIFIED' });

    const err = await capturarError(() => service.deleteElection(ID));

    expect(err.statusCode).toBe(409);
    expect(mockDeleteElectionById).not.toHaveBeenCalled();
  });
});

