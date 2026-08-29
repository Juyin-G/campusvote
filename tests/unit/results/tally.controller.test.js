// tests/unit/results/tally.controller.test.js
// S7-12 — Tests del Controller de Tally.

import { jest } from '@jest/globals';

const mockRecalculateTallies = jest.fn();
const mockGetExistingTallies = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/results/tally/tally.service.js',
  () => ({
    recalculateTallies: mockRecalculateTallies,
    getExistingTallies: mockGetExistingTallies,
  })
);

const controller = await import('../../../src/modules/results/tally/tally.controller.js');

const ELECTION_ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Tally Controller', () => {
  beforeEach(() => jest.clearAllMocks());

  it('recalculateTallies llama al service con req.params.id y responde 200', async () => {
    mockRecalculateTallies.mockResolvedValue({ electionId: ELECTION_ID, inserted: 4 });
    const req = { params: { id: ELECTION_ID } };
    const res = mockRes();

    await controller.recalculateTallies(req, res, jest.fn());

    expect(mockRecalculateTallies).toHaveBeenCalledWith(ELECTION_ID);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { electionId: ELECTION_ID, inserted: 4 },
      })
    );
  });

  it('getTallies llama al service y responde con la lista', async () => {
    mockGetExistingTallies.mockResolvedValue([{ id: 't1', votesCount: 5 }]);
    const req = { params: { id: ELECTION_ID } };
    const res = mockRes();

    await controller.getTallies(req, res, jest.fn());

    expect(mockGetExistingTallies).toHaveBeenCalledWith(ELECTION_ID);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [{ id: 't1', votesCount: 5 }],
      })
    );
  });

  it('propaga errores al next (asyncHandler)', async () => {
    const customError = new Error('boom');
    mockRecalculateTallies.mockRejectedValue(customError);
    const req = { params: { id: ELECTION_ID } };
    const res = mockRes();
    const next = jest.fn();

    await controller.recalculateTallies(req, res, next);

    // Esperar microtask para que .catch(next) se ejecute.
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(customError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
