// tests/unit/results/results.service.test.js
// S7-12 — Tests del Servicio de Resultados.

import { jest } from '@jest/globals';

const mockFindElectionStatus = jest.fn();
const mockFindElectionResult = jest.fn();
const mockFindTalliesWithContext = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/results/results.repository.js',
  () => ({
    default: {
      findElectionStatus: mockFindElectionStatus,
      findElectionResult: mockFindElectionResult,
      findTalliesWithContext: mockFindTalliesWithContext,
    },
  })
);

const service = await import(
  '../../../src/modules/results/results.service.js'
);

const ELECTION_ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('Results Service — getLiveResults', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rechaza electionId vacío (400)', async () => {
    const err = await capturarError(() => service.getLiveResults(''));
    expect(err.statusCode).toBe(400);
  });

  it('NOT_FOUND si la elección no existe', async () => {
    mockFindElectionStatus.mockResolvedValue(null);
    const err = await capturarError(() => service.getLiveResults(ELECTION_ID));
    expect(err.statusCode).toBe(404);
  });

  it('bloquea en OPEN (409)', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ELECTION_ID, status: 'OPEN' });
    const err = await capturarError(() => service.getLiveResults(ELECTION_ID));
    expect(err.statusCode).toBe(409);
  });

  it('bloquea en DRAFT (409)', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ELECTION_ID, status: 'DRAFT' });
    const err = await capturarError(() => service.getLiveResults(ELECTION_ID));
    expect(err.statusCode).toBe(409);
  });

  it('permite en CLOSED', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ELECTION_ID, status: 'CLOSED' });
    mockFindElectionResult.mockResolvedValue({ turnout_percentage: 50 });
    mockFindTalliesWithContext.mockResolvedValue([]);

    const res = await service.getLiveResults(ELECTION_ID);
    expect(res.status).toBe('CLOSED');
    expect(res.election_id).toBe(ELECTION_ID);
  });

  it('permite en CERTIFIED y PUBLISHED', async () => {
    for (const status of ['CERTIFIED', 'PUBLISHED']) {
      mockFindElectionStatus.mockResolvedValue({ id: ELECTION_ID, status });
      mockFindElectionResult.mockResolvedValue({ turnout_percentage: 50 });
      mockFindTalliesWithContext.mockResolvedValue([]);
      const res = await service.getLiveResults(ELECTION_ID);
      expect(res.status).toBe(status);
    }
  });
});

describe('Results Service — getFinalResults', () => {
  beforeEach(() => jest.clearAllMocks());

  it('NOT_FOUND si la elección no existe', async () => {
    mockFindElectionStatus.mockResolvedValue(null);
    const err = await capturarError(() => service.getFinalResults(ELECTION_ID));
    expect(err.statusCode).toBe(404);
  });

  it('devuelve NOT_AVAILABLE si la elección está CERTIFIED', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    const err = await capturarError(() => service.getFinalResults(ELECTION_ID));
    expect(err.statusCode).toBe(404);
    expect(err.message).toMatch(/disponibles/i);
  });

  it('devuelve NOT_AVAILABLE si la elección está CLOSED', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ELECTION_ID, status: 'CLOSED' });
    const err = await capturarError(() => service.getFinalResults(ELECTION_ID));
    expect(err.statusCode).toBe(404);
  });

  it('devuelve resultados si está PUBLISHED', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ELECTION_ID, status: 'PUBLISHED' });
    mockFindElectionResult.mockResolvedValue({ turnout_percentage: 60 });
    mockFindTalliesWithContext.mockResolvedValue([
      {
        ballot_options: {
          ballot_positions: {
            positions: { id: 'p1', name: 'Rector', seats: 1 },
          },
        },
        option_id: 'o1',
        votes_count: 100,
        ballot_options: {
          label: 'Lista A',
          option_type: 'CANDIDATE_LIST',
          candidate_list_id: 'cl1',
          ballot_positions: {
            positions: { id: 'p1', name: 'Rector', seats: 1 },
          },
        },
      },
    ]);

    const res = await service.getFinalResults(ELECTION_ID);
    expect(res.status).toBe('PUBLISHED');
    expect(res.detail.positions).toHaveLength(1);
    expect(res.detail.positions[0].options[0].percentage).toBe(100);
  });
});
