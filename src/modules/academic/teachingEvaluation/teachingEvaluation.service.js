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
  return grouped;
};
