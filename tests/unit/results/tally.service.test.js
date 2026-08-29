// tests/unit/results/tally.service.test.js
// S7-12 — Tests del Servicio de Tally (FASE 3).

import { jest } from '@jest/globals';

const mockFindElectionById = jest.fn();
const mockFindBallotOptionsByElection = jest.fn();
const mockCountSelectionsByBallotOption = jest.fn();
const mockFindExistingTallies = jest.fn();
const mockReplaceTallies = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/elections/elections/election.repository.js',
  () => ({
    findElectionById: mockFindElectionById,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/results/tally/tally.repository.js',
  () => ({
    findBallotOptionsByElection: mockFindBallotOptionsByElection,
    countSelectionsByBallotOption: mockCountSelectionsByBallotOption,
    findExistingTallies: mockFindExistingTallies,
    replaceTallies: mockReplaceTallies,
  })
);

const service = await import('../../../src/modules/results/tally/tally.service.js');

const ELECTION_ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const POSITION_ID = '11111111-2222-3333-4444-555555555555';
const OPTION_CANDIDATE = 'aaaa1111-aaaa-1111-aaaa-111111111111';
const OPTION_BLANK = 'bbbb2222-bbbb-2222-bbbb-222222222222';
const OPTION_NULL = 'cccc3333-cccc-3333-cccc-333333333333';
const OPTION_EMPTY = 'dddd4444-dddd-4444-dddd-444444444444';

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('Tally Service — recalculateTallies', () => {
  beforeEach(() => jest.clearAllMocks());

  const fakeOptions = [
    {
      id: OPTION_CANDIDATE,
      ballotPositionId: 'bp-1',
      optionType: 'CANDIDATE_LIST',
      candidateListId: 'cl-1',
      label: 'Lista A',
      ballotPosition: { positionId: POSITION_ID },
    },
    {
      id: OPTION_BLANK,
      ballotPositionId: 'bp-1',
      optionType: 'BLANK',
      candidateListId: null,
      label: 'Voto en blanco',
      ballotPosition: { positionId: POSITION_ID },
    },
    {
      id: OPTION_NULL,
      ballotPositionId: 'bp-1',
      optionType: 'NULL',
      candidateListId: null,
      label: 'Voto nulo',
      ballotPosition: { positionId: POSITION_ID },
    },
    {
      id: OPTION_EMPTY,
      ballotPositionId: 'bp-1',
      optionType: 'CANDIDATE_LIST',
      candidateListId: 'cl-2',
      label: 'Lista B (sin votos)',
      ballotPosition: { positionId: POSITION_ID },
    },
  ];

  it('rechaza electionId vacío (400)', async () => {
    const err = await capturarError(() => service.recalculateTallies(''));
    expect(err.statusCode).toBe(400);
    expect(mockFindElectionById).not.toHaveBeenCalled();
  });

  it('lanza NOT_FOUND si la elección no existe', async () => {
    mockFindElectionById.mockResolvedValue(null);
    const err = await capturarError(() =>
      service.recalculateTallies(ELECTION_ID)
    );
    expect(err.statusCode).toBe(404);
  });

  it('rechaza recalcular si el estado no es CLOSED (409)', async () => {
    mockFindElectionById.mockResolvedValue({
      id: ELECTION_ID,
      status: 'OPEN',
    });
    const err = await capturarError(() =>
      service.recalculateTallies(ELECTION_ID)
    );
    expect(err.statusCode).toBe(409);
    expect(mockReplaceTallies).not.toHaveBeenCalled();
  });

  it('rechaza recalcular si está DRAFT (409)', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'DRAFT' });
    const err = await capturarError(() =>
      service.recalculateTallies(ELECTION_ID)
    );
    expect(err.statusCode).toBe(409);
  });

  it('rechaza recalcular si está CERTIFIED (409)', async () => {
    mockFindElectionById.mockResolvedValue({
      id: ELECTION_ID,
      status: 'CERTIFIED',
    });
    const err = await capturarError(() =>
      service.recalculateTallies(ELECTION_ID)
    );
    expect(err.statusCode).toBe(409);
  });

  it('rechaza recalcular si está PUBLISHED (409)', async () => {
    mockFindElectionById.mockResolvedValue({
      id: ELECTION_ID,
      status: 'PUBLISHED',
    });
    const err = await capturarError(() =>
      service.recalculateTallies(ELECTION_ID)
    );
    expect(err.statusCode).toBe(409);
  });

  it('recalcula correctamente con votos, BLANK, NULL y opción con 0', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CLOSED' });
    mockFindBallotOptionsByElection.mockResolvedValue(fakeOptions);
    mockCountSelectionsByBallotOption.mockResolvedValue([
      { ballotOptionId: OPTION_CANDIDATE, _count: { _all: 12 } },
      { ballotOptionId: OPTION_BLANK, _count: { _all: 2 } },
      { ballotOptionId: OPTION_NULL, _count: { _all: 1 } },
    ]);
    mockReplaceTallies.mockResolvedValue({
      electionId: ELECTION_ID,
      deleted: 4,
      inserted: 4,
    });

    const result = await service.recalculateTallies(ELECTION_ID);

    expect(result).toEqual({
      electionId: ELECTION_ID,
      deleted: 4,
      inserted: 4,
      optionsProcessed: 4,
      positionsProcessed: 1,
    });

    expect(mockReplaceTallies).toHaveBeenCalledWith(
      ELECTION_ID,
      expect.arrayContaining([
        expect.objectContaining({
          electionId: ELECTION_ID,
          optionId: OPTION_CANDIDATE,
          votesCount: 12,
        }),
        expect.objectContaining({
          optionId: OPTION_BLANK,
          votesCount: 2,
        }),
        expect.objectContaining({
          optionId: OPTION_NULL,
          votesCount: 1,
        }),
        expect.objectContaining({
          optionId: OPTION_EMPTY,
          votesCount: 0,
        }),
      ])
    );
  });

  it('incluye opciones con 0 votos (idempotencia de listado)', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CLOSED' });
    mockFindBallotOptionsByElection.mockResolvedValue(fakeOptions);
    mockCountSelectionsByBallotOption.mockResolvedValue([
      { ballotOptionId: OPTION_CANDIDATE, _count: { _all: 5 } },
    ]);
    mockReplaceTallies.mockResolvedValue({
      electionId: ELECTION_ID,
      deleted: 0,
      inserted: 4,
    });

    await service.recalculateTallies(ELECTION_ID);

    const records = mockReplaceTallies.mock.calls[0][1];
    const emptyRecord = records.find((r) => r.optionId === OPTION_EMPTY);
    expect(emptyRecord.votesCount).toBe(0);
  });

  it('maneja elección sin votos (records con 0)', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CLOSED' });
    mockFindBallotOptionsByElection.mockResolvedValue(fakeOptions);
    mockCountSelectionsByBallotOption.mockResolvedValue([]);
    mockReplaceTallies.mockResolvedValue({
      electionId: ELECTION_ID,
      deleted: 0,
      inserted: 4,
    });

    const result = await service.recalculateTallies(ELECTION_ID);

    const records = mockReplaceTallies.mock.calls[0][1];
    expect(records).toHaveLength(4);
    expect(records.every((r) => r.votesCount === 0)).toBe(true);
    expect(result.inserted).toBe(4);
  });

  it('ignora counts huérfanos (FK rota hipotética)', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CLOSED' });
    mockFindBallotOptionsByElection.mockResolvedValue(fakeOptions);
    mockCountSelectionsByBallotOption.mockResolvedValue([
      { ballotOptionId: OPTION_CANDIDATE, _count: { _all: 7 } },
      { ballotOptionId: 'ghost-option-id', _count: { _all: 99 } },
    ]);
    mockReplaceTallies.mockResolvedValue({
      electionId: ELECTION_ID,
      deleted: 0,
      inserted: 4,
    });

    await service.recalculateTallies(ELECTION_ID);

    const records = mockReplaceTallies.mock.calls[0][1];
    expect(records).toHaveLength(4);
    expect(records.find((r) => r.optionId === 'ghost-option-id')).toBeUndefined();
  });

  it('propaga errores del repository', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CLOSED' });
    mockFindBallotOptionsByElection.mockResolvedValue(fakeOptions);
    mockCountSelectionsByBallotOption.mockResolvedValue([]);
    mockReplaceTallies.mockRejectedValue(new Error('DB down'));

    const err = await capturarError(() => service.recalculateTallies(ELECTION_ID));
    expect(err.message).toBe('DB down');
  });
});

describe('Tally Service — getExistingTallies', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rechaza electionId vacío (400)', async () => {
    const err = await capturarError(() => service.getExistingTallies(''));
    expect(err.statusCode).toBe(400);
  });

  it('devuelve los tallies del repository', async () => {
    const fakeTallies = [
      {
        id: 't1',
        electionId: ELECTION_ID,
        positionId: POSITION_ID,
        optionId: OPTION_CANDIDATE,
        votesCount: 5,
        updatedAt: new Date(),
      },
    ];
    mockFindExistingTallies.mockResolvedValue(fakeTallies);

    const res = await service.getExistingTallies(ELECTION_ID);

    expect(res).toEqual(fakeTallies);
    expect(mockFindExistingTallies).toHaveBeenCalledWith(ELECTION_ID);
  });

  it('devuelve array vacío si no hay tallies', async () => {
    mockFindExistingTallies.mockResolvedValue([]);
    const res = await service.getExistingTallies(ELECTION_ID);
    expect(res).toEqual([]);
  });
});
