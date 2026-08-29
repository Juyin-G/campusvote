import { jest } from '@jest/globals';
import { Prisma } from '@prisma/client';

const mockFindRulesByElection = jest.fn();
const mockCreateRules = jest.fn();
const mockUpdateRulesByElection = jest.fn();
const mockDeleteRulesByElection = jest.fn();
const mockFindElectionStatus = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/elections/electionRules/electionRules.repository.js',
  () => ({
    findRulesByElection: mockFindRulesByElection,
    createRules: mockCreateRules,
    updateRulesByElection: mockUpdateRulesByElection,
    deleteRulesByElection: mockDeleteRulesByElection,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/elections/election.repository.js',
  () => ({ findElectionStatus: mockFindElectionStatus })
);

const service = await import(
  '../../../src/modules/elections/electionRules/electionRules.service.js'
);

const ELECCION = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

const eleccionEn = (status) =>
  mockFindElectionStatus.mockResolvedValue({ id: ELECCION, status });

describe('ElectionRules Service — relación 1:1', () => {
  beforeEach(() => jest.clearAllMocks());

  it('obtener devuelve 404 si la elección no existe', async () => {
    mockFindElectionStatus.mockResolvedValue(null);

    const err = await capturarError(() => service.getRules(ELECCION));

    expect(err.statusCode).toBe(404);
    expect(mockFindRulesByElection).not.toHaveBeenCalled();
  });

  it('obtener devuelve 404 si la elección aún no tiene reglas', async () => {
    eleccionEn('DRAFT');
    mockFindRulesByElection.mockResolvedValue(null);

    const err = await capturarError(() => service.getRules(ELECCION));

    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('todavía no tiene reglas');
  });

  it('crear dos veces devuelve 409 (election_id es UNIQUE)', async () => {
    eleccionEn('DRAFT');
    mockFindRulesByElection.mockResolvedValue({ id: 'ya-existen' });

    const err = await capturarError(() => service.createRules(ELECCION, {}));

    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('PATCH');
    expect(mockCreateRules).not.toHaveBeenCalled();
  });

  it('actualizar sin reglas creadas devuelve 404 y sugiere POST', async () => {
    eleccionEn('DRAFT');
    mockFindRulesByElection.mockResolvedValue(null);

    const err = await capturarError(() =>
      service.updateRules(ELECCION, { requires_2fa: false })
    );

    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('POST');
  });
});

describe('ElectionRules Service — conversión de Decimal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('devuelve min_turnout_percentage como número, no como cadena', async () => {
    eleccionEn('OPEN');
    mockFindRulesByElection.mockResolvedValue({
      id: 'r1',
      electionId: ELECCION,
      minTurnoutPercentage: new Prisma.Decimal('12.50'),
      requires2fa: true,
    });

    const rules = await service.getRules(ELECCION);

    expect(typeof rules.min_turnout_percentage).toBe('number');
    expect(rules.min_turnout_percentage).toBe(12.5);
    // Sin conversión, JSON.stringify lo sacaría como "12.5" (cadena)
    expect(JSON.parse(JSON.stringify(rules)).min_turnout_percentage).toBe(12.5);
  });
});

describe('ElectionRules Service — escritura solo en DRAFT', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crear falla si la elección ya no es borrador (409)', async () => {
    eleccionEn('SCHEDULED');

    const err = await capturarError(() => service.createRules(ELECCION, {}));

    expect(err.statusCode).toBe(409);
    expect(mockCreateRules).not.toHaveBeenCalled();
  });

  it('crear adjunta election_id y respeta los defaults de la BD', async () => {
    eleccionEn('DRAFT');
    mockFindRulesByElection.mockResolvedValue(null);
    mockCreateRules.mockResolvedValue({
      id: 'r1',
      electionId: ELECCION,
      minTurnoutPercentage: new Prisma.Decimal('0'),
    });

    await service.createRules(ELECCION, { requires_2fa: false });

    const data = mockCreateRules.mock.calls[0][0];
    expect(data.electionId).toBe(ELECCION);
    expect(data.requires2fa).toBe(false);
    // Los no enviados no se mandan: los rellena el DEFAULT de la tabla
    expect(data.allowBlankVote).toBeUndefined();
    expect(data.minTurnoutPercentage).toBeUndefined();
  });

  it('actualizar convierte el quórum a número antes de guardar', async () => {
    eleccionEn('DRAFT');
    mockFindRulesByElection.mockResolvedValue({ id: 'r1' });
    mockUpdateRulesByElection.mockResolvedValue({
      id: 'r1',
      min_turnout_percentage: new Prisma.Decimal('33.33'),
    });

    await service.updateRules(ELECCION, { min_turnout_percentage: '33.33' });

    const data = mockUpdateRulesByElection.mock.calls[0][1];
    expect(data.minTurnoutPercentage).toBe(33.33);
  });

  it('eliminar falla si la elección ya no es borrador (409)', async () => {
    eleccionEn('CERTIFIED');

    const err = await capturarError(() => service.deleteRules(ELECCION));

    expect(err.statusCode).toBe(409);
    expect(mockDeleteRulesByElection).not.toHaveBeenCalled();
  });

  it('eliminar funciona con reglas existentes en DRAFT', async () => {
    eleccionEn('DRAFT');
    mockFindRulesByElection.mockResolvedValue({ id: 'r1' });
    mockDeleteRulesByElection.mockResolvedValue({ id: 'r1' });

    const res = await service.deleteRules(ELECCION);

    expect(res).toEqual({ deleted: true });
  });
});
