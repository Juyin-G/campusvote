// src/modules/certificate/certificate.eligibility.service.js
// Determinación de elegibilidad (feria CLOSED + publicación + ganador).
// Separado para mantener el service principal delgado y testeable.

import * as fairResultRepository from '../fairResults/fairResult.repository.js';
import * as votingRepository from '../fairVoting/fairVoting.repository.js'; // ✅ NUEVO
import { buildVoteRanking } from '../fairVoting/fairVoting.helpers.js';     // ✅ NUEVO: Import estático
import { ApiError } from '../../shared/errors/ApiError.js';
import {
  assertAdminTenantForFairPure,
  assertOfficialPublicationPure,
  CERTIFICATE_TYPE,
} from './certificate.helpers.js';

/** Garantiza que la feria está CLOSED y tiene publicación oficial. */
export const assertOfficialPublication = async (fairId, fair) => {
  const publication = await fairResultRepository.findPublicationByFair(fairId);
  const errorMessage = assertOfficialPublicationPure({ fair, publication });
  if (errorMessage) throw ApiError.conflict(errorMessage);
  return publication;
};

/** Asegura ADMIN + tenant de la feria. */
export const assertAdminTenantForFair = ({ fair, actor }) => {
  const errorMessage = assertAdminTenantForFairPure({ fair, actor });
  if (errorMessage) throw ApiError.forbidden(errorMessage);
};

/**
 * Determina el ganador (única fuente: VOTOS, Decisión P1).
 * Devuelve el projectId ganador, o null si no hay publicación oficial.
 */
export const determineWinnerProjectId = async ({ fairId, fair }) => {
  const publication = await fairResultRepository.findPublicationByFair(fairId);
  if (!publication) return null;
  if (fair.status !== 'CLOSED') return null;

  const [projects, votesByProject] = await Promise.all([
    fairResultRepository.listApprovedProjects(fairId),
    votingRepository.countVotesByFair(fairId), // ✅ Usa el repositorio de votos, no uno inexistente
  ]);

  // ✅ Import estático corregido (sin ciclos, sin dynamic import)
  const ranking = buildVoteRanking(projects, votesByProject);
  
  const winner = ranking.find((entry) => entry.winner === true);
  return winner ? winner.project_id : null;
};

/** Crea o devuelve el certificado existente (idempotencia). */
export const upsertCertificate = async ({
  certificateRepository,
  fairId,
  projectId,
  userId,
  certificateType,
}) => {
  const existing = await certificateRepository.findExisting({
    fairId,
    projectId,
    userId,
    certificateType,
  });
  if (existing) return { certificate: existing, created: false };

  try {
    const created = await certificateRepository.create({
      fairId,
      projectId,
      userId,
      certificateType,
    });
    if (!created) {
      const reExisting = await certificateRepository.findExisting({
        fairId,
        projectId,
        userId,
        certificateType,
      });
      return { certificate: reExisting, created: false };
    }
    return { certificate: created, created: true };
  } catch (err) {
    if (err.message === 'CERTIFICATE_ALREADY_EXISTS' || err.code === 'P2002') {
      const existing = await certificateRepository.findExisting({
        fairId,
        projectId,
        userId,
        certificateType,
      });
      return { certificate: existing, created: false };
    }
    throw err;
  }
};

export { CERTIFICATE_TYPE };