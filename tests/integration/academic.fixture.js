/**
 * Fixture académico compartido para tests de integración.
 *
 * Crea la Faculty + Program que las suites usan para dar a sus usuarios un
 * vínculo académico realista (programa del estudiante, facultad del
 * docente). Ninguno de los dos es obligatorio en la BD.
 */
import { prisma } from '../../src/database/prisma.js';

export const createAcademicFixture = async (runId) => {
  const faculty = await prisma.faculty.create({
    data: {
      name: `Facultad Test ${runId}`.slice(0, 149),
      code: `FT${runId}`.slice(0, 20),
    },
  });

  const program = await prisma.program.create({
    data: {
      facultyId: faculty.id,
      name: `Programa Test ${runId}`.slice(0, 149),
      code: `PT${runId}`.slice(0, 20),
    },
  });

  return { faculty, program };
};

export default { createAcademicFixture };
