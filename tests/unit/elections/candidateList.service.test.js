// tests/unit/elections/candidateList.service.test.js
import { jest } from '@jest/globals';

// 1. Definir mocks como variables para controlar su comportamiento por prueba
const mockFindElectionStatus = jest.fn();
const mockCount = jest.fn();
const mockList = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockCountCandidacies = jest.fn();
const mockFindById = jest.fn();

// 2. Aplicar mocks a los módulos antes de importar el servicio
jest.unstable_mockModule(
  '../../../src/modules/elections/elections/election.repository.js',
  () => ({ findElectionStatus: mockFindElectionStatus })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/candidateList/candidateList.repository.js',
  () => ({
    count: mockCount,
    list: mockList,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    countCandidaciesByList: mockCountCandidacies,
    findCandidateListById: mockFindById,
  })
);

// 3. Importar el servicio (se resuelve después de mockear)
const service = await import('../../../src/modules/elections/candidateList/candidateList.crud.service.js');

const ELEC_ID = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const LIST_ID = '5d4c3b2a-1e2f-4a5b-8c9d-0e1f2a3b4c5d';

// Helper para verificar errores de forma concisa
const expectError = async (fn, statusCode, messageSnippet) => {
  try {
    await fn();
    throw new Error('Se esperaba un error, pero resolvió correctamente.');
  } catch (err) {
    expect(err.statusCode).toBe(statusCode);
    if (messageSnippet) expect(err.message).toContain(messageSnippet);
    return err;
  }
};

describe('CandidateList CRUD Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Valor por defecto: elección válida y en estado editable
    mockFindElectionStatus.mockResolvedValue({ id: ELEC_ID, status: 'DRAFT' });
  });

  describe('Lectura', () => {
    it('devuelve 404 si la elección no existe', async () => {
      mockFindElectionStatus.mockResolvedValue(null);

      await expectError(() => service.listCandidateLists(ELEC_ID), 404);
      expect(mockList).not.toHaveBeenCalled();
    });

    it('lista las candidaturas con paginación correcta', async () => {
      const lists = [{ id: LIST_ID, name: 'Unidad Estudiantil' }];
      mockCount.mockResolvedValue(1);
      mockList.mockResolvedValue(lists);

      const res = await service.listCandidateLists(ELEC_ID, { page: 1, limit: 10 });

      expect(res.data).toEqual(lists);
      expect(res.pagination.total).toBe(1);
      expect(mockCount).toHaveBeenCalledWith({ electionId: ELEC_ID });
    });
  });

  describe('Escritura y Normalización', () => {
    it('convierte strings vacíos en null y limpia espacios', async () => {
      mockCreate.mockResolvedValue({ id: LIST_ID });

      await service.createCandidateList(ELEC_ID, {
        name: '  Unidad Estudiantil  ',
        acronym: '   ',
        motto: '',
        logo: '  https://cdn/logo.png  ',
      });

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Unidad Estudiantil',
        acronym: null,
        motto: null,
        logo: 'https://cdn/logo.png',
        electionId: ELEC_ID,
      }));
    });

    it('rechaza creación si la elección no está en DRAFT o SCHEDULED (409)', async () => {
      mockFindElectionStatus.mockResolvedValue({ id: ELEC_ID, status: 'OPEN' });

      await expectError(() => service.createCandidateList(ELEC_ID, { name: 'Unidad' }), 409, 'BORRADOR');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('traduce errores de unicidad de Prisma a 409', async () => {
      mockCreate.mockRejectedValue({ code: 'P2002' });

      await expectError(() => service.createCandidateList(ELEC_ID, { name: 'Unidad' }), 409, 'Ya existe');
    });
  });

  describe('Borrado Seguro', () => {
    it('no borra una lista con candidaturas (409)', async () => {
      mockFindById.mockResolvedValue({ id: LIST_ID, electionId: ELEC_ID });
      mockCountCandidacies.mockResolvedValue(5);

      await expectError(() => service.deleteCandidateList(ELEC_ID, LIST_ID), 409, 'candidatura');
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('borra la lista si está vacía', async () => {
      mockFindById.mockResolvedValue({ id: LIST_ID, electionId: ELEC_ID });
      mockCountCandidacies.mockResolvedValue(0);
      mockDelete.mockResolvedValue(true);

      const res = await service.deleteCandidateList(ELEC_ID, LIST_ID);

      expect(res).toEqual({ deleted: true, id: LIST_ID });
      expect(mockDelete).toHaveBeenCalledWith(LIST_ID);
    });
  });
});