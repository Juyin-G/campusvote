// src/modules/ratings/rating.repository.js
// Acceso a datos para calificaciones por estrellas.

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

// Crea o actualiza una calificación (el UNIQUE candidacy_id + juror_id impide
// que un jurado califique dos veces el mismo proyecto; por eso usamos upsert).
export const upsertRating = ({ electionId, candidacyId, jurorId, score, comment }) =>
  prisma.rating.upsert({
    where: {
      // @@unique([candidacyId, jurorId])
      candidacyId_jurorId: {
        candidacyId,
        jurorId,
      },
    },
    update: { score, comment, status: 'ACTIVE' },
    create: { electionId, candidacyId, jurorId, score, comment },
    select: RATING_SELECT,
  });

export const findRating = (candidacyId, jurorId) =>
  prisma.rating.findUnique({
    where: { candidacyId_jurorId: { candidacyId, jurorId } },
    select: RATING_SELECT,
  });

export const listRatingsByElection = ({ electionId, candidacyId, limit = 50, offset = 0 }) =>
  prisma.rating.findMany({
    where: { electionId, ...(candidacyId ? { candidacyId } : {}) },
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
  listRatingsByElection,
  ratingsSummaryByCandidacy,
};
