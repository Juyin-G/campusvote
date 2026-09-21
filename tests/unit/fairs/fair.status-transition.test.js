// tests/unit/fairs/fair.status-transition.test.js
// Parte 3 — Estados de la feria.
// Verifica la máquina de estados de fair.service.changeFairStatus y, en
// particular, que OPEN -> DRAFT se bloquea cuando ya existe participación
// (votos o rúbricas finalizadas) y se permite cuando no la hay.

import { jest } from '@jest/globals';

const mockFindById = jest.fn();
const mockUpdate = jest.fn();

jest.unstable_mockModule('../../../src/modules/fairs/fair.repository.js', () => ({
  findById: mockFindById,
  list: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  update: mockUpdate,
  default: {},
}));

const mockVoteCount = jest.fn();
const mockEvaluationCount = jest.fn();

jest.unstable_mockModule('../../../src/database/prisma.js', () => ({
  prisma: {
    fairVoteParticipation: { count: mockVoteCount },
    fairEvaluation: { count: mockEvaluationCount },
  },
}));

const service = await import('../../../src/modules/fairs/fair.service.js');

const FAIR_ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const ACTOR = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };

const fair = (status) => ({
  id: FAIR_ID,
  organizationId: 'org-1',
  name: 'Feria',
  description: null,
  status,
  startsAt: null,
  endsAt: null,
  site: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { projects: 0 },
});

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('Fair Service — changeFairStatus (Parte 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVoteCount.mockResolvedValue(0);
    mockEvaluationCount.mockResolvedValue(0);
  });

  it('DRAFT -> OPEN está permitido', async () => {
    mockFindById.mockResolvedValue(fair('DRAFT'));
    mockUpdate.mockResolvedValue(fair('OPEN'));

    const res = await service.changeFairStatus({
      fairId: FAIR_ID,
      data: { status: 'OPEN' },
      actor: ACTOR,
    });
    expect(res.status).toBe('OPEN');
    expect(mockUpdate).toHaveBeenCalledWith(FAIR_ID, { status: 'OPEN' });
  });

  it('OPEN -> CLOSED está permitido', async () => {
    mockFindById.mockResolvedValue(fair('OPEN'));
    mockUpdate.mockResolvedValue(fair('CLOSED'));

    const res = await service.changeFairStatus({
      fairId: FAIR_ID,
      data: { status: 'CLOSED' },
      actor: ACTOR,
    });
    expect(res.status).toBe('CLOSED');
  });

  it('CLOSED es terminal: CLOSED -> OPEN falla (409)', async () => {
    mockFindById.mockResolvedValue(fair('CLOSED'));

    const err = await capturarError(() =>
      service.changeFairStatus({ fairId: FAIR_ID, data: { status: 'OPEN' }, actor: ACTOR })
    );
    expect(err.statusCode).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('DRAFT -> CLOSED (salto inválido) falla (409)', async () => {
    mockFindById.mockResolvedValue(fair('DRAFT'));

    const err = await capturarError(() =>
      service.changeFairStatus({ fairId: FAIR_ID, data: { status: 'CLOSED' }, actor: ACTOR })
    );
    expect(err.statusCode).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('OPEN -> DRAFT SIN participación está permitido', async () => {
    mockFindById.mockResolvedValue(fair('OPEN'));
    mockVoteCount.mockResolvedValue(0);
    mockEvaluationCount.mockResolvedValue(0);
    mockUpdate.mockResolvedValue(fair('DRAFT'));

    const res = await service.changeFairStatus({
      fairId: FAIR_ID,
      data: { status: 'DRAFT' },
      actor: ACTOR,
    });
    expect(res.status).toBe('DRAFT');
    expect(mockUpdate).toHaveBeenCalledWith(FAIR_ID, { status: 'DRAFT' });
  });

  it('OPEN -> DRAFT CON votos emitidos falla (409) y no cambia el estado', async () => {
    mockFindById.mockResolvedValue(fair('OPEN'));
    mockVoteCount.mockResolvedValue(2);
    mockEvaluationCount.mockResolvedValue(0);

    const err = await capturarError(() =>
      service.changeFairStatus({ fairId: FAIR_ID, data: { status: 'DRAFT' }, actor: ACTOR })
    );
    expect(err.statusCode).toBe(409);
    expect(err.message).toMatch(/participaci/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('OPEN -> DRAFT CON rúbricas finalizadas falla (409) y no cambia el estado', async () => {
    mockFindById.mockResolvedValue(fair('OPEN'));
    mockVoteCount.mockResolvedValue(0);
    mockEvaluationCount.mockResolvedValue(1);

    const err = await capturarError(() =>
      service.changeFairStatus({ fairId: FAIR_ID, data: { status: 'DRAFT' }, actor: ACTOR })
    );
    expect(err.statusCode).toBe(409);
    expect(err.message).toMatch(/participaci/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('la comprobación de participación solo consulta votos no nulos de rúbrica finalizada', async () => {
    mockFindById.mockResolvedValue(fair('OPEN'));
    mockUpdate.mockResolvedValue(fair('DRAFT'));

    await service.changeFairStatus({ fairId: FAIR_ID, data: { status: 'DRAFT' }, actor: ACTOR });

    expect(mockVoteCount).toHaveBeenCalledWith({ where: { fairId: FAIR_ID } });
    expect(mockEvaluationCount).toHaveBeenCalledWith({
      where: { fairId: FAIR_ID, submittedAt: { not: null } },
    });
  });
});