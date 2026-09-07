// tests/unit/voting/voting.service.test.js
// Tests del servicio de VOTACIÓN — verificación pública de comprobante.

import { jest } from '@jest/globals';

const mockFindVoteByReceipt = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/voting/voting.repository.js',
  () => ({
    findVoteByReceipt: mockFindVoteByReceipt,
    startSession: jest.fn(),
    castVote: jest.fn(),
    getSession: jest.fn(),
    default: {
      findVoteByReceipt: mockFindVoteByReceipt,
      startSession: jest.fn(),
      castVote: jest.fn(),
      getSession: jest.fn(),
    },
  })
);

jest.unstable_mockModule(
  '../../../src/modules/audit/audit.service.js',
  () => ({
    default: {
      consumeOneTimeToken: jest.fn().mockResolvedValue(true),
    },
  })
);

const service = await import('../../../src/modules/voting/voting.service.js');

const VALID_RECEIPT = 'a'.repeat(64);

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('Voting Service — verifyReceipt', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rechaza código vacío (400)', async () => {
    const err = await capturarError(() => service.verifyReceipt(''));
    expect(err.statusCode).toBe(400);
  });

  it('devuelve valid:false si el comprobante no existe', async () => {
    mockFindVoteByReceipt.mockResolvedValue(null);
    const result = await service.verifyReceipt(VALID_RECEIPT);
    expect(result.valid).toBe(false);
    expect(mockFindVoteByReceipt).toHaveBeenCalledWith(VALID_RECEIPT);
  });

  it('devuelve datos públicos del voto cuando el comprobante es válido', async () => {
    mockFindVoteByReceipt.mockResolvedValue({
      id: 'vote-1',
      electionId: 'election-1',
      castAt: new Date('2026-08-30T00:00:00Z'),
      payloadHash: 'hash123',
      sessionId: 'session-1',
      election: { id: 'election-1', title: 'Elección Rector', status: 'PUBLISHED' },
    });

    const result = await service.verifyReceipt(VALID_RECEIPT);
    expect(result.valid).toBe(true);
    expect(result.electionId).toBe('election-1');
    expect(result.electionTitle).toBe('Elección Rector');
    expect(result.castAt).toEqual(new Date('2026-08-30T00:00:00Z'));
    expect(result.payloadHash).toBe('hash123');
  });

  it('no expone el voterId ni el sessionId en la respuesta válida', async () => {
    mockFindVoteByReceipt.mockResolvedValue({
      id: 'vote-1',
      electionId: 'election-1',
      castAt: new Date(),
      payloadHash: 'hash123',
      sessionId: 'session-1',
    });

    const result = await service.verifyReceipt(VALID_RECEIPT);
    expect(result).not.toHaveProperty('sessionId');
    expect(result).not.toHaveProperty('id');
  });
});
