// src/modules/certificate/certificate.helpers.js
// Funciones PURAS reutilizables: filtros, clasificaciones y reglas de
// autorización. Sin acceso a BD ni HTTP. Testeable de forma aislada.

import { ROLES } from '../../constants/roles.js';

export const CERTIFICATE_TYPE = Object.freeze({
  PARTICIPATION: 'PARTICIPATION',
  WINNER: 'WINNER',
});

const isAdminRole = (actor) => actor?.role === ROLES.ADMIN;

/**
 * Indica si el actor tiene rol ADMIN (único rol que puede generar
 * certificados). SUPERADMIN NO tiene bypass operativo en este módulo.
 */
export const canGenerateCertificates = (actor) => actor?.role === ROLES.ADMIN;

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
 *   - ADMIN de la misma organización que la feria del certificado: sí.
 *   - Cualquier otro rol (incluido SUPERADMIN): no (debe ser dueño).
 */
export const canAdminReadOthersCertificate = ({ cert, actor }) => {
  if (!isAdminRole(actor)) return false;
  if (!actor?.organizationId) return false;
  return cert?.fair?.organizationId === actor.organizationId;
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
 */
export const classifyMembers = ({ members, winnerProjectId, projectId }) => {
  const valid = filterValidMembers(members);
  const isWinner = winnerProjectId === projectId;
  return {
    participation: valid.map((m) => m.userId),
    winner: isWinner ? valid.map((m) => m.userId) : [],
  };
};

/** Map público de un certificado (sin DNI, sin ranking, sin puesto). */
export const mapCertificate = (cert) => ({
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
    ? { id: cert.project.id, name: cert.project.name, status: cert.project.status }
    : null,
  participant: cert.user
    ? { id: cert.user.id, first_name: cert.user.firstName, last_name: cert.user.lastName }
    : null,
});
