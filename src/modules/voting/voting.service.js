// src/modules/voting/voting.service.js
// Capa de negocio del módulo de VOTACIÓN.
//
// Responsabilidades:
//   - Coordinar el caso de uso "iniciar sesión de votación".
//   - Coordinar el caso de uso "emitir voto".
//   - Traducir los RAISE EXCEPTION del motor SQL (Prisma P2010)
//     a ApiError con el código HTTP correcto.
//
// NO accede a Prisma directamente (delega en voting.repository.js).
// NO conoce HTTP.

import * as votingRepository from './voting.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import MESSAGES from '../../constants/messages.js';

/**
 * Extrae el mensaje legible de un error Prisma P2010 provocado por
 * un RAISE EXCEPTION dentro de una función SQL del motor.
 */
const extractSqlMessage = (error) => {
  const raw = String(error?.meta?.message ?? error?.message ?? '');
  // Prisma suele envolver el mensaje con prefijos como "Raw query failed".
  // Nos quedamos con lo que haya tras los dos puntos del mensaje real.
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

    // Fallback genérico: el error provino del motor SQL validando reglas.
    throw ApiError.badRequest(extractSqlMessage(error));
  }

  // Cualquier otro error (conexión, etc.) se propaga como 500.
  throw error;
};

/**
 * POST /voting/elections/:electionId/sessions
 * Inicia una sesión de votación para el elector autenticado.
 */
export const startVotingSession = async ({ electionId, actorId, ip, userAgent }) => {
  if (!actorId) throw ApiError.unauthorized('No se identificó al votante');

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

  // Solo el dueño de la sesión puede consultarla.
  if (session.voterId !== actorId) {
    throw ApiError.forbidden('No tiene permisos para consultar esta sesión');
  }

  return session;
};

export default {
  startVotingSession,
  castSecureVote,
  getVotingSession,
};
