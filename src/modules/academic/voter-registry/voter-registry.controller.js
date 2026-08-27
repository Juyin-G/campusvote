import voterRegistryService from './voter-registry.service.js';

class VoterRegistryController {
  /**
   * POST /academic/voter-registry/sync-sis
   * Ejecuta la sincronización masiva con el SIS mediante procedimiento almacenado.
   */
  async syncSisVoters(req, res, next) {
    try {
      const operatorUserId = req.user.id;
      const result = await voterRegistryService.syncSisVoters(operatorUserId, req.body);

      return res.status(200).json({
        success: true,
        message: 'Sincronización con el SIS ejecutada correctamente.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /academic/voter-registry
   * Agrega un nuevo votante manualmente al padrón electoral.
   */
  async createVoter(req, res, next) {
    try {
      const voter = await voterRegistryService.createVoter(req.body);

      return res.status(201).json({
        success: true,
        message: 'Votante registrado en el padrón exitosamente.',
        data: voter,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /academic/voter-registry
   * Listado paginado y filtrado de votantes del padrón.
   */
  async getVoters(req, res, next) {
    try {
      const result = await voterRegistryService.getVoters(req.query);

      return res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /academic/voter-registry/:id
   * Obtiene el detalle de un registro del padrón por ID.
   */
  async getVoterById(req, res, next) {
    try {
      const { id } = req.params;
      const voter = await voterRegistryService.getVoterById(id);

      return res.status(200).json({
        success: true,
        data: voter,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /academic/voter-registry/:id
   * Actualiza el estado de inhabilitación o datos académicos de un votante.
   */
  async updateVoter(req, res, next) {
    try {
      const { id } = req.params;
      const updatedVoter = await voterRegistryService.updateVoter(id, req.body);

      return res.status(200).json({
        success: true,
        message: 'Registro de padrón actualizado correctamente.',
        data: updatedVoter,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /academic/voter-registry/:id
   * Elimina a un estudiante del padrón electoral.
   */
  async deleteVoter(req, res, next) {
    try {
      const { id } = req.params;
      await voterRegistryService.deleteVoter(id);

      return res.status(200).json({
        success: true,
        message: 'Registro de padrón eliminado exitosamente.',
      });
    } catch (error) {
      next(error);
    }
  }
}

const voterRegistryController = new VoterRegistryController();
export default voterRegistryController;