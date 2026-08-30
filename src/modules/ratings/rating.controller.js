// src/modules/ratings/rating.controller.js
import * as ratingService from './rating.service.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

const getActor = (user) => ({
  id: getActorId(user) || user.id,
  role: user.role,
  organizationId: user.organizationId || null,
  isSuperAdmin: user.isSuperAdmin || false,
  isSuperuser: user.isSuperuser || false,
});

// POST /api/elections/:electionId/ratings/:candidacyId
export const rateProject = async (req, res, next) => {
  try {
    const { electionId, candidacyId } = req.params;
    const { score, comment } = req.body;
    const result = await ratingService.rateProject({
      electionId,
      candidacyId,
      score,
      comment,
      actor: getActor(req.user),
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// GET /api/elections/:electionId/ratings/results
export const getRatingResults = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const result = await ratingService.getRatingResults({
      electionId,
      actor: getActor(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// GET /api/elections/:electionId/ratings
export const listRatings = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const { candidacyId, limit, offset } = req.query;
    const result = await ratingService.listRatings({
      electionId,
      candidacyId,
      limit,
      offset,
      actor: getActor(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};
