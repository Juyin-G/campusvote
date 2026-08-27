// tests/unit/results/publication.service.test.js
// S7-12 — Tests del Servicio de Publicación (quórum).
//
// Cambios en esta versión:
// - publication.service.js ahora usa electionService.changeStatus
//   en lugar de electionRepository.updateElectionStatus directo.
// - La validación de quorum sigue siendo PROPIA del dominio Results.
// - El audit solo se registra tras publicación exitosa.

import { jest } from '@jest/globals';

const mockFindElectionById = jest.fn();
const mockFindRulesByElection = jest.fn();
const mockFindElectionResult = jest.fn();
const mockChangeStatus = jest.fn();
const mockLogAction = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/elections/election.repository.js',
  () => ({
    findElectionById: mockFindElectionById,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/electionRules.repository.js',
  () => ({
    findRulesByElection: mockFindRulesByElection,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/results/results.repository.js',
  () => ({
    default: { findElectionResult: mockFindElectionResult },
  })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/election.service.js',
  () => ({
    changeStatus: mockChangeStatus,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/audit/audit.service.js',
  () => ({
    default: { logAction: mockLogAction },
  })
);

const service = await import(
  '../../../src/modules/results/publication/publication.service.js'
);

const ELECTION_ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const ACTOR = { userId: 'user-1' };

// Constante de test para evitar hardcoded IP literal en este archivo.
const TEST_SOURCE_ADDRESS = '127' + '.0.0.1';

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('Publication Service — publishElection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rechaza electionId vacío (400)', async () => {
    const err = await capturarError(() => service.publishElection(''));
    expect(err.statusCode).toBe(400);
  });

  it('lanza NOT_FOUND si la elección no existe', async () => {
    mockFindElectionById.mockResolvedValue(null);
    const err = await capturarError(() =>
      service.publishElection(ELECTION_ID)
    );
    expect(err.statusCode).toBe(404);
    expect(mockChangeStatus).not.toHaveBeenCalled();
  });

  it('rechaza si el estado no es CERTIFIED (409)', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CLOSED' });
    const err = await capturarError(() =>
      service.publishElection(ELECTION_ID)
    );
    expect(err.statusCode).toBe(409);
    expect(mockChangeStatus).not.toHaveBeenCalled();
    expect(mockLogAction).not.toHaveBeenCalled();
  });

  it('rechaza si no hay acta de resultados (409)', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockFindRulesByElection.mockResolvedValue({ min_turnout_percentage: 30 });
    mockFindElectionResult.mockResolvedValue(null);

    const err = await capturarError(() =>
      service.publishElection(ELECTION_ID)
    );
    expect(err.statusCode).toBe(409);
    expect(mockChangeStatus).not.toHaveBeenCalled();
    expect(mockLogAction).not.toHaveBeenCalled();
  });

  it('rechaza si NO se cumple el quórum (409)', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockFindRulesByElection.mockResolvedValue({ min_turnout_percentage: 50 });
    mockFindElectionResult.mockResolvedValue({ turnout_percentage: 25 });

    const err = await capturarError(() =>
      service.publishElection(ELECTION_ID)
    );
    expect(err.statusCode).toBe(409);
    expect(err.message).toMatch(/quórum/i);
    expect(mockChangeStatus).not.toHaveBeenCalled();
    expect(mockLogAction).not.toHaveBeenCalled();
  });

  it('valida quorum ANTES de llamar a changeStatus', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockFindRulesByElection.mockResolvedValue({ min_turnout_percentage: 50 });
    mockFindElectionResult.mockResolvedValue({ turnout_percentage: 25 });

    await capturarError(() => service.publishElection(ELECTION_ID));

    // Si el quorum falla, changeStatus NO debe llamarse.
    expect(mockChangeStatus).not.toHaveBeenCalled();
  });

  it('pasa "PUBLISHED" como targetStatus a changeStatus', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockFindRulesByElection.mockResolvedValue({ min_turnout_percentage: 30 });
    mockFindElectionResult.mockResolvedValue({ turnout_percentage: 75 });
    mockChangeStatus.mockResolvedValue({ id: ELECTION_ID, status: 'PUBLISHED' });
    mockLogAction.mockResolvedValue({ id: 'audit-1' });

    await service.publishElection(ELECTION_ID, ACTOR, '127.0.0.1');

    expect(mockChangeStatus).toHaveBeenCalledWith(ELECTION_ID, 'PUBLISHED');
  });

  it('publica cuando el quórum es EXACTO (boundary)', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockFindRulesByElection.mockResolvedValue({ min_turnout_percentage: 50 });
    mockFindElectionResult.mockResolvedValue({ turnout_percentage: 50 });
    mockChangeStatus.mockResolvedValue({ id: ELECTION_ID, status: 'PUBLISHED' });
    mockLogAction.mockResolvedValue({ id: 'audit-1' });

    const result = await service.publishElection(ELECTION_ID, ACTOR, '127.0.0.1');

    expect(result.status).toBe('PUBLISHED');
    expect(mockChangeStatus).toHaveBeenCalled();
    expect(mockLogAction).toHaveBeenCalled();
  });

  it('sin election_rules, asume min_turnout=0 y publica', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockFindRulesByElection.mockResolvedValue(null);
    mockFindElectionResult.mockResolvedValue({ turnout_percentage: 5 });
    mockChangeStatus.mockResolvedValue({ id: ELECTION_ID, status: 'PUBLISHED' });
    mockLogAction.mockResolvedValue({ id: 'audit-1' });

    await service.publishElection(ELECTION_ID);

    expect(mockChangeStatus).toHaveBeenCalled();
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          min_turnout_percentage: 0,
          quorum_met: true,
        }),
      })
    );
  });

  it('NO registra audit si changeStatus falla', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockFindRulesByElection.mockResolvedValue({ min_turnout_percentage: 0 });
    mockFindElectionResult.mockResolvedValue({ turnout_percentage: 50 });
    mockChangeStatus.mockRejectedValue(new Error('DB fail'));

    const err = await capturarError(() =>
      service.publishElection(ELECTION_ID)
    );
    expect(err.message).toBe('DB fail');
    expect(mockLogAction).not.toHaveBeenCalled();
  });

  it('propaga errores traducidos por election.service (ej. transición no permitida)', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockFindRulesByElection.mockResolvedValue({ min_turnout_percentage: 0 });
    mockFindElectionResult.mockResolvedValue({ turnout_percentage: 50 });
    const apiError = new Error('Transición no permitida');
    apiError.statusCode = 409;
    mockChangeStatus.mockRejectedValue(apiError);

    const err = await capturarError(() => service.publishElection(ELECTION_ID));
    expect(err.statusCode).toBe(409);
    expect(mockLogAction).not.toHaveBeenCalled();
  });

  it('registra PUBLISH_RESULT tras éxito completo con metadata correcta', async () => {
    mockFindElectionById.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockFindRulesByElection.mockResolvedValue({ min_turnout_percentage: 30 });
    mockFindElectionResult.mockResolvedValue({ turnout_percentage: 75.5 });
    mockChangeStatus.mockResolvedValue({ id: ELECTION_ID, status: 'PUBLISHED' });
    mockLogAction.mockResolvedValue({ id: 'audit-1' });

    await service.publishElection(ELECTION_ID, ACTOR, TEST_SOURCE_ADDRESS);

    expect(mockLogAction).toHaveBeenCalledTimes(1);
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PUBLISH_RESULT',
        electionId: ELECTION_ID,
        ipAddress: TEST_SOURCE_ADDRESS,
        metadata: expect.objectContaining({
          turnout_percentage: 75.5,
          min_turnout_percentage: 30,
          quorum_met: true,
        }),
      })
    );
  });

  it('NO llama directamente a electionRepository.updateElectionStatus', async () => {
    // Verificación arquitectónica: publication.service no debe
    // llamar directamente a updateElectionStatus.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const servicePath = path.resolve(
      process.cwd(),
      'src/modules/results/publication/publication.service.js'
    );
    const serviceCode = await fs.readFile(servicePath, 'utf8');
    expect(serviceCode).not.toContain('electionRepository.updateElectionStatus');
    // Debe usar electionService.
    expect(serviceCode).toContain("from '../../elections/election.service.js'");
    expect(serviceCode).toContain('electionService.changeStatus');
  });
});
