import { ApiError } from '../../shared/errors/ApiError.js';
import * as orgRepository from './organization.repository.js';

// Validacion basica de UUID (defensa antes de llegar a la BD)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const assertUuid = (id) => {
  if (!UUID_REGEX.test(id)) {
    throw ApiError.badRequest('El ID debe ser un UUID valido');
  }
};

// Carga la solicitud y valida que este en estado PENDING (rechaza procesadas)
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

// Aprueba una solicitud delegando en la funcion SQL nativa (bloqueo pesimista)
export const approveRequest = async (requestId, reviewerId) => {
  assertUuid(requestId);
  await assertPending(requestId);

  const newOrg = await orgRepository.approveOrganizationRequest(
    requestId,
    reviewerId
  );

  if (!newOrg) {
    throw ApiError.conflict('La solicitud no genero una organizacion (posible condicion de carrera)');
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
