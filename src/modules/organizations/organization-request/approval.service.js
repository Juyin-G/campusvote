// src/modules/organizations/organization-request/approval.service.js

import { ApiError } from '../../../shared/errors/ApiError.js';
import * as orgRepository from '../organization/organization.repository.js';
import { findById as findUserById } from '../../users/user.repository.js';
import {
  sendAdminActivation,
} from '../../../shared/services/email.service.js';
import logger from '../../../config/logger.js';
import env from '../../../config/env.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const assertUuid = (id) => {
  if (!UUID_REGEX.test(id)) {
    throw ApiError.badRequest('El ID debe ser un UUID válido');
  }
};

/**
 * Carga la solicitud y valida que esté en estado PENDING (rechaza procesadas).
 */
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

/**
 * Resuelve el nombre del aprobador de forma tolerante a fallos.
 * Si el reviewer no existe en DB o la consulta falla, devuelve un nombre
 * genérico para que el correo siga siendo humano.
 */
const resolveApproverName = async (reviewerId) => {
  try {
    const reviewer = await findUserById(reviewerId);
    if (!reviewer) return 'el equipo de CampusVote';
    return (
      reviewer.fullName ||
      reviewer.full_name ||
      reviewer.username ||
      reviewer.email ||
      'el equipo de CampusVote'
    );
  } catch (err) {
    logger.warn('No se pudo resolver el nombre del aprobador', {
      reviewerId,
      error: err.message,
    });
    return 'el equipo de CampusVote';
  }
};

/**
 * Aprueba una solicitud delegando en la función SQL nativa (bloqueo pesimista)
 * y crea el User admin invitado + activation_token en la misma transacción
 * (Opción B). Por último, notifica al visitante con el link accionable a
 * /activate-account?token=...
 *
 * Si el envío del email falla, la aprobación y el User ya quedan creados
 * (transacción completa). Se loguea warning. La recuperación manual vía
 * /api/auth/activation/resend queda como deuda futura.
 */
export const approveRequest = async (requestId, reviewerId) => {
  assertUuid(requestId);
  const request = await assertPending(requestId);
  let activationEmailSent = true;
  let activationEmailError;

  const { activationToken } =
    await orgRepository.approveAndInviteAdmin(requestId, reviewerId);

  /**
   * Email accionable al visitante con el link a /activate-account.
   * Si Gmail falla, el User ya quedó creado; warning + log.
   * (Deuda: añadir /api/auth/activation/resend para reenviar.)
   */
  try {
    await sendAdminActivation({
      email: request.contactEmail,
      institutionName: request.institutionName,
      token: activationToken,
    });

    logger.info('Solicitud aprobada y correo de activación enviado', {
      requestId,
    });
  } catch (emailErr) {
    activationEmailSent = false;
    activationEmailError = emailErr.message;
    logger.warn('Aprobación OK pero falló el email de activación', {
      requestId,
      email: request.contactEmail,
      error: emailErr.message,
    });
  }

  return {
    id: request.id,
    status: 'APPROVED',
    institutionName: request.institutionName,
    contactEmail: request.contactEmail,
    activation_email_sent: activationEmailSent,
    ...(activationEmailError ? { activation_email_error: activationEmailError } : {}),
    // Sin Gmail no hay canal para entregar el token; solo se expone en dev/test.
    ...(env.NODE_ENV !== 'production' ? { _debugToken: activationToken } : {}),
  };
};

/**
 * Rechaza una solicitud guardando el motivo y marcando REJECTED.
 */
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
