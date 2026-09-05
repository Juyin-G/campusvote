// src/modules/results/peru/peru.service.js
// Adaptación peruana del escrutinio (F2/F6/F7):
// - certifiedWeightedElection: quórum por estamento + voto ponderado
//   2/3 docentes / 1/3 estudiantes (certify_weighted_election en PG).
// - finalizeFairResults: ranking de feria = 80% rúbricas de jurados (con
//   desempate por criterio dirimente) + 20% voto popular.

import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';

const translateRawError = (err) => {
  const message = String(err?.message ?? '');
  if (message.includes('QUORUM_FAILED')) {
    const match = message.match(/QUORUM_FAILED: (.+)/);
    return ApiError.conflict(match ? match[1] : 'Quórum por estamento no alcanzado');
  }
  if (message.includes('CERRADA')) {
    return ApiError.conflict('Solo se puede certificar una elección CERRADA');
  }
  if (message.includes('no encontrada')) {
    return ApiError.notFound('Elección no encontrada');
  }
  return err;
};

/**
 * Certifica una elección ponderada (docentes/estudiantes) reutilizando la
 * función SQL certify_weighted_election que aplica quórum diferenciado.
 */
export const certifyWeightedElection = async ({ electionId, actorId, options = {} }) => {
  const rule = await prisma.electionRule.findUnique({
    where: { electionId },
    select: {
      isWeighted: true,
      teacherWeight: true,
      studentWeight: true,
      minTeacherTurnout: true,
      minStudentTurnout: true,
      quorumFailPolicy: true,
    },
  });

  if (!rule || !rule.isWeighted) {
    throw ApiError.badRequest('Esta elección no está configurada como voto ponderado (is_weighted)');
  }

  const teacherWeight = options.teacher_weight ?? Number(rule.teacherWeight ?? 0.67);
  const studentWeight = options.student_weight ?? Number(rule.studentWeight ?? 0.33);

  if ((teacherWeight + studentWeight).toFixed(2) !== '1.00') {
    throw ApiError.badRequest('teacher_weight + student_weight deben sumar exactamente 1.00');
  }

  const minTeacherTurnout = options.min_teacher_turnout ?? Number(rule.minTeacherTurnout ?? 0);
  const minStudentTurnout = options.min_student_turnout ?? Number(rule.minStudentTurnout ?? 0);
  const policy = options.quorum_fail_policy ?? rule.quorumFailPolicy ?? 'VOID_ELECTION';

  try {
    const result = await prisma.$queryRaw`
      SELECT certify_weighted_election(
        ${electionId}::uuid,
        ${actorId}::uuid,
        ${teacherWeight}::numeric,
        ${studentWeight}::numeric,
        ${minTeacherTurnout}::numeric,
        ${minStudentTurnout}::numeric,
        ${policy}::quorum_fail_policy
      ) AS result_id
    `;
    return { certified: true, result_id: result[0]?.result_id ?? null };
  } catch (err) {
    throw translateRawError(err);
  }
};

/**
 * Derivar el ranking final de una feria (rúbricas + voto popular) y registrar
 * la decisión de desempate (si hubo empate en final_score).
 */
export const finalizeFairResults = async ({ electionId }) => {
  await prisma.$executeRaw`SELECT finalize_fair_results(${electionId}::uuid)`;
  const result = await prisma.electionResult.findUnique({
    where: { electionId },
    select: {
      fairRanking: true,
      tieBreakApplied: true,
      tieBreakWinnerId: true,
      tieBreakAt: true,
    },
  });
  return {
    election_id: electionId,
    ranking: result?.fairRanking ?? null,
    tie_break: {
      applied: result?.tieBreakApplied ?? false,
      winner_id: result?.tieBreakWinnerId ?? null,
      at: result?.tieBreakAt ?? null,
    },
  };
};

export default {
  certifyWeightedElection,
  finalizeFairResults,
};