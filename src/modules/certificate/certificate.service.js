// src/modules/certificate/certificate.service.js
// PASO 8 — Publicación oficial y certificados de FERIAS.
//
// Reglas de dominio (las validaciones son del módulo, NO del cliente):
//   * Los certificados SOLO pueden generarse cuando la feria está CLOSED
//     y existe una publicación oficial (FairResultPublication).
//   * PARTICIPATION: para cada miembro (ProjectMember) de un proyecto
//     APPROVED de la feria.
//   * WINNER: SOLO para los miembros del proyecto que, según el ranking
//     derivado por getFairResults(), ocupa position === 1. La fuente de
//     verdad del ganador es getFairResults(); este módulo NO recalcula ni
//     persiste un ranking paralelo.
//   * El ganador NO se persiste como estado (ProjectStatus.WINNER NO
//     existe). Tampoco se guarda un "winner=true" en Certificate.
//
// Autorización:
//   * ADMIN: opera únicamente sobre ferias de SU organización.
//   * SUPERADMIN: NO obtiene bypass operativo del tenant en este módulo.
//     Puede consultar/descargar sus propios certificados si es participante,
//     pero NO genera certificados para ferias ajenas.
//   * JURY: 403 administrativo. Puede consultar/descargar únicamente
//     certificados propios si figura como ProjectMember de un proyecto.
//   * STUDENT / TEACHER: solo pueden ver/descargar certificados propios.
//   * Participante: solo ve/descarga sus propios certificados.
//
// Idempotencia:
//   * Si ya existe el certificado (UNIQUE a nivel BD), NO se duplica: se
//     devuelve el existente. La generación es segura de repetir.

import * as certificateRepository from './certificate.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import * as fairResultRepository from '../fairResults/fairResult.repository.js';
import { buildFairRanking } from '../fairResults/fairResult.service.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

const CERTIFICATE_TYPE = Object.freeze({
  PARTICIPATION: 'PARTICIPATION',
  WINNER: 'WINNER',
});

const isAdminRole = (actor) => actor.role === ROLES.ADMIN;

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) {
    throw ApiError.notFound('Feria no encontrada');
  }
  return fair;
};

// ──────────────────────────────────────────────────────────────────────
// Funciones PURAS de autorización (exportadas para tests sin BD)
// ──────────────────────────────────────────────────────────────────────

/**
 * Indica si el actor tiene rol ADMIN (único rol que puede generar
 * certificados). SUPERADMIN NO tiene bypass operativo en este módulo.
 */
export const canGenerateCertificates = (actor) =>
  actor?.role === ROLES.ADMIN;

/**
 * Verifica si el actor es ADMIN y pertenece a la organización de la
 * feria. SUPERADMIN NO obtiene bypass del tenant.
 * Devuelve un string de error si falla; null si todo es válido.
 */
export const assertAdminTenantForFairPure = ({ fair, actor }) => {
  if (!canGenerateCertificates(actor)) {
    return 'Solo el ADMIN de la organización puede generar certificados';
  }
  if (!actor?.organizationId) {
    return 'Tu cuenta no está vinculada a ninguna organización';
  }
  if (fair.organizationId !== actor.organizationId) {
    return 'La feria no pertenece a tu organización';
  }
  return null;
};

/**
 * Verifica si el actor puede consultar/descargar un certificado ajeno.
 * Reglas:
 *   - ADMIN de la misma organización que la feria del certificado: sí.
 *   - Cualquier otro rol (incluido SUPERADMIN): no (debe ser dueño).
 *   - SUPERADMIN NO tiene bypass operativo del tenant.
 */
export const canAdminReadOthersCertificate = ({ cert, actor }) => {
  if (!isAdminRole(actor)) return false;
  if (!actor?.organizationId) return false;
  return cert?.fair?.organizationId === actor.organizationId;
};

/**
 * Tenant estricto para certificados:
 *   - SUPERADMIN NO tiene bypass: si NO es ADMIN de la organización de la
 *     feria, no puede generar/administrar certificados de esa feria.
 *   - ADMIN solo sobre ferias de SU organización.
 *   - JURY/STUDENT/TEACHER: no son ADMIN, no generan.
 */
const assertAdminTenantForFair = ({ fair, actor }) => {
  const errorMessage = assertAdminTenantForFairPure({ fair, actor });
  if (errorMessage) throw ApiError.forbidden(errorMessage);
};

/**
 * Regla de publicación (puramente): la feria debe estar CLOSED y tener
 * publicación oficial. Devuelve un string con el motivo del rechazo, o
 * null si la combinación es válida.
 */
export const assertOfficialPublicationPure = ({ fair, publication }) => {
  if (!fair || fair.status !== 'CLOSED') {
    return 'Los certificados solo pueden generarse cuando la feria está cerrada (CLOSED)';
  }
  if (!publication) {
    return 'Los certificados requieren publicación oficial de resultados';
  }
  return null;
};

/** Garantiza que la feria está CLOSED y tiene publicación oficial. */
const assertOfficialPublication = async (fairId, fair) => {
  const publication = await fairResultRepository.findPublicationByFair(fairId);
  const errorMessage = assertOfficialPublicationPure({ fair, publication });
  if (errorMessage) throw ApiError.conflict(errorMessage);
  return publication;
};

/**
 * Determina el ganador (única fuente: getFairResults → ranking derivado).
 * Devuelve el projectId ganador, o null si no hay publicación oficial o
 * no hay proyectos evaluados en la feria.
 */
const determineWinnerProjectId = async ({ fairId, fair }) => {
  const publication = await fairResultRepository.findPublicationByFair(fairId);
  if (!publication) return null;
  if (fair.status !== 'CLOSED') return null;

  const [projects, evaluations] = await Promise.all([
    fairResultRepository.listApprovedProjects(fairId),
    fairResultRepository.listEvaluationTotals(fairId),
  ]);

  const evaluationsByProject = new Map();
  for (const evaluation of evaluations) {
    const totals = evaluationsByProject.get(evaluation.projectId) ?? [];
    totals.push(evaluation.totalScore);
    evaluationsByProject.set(evaluation.projectId, totals);
  }

  const ranking = buildFairRanking({
    status: fair.status,
    published: Boolean(publication),
    projects,
    evaluationsByProject,
  });
  const winner = ranking.find((entry) => entry.winner === true);
  return winner ? winner.project_id : null;
};

/** Crea o devuelve el certificado existente (idempotencia). */
const upsertCertificate = async ({ fairId, projectId, userId, certificateType }) => {
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
      // Carrera: se creó en paralelo. Re-leer.
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
    if (err.message === 'CERTIFICATE_ALREADY_EXISTS') {
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

/** Map público de un certificado (sin DNI, sin ranking, sin puesto). */
const mapCertificate = (cert) => ({
  id: cert.id,
  user_id: cert.userId,
  project_id: cert.projectId,
  fair_id: cert.fairId,
  certificate_type: cert.certificateType,
  issue_date: cert.issueDate,
  description: cert.description,
  valid_until: cert.validUntil,
  fair: cert.fair
    ? {
        id: cert.fair.id,
        name: cert.fair.name,
        organization_id: cert.fair.organizationId,
        status: cert.fair.status,
      }
    : null,
  project: cert.project
    ? {
        id: cert.project.id,
        name: cert.project.name,
        status: cert.project.status,
      }
    : null,
  participant: cert.user
    ? {
        id: cert.user.id,
        first_name: cert.user.firstName,
        last_name: cert.user.lastName,
      }
    : null,
});

// ════════════════════════════════════════════════════════════════════
// LÓGICA PURA (exportada para tests sin BD)
// ════════════════════════════════════════════════════════════════════

/**
 * Filtra los miembros del proyecto para quedarse solo con usuarios
 * que existen (no nulos) y únicos. No usa DNI.
 */
export const filterValidMembers = (members) => {
  const seen = new Set();
  const out = [];
  for (const m of members || []) {
    if (!m || !m.userId) continue;
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    out.push(m);
  }
  return out;
};

/**
 * Clasifica los miembros de un proyecto entre PARTICIPATION y WINNER.
 * Si el proyecto es el ganador (winnerProjectId === projectId), esos
 * mismos miembros reciben AMBOS certificados.
 *
 * Esta función es PURA: trabaja con los datos ya cargados (members,
 * winnerProjectId). La determinación del ganador la hace el orquestador
 * usando getFairResults().
 */
export const classifyMembers = ({ members, winnerProjectId, projectId }) => {
  const valid = filterValidMembers(members);
  const isWinner = winnerProjectId === projectId;
  return {
    participation: valid.map((m) => m.userId),
    winner: isWinner ? valid.map((m) => m.userId) : [],
  };
};

// ════════════════════════════════════════════════════════════════════
// OPERACIONES
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/fairs/:id/certificates/generate
 *
 * Genera los certificados de la feria (PARTICIPATION para todos los
 * miembros de proyectos APPROVED; WINNER para los miembros del proyecto
 * ganador según getFairResults()).
 *
 * Reglas:
 *   - Requiere rol ADMIN y misma organización que la feria.
 *   - SUPERADMIN NO tiene bypass operativo del tenant.
 *   - Feria CLOSED + publicación oficial obligatoria.
 *   - Idempotente: re-ejecutar no duplica.
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

/**
 * GET /api/certificates/my
 * Devuelve los certificados del usuario autenticado (todos los tipos).
 */
export const listMyCertificates = async ({ actor }) => {
  const certs = await certificateRepository.listMine(actor.id);
  return {
    user_id: actor.id,
    certificates: certs.map(mapCertificate),
  };
};

/**
 * GET /api/certificates/:certificateId
 * Reglas de autorización:
 *   - Participante: solo su propio certificado.
 *   - ADMIN: certificados de usuarios de su organización (a través de
 *     fair.organization_id).
 *   - JURY/STUDENT/TEACHER (no participantes del certificado): 403.
 *   - SUPERADMIN: NO bypass operativo. Si quiere ver un certificado
 *     que no le pertenece y no es ADMIN de la org → 403.
 */
export const getCertificateById = async ({ certificateId, actor }) => {
  const cert = await certificateRepository.findById(certificateId);
  if (!cert) {
    throw ApiError.notFound('Certificado no encontrado');
  }

  const isOwner = cert.userId === actor.id;

  if (isOwner) {
    return mapCertificate(cert);
  }

  // No es el dueño: debe ser ADMIN de la organización de la feria.
  if (!canAdminReadOthersCertificate({ cert, actor })) {
    throw ApiError.forbidden(
      'No tienes permisos para consultar este certificado'
    );
  }

  return mapCertificate(cert);
};

export default {
  generateCertificates,
  listMyCertificates,
  getCertificateById,
  filterValidMembers,
  classifyMembers,
  canGenerateCertificates,
  canAdminReadOthersCertificate,
  assertAdminTenantForFairPure,
  assertOfficialPublicationPure,
};