// src/modules/ratings/juryAssignment.controller.js
import * as juryService from './juryAssignment.service.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

const getActor = (user) => ({
  id: getActorId(user) || user.id,
  role: user.role,
  organizationId: user.organizationId || null,
  isSuperAdmin: user.isSuperAdmin || false,
  isSuperuser: user.isSuperuser || false,
});

// POST /api/elections/:id/jury-assignments
export const assignJury = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const { jury_id, candidacy_id, is_diriment } = req.body;
    const result = await juryService.assignJury({
      electionId,
      juryId: jury_id,
      candidacyId: candidacy_id,
      isDiriment: is_diriment ?? false,
      actor: getActor(req.user),
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// GET /api/elections/:id/jury-assignments
export const listAssignments = async (req, res, next) => {
  try {
    const electionId = req.params.id;
    const { candidacyId, status } = req.query;
    const result = await juryService.listAssignments({
      electionId,
      candidacyId,
      status,
      actor: getActor(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// PUT /api/elections/:id/jury-assignments/:assignmentId/status
export const setAssignmentStatus = async (req, res, next) => {
  try {
    const { id, assignmentId } = req.params;
    const { status } = req.body;
    const result = await juryService.setAssignmentStatus({
      electionId: id,
      assignmentId,
      status,
      actor: getActor(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

// POST /api/elections/:id/jury-assignments/:assignmentId/declaration
export const signConflictDeclaration = async (req, res, next) => {
  try {
    const { id, assignmentId } = req.params;
    const result = await juryService.signConflictDeclaration({
      electionId: id,
      assignmentId,
      juryId: getActorId(req.user),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};