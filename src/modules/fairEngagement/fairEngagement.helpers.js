// src/modules/fairEngagement/fairEngagement.helpers.js
// Helpers puros: validación de anonimato, mapeos, constantes de hitos.

export const COMMENT_MIN_LENGTH = 10;
export const COMMENT_MAX_LENGTH = 1000;

// Hitos de "Me gusta" que disparan notificación al expositor.
// Múltiplos de 10 (10, 20, 30, …): cada umbral se notifica UNA vez por
// proyecto (controlado en BD por fair_project_like_milestones +
// UNIQUE (project_id, milestone)). 5 NO es un hito (el primero es 10).
const LIKE_MILESTONES = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);

/**
 * Devuelve el múltiplo de 10 más alto aplicable al conteo dado (o null).
 * Ej: count=10 → 10, count=20 → 20, count=25 → 20, count=99 → 90.
 * Devuelve null si count < 10.
 */
export const nextMilestone = (count) => {
  const hit = Math.floor(count / 10) * 10;
  return hit >= 10 ? hit : null;
};

/** Trimea y valida la longitud de un comentario. */
export const cleanComment = (raw) => {
  if (typeof raw !== 'string') return '';
  return raw.trim();
};

/** Mapea un like a respuesta pública (sin datos sensibles). */
export const mapLike = (like) => ({
  id: like.id,
  fair_id: like.fairId,
  project_id: like.projectId,
  jury_user_id: like.juryUserId,
  created_at: like.createdAt,
});

/**
 * Mapea un comentario para el JURY (ve nombre del emisor).
 */
export const mapCommentForJury = (c) => ({
  id: c.id,
  fair_id: c.fairId,
  project_id: c.projectId,
  jury: c.jury
    ? {
        id: c.jury.id,
        first_name: c.jury.firstName,
        last_name: c.jury.lastName,
        institutional_id: c.jury.institutionalId,
      }
    : null,
  comment: c.comment,
  is_anonymous: c.isAnonymous,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

/**
 * Mapea un comentario para el ESTUDIANTE (anonimato del jurado).
 * Si is_anonymous=true, NO expone quién lo dejó.
 */
export const mapCommentForStudent = (c) => ({
  id: c.id,
  comment: c.comment,
  is_anonymous: c.isAnonymous,
  created_at: c.createdAt,
});
