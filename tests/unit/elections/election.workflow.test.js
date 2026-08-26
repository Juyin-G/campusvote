import { jest } from '@jest/globals';

const mockFindElectionById = jest.fn();
const mockFindElectionStatus = jest.fn();
const mockListElections = jest.fn();
const mockCountElections = jest.fn();
const mockCreateElection = jest.fn();
const mockUpdateElection = jest.fn();
const mockUpdateElectionStatus = jest.fn();
const mockDeleteElectionById = jest.fn();
const mockCountPositionsByElection = jest.fn();
const mockCertifyElection = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/elections/election.repository.js',
  () => ({
    findElectionById: mockFindElectionById,
    findElectionStatus: mockFindElectionStatus,
    listElections: mockListElections,
    countElections: mockCountElections,
    createElection: mockCreateElection,
    updateElection: mockUpdateElection,
    updateElectionStatus: mockUpdateElectionStatus,
    deleteElectionById: mockDeleteElectionById,
    certifyElection: mockCertifyElection,
  })
);

// El conteo de cargos vive en el repository de positions (dominio propio)
jest.unstable_mockModule(
  '../../../src/modules/elections/position.repository.js',
  () => ({
    countPositionsByElection: mockCountPositionsByElection,
  })
);

const service = await import(
  '../../../src/modules/elections/election.service.js'
);

const ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const PERIODO = '11111111-2222-3333-4444-555555555555';
const ACTOR = '99999999-8888-7777-6666-555555555555';

const enElFuturo = (dias) =>
  new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('Election Service — Workflow de estados (S4-13)', () => {
  beforeEach(() => jest.clearAllMocks());

  const elegirEstado = (status, extra = {}) =>
    mockFindElectionStatus.mockResolvedValue({
      id: ID,
      status,
      start_at: new Date(enElFuturo(1)),
      end_at: new Date(enElFuturo(2)),
      ...extra,
    });

  it('DRAFT -> SCHEDULED funciona si hay cargos definidos', async () => {
    elegirEstado('DRAFT');
    mockCountPositionsByElection.mockResolvedValue(2);
    mockUpdateElectionStatus.mockResolvedValue({ id: ID, status: 'SCHEDULED' });

    const res = await service.changeStatus(ID, 'SCHEDULED');

    expect(mockUpdateElectionStatus).toHaveBeenCalledWith(ID, 'SCHEDULED');
    expect(res.status).toBe('SCHEDULED');
  });

  it('DRAFT -> SCHEDULED falla si la elección no tiene cargos (400)', async () => {
    elegirEstado('DRAFT');
    mockCountPositionsByElection.mockResolvedValue(0);

    const err = await capturarError(() => service.changeStatus(ID, 'SCHEDULED'));

    expect(err.statusCode).toBe(400);
    expect(mockUpdateElectionStatus).not.toHaveBeenCalled();
  });

  it('DRAFT -> SCHEDULED falla si la fecha de fin ya pasó (400)', async () => {
    elegirEstado('DRAFT', { end_at: new Date('2020-01-01T00:00:00Z') });
    mockCountPositionsByElection.mockResolvedValue(3);

    const err = await capturarError(() => service.changeStatus(ID, 'SCHEDULED'));

    expect(err.statusCode).toBe(400);
  });

  it('DRAFT -> OPEN es una transición no permitida (409)', async () => {
    elegirEstado('DRAFT');

    const err = await capturarError(() => service.changeStatus(ID, 'OPEN'));

    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('DRAFT');
    expect(mockUpdateElectionStatus).not.toHaveBeenCalled();
  });

  it('DRAFT -> PUBLISHED (saltarse todo el proceso) se bloquea', async () => {
    elegirEstado('DRAFT');

    const err = await capturarError(() => service.changeStatus(ID, 'PUBLISHED'));

    expect(err.statusCode).toBe(409);
  });

  it('pasar al mismo estado devuelve 409', async () => {
    elegirEstado('OPEN');

    const err = await capturarError(() => service.changeStatus(ID, 'OPEN'));

    expect(err.statusCode).toBe(409);
  });

  it('OPEN -> CLOSED funciona', async () => {
    elegirEstado('OPEN');
    mockUpdateElectionStatus.mockResolvedValue({ id: ID, status: 'CLOSED' });

    const res = await service.changeStatus(ID, 'CLOSED');

    expect(res.status).toBe('CLOSED');
  });

  it('CLOSED -> CERTIFIED delega en la función SQL certify_election', async () => {
    elegirEstado('CLOSED');
    mockCertifyElection.mockResolvedValue({ id: ID, status: 'CERTIFIED' });

    const res = await service.changeStatus(ID, 'CERTIFIED');

    expect(mockCertifyElection).toHaveBeenCalledWith(ID);
    expect(mockUpdateElectionStatus).not.toHaveBeenCalled();
    expect(res.status).toBe('CERTIFIED');
  });

  it('traduce el RAISE EXCEPTION de certify_election a 409', async () => {
    elegirEstado('CLOSED');
    mockCertifyElection.mockRejectedValue({
      meta: {
        message:
          'No se puede certificar una elección que no está CERRADA. Estado actual: OPEN',
      },
    });

    const err = await capturarError(() => service.changeStatus(ID, 'CERTIFIED'));

    expect(err.statusCode).toBe(409);
  });

  it('CERTIFIED -> PUBLISHED funciona', async () => {
    elegirEstado('CERTIFIED');
    mockUpdateElectionStatus.mockResolvedValue({ id: ID, status: 'PUBLISHED' });

    const res = await service.changeStatus(ID, 'PUBLISHED');

    expect(res.status).toBe('PUBLISHED');
  });

  it('PUBLISHED es estado final: no admite más transiciones', async () => {
    elegirEstado('PUBLISHED');

    const err = await capturarError(() => service.changeStatus(ID, 'CLOSED'));

    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('final');
  });

  it('cambiar el estado de una elección inexistente devuelve 404', async () => {
    mockFindElectionStatus.mockResolvedValue(null);

    const err = await capturarError(() => service.changeStatus(ID, 'SCHEDULED'));

    expect(err.statusCode).toBe(404);
  });

  it('el mapa de transiciones cubre la cadena completa', () => {
    expect(service.getAllowedTransitions('DRAFT')).toEqual(['SCHEDULED']);
    expect(service.getAllowedTransitions('SCHEDULED')).toEqual(['OPEN']);
    expect(service.getAllowedTransitions('OPEN')).toEqual(['CLOSED']);
    expect(service.getAllowedTransitions('CLOSED')).toEqual(['CERTIFIED']);
    expect(service.getAllowedTransitions('CERTIFIED')).toEqual(['PUBLISHED']);
    expect(service.getAllowedTransitions('PUBLISHED')).toEqual([]);
  });
});
