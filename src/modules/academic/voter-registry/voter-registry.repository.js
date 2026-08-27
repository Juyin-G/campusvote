import { prisma } from '../../../database/prisma.js';

class VoterRegistryRepository {
  /**
   * Ejecuta la función SQL de sincronización masiva SIS.
   */
  async callSyncSisVotersProcedure(operatorUserId, periodId, students) {
    const result = await prisma.$queryRaw`
      SELECT * FROM sync_sis_voters(
        ${operatorUserId}::uuid,
        ${periodId}::uuid,
        ${JSON.stringify(students)}::jsonb
      )
    `;

    return result[0];
  }

  /**
   * Busca un registro por la combinación única de usuario y período.
   */
  async findByUserAndPeriod(userId, periodId) {
    return await prisma.voterRegistry.findUnique({
      where: {
        userId_periodId: {
          userId,
          periodId,
        },
      },
    });
  }

  /**
   * Crea un registro manual de votante en la base de datos.
   */
  async create(voterData) {
    return await prisma.voterRegistry.create({
      data: voterData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            institutionalId: true,
          },
        },
        program: true,
        academicPeriod: true,
      },
    });
  }

  /**
   * Consulta registros de votantes con filtros y paginación.
   */
  async findManyPaginated({ skip, take, periodId, programId, isEligible, search }) {
    const where = {};

    if (periodId) where.periodId = periodId;
    if (programId) where.programId = programId;
    if (typeof isEligible === 'boolean') where.isEligible = isEligible;

    if (search) {
      where.user = {
        OR: [
          { institutionalId: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.voterRegistry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              institutionalId: true,
            },
          },
          program: true,
          academicPeriod: true,
        },
      }),
      prisma.voterRegistry.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Busca un registro por su ID único.
   */
  async findById(id) {
    return await prisma.voterRegistry.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            institutionalId: true,
          },
        },
        program: true,
        academicPeriod: true,
      },
    });
  }

  /**
   * Actualiza un registro existente.
   */
  async update(id, updateData) {
    return await prisma.voterRegistry.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Elimina un registro del padrón.
   */
  async delete(id) {
    return await prisma.voterRegistry.delete({
      where: { id },
    });
  }
}

const voterRegistryRepository = new VoterRegistryRepository();
export default voterRegistryRepository;