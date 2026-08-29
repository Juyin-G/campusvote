import { jest } from '@jest/globals';

const mockFindCandidateListById = jest.fn();
const mockFindCandidateListsByElection = jest.fn();
const mockCountCandidateListsByElection = jest.fn();
const mockCreateCandidateList = jest.fn();
const mockUpdateCandidateList = jest.fn();
const mockDeleteCandidateListById = jest.fn();
const mockCountCandidaciesByList = jest.fn();
const mockFindElectionStatus = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/elections/candidateList/candidateList.repository.js',
  () => ({
    findCandidateListById: mockFindCandidateListById,
    findCandidateListsByElection: mockFindCandidateListsByElection,
    countCandidateListsByElection: mockCountCandidateListsByElection,
    createCandidateList: mockCreateCandidateList,
    updateCandidateList: mockUpdateCandidateList,
    deleteCandidateListById: mockDeleteCandidateListById,
    countCandidaciesByList: mockCountCandidaciesByList,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/elections/election.repository.js',
  () => ({
    findElectionStatus: mockFindElectionStatus,
  })
);

const service = await import(
  '../../../src/modules/elections/candidateList/candidateList.service.js'
);

const ELECCION = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const OTRA_ELECCION = '7a2b9c4d-3e5f-4a6b-9c8d-1e2f3a4b5c6d';
const LISTA = '5d4c3b2a-1e2f-4a5b-8c9d-0e1f2a3b4c5d';

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

describe('CandidateList Service — lectura y pertenencia', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listar devuelve 404 si la elección no existe', async () => {
    mockFindElectionStatus.mockResolvedValue(null);

    const err = await capturarError(() => service.listCandidateLists(ELECCION));

    expect(err.statusCode).toBe(404);
    expect(mockFindCandidateListsByElection).not.toHaveBeenCalled();
  });

  it('listar devuelve las listas con su total', async () => {
    eleccionEn('OPEN');
    mockFindCandidateListsByElection.mockResolvedValue([
      { id: LISTA, name: 'Unidad Estudiantil' },
      { id: 'otra', name: 'Fuerza Joven' },
    ]);

    const res = await service.listCandidateLists(ELECCION);

    expect(res.total).toBe(2);
    expect(res.candidateLists).toHaveLength(2);
  });

  it('obtener una lista de OTRA elección devuelve 404', async () => {
    eleccionEn('DRAFT');
    mockFindCandidateListById.mockResolvedValue({
      id: LISTA,
      electionId: OTRA_ELECCION,
    });

    const err = await capturarError(() =>
      service.getCandidateListById(ELECCION, LISTA)
    );

    expect(err.statusCode).toBe(404);
  });
});

describe('CandidateList Service — normalización de campos opcionales', () => {
  beforeEach(() => jest.clearAllMocks());

  it('convierte acronym y motto vacíos a null (la BD rechaza cadena vacía)', async () => {
    eleccionEn('DRAFT');
    mockCreateCandidateList.mockResolvedValue({ id: LISTA });

    await service.createCandidateList(ELECCION, {
      name: '  Unidad Estudiantil  ',
      acronym: '   ',
      motto: '',
      logo: '  https://cdn/logo.png  ',
    });

    const data = mockCreateCandidateList.mock.calls[0][0];
    expect(data.name).toBe('Unidad Estudiantil');
    expect(data.acronym).toBeNull();
    expect(data.motto).toBeNull();
    expect(data.logo).toBe('https://cdn/logo.png');
    expect(data.electionId).toBe(ELECCION);
  });

  it('conserva acronym y motto cuando traen contenido', async () => {
    eleccionEn('DRAFT');
    mockCreateCandidateList.mockResolvedValue({ id: LISTA });

    await service.createCandidateList(ELECCION, {
      name: 'Fuerza Joven',
      acronym: 'FJ',
      motto: 'Por un campus mejor',
    });

    const data = mockCreateCandidateList.mock.calls[0][0];
    expect(data.acronym).toBe('FJ');
    expect(data.motto).toBe('Por un campus mejor');
  });

  it('permite limpiar un campo enviando null explícito', async () => {
    eleccionEn('DRAFT');
    mockFindCandidateListById.mockResolvedValue({
      id: LISTA,
      electionId: ELECCION,
    });
    mockUpdateCandidateList.mockResolvedValue({ id: LISTA });

    await service.updateCandidateList(ELECCION, LISTA, { motto: null });

    expect(mockUpdateCandidateList).toHaveBeenCalledWith(LISTA, { motto: null });
  });
});

describe('CandidateList Service — escritura solo en DRAFT', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crear falla si la elección ya no es borrador (409)', async () => {
    eleccionEn('OPEN');

    const err = await capturarError(() =>
      service.createCandidateList(ELECCION, { name: 'Unidad' })
    );

    expect(err.statusCode).toBe(409);
    expect(mockCreateCandidateList).not.toHaveBeenCalled();
  });

  it('crear con nombre repetido en la elección devuelve 409', async () => {
    eleccionEn('DRAFT');
    mockCreateCandidateList.mockRejectedValue({ code: 'P2002' });

    const err = await capturarError(() =>
      service.createCandidateList(ELECCION, { name: 'Unidad' })
    );

    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('Ya existe una lista');
  });

  it('actualizar una lista de otra elección devuelve 404', async () => {
    eleccionEn('DRAFT');
    mockFindCandidateListById.mockResolvedValue({
      id: LISTA,
      electionId: OTRA_ELECCION,
    });

    const err = await capturarError(() =>
      service.updateCandidateList(ELECCION, LISTA, { name: 'Otra' })
    );

    expect(err.statusCode).toBe(404);
    expect(mockUpdateCandidateList).not.toHaveBeenCalled();
  });
});

describe('CandidateList Service — borrado seguro', () => {
  beforeEach(() => jest.clearAllMocks());

  it('no borra una lista con candidaturas (409)', async () => {
    eleccionEn('DRAFT');
    mockFindCandidateListById.mockResolvedValue({
      id: LISTA,
      electionId: ELECCION,
    });
    mockCountCandidaciesByList.mockResolvedValue(5);

    const err = await capturarError(() =>
      service.deleteCandidateList(ELECCION, LISTA)
    );

    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('5 candidatura');
    expect(mockDeleteCandidateListById).not.toHaveBeenCalled();
  });

  it('borra la lista si está vacía', async () => {
    eleccionEn('DRAFT');
    mockFindCandidateListById.mockResolvedValue({
      id: LISTA,
      electionId: ELECCION,
    });
    mockCountCandidaciesByList.mockResolvedValue(0);
    mockDeleteCandidateListById.mockResolvedValue({ id: LISTA });

    const res = await service.deleteCandidateList(ELECCION, LISTA);

    expect(res).toEqual({ deleted: true });
  });
});
