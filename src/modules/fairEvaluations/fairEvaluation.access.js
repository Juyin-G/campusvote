// src/modules/fairEvaluations/fairEvaluation.access.js
// Helpers de acceso (loadFair, asserts) compartidos por todos los sub-servicios
// del módulo fairEvaluations. Sin reglas de negocio, solo carga y asserts.

import * as fairRepository from '../fairs/fair.repository.js';
import * as juryAssignmentRepository from '../juryAssignments/juryAssignment.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';

export const RUBRIC_CONFIGURABLE_STATUSES = ['DRAFT'];
// Parte 3 — Estados de la feria: el JURY solo participa académicamente en OPEN.
// En DRAFT la feria es preparación administrativa y el jurado, aunque esté
// asignado, NO puede ver/responder rúbrica, finalizarla, firmar la declaración
// ni votar. El voto anónimo ya exige OPEN (fairVoting).
export const RUBRIC_RESPOND_STATUSES = ['OPEN'];
export const EVALUABLE_PROJECT_STATUS = ['APPROVED'];
export const DECLARATION_ALLOWED_STATUSES = ['OPEN'];

export const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  return fair;
};

export const assertTenantMatch = ({ fair, actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (fair.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La feria no pertenece a tu organización');
  }
};

export const assertJuryAssignedToFair = async ({ fairId, juryId }) => {
  const a = await juryAssignmentRepository.findByFairUser(fairId, juryId);
  if (!a) throw ApiError.forbidden('No tienes asignación como jurado en esta feria');
  return a;
};

export const assertRubricConfigurable = (fair) => {
  if (!RUBRIC_CONFIGURABLE_STATUSES.includes(fair.status)) {
    throw ApiError.conflict(
      'La rúbrica solo se puede configurar en estado DRAFT; se congela al abrir la feria'
    );
  }
};

export const assertRubricOpenForResponse = (fair) => {
  if (!RUBRIC_RESPOND_STATUSES.includes(fair.status)) {
    throw ApiError.conflict('Solo puedes responder la rúbrica mientras la feria está abierta (OPEN)');
  }
};
