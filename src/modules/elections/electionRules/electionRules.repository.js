// src/modules/elections/electionRules/electionRules.repository.js

import { prisma } from '../../../database/prisma.js';


const RULES_SELECT = {
  id: true,
  electionId: true,               // No 'election_id'
  minTurnoutPercentage: true,     // No 'min_turnout_percentage'
  allowBlankVote: true,           // No 'allow_blank_vote'
  allowNullVote: true,            // No 'allow_null_vote'
  maxVotesPerPosition: true,      // No 'max_positions_per_ballot'
  requires2fa: true,              // No 'requires_2fa'
  createdAt: true,                // No 'created_at'
  updatedAt: true,                // No 'updated_at'
};

export const findRulesByElection = (electionId) =>
  prisma.electionRule.findUnique({
    where: { electionId },
    select: RULES_SELECT,
  });

export const createRules = (data) =>
  prisma.electionRule.create({
    data,
    select: RULES_SELECT,
  });

export const updateRulesByElection = (electionId, data) =>
  prisma.electionRule.update({
    where: { electionId },
    data,
    select: RULES_SELECT,
  });

export const deleteRulesByElection = (electionId) =>
  prisma.electionRule.delete({
    where: { electionId },
    select: { id: true },
  });

export default {
  findRulesByElection,
  createRules,
  updateRulesByElection,
  deleteRulesByElection,
};