// src/modules/certificate/certificate.service.js
// PASO 8 — Publicación oficial y certificados de FERIAS.
//
// Reglas de dominio:
//   * Los certificados SOLO pueden generarse cuando la feria está CLOSED
//     y existe una publicación oficial (FairResultPublication).
//   * PARTICIPATION: para cada miembro (ProjectMember) de un proyecto
//     APPROVED de la feria.
//   * WINNER: SOLO para los miembros del proyecto ganador según el
//     ranking derivado por getFairResults(). Fuente de verdad ÚNICA.
//   * El ganador NO se persiste como estado (ProjectStatus.WINNER no
//     existe). Tampoco se guarda un "winner=true" en Certificate.
//   * Idempotente: re-ejecutar no duplica (UNIQUE a nivel BD).

import * as certificateRepository from './certificate.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import * as fairResultRepository from '../fairResults/fairResult.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import {
  classifyMembers,
  mapCertificate,
  canAdminReadOthersCertificate,
} from './certificate.helpers.js';
import {
  assertOfficialPublication,
  assertAdminTenantForFair,
  determineWinnerProjectId,
  upsertCertificate,
  CERTIFICATE_TYPE,
} from './certificate.eligibility.service.js';

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  return fair;
};

/**
 * POST /api/fairs/:id/certificates/generate
 * Genera los certificados de la feria. ADMIN + tenant + CLOSED + publicado.
 */
export const generateCertificates = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  assertAdminTenantForFair({ fair, actor });
  await assertOfficialPublication(fairId, fair);

  const winnerProjectId = await determineWinnerProjectId({ fairId, fair });

  const approvedProjects = await fairResultRepository.listApprovedProjects(fairId);
  if (!approvedProjects || approvedProjects.length === 0) {
    return {
      fair_id: fairId,
      certificates: [],
      summary: { participation: 0, winner: 0, total: 0 },
    };
  }

  const results = [];
  let participationCount = 0;
  let winnerCount = 0;

  for (const project of approvedProjects) {
    const members = await certificateRepository.listProjectMembers(project.id);
    const { participation, winner } = classifyMembers({
      members,
      winnerProjectId,
      projectId: project.id,
    });

    for (const userId of participation) {
      const { certificate, created } = await upsertCertificate({
        certificateRepository,
        fairId,
        projectId: project.id,
        userId,
        certificateType: CERTIFICATE_TYPE.PARTICIPATION,
      });
      results.push({
        certificate_id: certificate.id,
        user_id: certificate.userId,
        project_id: certificate.projectId,
        fair_id: certificate.fairId,
        certificate_type: certificate.certificateType,
        created,
      });
      participationCount += 1;
    }

    for (const userId of winner) {
      const { certificate, created } = await upsertCertificate({
        certificateRepository,
        fairId,
        projectId: project.id,
        userId,
        certificateType: CERTIFICATE_TYPE.WINNER,
      });
      results.push({
        certificate_id: certificate.id,
        user_id: certificate.userId,
        project_id: certificate.projectId,
        fair_id: certificate.fairId,
        certificate_type: certificate.certificateType,
        created,
      });
      winnerCount += 1;
    }
  }

  return {
    fair_id: fairId,
    summary: {
      participation: participationCount,
      winner: winnerCount,
      total: results.length,
    },
    certificates: results,
  };
};

/** GET /api/certificates/my — certificados del usuario autenticado. */
export const listMyCertificates = async ({ actor }) => {
  const certs = await certificateRepository.listMine(actor.id);
  return {
    user_id: actor.id,
    certificates: certs.map(mapCertificate),
  };
};

/**
 * GET /api/certificates/:certificateId
 *   - Participante: solo su propio certificado.
 *   - ADMIN: certificados de usuarios de su organización.
 *   - JURY/STUDENT/TEACHER no participantes: 403.
 *   - SUPERADMIN: NO bypass operativo.
 */
export const getCertificateById = async ({ certificateId, actor }) => {
  const cert = await certificateRepository.findById(certificateId);
  if (!cert) throw ApiError.notFound('Certificado no encontrado');

  const isOwner = cert.userId === actor.id;
  if (isOwner) return mapCertificate(cert);

  if (!canAdminReadOthersCertificate({ cert, actor })) {
    throw ApiError.forbidden('No tienes permisos para consultar este certificado');
  }
  return mapCertificate(cert);
};

// Re-exports de funciones puras (compatibilidad con tests previos).
export {
  filterValidMembers,
  classifyMembers,
  canGenerateCertificates,
  canAdminReadOthersCertificate,
  assertAdminTenantForFairPure,
  assertOfficialPublicationPure,
} from './certificate.helpers.js';

export default {
  generateCertificates,
  listMyCertificates,
  getCertificateById,
};
