// src/modules/voting/voting.service.js

import * as votingRepository from './voting.repository.js';
import * as notificationService from '../notification/notification.service.js';
import auditService from '../audit/audit.service.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import MESSAGES from '../../constants/messages.js';
import logger from '../../config/logger.js';

/**
 * Extrae el mensaje legible de un error Prisma P2010 provocado por
 * un RAISE EXCEPTION dentro de una función SQL del motor.
 */
const extractSqlMessage = (error) => {
  const raw = String(error?.meta?.message ?? error?.message ?? '');
  const colonIdx = raw.indexOf(':');
  return (colonIdx >= 0 ? raw.slice(colonIdx + 1) : raw).trim();
};

/**
 * Mapea los mensajes de las funciones SQL a errores HTTP semánticos.
 */
const translateVotingError = (error) => {
  if (error instanceof ApiError) return error;

  if (error?.code === 'P2010') {
    const message = extractSqlMessage(error).toLowerCase();

    if (message.includes('no existe')) {
      throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
    }
    if (message.includes('no está abierta')) {
      throw ApiError.conflict('La elección no está abierta para votación');
    }
    if (message.includes('elegible')) {
      throw ApiError.forbidden(MESSAGES.VOTE.NOT_ELIGIBLE);
    }
    if (message.includes('ya emitió') || message.includes('ya ha sido utilizado')) {
      throw ApiError.conflict(MESSAGES.VOTE.ALREADY_VOTED);
    }
    if (message.includes('sesión') && message.includes('activa')) {
      throw ApiError.conflict('Ya existe una sesión de votación en curso para este usuario');
    }
    if (message.includes('blanco')) {
      throw ApiError.badRequest('La elección no permite votos en blanco');
    }
    if (message.includes('máximo')) {
      throw ApiError.badRequest('Se excedió el número máximo de selecciones permitidas para un cargo');
    }
    if (message.includes('no pertenecen') || message.includes('inconsistencia')) {
      throw ApiError.badRequest(MESSAGES.VOTE.SELECTION_INVALID);
    }
    if (message.includes('acceso denegado') || message.includes('no pertenece al usuario')) {
      throw ApiError.forbidden('La sesión no pertenece al usuario autenticado');
    }
    if (message.includes('finalizada')) {
      throw ApiError.conflict('La sesión de votación ya fue finalizada');
    }
    if (message.includes('no encontrada')) {
      throw ApiError.notFound('Sesión de votación no encontrada');
    }

    // Prevención de fuga de información (S2.5): Sanitización de fallback
    const sqlDetail = extractSqlMessage(error);
    console.error('[VotingService] Unhandled SQL Exception:', sqlDetail, error);

    const safeMessage = process.env.NODE_ENV === 'production'
      ? 'No se pudo procesar la solicitud de votación.'
      : sqlDetail;

    throw ApiError.badRequest(safeMessage);
  }

  throw error;
};

/**
 * POST /voting/elections/:electionId/sessions
 * Inicia una sesión de votación y consume el token de un solo uso si es provisto.
 */
export const startVotingSession = async ({ electionId, actorId, ip, userAgent, votingToken }) => {
  if (!actorId) throw ApiError.unauthorized('No se identificó al votante');

  // Integración S2.4: Consumo y validación estricta del token de un solo uso
  if (votingToken) {
    try {
      await auditService.consumeOneTimeToken(votingToken, electionId);
    } catch (err) {
      if (err.message.includes('expirado')) throw ApiError.gone('El token de votación ha expirado');
      if (err.message.includes('utilizado')) throw ApiError.conflict('El token de votación ya fue utilizado');
      throw ApiError.badRequest('Token de votación inválido o no correspondiente a esta elección');
    }
  }

  try {
    const [row] = await votingRepository.startSession(
      electionId,
      actorId,
      ip,
      userAgent
    );
    const sessionId = row?.session_id;

    return {
      sessionId,
      electionId,
      status: 'STARTED',
      message: 'Sesión de votación iniciada. Ya puede emitir su voto.',
    };
  } catch (error) {
    throw translateVotingError(error);
  }
};

/**
 * POST /voting/sessions/:sessionId/cast
 * Emite el voto del elector dentro de una sesión iniciada.
 */
export const castSecureVote = async ({
  sessionId,
  actorId,
  encryptedPayload,
  payloadHash,
  selections,
}) => {
  if (!actorId) throw ApiError.unauthorized('No se identificó al votante');

  try {
    const [row] = await votingRepository.castVote(
      sessionId,
      actorId,
      encryptedPayload,
      payloadHash,
      selections
    );
    const receiptCode = row?.receipt_code;

    // CAST_VOTE debe auditarse al EMITIR el voto (no solo al consumir el token).
    try {
      await auditService.logAction({
        actorId: null, // Anonimato forzado (la BD además lo garantiza)
        electionId: null,
        action: 'CAST_VOTE',
        metadata: { receipt: receiptCode, session_id: sessionId },
      });
    } catch (err) {
      logger.warn('No se pudo registrar el voto en auditoría', { error: err.message });
    }

    // Confirmación ANÓNIMA al elector: no incluye selecciones ni payload.
    try {
      const session = await votingRepository.getSession(sessionId);
      if (session?.electionId) {
        await notificationService.createNotification({
          user_id: session.voterId ?? actorId,
          type: 'VOTE_CONFIRMATION',
          title: 'Voto registrado',
          message: 'Tu voto fue registrado correctamente. Tu comprobante quedó en tus manos.',
          metadata: { election_id: session.electionId, receipt: receiptCode },
          channels: ['IN_APP'],
        });
      }
    } catch (err) {
      logger.warn('No se pudo notificar la confirmación de voto', { error: err.message });
    }

    return {
      receiptCode,
      status: 'CAST',
      message: MESSAGES.VOTE.SUBMITTED_SUCCESS,
    };
  } catch (error) {
    throw translateVotingError(error);
  }
};

/** GET /voting/sessions/:id — Consulta el estado de una sesión. */
export const getVotingSession = async (sessionId, actorId) => {
  const session = await votingRepository.getSession(sessionId);
  if (!session) throw ApiError.notFound('Sesión de votación no encontrada');

  if (session.voterId !== actorId) {
    throw ApiError.forbidden('No tiene permisos para consultar esta sesión');
  }

  return session;
};

/**
 * GET /public/verify-receipt/:receiptCode
 * Verificación pública de comprobante de voto. No requiere autenticación
 * y NO expone datos del votante (integridad / anti-fuga de información S2.5).
 * Devuelve 200 con valid:false cuando el código no corresponde a un voto,
 * en lugar de un 404, para no permitir enumerar comprobantes por la respuesta.
 */
export const verifyReceipt = async (receiptCode) => {
  if (!receiptCode) {
    throw ApiError.badRequest('El código de comprobante es requerido');
  }

  const vote = await votingRepository.findVoteByReceipt(receiptCode);

  if (!vote) {
    return {
      valid: false,
      message: 'El comprobante no corresponde a un voto registrado.',
    };
  }

  return {
    valid: true,
    electionId: vote.electionId,
    electionTitle: vote.election?.title ?? null,
    electionStatus: vote.election?.status ?? null,
    castAt: vote.castAt,
    payloadHash: vote.payloadHash,
    message: 'Comprobante de voto válido.',
  };
};

export default {
  startVotingSession,
  castSecureVote,
  getVotingSession,
  verifyReceipt,
};