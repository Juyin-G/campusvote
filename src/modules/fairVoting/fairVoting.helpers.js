// src/modules/fairVoting/fairVoting.helpers.js
// Funciones puras: receipt, ranking, mappers anónimos.

import crypto from 'node:crypto';

/** Genera un comprobante técnico (32 chars hex). NO revela identidad. */
export const generateReceiptCode = () =>
  crypto.randomBytes(16).toString('hex');

/**
 * Construye el ranking derivado a partir de los votos por proyecto.
 *
 * Reglas:
 *   1. votes DESC
 *   2. project.id ASC (desempate determinista)
 *   3. Proyectos sin votos al final con votes=null y position=null
 *      (no se inventa un 0).
 *
 * @param {Array<{id:string,name:string}>} projects
 * @param {Map<string, number>} votesByProject
 */
export const buildVoteRanking = (projects, votesByProject) => {
  const enriched = projects.map((p) => ({
    project_id: p.id,
    project_name: p.name,
    votes: votesByProject.get(p.id) ?? 0,
  }));

  enriched.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.project_id.localeCompare(b.project_id);
  });

  // Encontrar el primer votes === 0 → a partir de ahí position = null.
  const ranking = [];
  let position = 0;
  for (const entry of enriched) {
    if (entry.votes === 0) {
      ranking.push({ ...entry, position: null });
    } else {
      position += 1;
      ranking.push({ ...entry, position });
    }
  }
  return ranking;
};

/** Mapea el comprobante para respuesta del cliente (SIN identidad). */
export const mapCastReceipt = (receiptCode) => ({
  status: 'CAST',
  receipt_code: receiptCode,
});

/** Mapea el status de votación del JURY autenticado (SIN proyecto elegido). */
export const mapVotingStatus = ({ hasVoted, votedAt }) => ({
  has_voted: Boolean(hasVoted),
  voted_at: votedAt ?? null,
});
