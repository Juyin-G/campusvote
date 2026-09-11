import * as courseRepository from './course.repository.js';
import * as careerRepository from '../career/career.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import { isAdminActor } from '../teachingEvaluation/teachingEvaluation.service.js';

const assertOrgActor = (actor) => {
  if (!actor?.organizationId && actor?.role !== 'SUPERADMIN') {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'El usuario debe pertenecer a una organización');
  }
};

export const listCourses = async (query = {}, actor = {}) => {
  if (!isAdminActor(actor)) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Solo administradores');
  assertOrgActor(actor);
  const skip = Math.max(0, Number(query.skip) || 0);
  const take = Math.min(200, Math.max(1, Number(query.take) || 100));
  const organizationId = actor.role === 'SUPERADMIN' ? query.organization_id : actor.organizationId;
  if (actor.role !== 'SUPERADMIN' && !organizationId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Sin organización asociada');
  }
  const isActive =
    query.is_active === undefined
      ? undefined
      : query.is_active === 'true' || query.is_active === true
  const [data, total] = await Promise.all([
    courseRepository.list({ organizationId, careerId: query.career_id, isActive, skip, take }),
    courseRepository.count({ organizationId, careerId: query.career_id, isActive }),
  ]);
  return { data, meta: { total, skip, take, hasMore: skip + data.length < total } };
};

export const getCourseById = async (id, actor = {}) => {
  if (!isAdminActor(actor)) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Solo administradores');
  assertOrgActor(actor);
  const organizationId = actor.role === 'SUPERADMIN' ? undefined : actor.organizationId;
  const course = await courseRepository.findById(id, organizationId);
  if (!course) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Curso no encontrado');
  return course;
};

export const createCourse = async (data, actor = {}) => {
  if (!isAdminActor(actor)) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Solo administradores');
  if (!actor.organizationId) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'El actor debe pertenecer a una organización');
  const career = await careerRepository.findById(data.careerId, actor.organizationId);
  if (!career) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'La carrera no pertenece a tu organización');
  const existing = await courseRepository.findByCode(data.code, actor.organizationId, data.careerId);
  if (existing) {
    throw new ApiError(HTTP_STATUS.CONFLICT, `Ya existe un curso con el código ${data.code} en esa carrera`);
  }
  return courseRepository.create({
    organizationId: actor.organizationId,
    code: data.code,
    name: data.name,
    cycle: data.cycle,
    careerId: data.careerId,
  });
};

export const updateCourse = async (id, data, actor = {}) => {
  if (!isAdminActor(actor)) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Solo administradores');
  const organizationId = actor.role === 'SUPERADMIN' ? undefined : actor.organizationId;
  await getCourseById(id, actor);
  if (data.code) {
    const existing = await courseRepository.findByCode(data.code, organizationId, data.careerId);
    if (existing && existing.id !== id) {
      throw new ApiError(HTTP_STATUS.CONFLICT, `Otro curso ya usa el código ${data.code}`);
    }
  }
  if (data.careerId) {
    const career = await careerRepository.findById(data.careerId, organizationId);
    if (!career) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'La carrera destino no pertenece a tu organización');
  }
  return courseRepository.update(id, organizationId, data);
};

export const deleteCourse = async (id, actor = {}) => {
  if (!isAdminActor(actor)) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Solo administradores');
  await getCourseById(id, actor);
  const hasAssignments = await courseRepository.hasAssociatedAssignments(id);
  if (hasAssignments) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'No se puede eliminar el curso porque tiene asignaciones docentes activas. Desactívalo en su lugar.',
    );
  }
  return courseRepository.deleteById(id);
};
