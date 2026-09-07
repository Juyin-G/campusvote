import { jest } from '@jest/globals';

const mockFindBallotPositionById = jest.fn();
const mockFindBallotPositionsByBallot = jest.fn();
const mockCountBallotPositionsByBallot = jest.fn();
const mockCreateBallotPosition = jest.fn();
const mockUpdateBallotPosition = jest.fn();
const mockDeleteBallotPositionById = jest.fn();
const mockFindByBallotAndPosition = jest.fn();
const mockFindByBallotAndOrder = jest.fn();

const mockFindBallotById = jest.fn();
const mockFindPositionById = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/ballots/ballotPositions/ballotPosition.repository.js',
  () => ({
    findBallotPositionById: mockFindBallotPositionById,
    findBallotPositionsByBallot: mockFindBallotPositionsByBallot,
    countBallotPositionsByBallot: mockCountBallotPositionsByBallot,
    createBallotPosition: mockCreateBallotPosition,
    updateBallotPosition: mockUpdateBallotPosition,
    deleteBallotPositionById: mockDeleteBallotPositionById,
    findByBallotAndPosition: mockFindByBallotAndPosition,
    findByBallotAndOrder: mockFindByBallotAndOrder,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/ballots/ballot.repository.js',
  () => ({
    findBallotById: mockFindBallotById,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/positions/position.repository.js',
  () => ({
    findPositionById: mockFindPositionById,
  })
);

const service = await import(
  '../../../src/modules/ballots/ballotPositions/ballotPosition.service.js'
);

const BALLOT = '11111111-1111-1111-1111-111111111111';
const BP = '22222222-2222-2222-2222-222222222222';
const POSITION = '33333333-3333-3333-3333-333333333333';
const ELECTION = '44444444-4444-4444-4444-444444444444';

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('BallotPosition Service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listar devuelve 404 si la boleta no existe', async () => {
    mockFindBallotById.mockResolvedValue(null);

    const err = await capturarError(() =>
      service.listBallotPositions(BALLOT)
    );

    expect(err.statusCode).toBe(404);
  });

  it('listar devuelve posiciones con total', async () => {
    mockFindBallotById.mockResolvedValue({
      id: BALLOT,
      electionId: ELECTION,
    });

    mockFindBallotPositionsByBallot.mockResolvedValue([
      { id: BP },
    ]);

    const result =
      await service.listBallotPositions(BALLOT);

    expect(result.total).toBe(1);
  });

  it('crear rechaza cargo de otra elección', async () => {
    mockFindBallotById.mockResolvedValue({
      id: BALLOT,
      electionId: ELECTION,
    });

    mockFindPositionById.mockResolvedValue({
      id: POSITION,
      electionId: '99999999-9999-9999-9999-999999999999',
    });

    const err = await capturarError(() =>
      service.createBallotPosition(BALLOT, {
        position_id: POSITION,
      })
    );

    expect(err.statusCode).toBe(400);
  });

  it('crear rechaza posición duplicada', async () => {
    mockFindBallotById.mockResolvedValue({
      id: BALLOT,
      electionId: ELECTION,
    });

    mockFindPositionById.mockResolvedValue({
      id: POSITION,
      electionId: ELECTION,
    });

    mockFindByBallotAndPosition.mockResolvedValue({
      id: BP,
    });

    const err = await capturarError(() =>
      service.createBallotPosition(BALLOT, {
        position_id: POSITION,
      })
    );

    expect(err.statusCode).toBe(409);
  });

  it('crear asigna order_index al final si no se envía', async () => {
    mockFindBallotById.mockResolvedValue({
      id: BALLOT,
      electionId: ELECTION,
    });

    mockFindPositionById.mockResolvedValue({
      id: POSITION,
      electionId: ELECTION,
    });

    mockFindByBallotAndPosition.mockResolvedValue(
      null
    );

    mockCountBallotPositionsByBallot.mockResolvedValue(
      2
    );

    mockFindByBallotAndOrder.mockResolvedValue(null);

    mockCreateBallotPosition.mockResolvedValue({
      id: BP,
    });

    await service.createBallotPosition(BALLOT, {
      position_id: POSITION,
    });

    expect(
      mockCreateBallotPosition
    ).toHaveBeenCalledWith({
      ballotId: BALLOT,
      positionId: POSITION,
      orderIndex: 3,
    });
  });

  it('crear rechaza order_index repetido', async () => {
    mockFindBallotById.mockResolvedValue({
      id: BALLOT,
      electionId: ELECTION,
    });

    mockFindPositionById.mockResolvedValue({
      id: POSITION,
      electionId: ELECTION,
    });

    mockFindByBallotAndPosition.mockResolvedValue(
      null
    );

    mockFindByBallotAndOrder.mockResolvedValue({
      id: BP,
    });

    const err = await capturarError(() =>
      service.createBallotPosition(BALLOT, {
        position_id: POSITION,
        order_index: 1,
      })
    );

    expect(err.statusCode).toBe(409);
  });
});