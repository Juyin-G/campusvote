// src/modules/organizations/organization-request/approval.service.js

import { ApiError } from '../../../shared/errors/ApiError.js';
import * as orgRepository from '../organization/organization.repository.js'; 

// import * as requestRepository from './request.repository.js'; // Ajusta la ruta si es necesario
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const assertUuid = (id) => {
  if (!UUID_REGEX.test(id)) {
    throw ApiError.badRequest('El ID debe ser un UUID válido');
  }
};

// Carga la solicitud y valida que esté en estado PENDING (rechaza procesadas)
const assertPending = async (requestId) => {
  const request = await orgRepository.findRequestById(requestId);
  if (!request) {
    throw ApiError.notFound('Solicitud no encontrada');
  }
  if (request.status !== 'PENDING') {
    throw ApiError.conflict(
      `La solicitud ya fue procesada (estado actual: ${request.status})`
    );
  }
  return request;
};

// Aprueba una solicitud delegando en la función SQL nativa (bloqueo pesimista)
export const approveRequest = async (requestId, reviewerId) => {
  assertUuid(requestId);
  await assertPending(requestId);

  const newOrg = await orgRepository.approveOrganizationRequest(
    requestId,
    reviewerId
  );

  if (!newOrg) {
    throw ApiError.conflict('La solicitud no generó una organización (posible condición de carrera o error en la función SQL)');
  }

  return newOrg;
};

// Rechaza una solicitud guardando el motivo y marcando REJECTED
export const rejectRequest = async (requestId, reviewerId, reason) => {
  assertUuid(requestId);

  if (!reason || !String(reason).trim()) {
    throw ApiError.badRequest('El motivo de rechazo es obligatorio');
  }

  await assertPending(requestId);

  return orgRepository.rejectOrganizationRequest(
    requestId,
    reviewerId,
    String(reason).trim()
  );
};

export default {
  approveRequest,
  rejectRequest,
};