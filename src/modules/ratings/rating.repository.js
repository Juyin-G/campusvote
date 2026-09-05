// src/modules/ratings/rating.repository.js
// Acceso a datos para la calificación por rúbrica multicriterio.

import { prisma } from '../../database/prisma.js';

export const RATING_SELECT = {
  id: true,
  electionId: true,
  candidacyId: true,
  jurorId: true,
  score: true,
  comment: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

// ── CRITERIOS DE RÚBRICA ─────────────────────────────────────

export const createCriterion = ({ electionId, name, weight, maxScore }) =>
  prisma.feriaCriterion.create({
    data: { electionId, name, weight, maxScore },
  });

export const listCriteria = (electionId) =>
  prisma.feriaCriterion.findMany({
    where: { electionId },
    orderBy: [{ createdAt: 'asc' }],
  });

export const findCriterion = (criterionId, electionId) =>
  prisma.feriaCriterion.findFirst({
    where: { id: criterionId, electionId },
    include: { ratingDetails: { select: { id: true } } },
  });

export const deleteCriterion = (criterionId) =>
  prisma.feriaCriterion.delete({ where: { id: criterionId } });

export const sumCriteriaWeights = (electionId) =>
  prisma.feriaCriterion.aggregate({
    where: { electionId },
    _sum: { weight: true },
  });

export const countCriteria = (electionId) =>
  prisma.feriaCriterion.count({ where: { electionId } });

// ── CALIFICACIONES ───────────────────────────────────────────

// Crea o actualiza una calificación (el UNIQUE candidacy_id + juror_id impide
// que un jurado califique dos veces el mismo proyecto; por eso usamos upsert).
// `details` es la matriz [ { criterionId, score } ]; `score` es el puntaje
// ponderado FINAL calculado en el service (Σ score·peso), nunca del cliente.
export const upsertRating = ({ electionId, candidacyId, jurorId, score, comment, details = [] }) =>
  prisma.rating.upsert({
    where: {
      candidacyId_jurorId: {
        candidacyId,
        jurorId,
      },
    },
    update: {
      score,
      comment,
      status: 'ACTIVE',
      ratingDetails: {
        deleteMany: {},
        create: details.map((d) => ({
          criterionId: d.criterionId,
          score: d.score,
        })),
      },
    },
    create: {
      electionId,
      candidacyId,
      jurorId,
      score,
      comment,
      ratingDetails: {
        create: details.map((d) => ({
          criterionId: d.criterionId,
          score: d.score,
        })),
      },
    },
    select: {
      ...RATING_SELECT,
      ratingDetails: { select: { id: true, criterionId: true, score: true } },
    },
  });

export const findRating = (candidacyId, jurorId) =>
  prisma.rating.findUnique({
    where: { candidacyId_jurorId: { candidacyId, jurorId } },
    select: RATING_SELECT,
  });

export const findRatingById = (ratingId, electionId) =>
  prisma.rating.findFirst({
    where: { id: ratingId, electionId },
    select: RATING_SELECT,
  });

export const updateRatingStatus = (ratingId, status) =>
  prisma.rating.update({
    where: { id: ratingId },
    data: { status },
    select: RATING_SELECT,
  });

export const listRatingsByElection = ({
  electionId,
  candidacyId,
  status,
  limit = 50,
  offset = 0,
}) => {
  const where = { electionId };
  if (candidacyId) where.candidacyId = candidacyId;
  if (status) where.status = status;

  return prisma.rating.findMany({
    where,
    select: {
      ...RATING_SELECT,
      juror: { select: { id: true, firstName: true, lastName: true, username: true } },
      candidacy: {
        select: {
          id: true,
          userId: true,
          candidateList: { select: { id: true, name: true, acronym: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });
};

// Resumen agregado por candidatura: promedio, total, distribución 1-5.
export const ratingsSummaryByCandidacy = (electionId) =>
  prisma.$queryRaw`
    SELECT
      candidacy_id,
      COUNT(*)::int                       AS rating_count,
      ROUND(AVG(score)::numeric, 2)::float AS average_score,
      SUM(score)::int                     AS total_score,
      COUNT(*) FILTER (WHERE score = 5)::int AS s5,
      COUNT(*) FILTER (WHERE score = 4)::int AS s4,
      COUNT(*) FILTER (WHERE score = 3)::int AS s3,
      COUNT(*) FILTER (WHERE score = 2)::int AS s2,
      COUNT(*) FILTER (WHERE score = 1)::int AS s1
    FROM ratings
    WHERE election_id = ${electionId}::uuid AND status = 'ACTIVE'
    GROUP BY candidacy_id
  `;

export default {
  upsertRating,
  findRating,
  findRatingById,
  updateRatingStatus,
  listRatingsByElection,
  ratingsSummaryByCandidacy,
};
