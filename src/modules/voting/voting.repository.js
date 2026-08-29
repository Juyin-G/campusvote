// src/modules/voting/voting.repository.js
// Acceso a datos del módulo de VOTACIÓN.
//
// Delega en las funciones SQL nativas del motor (SECURITY DEFINER):
//   - start_voting_session(election_id, voter_id, ip, ua)       → session UUID
//   - cast_secure_vote_with_session(session, voter, payload,
//     hash, selections)                                          → receipt code
//
// Estas funciones encapsulan TODA la lógica transaccional de votación
// (elección abierta, elegibilidad, voto único, conteo de selecciones,
// límites por cargo, voto en blanco) dentro de la base de datos.
//
// NO contiene reglas de negocio. NO conoce HTTP.
// Solo traduce llamadas Prisma a esas funciones y usa el cliente para
// consultas auxiliares de sesión.

import { prisma } from '../../database/prisma.js';

/**
 * Inicia una sesión de votación para un elector.
 * Delega en la función SQL `start_voting_session`.
 * Retorna el UUID de la sesión creada (o lanza el RAISE EXCEPTION del motor).
 */
export const startSession = (electionId, voterId, ipAddress, userAgent) =>
  prisma.$queryRawUnsafe(
    `SELECT start_voting_session(
       $1::uuid, $2::uuid, $3::inet, $4::text
     ) AS session_id`,
    electionId,
    voterId,
    ipAddress || null,
    userAgent || null
  );

/**
 * Emite un voto dentro de una sesión ya iniciada.
 * Delega en la función SQL `cast_secure_vote_with_session`.
 * Retorna el comprobante (receipt code) del voto registrado.
 *
 * `selections` es un array de { optionId } que se serializa a JSONB.
 */
export const castVote = (
  sessionId,
  voterId,
  encryptedPayload,
  payloadHash,
  selections
) =>
  prisma.$queryRawUnsafe(
    `SELECT cast_secure_vote_with_session(
       $1::uuid, $2::uuid, $3::text, $4::varchar, $5::jsonb
     ) AS receipt_code`,
    sessionId,
    voterId,
    encryptedPayload,
    payloadHash,
    JSON.stringify(selections || [])
  );

/** Devuelve el estado de una sesión de votación (sin datos sensibles). */
export const getSession = (sessionId) =>
  prisma.votingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      electionId: true,
      voterId: true,
      startedAt: true,
      completedAt: true,
      isSuccessful: true,
    },
  });

export default {
  startSession,
  castVote,
  getSession,
};
