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

// POST /api/elections/:electionId/criteria
export const createCriterion = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const { name, weight, max_score } = req.body;
    const result = await ratingService.createCriterion({
      electionId,
      name,
      weight,
      maxScore: max_score,
      actor: getActor(req.user),
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// GET /api/elections/:electionId/criteria
export const getCriteria = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const result = await ratingService.getCriteria({ electionId });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// DELETE /api/elections/:electionId/criteria/:criterionId
export const removeCriterion = async (req, res, next) => {
  try {
    const { id, criterionId } = req.params;
    const result = await ratingService.removeCriterion({
      electionId: id,
      criterionId,
      actor: getActor(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// POST /api/elections/:electionId/ratings/:candidacyId
export const rateProject = async (req, res, next) => {
  try {
    const { id: electionId, candidacyId } = req.params;
    const { details, comment } = req.body;
    const result = await ratingService.rateProject({
      electionId,
      candidacyId,
      details,
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
    const { candidacyId, status, limit, offset } = req.query;
    const result = await ratingService.listRatings({
      electionId,
      candidacyId,
      status,
      limit,
      offset,
      actor: getActor(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// POST /api/elections/:electionId/ratings/:ratingId/revoke
export const revokeRating = async (req, res, next) => {
  try {
    const { id: electionId, ratingId } = req.params;
    const { reason } = req.body;
    const result = await ratingService.revokeRating({
      electionId,
      ratingId,
      reason,
      actor: getActor(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// POST /api/elections/:electionId/ratings/:ratingId/restore
export const restoreRating = async (req, res, next) => {
  try {
    const { id: electionId, ratingId } = req.params;
    const result = await ratingService.restoreRating({
      electionId,
      ratingId,
      actor: getActor(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};