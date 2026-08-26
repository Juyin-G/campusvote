import { jest } from '@jest/globals';

const mockFindBallotOptionById = jest.fn();
const mockFindBallotOptionsByPosition = jest.fn();
const mockCreateBallotOption = jest.fn();
const mockUpdateBallotOption = jest.fn();
const mockDeleteBallotOptionById = jest.fn();
const mockFindByPositionAndCandidateList = jest.fn();
const mockFindSpecialOptionByType = jest.fn();

const mockFindBallotPositionById = jest.fn();
const mockFindBallotById = jest.fn();
const mockFindCandidateListById = jest.fn();

jest.unstable_mockModule(
  '../../../src/modules/ballots/ballotOption.repository.js',
  () => ({
    findBallotOptionById: mockFindBallotOptionById,
    findBallotOptionsByPosition: mockFindBallotOptionsByPosition,
    createBallotOption: mockCreateBallotOption,
    updateBallotOption: mockUpdateBallotOption,
    deleteBallotOptionById: mockDeleteBallotOptionById,
    findByPositionAndCandidateList:
      mockFindByPositionAndCandidateList,
    findSpecialOptionByType:
      mockFindSpecialOptionByType,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/ballots/ballotPosition.repository.js',
  () => ({
    findBallotPositionById:
      mockFindBallotPositionById,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/ballots/ballot.repository.js',
  () => ({
    findBallotById: mockFindBallotById,
  })
);

jest.unstable_mockModule(
  '../../../src/modules/elections/candidateList.repository.js',
  () => ({
    findCandidateListById:
      mockFindCandidateListById,
  })
);

const service = await import(
  '../../../src/modules/ballots/ballotOption.service.js'
);

const BP = '11111111-1111-1111-1111-111111111111';
const OPTION = '22222222-2222-2222-2222-222222222222';
const BALLOT = '33333333-3333-3333-3333-333333333333';
const LIST = '44444444-4444-4444-4444-444444444444';
const ELECTION = '55555555-5555-5555-5555-555555555555';

const capturarError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

describe('BallotOption Service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crear CANDIDATE_LIST exige candidate_list_id', async () => {
    mockFindBallotPositionById.mockResolvedValue({
      id: BP,
      ballot_id: BALLOT,
    });

    const err = await capturarError(() =>
      service.createBallotOption(BP, {
        option_type: 'CANDIDATE_LIST',
        label: 'Lista A',
      })
    );

    expect(err.statusCode).toBe(400);
  });

  it('BLANK no acepta candidate_list_id', async () => {
    mockFindBallotPositionById.mockResolvedValue({
      id: BP,
      ballot_id: BALLOT,
    });

    const err = await capturarError(() =>
      service.createBallotOption(BP, {
        option_type: 'BLANK',
        candidate_list_id: LIST,
        label: 'Blanco',
      })
    );

    expect(err.statusCode).toBe(400);
  });

  it('no permite BLANK duplicado', async () => {
    mockFindBallotPositionById.mockResolvedValue({
      id: BP,
      ballot_id: BALLOT,
    });

    mockFindSpecialOptionByType.mockResolvedValue({
      id: OPTION,
    });

    const err = await capturarError(() =>
      service.createBallotOption(BP, {
        option_type: 'BLANK',
        label: 'Blanco',
      })
    );

    expect(err.statusCode).toBe(409);
  });

  it('no permite NULL duplicado', async () => {
    mockFindBallotPositionById.mockResolvedValue({
      id: BP,
      ballot_id: BALLOT,
    });

    mockFindSpecialOptionByType.mockResolvedValue({
      id: OPTION,
    });

    const err = await capturarError(() =>
      service.createBallotOption(BP, {
        option_type: 'NULL',
        label: 'Nulo',
      })
    );

    expect(err.statusCode).toBe(409);
  });

  it('no permite lista candidata repetida', async () => {
    mockFindBallotPositionById.mockResolvedValue({
      id: BP,
      ballot_id: BALLOT,
    });

    mockFindBallotById.mockResolvedValue({
      id: BALLOT,
      election_id: ELECTION,
    });

    mockFindCandidateListById.mockResolvedValue({
      id: LIST,
      election_id: ELECTION,
    });

    mockFindByPositionAndCandidateList.mockResolvedValue({
      id: OPTION,
    });

    const err = await capturarError(() =>
      service.createBallotOption(BP, {
        option_type: 'CANDIDATE_LIST',
        candidate_list_id: LIST,
        label: 'Lista A',
      })
    );

    expect(err.statusCode).toBe(409);
  });

  it('crea opción CANDIDATE_LIST válida', async () => {
    mockFindBallotPositionById.mockResolvedValue({
      id: BP,
      ballot_id: BALLOT,
    });

    mockFindBallotById.mockResolvedValue({
      id: BALLOT,
      election_id: ELECTION,
    });

    mockFindCandidateListById.mockResolvedValue({
      id: LIST,
      election_id: ELECTION,
    });

    mockFindByPositionAndCandidateList.mockResolvedValue(
      null
    );

    mockCreateBallotOption.mockResolvedValue({
      id: OPTION,
    });

    await service.createBallotOption(BP, {
      option_type: 'CANDIDATE_LIST',
      candidate_list_id: LIST,
      label: '  Lista A  ',
    });

    expect(
      mockCreateBallotOption
    ).toHaveBeenCalledWith({
      ballot_position_id: BP,
      option_type: 'CANDIDATE_LIST',
      candidate_list_id: LIST,
      label: 'Lista A',
    });
  });
});