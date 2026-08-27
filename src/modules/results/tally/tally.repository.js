// src/modules/results/tally/tally.repository.js
// S7-02 — Acceso a datos para el conteo de votos (tallies).
//
// Responsabilidad única del Repository:
//   - Leer y persistir datos en la tabla `tallies` y sus dependencias.
//   - NO contiene reglas de negocio (eso vive en tally.service.js).
//   - NO conoce HTTP, respuestas ni errores de la API.
//   - NO escribe en `election_results` (responsabilidad del Service).
//
// Patrón aplicado: Prisma puro (sin $queryRaw), igual que
// organization.repository.js y elections/position.repository.js.

import { prisma } from '../../../database/prisma.js';

// ─────────────────────────────────────────────────────────────
// SELECTS Prisma reutilizables
// ─────────────────────────────────────────────────────────────

/**
 * ballot_options con su ballot_position y el position_id asociado.
 * Permite resolver la cadena: ballot_option → ballot_position → position.
 */
const BALLOT_OPTION_JOIN_SELECT = {
  id: true,
  ballot_position_id: true,
  option_type: true,
  candidate_list_id: true,
  label: true,
  ballot_positions: {
    select: {
      position_id: true,
    },
  },
};

/** Solo los campos públicos de un tally existente. */
const TALLY_SELECT = {
  id: true,
  election_id: true,
  position_id: true,
  option_id: true,
  votes_count: true,
  updated_at: true,
};

// ─────────────────────────────────────────────────────────────
// LECTURAS
// ─────────────────────────────────────────────────────────────

/**
 * Devuelve todas las ballot_options de una elección ya unidas
 * con el position_id del cargo al que pertenecen.
 *
 * Sirve para que el Service pueda construir el set completo
 * de opciones (incluyendo BLANK y NULL y opciones con 0 votos)
 * y mapear cada selección a su (election, position, option).
 */
export const findBallotOptionsByElection = (electionId) =>
  prisma.ballot_options.findMany({
    where: {
      ballot_positions: {
        positions: {
          election_id: electionId,
        },
      },
    },
    select: BALLOT_OPTION_JOIN_SELECT,
    orderBy: { created_at: 'asc' },
  });

/**
 * Cuenta cuántas vote_selections tiene cada ballot_option_id
 * para los votos de una elección concreta.
 *
 * Es la fuente del conteo: cada fila de vote_selections
 * representa exactamente un voto a una opción (UNIQUE
 * (vote_id, ballot_option_id) garantiza que no hay duplicados).
 */
export const countSelectionsByBallotOption = (electionId) =>
  prisma.vote_selections.groupBy({
    by: ['ballot_option_id'],
    where: {
      votes: {
        election_id: electionId,
      },
    },
    _count: { _all: true },
  });

/**
 * Devuelve los tallies ya almacenados para una elección.
 * Útil para /results/live, /results/final y para depuración.
 * El orden es estable: primero por position, luego por option.
 */
export const findExistingTallies = (electionId) =>
  prisma.tallies.findMany({
    where: { election_id: electionId },
    select: TALLY_SELECT,
    orderBy: [{ position_id: 'asc' }, { option_id: 'asc' }],
  });

// ─────────────────────────────────────────────────────────────
// PERSISTENCIA
// ─────────────────────────────────────────────────────────────

/**
 * Sustituye atómicamente el conjunto completo de tallies de
 * una elección por uno nuevo.
 *
 * Esta operación:
 *   1. Borra TODOS los tallies previos de la elección.
 *   2. Inserta el nuevo conjunto de registros.
 *
 * Ambas operaciones se ejecutan dentro de UNA transacción
 * Prisma para garantizar atomicidad.
 *
 * NO se usa `skipDuplicates` a propósito: si `records` trae
 * duplicados por (election_id, position_id, option_id), la
 * restricción UNIQUE de la tabla hará fallar el createMany,
 * y eso debe detectarse como un bug, no silenciarse.
 *
 * Limitación documentada: $transaction por sí sola no resuelve
 * toda la concurrencia. Esta función no aplica locks explícitos;
 * la decisión sobre cuándo recalcular (y con qué garantías de
 * aislamiento) corresponde a la capa Service, que conoce el
 * estado de la elección.
 *
 * @param {string} electionId - UUID de la elección.
 * @param {Array<{election_id:string, position_id:string,
 *   option_id:string, votes_count:number}>} records
 *   Set nuevo de tallies. Si está vacío, solo se ejecuta el borrado.
 * @returns {Promise<{election_id:string, deleted:number,
 *   inserted:number}>}
 */
export const replaceTallies = async (electionId, records = []) => {
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.tallies.deleteMany({
      where: { election_id: electionId },
    });

    if (records.length > 0) {
      await tx.tallies.createMany({
        data: records,
      });
    }

    return {
      election_id: electionId,
      deleted: deleted.count,
      inserted: records.length,
    };
  });
};

// ─────────────────────────────────────────────────────────────
// EXPORT DEFAULT
// ─────────────────────────────────────────────────────────────

export default {
  findBallotOptionsByElection,
  countSelectionsByBallotOption,
  findExistingTallies,
  replaceTallies,
};
