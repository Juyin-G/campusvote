import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { ROLES } from '../../../constants/roles.js';

const isAdmin = (actor) => [ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role);

const assertOrganization = (actor, organizationId) => {
  if (actor.role !== ROLES.SUPERADMIN && actor.organizationId !== organizationId) {
    throw ApiError.forbidden('El recurso no pertenece a tu organización');
  }
};

export const createTeachingAssignment = async (body, actor) => {
  if (!isAdmin(actor)) throw ApiError.forbidden('Solo un administrador puede asignar docentes');
  assertOrganization(actor, body.organization_id);

  const [career, course, teacher, period] = await Promise.all([
    prisma.career.findFirst({ where: { id: body.career_id, organizationId: body.organization_id, isActive: true } }),
    prisma.course.findFirst({ where: { id: body.course_id, organizationId: body.organization_id, careerId: body.career_id, isActive: true } }),
    prisma.user.findFirst({ where: { id: body.teacher_id, organizationId: body.organization_id, role: ROLES.TEACHER, status: 'ACTIVE' } }),
    prisma.academicPeriod.findUnique({ where: { id: body.academic_period_id } }),
  ]);
  if (!career || !course || !teacher || !period) {
    throw ApiError.badRequest('La carrera, curso, docente o periodo no pertenece a la organización');
  }
  if (course.cycle !== body.cycle) throw ApiError.badRequest('El ciclo no coincide con el curso');

  return prisma.teachingAssignment.create({
    data: {
      organizationId: body.organization_id,
      academicPeriodId: body.academic_period_id,
      careerId: body.career_id,
      courseId: body.course_id,
      teacherId: body.teacher_id,
      cycle: body.cycle,
    },
  });
};

export const listAssignmentsForStudent = async (studentId, actor) => {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true, organizationId: true, careerId: true, currentCycle: true, admissionPeriodId: true },
  });
  if (!student || student.role !== ROLES.STUDENT) throw ApiError.forbidden('Solo un alumno puede consultar sus docentes');
  if (actor.id !== studentId && actor.userId !== studentId) throw ApiError.forbidden('No puedes consultar la carga de otro alumno');

  return prisma.teachingAssignment.findMany({
    where: {
      organizationId: student.organizationId,
      careerId: student.careerId,
      cycle: student.currentCycle,
      academicPeriodId: student.admissionPeriodId,
      isActive: true,
    },
    include: { course: true, teacher: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ course: { name: 'asc' } }],
  });
};

export const listAssignmentsForAdmin = async (actor, filters = {}) => {
  if (!isAdmin(actor)) throw ApiError.forbidden('Solo un administrador puede listar asignaciones');
  const where = {
    ...(actor.role !== ROLES.SUPERADMIN ? { organizationId: actor.organizationId } : {}),
    ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.academicPeriodId ? { academicPeriodId: filters.academicPeriodId } : {}),
    ...(filters.cycle ? { cycle: Number(filters.cycle) } : {}),
    ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
  };
  return prisma.teachingAssignment.findMany({
    where,
    include: {
      course: { include: { career: true } },
      teacher: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
      academicPeriod: { select: { id: true, name: true } },
    },
    orderBy: [{ teacher: { lastName: 'asc' } }, { course: { name: 'asc' } }],
  });
};

export const removeTeachingAssignment = async (id, actor) => {
  if (!isAdmin(actor)) throw ApiError.forbidden('Solo un administrador puede quitar asignaciones');
  const existing = await prisma.teachingAssignment.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Asignación no encontrada');
  if (actor.role !== ROLES.SUPERADMIN && existing.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La asignación no pertenece a tu organización');
  }
  await prisma.teachingAssignment.delete({ where: { id } });
  return { id, deleted: true };
};

export const evaluateTeacher = async (body, actor) => {
  const studentId = actor.id ?? actor.userId;
  if (actor.role !== ROLES.STUDENT) throw ApiError.forbidden('Solo los alumnos pueden evaluar docentes');
  const assignment = await prisma.teachingAssignment.findUnique({
    where: { id: body.teaching_assignment_id },
    include: { course: true },
  });
  if (!assignment || assignment.organizationId !== actor.organizationId) throw ApiError.notFound('Asignación docente no encontrada');
  if (assignment.teacherId === studentId) throw ApiError.badRequest('No puedes evaluarte a ti mismo');

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { role: true, organizationId: true, careerId: true, currentCycle: true, admissionPeriodId: true },
  });
  if (student?.organizationId !== assignment.organizationId ||
      student.careerId !== assignment.careerId ||
      student.currentCycle !== assignment.cycle ||
      student.admissionPeriodId !== assignment.academicPeriodId) {
    throw ApiError.forbidden('Solo puedes evaluar docentes de tu carrera, ciclo y periodo');
  }

  try {
    return await prisma.teacherEvaluation.create({
      data: {
        organizationId: assignment.organizationId,
        academicPeriodId: assignment.academicPeriodId,
        teachingAssignmentId: assignment.id,
        courseId: assignment.courseId,
        studentId,
        teacherId: assignment.teacherId,
        score: body.score,
        comment: body.comment || null,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') throw ApiError.conflict('Ya evaluaste a este docente en este curso');
    throw error;
  }
};

export const teacherSummary = async (teacherId, actor, periodId) => {
  if (!isAdmin(actor) && actor.id !== teacherId && actor.userId !== teacherId) {
    throw ApiError.forbidden('No puedes consultar este resumen');
  }
  const where = {
    teacherId,
    ...(periodId ? { academicPeriodId: periodId } : {}),
    ...(actor.role === ROLES.SUPERADMIN ? {} : { organizationId: actor.organizationId }),
  };
  const grouped = await prisma.teacherEvaluation.groupBy({
    by: ['courseId'],
    where,
    _avg: { score: true },
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  // Enriquece cada curso con su nombre, ciclo y carrera asociada.
  const courseIds = grouped.map((g) => g.courseId);
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: {
      id: true,
      code: true,
      name: true,
      cycle: true,
      career: { select: { id: true, code: true, name: true } },
    },
  });
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  return grouped.map((g) => {
    const course = courseMap.get(g.courseId);
    return {
      courseId: g.courseId,
      averageScore: g._avg?.score ?? null,
      totalEvaluations: g._count?._all ?? 0,
      course: course
        ? {
            id: course.id,
            code: course.code,
            name: course.name,
            cycle: course.cycle,
            career: course.career
              ? { id: course.career.id, code: course.career.code, name: course.career.name }
              : null,
          }
        : null,
    };
  });
};
