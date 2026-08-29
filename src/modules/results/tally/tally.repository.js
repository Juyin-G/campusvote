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
  ballotPositionId: true,
  optionType: true,
  candidateListId: true,
  label: true,
  ballotPosition: {
    select: {
      positionId: true,
    },
  },
};

/** Solo los campos públicos de un tally existente. */
const TALLY_SELECT = {
  id: true,
  electionId: true,
  positionId: true,
  optionId: true,
  votesCount: true,
  updatedAt: true,
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
  prisma.ballotOption.findMany({
    where: {
      ballotPosition: {
        position: {
          electionId,
        },
      },
    },
    select: BALLOT_OPTION_JOIN_SELECT,
    orderBy: { createdAt: 'asc' },
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
  prisma.voteSelection.groupBy({
    by: ['ballotOptionId'],
    where: {
      vote: {
        electionId,
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
  prisma.tally.findMany({
    where: { electionId },
    select: TALLY_SELECT,
    orderBy: [{ positionId: 'asc' }, { optionId: 'asc' }],
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
 * @param {string} electionId - UUID de la elección.
 * @param {Array<{electionId:string, positionId:string,
 *   optionId:string, votesCount:number}>} records
 *   Set nuevo de tallies. Si está vacío, solo se ejecuta el borrado.
 * @returns {Promise<{electionId:string, deleted:number,
 *   inserted:number}>}
 */
export const replaceTallies = async (electionId, records = []) => {
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.tally.deleteMany({
      where: { electionId },
    });

    if (records.length > 0) {
      await tx.tally.createMany({
        data: records,
      });
    }

    return {
      electionId,
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
