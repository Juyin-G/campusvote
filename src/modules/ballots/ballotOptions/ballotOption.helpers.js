// src/modules/ballots/ballotOptions/ballotOption.helpers.js
// Helpers de validación y carga: requireBallotPosition, requireOptionInPosition,
// requireCandidateListForBallot, validateOptionData, translatePrismaError.

import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';

export const OPTION_TYPES = ['CANDIDATE_LIST', 'TEXT', 'IMAGE'];

export const asText = (value) => (value == null ? '' : String(value));

export const translatePrismaError = (err) => {
  if (err?.code === 'P2025') throw ApiError.notFound('Recurso no encontrado');
  if (err?.code === 'P2002') throw ApiError.conflict('Recurso duplicado');
  if (err?.code === 'P2003') throw ApiError.badRequest('Referencia inválida');
  throw err;
};

export const requireBallotPosition = async (ballotPositionId) => {
  const position = await prisma.ballotPosition.findUnique({
    where: { id: ballotPositionId },
    select: { id: true, ballotId: true },
  });
  if (!position) throw ApiError.notFound('Cargo del ballot no encontrado');
  return position;
};

export const requireOptionInPosition = async (ballotPositionId, optionId) => {
  const option = await prisma.ballotOption.findFirst({
    where: { id: optionId, ballotPositionId },
  });
  if (!option) throw ApiError.notFound('Opción no encontrada en este cargo');
  return option;
};

export const requireCandidateListForBallot = async (candidateListId, ballotId) => {
  const list = await prisma.candidateList.findUnique({
    where: { id: candidateListId },
    select: { id: true, electionId: true },
  });
  if (!list) throw ApiError.badRequest('La lista de candidatos no existe');
  const ballot = await prisma.ballot.findUnique({
    where: { id: ballotId },
    select: { id: true, electionId: true },
  });
  if (!ballot || list.electionId !== ballot.electionId) {
    throw ApiError.badRequest('La lista de candidatos no pertenece a la elección del ballot');
  }
  return list;
};

/**
 * Valida el cuerpo de creación/actualización de una opción.
 * Normaliza photoUrl (string|null), text (string) y candidateListId.
 */
export const validateOptionData = async ({ body, ballotPosition, isUpdate }) => {
  const errors = [];
  const data = {};

  if (!isUpdate || body.optionType !== undefined || body.option_type !== undefined) {
    data.optionType = body.optionType ?? body.option_type ?? 'CANDIDATE_LIST';
    if (!OPTION_TYPES.includes(data.optionType)) {
      errors.push('Tipo de opción inválido');
    }
  }

  if (body.candidateListId !== undefined || body.candidate_list_id !== undefined) {
    data.candidateListId = body.candidateListId ?? body.candidate_list_id ?? null;
    if (data.candidateListId) {
      await requireCandidateListForBallot(data.candidateListId, ballotPosition.ballotId);
    }
  } else if (data.optionType === 'CANDIDATE_LIST' && !isUpdate) {
    errors.push('Debes especificar la lista de candidatos');
  }

  if (!isUpdate || body.text !== undefined) data.text = asText(body.text);
  if (!isUpdate || body.photoUrl !== undefined || body.photo_url !== undefined) {
    data.photoUrl = body.photoUrl ?? body.photo_url ?? null;
  }
  if (!isUpdate || body.orderIndex !== undefined || body.order_index !== undefined) {
    if (body.orderIndex !== undefined || body.order_index !== undefined) {
      data.orderIndex = Number(body.orderIndex ?? body.order_index);
    }
  }

  if (errors.length > 0) {
    throw ApiError.badRequest(errors.join('; '));
  }
  return data;
};
