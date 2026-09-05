// src/modules/objections/objection.controller.js
import * as objectionService from './objection.service.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

const getActor = (user) => ({
  id: getActorId(user) || user.id,
  role: user.role,
  organizationId: user.organizationId || null,
  isSuperAdmin: user.isSuperAdmin || false,
  isSuperuser: user.isSuperuser || false,
});

// POST /api/elections/:id/objections
export const fileObjection = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const { objection_type, candidate_list_id, candidacy_id, reason, evidence_urls } = req.body;
    const result = await objectionService.fileObjection({
      electionId,
      objectionType: objection_type,
      candidate_list_id,
      candidacy_id,
      reason,
      evidence_urls,
      actor: getActor(req.user),
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// GET /api/elections/:id/objections
export const listObjections = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const { status, objection_type, limit, offset } = req.query;
    const result = await objectionService.listObjections({
      electionId,
      status,
      objectionType: objection_type,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      actor: getActor(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// PUT /api/elections/:id/objections/:objectionId/resolve
export const resolveObjection = async (req, res, next) => {
  try {
    const { id, objectionId } = req.params;
    const { status, resolution_notes } = req.body;
    const result = await objectionService.resolveObjection({
      electionId: id,
      objectionId,
      status,
      resolution_notes,
      actor: getActor(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};