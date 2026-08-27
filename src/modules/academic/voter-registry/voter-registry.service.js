import voterRegistryRepository from './voter-registry.repository.js';

class VoterRegistryService {
  /**
   * Ejecuta el procedimiento almacenado SQL sync_sis_voters para importación masiva desde SIS.
   */
  async syncSisVoters(operatorUserId, payload) {
    const { periodId, students } = payload;

    const result = await voterRegistryRepository.callSyncSisVotersProcedure(
      operatorUserId,
      periodId,
      students
    );

    return result;
  }

  /**
   * Crea manualmente un registro de votante individual en el padrón.
   */
  async createVoter(voterData) {
    const existing = await voterRegistryRepository.findByUserAndPeriod(
      voterData.userId,
      voterData.periodId
    );

    if (existing) {
      const error = new Error('El usuario ya se encuentra registrado en el padrón electoral de este período.');
      error.statusCode = 409;
      throw error;
    }

    return await voterRegistryRepository.create(voterData);
  }

  /**
   * Obtiene la lista paginada de votantes con filtros (período, programa, estado de habilitación, búsqueda).
   */
  async getVoters(queryParams) {
    const { page, limit, periodId, programId, isEligible, search } = queryParams;

    const skip = (page - 1) * limit;

    const { items, total } = await voterRegistryRepository.findManyPaginated({
      skip,
      take: limit,
      periodId,
      programId,
      isEligible,
      search,
    });

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtiene un registro individual por su UUID.
   */
  async getVoterById(id) {
    const voter = await voterRegistryRepository.findById(id);

    if (!voter) {
      const error = new Error('Registro de votante no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    return voter;
  }

  /**
   * Actualiza el estado de inhabilitación o datos de programa/semestre de un votante.
   */
  async updateVoter(id, updateData) {
    await this.getVoterById(id);
    return await voterRegistryRepository.update(id, updateData);
  }

  /**
   * Elimina manualmente una entrada del padrón electoral.
   */
  async deleteVoter(id) {
    await this.getVoterById(id);
    return await voterRegistryRepository.delete(id);
  }
}

const voterRegistryService = new VoterRegistryService();
export default voterRegistryService;