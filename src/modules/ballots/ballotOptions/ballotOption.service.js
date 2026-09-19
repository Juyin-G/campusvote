// src/modules/ballots/ballotOptions/ballotOption.service.js
// Orquestador del módulo ballotOption. Re-exporta la API pública.

export { listBallotOptions, getBallotOptionById } from './ballotOption.read.service.js';
export {
  createBallotOption,
  updateBallotOption,
  deleteBallotOption,
} from './ballotOption.mutations.service.js';

import { listBallotOptions, getBallotOptionById } from './ballotOption.read.service.js';
import {
  createBallotOption,
  updateBallotOption,
  deleteBallotOption,
} from './ballotOption.mutations.service.js';

export default {
  listBallotOptions,
  getBallotOptionById,
  createBallotOption,
  updateBallotOption,
  deleteBallotOption,
};
