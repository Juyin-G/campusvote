import * as service from './jury.service.js';

const actor = (user) => ({ ...user, id: user.userId ?? user.id });

export const assign = async (req, res, next) => {
  try {
    const data = await service.assignJuror({ electionId: req.params.electionId, candidacyId: req.params.candidacyId, jurorId: req.body.jurorId, actor: actor(req.user) });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
};

export const list = async (req, res, next) => {
  try { res.json({ success: true, data: await service.listAssignments({ electionId: req.params.electionId, actor: actor(req.user) }) }); } catch (error) { next(error); }
};

export const revoke = async (req, res, next) => {
  try { res.json({ success: true, data: await service.revokeAssignment({ assignmentId: req.params.assignmentId, actor: actor(req.user) }) }); } catch (error) { next(error); }
};

export const conflict = async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await service.declareConflict({
      electionId: req.params.electionId, candidacyId: req.params.candidacyId,
      jurorId: req.user.userId ?? req.user.id, reason: req.body.reason, actor: actor(req.user),
    }) });
  } catch (error) { next(error); }
};

export const clearConflict = async (req, res, next) => {
  try { res.json({ success: true, data: await service.clearConflict({ conflictId: req.params.conflictId, actor: actor(req.user) }) }); } catch (error) { next(error); }
};
