// src/modules/elections/electionRules.service.js
// S4-10 — Lógica de negocio de las reglas de una elección.
//
// Relación 1:1 con `elections` (election_id es UNIQUE), así que no es un
// CRUD de colección: cada elección tiene como mucho un juego de reglas.

import * as electionRulesRepository from './electionRules.repository.js';
import * as electionRepository from './election.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import MESSAGES from '../../constants/messages.js';

/** Las reglas condicionan la votación: solo se tocan en borrador. */
const EDITABLE_STATUSES = ['DRAFT'];

/**
 * min_turnout_percentage es NUMERIC(5,2): Prisma lo entrega como objeto
 * Decimal, que en JSON saldría como cadena ("12.5"). Se convierte a número
 * para que la API devuelva un tipo coherente.
 */
const formatRules = (rules) => {
  if (!rules) return rules;

  return {
    ...rules,
    min_turnout_percentage: Number(rules.min_turnout_percentage),
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
    throw ApiError.conflict(MESSAGES.ELECTION.DRAFT_ONLY_ACTION);
  }

  return election;
};

/** Solo copia los campos presentes; el resto lo cubren los DEFAULT de la BD. */
const buildRulesData = (body = {}) => {
  const data = {};

  if (body.min_turnout_percentage !== undefined) {
    data.min_turnout_percentage = Number(body.min_turnout_percentage);
  }
  if (body.allow_blank_vote !== undefined) {
    data.allow_blank_vote = body.allow_blank_vote;
  }
  if (body.allow_null_vote !== undefined) {
    data.allow_null_vote = body.allow_null_vote;
  }
  if (body.max_positions_per_ballot !== undefined) {
    data.max_positions_per_ballot = Number(body.max_positions_per_ballot);
  }
  if (body.requires_2fa !== undefined) data.requires_2fa = body.requires_2fa;

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

  const existentes =
    await electionRulesRepository.findRulesByElection(electionId);

  if (existentes) {
    throw ApiError.conflict(
      'Esta elección ya tiene reglas configuradas. Usa PUT para modificarlas.'
    );
  }

  const data = { ...buildRulesData(body), election_id: electionId };

  try {
    const creadas = await electionRulesRepository.createRules(data);
    return formatRules(creadas);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const updateRules = async (electionId, body = {}) => {
  await requireDraftElection(electionId);

  const existentes =
    await electionRulesRepository.findRulesByElection(electionId);

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

  const existentes =
    await electionRulesRepository.findRulesByElection(electionId);

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
