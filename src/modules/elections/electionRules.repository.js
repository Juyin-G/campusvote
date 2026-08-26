// src/modules/elections/electionRules.repository.js
// S4-11 — Acceso a datos de reglas de elección vía Prisma.
//
// election_id es UNIQUE: la relación con `elections` es 1:1, así que
// todas las operaciones se resuelven por election_id, no por id propio.

import { prisma } from '../../database/prisma.js';

const RULES_SELECT = {
  id: true,
  election_id: true,
  min_turnout_percentage: true,
  allow_blank_vote: true,
  allow_null_vote: true,
  max_positions_per_ballot: true,
  requires_2fa: true,
  created_at: true,
  updated_at: true,
};

export const findRulesByElection = (electionId) =>
  prisma.election_rules.findUnique({
    where: { election_id: electionId },
    select: RULES_SELECT,
  });

export const createRules = (data) =>
  prisma.election_rules.create({
    data,
    select: RULES_SELECT,
  });

export const updateRulesByElection = (electionId, data) =>
  prisma.election_rules.update({
    where: { election_id: electionId },
    data,
    select: RULES_SELECT,
  });

export const deleteRulesByElection = (electionId) =>
  prisma.election_rules.delete({
    where: { election_id: electionId },
    select: { id: true },
  });

export default {
  findRulesByElection,
  createRules,
  updateRulesByElection,
  deleteRulesByElection,
};
