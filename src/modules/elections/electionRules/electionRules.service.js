// src/modules/elections/electionRules/electionRules.service.js
// S4-10 — Lógica de negocio de las reglas de una elección.

import * as electionRulesRepository from './electionRules.repository.js';
import * as electionRepository from '../elections/election.repository.js'; // Ajusta la ruta si es necesario
import { ApiError } from '../../../shared/errors/ApiError.js';
import MESSAGES from '../../../constants/messages.js';

const EDITABLE_STATUSES = ['DRAFT', 'SCHEDULED'];


const formatRules = (rules) => {
  if (!rules) return rules;

  return {
    id: rules.id,
    election_id: rules.electionId,
    min_turnout_percentage: Number(rules.minTurnoutPercentage ?? 0),
    allow_blank_vote: rules.allowBlankVote,
    allow_null_vote: rules.allowNullVote,
    max_votes_per_position: rules.maxVotesPerPosition,
    requires_2fa: rules.requires2fa,
    created_at: rules.createdAt,
    updated_at: rules.updatedAt,
  };
};

const translatePrismaError = (err) => {
  if (err?.code === 'P2002') {
    return ApiError.conflict('Esta elección ya tiene reglas configuradas');
  }
  if (err?.code === 'P2025') {
    return ApiError.notFound('Esta elección todavía no tiene reglas configuradas');
  }
  if (err?.code === 'P2003') {
    return ApiError.badRequest('La elección indicada no existe');
  }
  return err;
};

const requireElection = async (electionId) => {
  const election = await electionRepository.findElectionStatus(electionId);
  if (!election) throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  return election;
};

const requireDraftElection = async (electionId) => {
  const election = await requireElection(electionId);
  if (!EDITABLE_STATUSES.includes(election.status)) {
    throw ApiError.conflict(MESSAGES.ELECTION.DRAFT_ONLY_ACTION || 'Las reglas solo pueden modificarse en estado DRAFT o SCHEDULED');
  }
  return election;
};


const buildRulesData = (body = {}) => {
  const data = {};

  if (body.min_turnout_percentage !== undefined) {
    data.minTurnoutPercentage = Number(body.min_turnout_percentage);
  }
  if (body.allow_blank_vote !== undefined) {
    data.allowBlankVote = body.allow_blank_vote;
  }
  if (body.allow_null_vote !== undefined) {
    data.allowNullVote = body.allow_null_vote;
  }
  if (body.max_votes_per_position !== undefined) { 
    data.maxVotesPerPosition = Number(body.max_votes_per_position);
  }
  if (body.requires_2fa !== undefined) {
    data.requires2fa = body.requires_2fa; 
  }

  return data;
};

export const getRules = async (electionId) => {
  await requireElection(electionId);

  const rules = await electionRulesRepository.findRulesByElection(electionId);

  if (!rules) {
    throw ApiError.notFound('Esta elección todavía no tiene reglas configuradas');
  }

  return formatRules(rules);
};

export const createRules = async (electionId, body = {}) => {
  await requireDraftElection(electionId);

  const existentes = await electionRulesRepository.findRulesByElection(electionId);

  if (existentes) {
    throw ApiError.conflict(
      'Esta elección ya tiene reglas configuradas. Usa PATCH para modificarlas.'
    );
  }

  const data = { ...buildRulesData(body), electionId: electionId };

  try {
    const creadas = await electionRulesRepository.createRules(data);
    return formatRules(creadas);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const updateRules = async (electionId, body = {}) => {
  await requireDraftElection(electionId);

  const existentes = await electionRulesRepository.findRulesByElection(electionId);

  if (!existentes) {
    throw ApiError.notFound(
      'Esta elección todavía no tiene reglas configuradas. Créalas primero con POST.'
    );
  }

  const data = buildRulesData(body);

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }

  try {
    const actualizadas = await electionRulesRepository.updateRulesByElection(
      electionId,
      data
    );
    return formatRules(actualizadas);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const deleteRules = async (electionId) => {
  await requireDraftElection(electionId);

  const existentes = await electionRulesRepository.findRulesByElection(electionId);

  if (!existentes) {
    throw ApiError.notFound('Esta elección todavía no tiene reglas configuradas');
  }

  try {
    await electionRulesRepository.deleteRulesByElection(electionId);
    return { deleted: true };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export default {
  getRules,
  createRules,
  updateRules,
  deleteRules,
};