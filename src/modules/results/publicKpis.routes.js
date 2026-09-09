import { Router } from 'express';
import { prisma } from '../../database/prisma.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ApiError } from '../../shared/errors/ApiError.js';

const router = Router();

router.get('/public/elections/:id/kpis', asyncHandler(async (req, res) => {
  const election = await prisma.election.findUnique({
    where: { id: req.params.id },
    select: { id: true, title: true, status: true, startAt: true, endAt: true, organizationId: true },
  });
  if (!election || !['OPEN', 'CLOSED', 'CERTIFIED', 'PUBLISHED'].includes(election.status)) {
    throw ApiError.notFound('Los indicadores de esta elección no están disponibles');
  }

  const [sessions, votes, ballots, result] = await Promise.all([
    prisma.votingSession.count({ where: { electionId: election.id } }),
    prisma.vote.count({ where: { electionId: election.id } }),
    prisma.ballot.count({ where: { electionId: election.id } }),
    prisma.electionResult.findUnique({ where: { electionId: election.id }, select: { totalVoters: true, turnoutPercentage: true, publishedAt: true } }),
  ]);

  res.json({
    success: true,
    data: {
      election: { id: election.id, title: election.title, status: election.status, start_at: election.startAt, end_at: election.endAt },
      processed_sessions: sessions,
      votes_cast: votes,
      ballots_generated: ballots,
      turnout_percentage: result ? Number(result.turnoutPercentage) : null,
      results_published: Boolean(result?.publishedAt),
      total_voters: result?.totalVoters ?? null,
    },
  });
}));

export default router;
