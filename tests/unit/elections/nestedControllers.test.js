import { jest } from '@jest/globals';

/**
 * Los cuatro controllers anidados comparten contrato: reciben electionId
 * desde la ruta padre (mergeParams) y lo pasan como primer argumento al
 * service. Aquí se comprueba ese enganche y los códigos de estado.
 */

const posSvc = {
  listPositions: jest.fn(),
  getPositionById: jest.fn(),
  createPosition: jest.fn(),
  updatePosition: jest.fn(),
  deletePosition: jest.fn(),
};
const listSvc = {
  listCandidateLists: jest.fn(),
  getCandidateListById: jest.fn(),
  createCandidateList: jest.fn(),
  updateCandidateList: jest.fn(),
  deleteCandidateList: jest.fn(),
};
const candSvc = {
  listCandidacies: jest.fn(),
  getCandidacyById: jest.fn(),
  createCandidacy: jest.fn(),
  updateCandidacy: jest.fn(),
  deleteCandidacy: jest.fn(),
};
const rulesSvc = {
  getRules: jest.fn(),
  createRules: jest.fn(),
  updateRules: jest.fn(),
  deleteRules: jest.fn(),
};

jest.unstable_mockModule(
  '../../../src/modules/elections/positions/position.service.js',
  () => posSvc
);
jest.unstable_mockModule(
  '../../../src/modules/elections/candidateList/candidateList.service.js',
  () => listSvc
);
jest.unstable_mockModule(
  '../../../src/modules/elections/candidacy/candidacy.service.js',
  () => candSvc
);
jest.unstable_mockModule(
  '../../../src/modules/elections/electionRules/electionRules.service.js',
  () => rulesSvc
);

jest.unstable_mockModule('../../../src/shared/utils/asyncHandler.js', () => ({
  default: (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  },
}));

const positionController = await import(
  '../../../src/modules/elections/positions/position.controller.js'
);
const candidateListController = await import(
  '../../../src/modules/elections/candidateList/candidateList.controller.js'
);
const candidacyController = await import(
  '../../../src/modules/elections/candidacy/candidacy.controller.js'
);
const rulesController = await import(
  '../../../src/modules/elections/electionRules/electionRules.controller.js'
);

const ELECCION = '3f0c2b1e-1c2d-4a5b-8c9d-0e1f2a3b4c5d';
const RECURSO = '7a2b9c4d-3e5f-4a6b-9c8d-1e2f3a4b5c6d';

let req;
let res;
let next;

beforeEach(() => {
  req = {
    body: {},
    params: { electionId: ELECCION, id: RECURSO },
    query: {},
    user: { userId: 'actor', role: 'ADMIN' },
    requestId: 'rid-1',
  };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  next = jest.fn();
  jest.clearAllMocks();
});

const cuerpo = () => res.json.mock.calls[0][0];

describe('Position Controller', () => {
  it('listar expone el total en meta y no pagina', async () => {
    posSvc.listPositions.mockResolvedValue({
      positions: [{ id: RECURSO }, { id: 'otro' }],
      total: 2,
    });

    await positionController.listPositions(req, res, next);

    expect(posSvc.listPositions).toHaveBeenCalledWith(ELECCION);
    expect(cuerpo().meta.total).toBe(2);
    expect(cuerpo().meta.pagination).toBeUndefined();
  });

  it('obtener pasa electionId e id en ese orden', async () => {
    posSvc.getPositionById.mockResolvedValue({ id: RECURSO });

    await positionController.getPositionById(req, res, next);

    expect(posSvc.getPositionById).toHaveBeenCalledWith(ELECCION, RECURSO);
  });

  it('crear responde 201', async () => {
    posSvc.createPosition.mockResolvedValue({ id: RECURSO });
    req.body = { name: 'Presidente' };

    await positionController.createPosition(req, res, next);

    expect(posSvc.createPosition).toHaveBeenCalledWith(ELECCION, req.body);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('actualizar pasa electionId, id y body', async () => {
    posSvc.updatePosition.mockResolvedValue({ id: RECURSO });
    req.body = { seats: 3 };

    await positionController.updatePosition(req, res, next);

    expect(posSvc.updatePosition).toHaveBeenCalledWith(ELECCION, RECURSO, {
      seats: 3,
    });
  });

  it('un 409 del service llega a next()', async () => {
    const err = Object.assign(new Error('tiene candidaturas'), {
      statusCode: 409,
    });
    posSvc.deletePosition.mockRejectedValue(err);

    await positionController.deletePosition(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('CandidateList Controller', () => {
  it('listar devuelve el total sin paginar', async () => {
    listSvc.listCandidateLists.mockResolvedValue({
      candidateLists: [{ id: RECURSO }],
      total: 1,
    });

    await candidateListController.listCandidateLists(req, res, next);

    expect(listSvc.listCandidateLists).toHaveBeenCalledWith(ELECCION);
    expect(cuerpo().meta.total).toBe(1);
  });

  it('crear responde 201', async () => {
    listSvc.createCandidateList.mockResolvedValue({ id: RECURSO });
    req.body = { name: 'Unidad' };

    await candidateListController.createCandidateList(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('eliminar devuelve el resultado del service', async () => {
    listSvc.deleteCandidateList.mockResolvedValue({ deleted: true });

    await candidateListController.deleteCandidateList(req, res, next);

    expect(listSvc.deleteCandidateList).toHaveBeenCalledWith(ELECCION, RECURSO);
    expect(cuerpo().data).toEqual({ deleted: true });
  });

  it('obtener pasa electionId e id', async () => {
    listSvc.getCandidateListById.mockResolvedValue({ id: RECURSO });

    await candidateListController.getCandidateListById(req, res, next);

    expect(listSvc.getCandidateListById).toHaveBeenCalledWith(ELECCION, RECURSO);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('actualizar pasa los tres argumentos', async () => {
    listSvc.updateCandidateList.mockResolvedValue({ id: RECURSO });
    req.body = { motto: 'Nuevo lema' };

    await candidateListController.updateCandidateList(req, res, next);

    expect(listSvc.updateCandidateList).toHaveBeenCalledWith(ELECCION, RECURSO, {
      motto: 'Nuevo lema',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('Candidacy Controller', () => {
  it('listar traslada los filtros de query al service', async () => {
    candSvc.listCandidacies.mockResolvedValue({ candidacies: [], total: 0 });
    req.query = { candidate_list_id: RECURSO };

    await candidacyController.listCandidacies(req, res, next);

    expect(candSvc.listCandidacies).toHaveBeenCalledWith(ELECCION, req.query);
    expect(cuerpo().meta.total).toBe(0);
  });

  it('crear responde 201 con el mensaje de candidato del sistema', async () => {
    candSvc.createCandidacy.mockResolvedValue({ id: RECURSO });
    req.body = { candidate_list_id: RECURSO, user_id: 'u1' };

    await candidacyController.createCandidacy(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(cuerpo().message).toContain('Candidato');
  });

  it('actualizar pasa los tres argumentos', async () => {
    candSvc.updateCandidacy.mockResolvedValue({ id: RECURSO });
    req.body = { order_index: 2 };

    await candidacyController.updateCandidacy(req, res, next);

    expect(candSvc.updateCandidacy).toHaveBeenCalledWith(ELECCION, RECURSO, {
      order_index: 2,
    });
  });

  it('obtener pasa electionId e id', async () => {
    candSvc.getCandidacyById.mockResolvedValue({ id: RECURSO });

    await candidacyController.getCandidacyById(req, res, next);

    expect(candSvc.getCandidacyById).toHaveBeenCalledWith(ELECCION, RECURSO);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('retirar una candidatura devuelve el resultado del service', async () => {
    candSvc.deleteCandidacy.mockResolvedValue({ deleted: true });

    await candidacyController.deleteCandidacy(req, res, next);

    expect(candSvc.deleteCandidacy).toHaveBeenCalledWith(ELECCION, RECURSO);
    expect(cuerpo().data).toEqual({ deleted: true });
  });
});

describe('ElectionRules Controller — recurso singular', () => {
  it('obtener solo necesita electionId (no hay :id propio)', async () => {
    rulesSvc.getRules.mockResolvedValue({ min_turnout_percentage: 0 });

    await rulesController.getRules(req, res, next);

    expect(rulesSvc.getRules).toHaveBeenCalledWith(ELECCION);
    expect(rulesSvc.getRules).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('crear responde 201', async () => {
    rulesSvc.createRules.mockResolvedValue({ id: 'r1' });
    req.body = { requires_2fa: false };

    await rulesController.createRules(req, res, next);

    expect(rulesSvc.createRules).toHaveBeenCalledWith(ELECCION, req.body);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('actualizar responde 200', async () => {
    rulesSvc.updateRules.mockResolvedValue({ id: 'r1' });
    req.body = { min_turnout_percentage: 50 };

    await rulesController.updateRules(req, res, next);

    expect(rulesSvc.updateRules).toHaveBeenCalledWith(ELECCION, req.body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('un 404 del service llega a next()', async () => {
    const err = Object.assign(new Error('sin reglas'), { statusCode: 404 });
    rulesSvc.deleteRules.mockRejectedValue(err);

    await rulesController.deleteRules(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
