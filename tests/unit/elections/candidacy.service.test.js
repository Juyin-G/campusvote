import { jest } from '@jest/globals';

const mockFindCandidacyById = jest.fn();
const mockFindCandidaciesByElection = jest.fn();
const mockFindCandidacyByElectionAndUser = jest.fn();
const mockCreateCandidacy = jest.fn();
const mockUpdateCandidacy = jest.fn();
const mockDeleteCandidacyById = jest.fn();
const mockFindCandidateListById = jest.fn();
const mockFindPositionById = jest.fn();
const mockFindElectionStatus = jest.fn();
const mockFindUserById = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/elections/candidacy/candidacy.repository.js',
  () => ({
    findCandidacyById: mockFindCandidacyById,
    findCandidaciesByElection: mockFindCandidaciesByElection,
    findCandidacyByElectionAndUser: mockFindCandidacyByElectionAndUser,
    countCandidaciesByElection: jest.fn(),
    createCandidacy: mockCreateCandidacy,
    updateCandidacy: mockUpdateCandidacy,
    deleteCandidacyById: mockDeleteCandidacyById,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/candidateList/candidateList.repository.js',
  () => ({ findCandidateListById: mockFindCandidateListById })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/positions/position.repository.js',
  () => ({ findPositionById: mockFindPositionById })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/elections/election.repository.js',
  () => ({ findElectionStatus: mockFindElectionStatus })
);

jest.unstable_mockModule('../../../src/modules/users/user.repository.js', () => ({
  findById: mockFindUserById,
}));

const service = await import(
  '../../../src/modules/elections/candidacy/candidacy.service.js'
);

const ELECCION = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const OTRA_ELECCION = '7a2b9c4d-3e5f-4a6b-9c8d-1e2f3a4b5c6d';
const LISTA = '5d4c3b2a-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
const CARGO = '9c8d7e6f-5a4b-4c3d-8e9f-0a1b2c3d4e5f';
const USUARIO = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const CANDIDATURA = '8e7d6c5b-4a3b-4c2d-9e8f-7a6b5c4d3e2f';

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

const escenarioValido = () => {
  mockFindElectionStatus.mockResolvedValue({ id: ELECCION, status: 'DRAFT' });
  mockFindCandidateListById.mockResolvedValue({
    id: LISTA,
    electionId: ELECCION,
  });
  mockFindPositionById.mockResolvedValue({ id: CARGO, electionId: ELECCION });
  mockFindUserById.mockResolvedValue({ id: USUARIO, status: 'ACTIVE' });
  mockFindCandidacyByElectionAndUser.mockResolvedValue(null);
  mockCreateCandidacy.mockResolvedValue({ id: CANDIDATURA, user: null });
};

const cuerpoValido = {
  candidate_list_id: LISTA,
  user_id: USUARIO,
  position_id: CARGO,
};

describe('Candidacy Service — validaciones cruzadas al crear', () => {
  beforeEach(() => jest.clearAllMocks());

  it('envía ambas columnas de la FK compuesta (election_id + candidate_list_id)', async () => {
    escenarioValido();

    await service.createCandidacy(ELECCION, cuerpoValido);

    const data = mockCreateCandidacy.mock.calls[0][0];
    expect(data.electionId).toBe(ELECCION);
    expect(data.candidateListId).toBe(LISTA);
    expect(data.userId).toBe(USUARIO);
    expect(data.positionId).toBe(CARGO);
  });

  it('rechaza una lista que pertenece a OTRA elección (400)', async () => {
    escenarioValido();
    mockFindCandidateListById.mockResolvedValue({
      id: LISTA,
      election_id: OTRA_ELECCION,
    });

    const err = await capturarError(() =>
      service.createCandidacy(ELECCION, cuerpoValido)
    );

    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('lista candidata');
    expect(mockCreateCandidacy).not.toHaveBeenCalled();
  });

  it('rechaza un cargo que pertenece a OTRA elección (400)', async () => {
    escenarioValido();
    mockFindPositionById.mockResolvedValue({
      id: CARGO,
      election_id: OTRA_ELECCION,
    });

    const err = await capturarError(() =>
      service.createCandidacy(ELECCION, cuerpoValido)
    );

    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('cargo');
  });

  it('rechaza un usuario inexistente (400)', async () => {
    escenarioValido();
    mockFindUserById.mockResolvedValue(null);

    const err = await capturarError(() =>
      service.createCandidacy(ELECCION, cuerpoValido)
    );

    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('no existe');
  });

  it('rechaza un usuario con la cuenta inactiva (400)', async () => {
    escenarioValido();
    mockFindUserById.mockResolvedValue({ id: USUARIO, status: 'SUSPENDED' });

    const err = await capturarError(() =>
      service.createCandidacy(ELECCION, cuerpoValido)
    );

    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('inactiva');
  });

  it('permite candidatura sin cargo asignado (position_id null)', async () => {
    escenarioValido();

    await service.createCandidacy(ELECCION, {
      candidate_list_id: LISTA,
      user_id: USUARIO,
    });

    expect(mockFindPositionById).not.toHaveBeenCalled();
    expect(mockCreateCandidacy.mock.calls[0][0].positionId).toBeNull();
  });

  it('no permite crear con la elección fuera de DRAFT (409)', async () => {
    escenarioValido();
    mockFindElectionStatus.mockResolvedValue({ id: ELECCION, status: 'OPEN' });

    const err = await capturarError(() =>
      service.createCandidacy(ELECCION, cuerpoValido)
    );

    expect(err.statusCode).toBe(409);
  });
});

describe('Candidacy Service — restricciones UNIQUE', () => {
  beforeEach(() => jest.clearAllMocks());

  it('bloquea al usuario que ya es candidato en la elección (409)', async () => {
    escenarioValido();
    mockFindCandidacyByElectionAndUser.mockResolvedValue({
      id: 'otra',
      candidate_list_id: 'otra-lista',
    });

    const err = await capturarError(() =>
      service.createCandidacy(ELECCION, cuerpoValido)
    );

    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('candidato');
    expect(mockCreateCandidacy).not.toHaveBeenCalled();
  });

  it('distingue el choque de uq_candidacies_position_user', async () => {
    escenarioValido();
    mockCreateCandidacy.mockRejectedValue({
      code: 'P2002',
      meta: { target: 'uq_candidacies_position_user' },
    });

    const err = await capturarError(() =>
      service.createCandidacy(ELECCION, cuerpoValido)
    );

    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('duplicidad');
  });

  it('distingue el choque de uq_candidacies_election_user', async () => {
    escenarioValido();
    mockCreateCandidacy.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['election_id', 'user_id'] },
    });

    const err = await capturarError(() =>
      service.createCandidacy(ELECCION, cuerpoValido)
    );

    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('duplicidad');
  });

  it('traduce el fallo de la FK compuesta (P2003) a 400', async () => {
    escenarioValido();
    mockCreateCandidacy.mockRejectedValue({ code: 'P2003' });

    const err = await capturarError(() =>
      service.createCandidacy(ELECCION, cuerpoValido)
    );

    expect(err.statusCode).toBe(400);
  });
});

describe('Candidacy Service — lectura y formato', () => {
  beforeEach(() => jest.clearAllMocks());

  it('convierte los datos del usuario a snake_case', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ELECCION, status: 'OPEN' });
    mockFindCandidaciesByElection.mockResolvedValue([
      {
        id: CANDIDATURA,
        election_id: ELECCION,
        user_id: USUARIO,
        user: {
          id: USUARIO,
          username: 'jgarcia',
          firstName: 'Juyin',
          lastName: 'García',
          institutionalId: '20260001',
        },
      },
    ]);

    const res = await service.listCandidacies(ELECCION, {});

    expect(res.total).toBe(1);
    expect(res.candidacies[0].user).toEqual({
      id: USUARIO,
      username: 'jgarcia',
      first_name: 'Juyin',
      last_name: 'García',
      institutional_id: '20260001',
    });
    expect(res.candidacies[0].user.firstName).toBeUndefined();
  });

  it('obtener una candidatura de otra elección devuelve 404', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ELECCION, status: 'DRAFT' });
    mockFindCandidacyById.mockResolvedValue({
      id: CANDIDATURA,
      election_id: OTRA_ELECCION,
    });

    const err = await capturarError(() =>
      service.getCandidacyById(ELECCION, CANDIDATURA)
    );

    expect(err.statusCode).toBe(404);
  });

  it('no permite eliminar con la elección fuera de DRAFT (409)', async () => {
    mockFindElectionStatus.mockResolvedValue({ id: ELECCION, status: 'CLOSED' });

    const err = await capturarError(() =>
      service.deleteCandidacy(ELECCION, CANDIDATURA)
    );

    expect(err.statusCode).toBe(409);
    expect(mockDeleteCandidacyById).not.toHaveBeenCalled();
  });
});
