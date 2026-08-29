/**
 * Fixture académico compartido para tests de integración.
 *
 * Los CHECK constraints de Postgres (chk_users_academic_linkage y
 * chk_users_student_data) exigen que los usuarios STUDENT tengan
 * program_id y current_cycle. Este helper crea la Faculty + Program
 * necesarios una sola vez por suite.
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
