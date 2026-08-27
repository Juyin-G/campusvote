// tests/unit/results/certification.service.test.js
// S7-12 — Tests del Servicio de Certificación.
//
// Verifica el flujo de certifyElection:
//   1. tallyService.recalculateTallies
//   2. electionService.changeStatus(id, 'CERTIFIED')
//   3. auditService.logAction (solo si los pasos anteriores pasan)

import { jest } from '@jest/globals';

const mockRecalculateTallies = jest.fn();
const mockChangeStatus = jest.fn();
const mockLogAction = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/results/tally/tally.service.js',
  () => ({
    recalculateTallies: mockRecalculateTallies,
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
  '../../../src/modules/results/certification/certification.service.js'
);

const ELECTION_ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const ACTOR = { userId: 'user-1' };

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('Certification Service — certifyElection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rechaza electionId vacío (400)', async () => {
    const err = await capturarError(() => service.certifyElection(''));
    expect(err.statusCode).toBe(400);
    expect(mockRecalculateTallies).not.toHaveBeenCalled();
    expect(mockChangeStatus).not.toHaveBeenCalled();
    expect(mockLogAction).not.toHaveBeenCalled();
  });

  it('ejecuta recalculateTallies ANTES de changeStatus', async () => {
    const callOrder = [];
    mockRecalculateTallies.mockImplementation(async () => {
      callOrder.push('tally');
      return { election_id: ELECTION_ID };
    });
    mockChangeStatus.mockImplementation(async () => {
      callOrder.push('changeStatus');
      return { id: ELECTION_ID, status: 'CERTIFIED' };
    });
    mockLogAction.mockImplementation(async () => {
      callOrder.push('audit');
      return { id: 'audit-1' };
    });

    await service.certifyElection(ELECTION_ID, ACTOR, '127.0.0.1');

    expect(callOrder).toEqual(['tally', 'changeStatus', 'audit']);
  });

  it('pasa "CERTIFIED" como targetStatus a changeStatus', async () => {
    mockRecalculateTallies.mockResolvedValue(undefined);
    mockChangeStatus.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockLogAction.mockResolvedValue({ id: 'audit-1' });

    await service.certifyElection(ELECTION_ID, ACTOR, '127.0.0.1');

    expect(mockChangeStatus).toHaveBeenCalledWith(ELECTION_ID, 'CERTIFIED');
  });

  it('NO certifica si recalculateTallies falla', async () => {
    mockRecalculateTallies.mockRejectedValue(new Error('tally fail'));

    const err = await capturarError(() =>
      service.certifyElection(ELECTION_ID, ACTOR, '127.0.0.1')
    );
    expect(err.message).toBe('tally fail');
    expect(mockChangeStatus).not.toHaveBeenCalled();
    expect(mockLogAction).not.toHaveBeenCalled();
  });

  it('NO registra audit si changeStatus falla', async () => {
    mockRecalculateTallies.mockResolvedValue(undefined);
    mockChangeStatus.mockRejectedValue(new Error('certify fail'));

    const err = await capturarError(() =>
      service.certifyElection(ELECTION_ID, ACTOR, '127.0.0.1')
    );
    expect(err.message).toBe('certify fail');
    expect(mockLogAction).not.toHaveBeenCalled();
  });

  it('propaga errores traducidos por election.service (ej. NOT_OPEN)', async () => {
    mockRecalculateTallies.mockResolvedValue(undefined);
    const apiError = new Error('Solo se puede certificar una elección CERRADA');
    apiError.statusCode = 409;
    mockChangeStatus.mockRejectedValue(apiError);

    const err = await capturarError(() =>
      service.certifyElection(ELECTION_ID, ACTOR, '127.0.0.1')
    );
    expect(err.statusCode).toBe(409);
    expect(mockLogAction).not.toHaveBeenCalled();
  });

  it('registra CERTIFY_RESULT tras éxito completo', async () => {
    mockRecalculateTallies.mockResolvedValue(undefined);
    mockChangeStatus.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockLogAction.mockResolvedValue({ id: 'audit-1' });

    await service.certifyElection(ELECTION_ID, ACTOR, '127.0.0.1');

    expect(mockLogAction).toHaveBeenCalledTimes(1);
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR.userId,
        electionId: ELECTION_ID,
        action: 'CERTIFY_RESULT',
        ipAddress: '127.0.0.1',
        metadata: expect.objectContaining({
          new_status: 'CERTIFIED',
          source: 'results.certification',
        }),
      })
    );
  });

  it('acepta actor sin userId (cae a null o al id legacy)', async () => {
    mockRecalculateTallies.mockResolvedValue(undefined);
    mockChangeStatus.mockResolvedValue({ id: ELECTION_ID, status: 'CERTIFIED' });
    mockLogAction.mockResolvedValue({ id: 'audit-1' });

    await service.certifyElection(ELECTION_ID, { id: 'legacy-id' }, null);

    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'legacy-id',
        ipAddress: null,
      })
    );
  });

  it('NO llama directamente a electionRepository.certifyElection', async () => {
    // Verificación arquitectónica: certification.service no debe
    // importar election.repository ni llamar a certifyElection directo.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const servicePath = path.resolve(
      process.cwd(),
      'src/modules/results/certification/certification.service.js'
    );
    const serviceCode = await fs.readFile(servicePath, 'utf8');
    expect(serviceCode).not.toContain("from '../../elections/election.repository.js'");
    expect(serviceCode).not.toContain('electionRepository.certifyElection');
    // Debe usar electionService.
    expect(serviceCode).toContain("from '../../elections/election.service.js'");
    expect(serviceCode).toContain('electionService.changeStatus');
  });
});
