import { jest } from '@jest/globals';

const mockFindBallotById = jest.fn();
const mockListBallotsByElection = jest.fn();
const mockCountBallotsByElection = jest.fn();
const mockCreateBallot = jest.fn();
const mockUpdateBallot = jest.fn();
const mockDeleteBallotById = jest.fn();
const mockGetActiveBallot = jest.fn();
const mockCreateBallotVersion = jest.fn();
const mockValidateBallotCompleteness = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/ballots/ballot.repository.js',
  () => ({
    findBallotById: mockFindBallotById,
    listBallotsByElection: mockListBallotsByElection,
    countBallotsByElection: mockCountBallotsByElection,
    createBallot: mockCreateBallot,
    updateBallot: mockUpdateBallot,
    deleteBallotById: mockDeleteBallotById,
    getActiveBallot: mockGetActiveBallot,
    createBallotVersion: mockCreateBallotVersion,
    validateBallotCompleteness: mockValidateBallotCompleteness,
  })
);

const service = await import(
  '../../../src/modules/ballots/ballot.service.js'
);

const BALLOT = '11111111-1111-1111-1111-111111111111';
const ELECTION = '22222222-2222-2222-2222-222222222222';

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('Ballot Service — CRUD', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lista ballots con paginación', async () => {
    mockCountBallotsByElection.mockResolvedValue(12);
    mockListBallotsByElection.mockResolvedValue([{ id: BALLOT }]);

    const result = await service.listBallots({
      election_id: ELECTION,
      page: '2',
      limit: '5',
    });

    expect(mockListBallotsByElection).toHaveBeenCalledWith(
      ELECTION,
      expect.objectContaining({
        skip: 5,
        take: 5,
      })
    );

    expect(result.pagination).toEqual(
      expect.objectContaining({
        page: 2,
        limit: 5,
        total: 12,
        totalPages: 3,
      })
    );
  });

  it('listar requiere election_id', async () => {
    const err = await capturarError(() =>
      service.listBallots({})
    );

    expect(err.statusCode).toBe(400);
  });

  it('getBallotById devuelve 404 si no existe', async () => {
    mockFindBallotById.mockResolvedValue(null);

    const err = await capturarError(() =>
      service.getBallotById(BALLOT)
    );

    expect(err.statusCode).toBe(404);
  });

  it('createBallot exige election_id', async () => {
    const err = await capturarError(() =>
      service.createBallot({})
    );

    expect(err.statusCode).toBe(400);
    expect(mockCreateBallot).not.toHaveBeenCalled();
  });

  it('createBallot crea con valores por defecto', async () => {
    mockCreateBallot.mockResolvedValue({
      id: BALLOT,
      election_id: ELECTION,
      version: 1,
      is_active: true,
    });

    await service.createBallot({
      election_id: ELECTION,
    });

    expect(mockCreateBallot).toHaveBeenCalledWith({
      electionId: ELECTION,
      version: 1,
      isActive: true,
    });
  });

  it('updateBallot devuelve 404 si no existe', async () => {
    mockFindBallotById.mockResolvedValue(null);

    const err = await capturarError(() =>
      service.updateBallot(BALLOT, {
        is_active: false,
      })
    );

    expect(err.statusCode).toBe(404);
  });

  it('updateBallot rechaza body vacío', async () => {
    mockFindBallotById.mockResolvedValue({
      id: BALLOT,
    });

    const err = await capturarError(() =>
      service.updateBallot(BALLOT, {})
    );

    expect(err.statusCode).toBe(400);
  });

  it('deleteBallot borra una boleta existente', async () => {
    mockFindBallotById.mockResolvedValue({
      id: BALLOT,
    });

    mockDeleteBallotById.mockResolvedValue({
      id: BALLOT,
    });

    const result = await service.deleteBallot(BALLOT);

    expect(result).toEqual({
      deleted: true,
    });

    expect(mockDeleteBallotById).toHaveBeenCalledWith(
      BALLOT
    );
  });
});

describe('Ballot Service — funciones especiales', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getActiveBallot devuelve 404 si no existe activa', async () => {
    mockGetActiveBallot.mockResolvedValue(null);

    const err = await capturarError(() =>
      service.getActiveBallot(ELECTION)
    );

    expect(err.statusCode).toBe(404);
  });

  it('getActiveBallot devuelve la boleta activa', async () => {
    mockGetActiveBallot.mockResolvedValue({
      ballot_id: BALLOT,
      version: 2,
    });

    const result =
      await service.getActiveBallot(ELECTION);

    expect(result.ballot_id).toBe(BALLOT);
  });

  it('createBallotVersion delega al repository', async () => {
    mockCreateBallotVersion.mockResolvedValue({
      id: BALLOT,
      version: 3,
    });

    const result =
      await service.createBallotVersion(ELECTION);

    expect(
      mockCreateBallotVersion
    ).toHaveBeenCalledWith(ELECTION);

    expect(result.version).toBe(3);
  });

  it('validateBallotCompleteness devuelve 404 si la boleta no existe', async () => {
    mockFindBallotById.mockResolvedValue(null);

    const err = await capturarError(() =>
      service.validateBallotCompleteness(BALLOT)
    );

    expect(err.statusCode).toBe(404);
  });

  it('validateBallotCompleteness devuelve el resultado', async () => {
    mockFindBallotById.mockResolvedValue({
      id: BALLOT,
    });

    mockValidateBallotCompleteness.mockResolvedValue(
      true
    );

    const result =
      await service.validateBallotCompleteness(BALLOT);

    expect(result).toEqual({
      ballotId: BALLOT,
      isComplete: true,
    });
  });
});