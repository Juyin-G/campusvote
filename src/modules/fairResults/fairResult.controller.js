import { FairResultsService } from './fairResult.service.js';

export class FairResultsController {
  /**
   * GET /api/fairs/:id/results
   */
  static async getResults(req, res, next) {
    try {
      const { id: fairId } = req.params;
      const data = await FairResultsService.getResults(fairId, req.user);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/fairs/:id/results/publish
   */
  static async publishResults(req, res, next) {
    try {
      const { id: fairId } = req.params;
      // Se descarta deliberadamente req.body para evitar inyecciones en la publicación
      const data = await FairResultsService.publishResults(fairId, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fairs/:id/projects/:projectId
   */
  static async getProjectReview(req, res, next) {
    try {
      const { id: fairId, projectId } = req.params;
      const data = await FairResultsService.getProjectReviewForJury(fairId, projectId, req.user);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}