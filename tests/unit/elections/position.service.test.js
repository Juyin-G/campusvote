import { jest } from '@jest/globals';

const mockFindPositionById = jest.fn();
const mockFindPositionsByElection = jest.fn();
const mockCountPositionsByElection = jest.fn();
const mockCreatePosition = jest.fn();
const mockUpdatePosition = jest.fn();
const mockDeletePositionById = jest.fn();
const mockCountCandidaciesByPosition = jest.fn();
const mockFindElectionStatus = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/elections/position.repository.js',
  () => ({
    findPositionById: mockFindPositionById,
    findPositionsByElection: mockFindPositionsByElection,
    countPositionsByElection: mockCountPositionsByElection,
    createPosition: mockCreatePosition,
    updatePosition: mockUpdatePosition,
    deletePositionById: mockDeletePositionById,
    countCandidaciesByPosition: mockCountCandidaciesByPosition,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/election.repository.js',
  () => ({
    findElectionStatus: mockFindElectionStatus,
  })
);

const service = await import(
  '../../../src/modules/elections/position.service.js'
);

const ELECCION = '11111111-1111-1111-1111-111111111111';
const OTRA_ELECCION = '22222222-2222-2222-2222-222222222222';
const CARGO = '33333333-3333-3333-3333-333333333333';

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

describe('Position Service — lectura', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listar devuelve 404 si la elección no existe', async () => {
    mockFindElectionStatus.mockResolvedValue(null);

    const err = await capturarError(() => service.listPositions(ELECCION));

    expect(err.statusCode).toBe(404);
    expect(mockFindPositionsByElection).not.toHaveBeenCalled();
  });

  it('listar devuelve los cargos con su total', async () => {
    eleccionEn('OPEN');
    mockFindPositionsByElection.mockResolvedValue([
      { id: CARGO, name: 'Presidente' },
      { id: 'otro', name: 'Secretario' },
    ]);

    const res = await service.listPositions(ELECCION);

    expect(res.total).toBe(2);
    expect(res.positions).toHaveLength(2);
  });

  it('obtener un cargo de OTRA elección devuelve 404', async () => {
    eleccionEn('DRAFT');
    mockFindPositionById.mockResolvedValue({
      id: CARGO,
      election_id: OTRA_ELECCION,
    });

    const err = await capturarError(() =>
      service.getPositionById(ELECCION, CARGO)
    );

    expect(err.statusCode).toBe(404);
  });

  it('obtener un cargo propio funciona', async () => {
    eleccionEn('DRAFT');
    mockFindPositionById.mockResolvedValue({
      id: CARGO,
      election_id: ELECCION,
      name: 'Presidente',
    });

    const res = await service.getPositionById(ELECCION, CARGO);

    expect(res.name).toBe('Presidente');
  });
});

describe('Position Service — escritura solo en DRAFT', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crear falla si la elección ya no es borrador (409)', async () => {
    eleccionEn('OPEN');

    const err = await capturarError(() =>
      service.createPosition(ELECCION, { name: 'Presidente' })
    );

    expect(err.statusCode).toBe(409);
    expect(mockCreatePosition).not.toHaveBeenCalled();
  });

  it('crear normaliza el nombre y adjunta election_id', async () => {
    eleccionEn('DRAFT');
    mockCreatePosition.mockResolvedValue({ id: CARGO });

    await service.createPosition(ELECCION, {
      name: '  Presidente  ',
      description: '   ',
      seats: '2',
    });

    const data = mockCreatePosition.mock.calls[0][0];
    expect(data.name).toBe('Presidente');
    expect(data.election_id).toBe(ELECCION);
    expect(data.description).toBeNull();
    expect(data.seats).toBe(2);
  });

  it('crear con nombre repetido en la misma elección devuelve 409', async () => {
    eleccionEn('DRAFT');
    mockCreatePosition.mockRejectedValue({ code: 'P2002' });

    const err = await capturarError(() =>
      service.createPosition(ELECCION, { name: 'Presidente' })
    );

    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('Ya existe un cargo');
  });

  it('actualizar falla si la elección ya no es borrador (409)', async () => {
    eleccionEn('SCHEDULED');

    const err = await capturarError(() =>
      service.updatePosition(ELECCION, CARGO, { seats: 3 })
    );

    expect(err.statusCode).toBe(409);
    expect(mockUpdatePosition).not.toHaveBeenCalled();
  });

  it('actualizar un cargo de otra elección devuelve 404', async () => {
    eleccionEn('DRAFT');
    mockFindPositionById.mockResolvedValue({
      id: CARGO,
      election_id: OTRA_ELECCION,
    });

    const err = await capturarError(() =>
      service.updatePosition(ELECCION, CARGO, { seats: 3 })
    );

    expect(err.statusCode).toBe(404);
    expect(mockUpdatePosition).not.toHaveBeenCalled();
  });

  it('actualizar funciona sobre un cargo propio en DRAFT', async () => {
    eleccionEn('DRAFT');
    mockFindPositionById.mockResolvedValue({
      id: CARGO,
      election_id: ELECCION,
    });
    mockUpdatePosition.mockResolvedValue({ id: CARGO, seats: 3 });

    const res = await service.updatePosition(ELECCION, CARGO, { seats: 3 });

    expect(mockUpdatePosition).toHaveBeenCalledWith(CARGO, { seats: 3 });
    expect(res.seats).toBe(3);
  });
});

describe('Position Service — borrado seguro', () => {
  beforeEach(() => jest.clearAllMocks());

  it('no borra un cargo que tiene candidaturas (409)', async () => {
    eleccionEn('DRAFT');
    mockFindPositionById.mockResolvedValue({
      id: CARGO,
      election_id: ELECCION,
    });
    mockCountCandidaciesByPosition.mockResolvedValue(3);

    const err = await capturarError(() =>
      service.deletePosition(ELECCION, CARGO)
    );

    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('3 candidatura');
    expect(mockDeletePositionById).not.toHaveBeenCalled();
  });

  it('borra el cargo si no tiene candidaturas', async () => {
    eleccionEn('DRAFT');
    mockFindPositionById.mockResolvedValue({
      id: CARGO,
      election_id: ELECCION,
    });
    mockCountCandidaciesByPosition.mockResolvedValue(0);
    mockDeletePositionById.mockResolvedValue({ id: CARGO });

    const res = await service.deletePosition(ELECCION, CARGO);

    expect(res).toEqual({ deleted: true });
    expect(mockDeletePositionById).toHaveBeenCalledWith(CARGO);
  });

  it('no borra si la elección ya no es borrador (409)', async () => {
    eleccionEn('CLOSED');

    const err = await capturarError(() =>
      service.deletePosition(ELECCION, CARGO)
    );

    expect(err.statusCode).toBe(409);
    expect(mockCountCandidaciesByPosition).not.toHaveBeenCalled();
  });
});
