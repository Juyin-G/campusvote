// src/modules/results/export/export.routes.js
// S7-10 — Rutas HTTP para descargar resultados en CSV y XLSX.

import { Router } from 'express';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { electionIdParamSchema } from '../results.schema.js';
import resultsService from '../results.service.js';
import { generateResultsCsv, generateResultsXlsx } from './export.service.js';

const router = Router();

const sendFile = (res, buffer, contentType, filename) => {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
};

/**
 * GET /api/elections/:id/export.csv
 */
router.get(
  '/elections/:id/export.csv',
  authenticate,
  validate(electionIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await resultsService.getFinalResults(req.params.id);
    const buffer = generateResultsCsv(data);
    sendFile(res, buffer, 'text/csv; charset=utf-8', `resultados-${req.params.id}.csv`);
  })
);

/**
 * GET /api/elections/:id/export.xlsx
 */
router.get(
  '/elections/:id/export.xlsx',
  authenticate,
  validate(electionIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await resultsService.getFinalResults(req.params.id);
    const buffer = await generateResultsXlsx(data);
    sendFile(
      res,
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      `resultados-${req.params.id}.xlsx`
    );
  })
);

export default router;
