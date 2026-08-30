// src/modules/results/report/report.routes.js
// S7-09 — Rutas HTTP para descargar el reporte PDF.

import { Router } from 'express';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { requireElectionInScope } from '../../../middlewares/scope.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { electionIdParamSchema } from '../results.schema.js';
import resultsService from '../results.service.js';
import { generateResultsPdf } from './report.service.js';

const router = Router();

/**
 * GET /api/elections/:id/report.pdf
 * Devuelve el PDF del acta de resultados.
 */
router.get(
  '/elections/:id/report.pdf',
  authenticate,
  validate(electionIdParamSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(async (req, res) => {
    const electionId = req.params.id;
    const data = await resultsService.getFinalResults(electionId);
    const election = {
      id: req.election?.id || data.election_id,
      title: req.election?.title || 'Acta de resultados',
      status: req.election?.status || data.status,
    };
    const { buffer, hash } = await generateResultsPdf({
      election,
      summary: data.summary || {},
      positions: data.detail?.positions || [],
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="acta-${electionId}.pdf"`
    );
    res.setHeader('X-Content-Hash', hash);
    res.send(buffer);
  })
);

export default router;
