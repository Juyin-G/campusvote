// src/modules/results/peru/peru.controller.js
import * as peruService from './peru.service.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

// POST /api/elections/:id/certify-weighted
export const certifyWeighted = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const options = req.body ?? {};
    const result = await peruService.certifyWeightedElection({
      electionId,
      actorId: getActorId(req.user),
      options,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// POST /api/elections/:id/finalize-fair
export const finalizeFair = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const result = await peruService.finalizeFairResults({ electionId });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};