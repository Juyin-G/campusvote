import * as careerRepository from './career.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import { isAdminActor } from '../teachingEvaluation/teachingEvaluation.service.js';

const assertOrgActor = (actor) => {
  if (!actor?.organizationId && actor?.role !== 'SUPERADMIN') {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'El usuario debe pertenecer a una organización');
  }
};

export const listCareers = async (query = {}, actor = {}) => {
  if (!isAdminActor(actor)) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Solo administradores');
  assertOrgActor(actor);
  const skip = Math.max(0, Number(query.skip) || 0);
  const take = Math.min(200, Math.max(1, Number(query.take) || 100));
  const organizationId = actor.role === 'SUPERADMIN' ? query.organizationId : actor.organizationId;
  if (actor.role !== 'SUPERADMIN' && !organizationId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Sin organización asociada');
  }
  const isActive =
    query.is_active === undefined
      ? undefined
      : query.is_active === 'true' || query.is_active === true
  const [data, total] = await Promise.all([
    careerRepository.list({ organizationId, isActive, skip, take }),
    careerRepository.count({ organizationId, isActive }),
  ]);
  return { data, meta: { total, skip, take, hasMore: skip + data.length < total } };
};

export const getCareerById = async (id, actor = {}) => {
  if (!isAdminActor(actor)) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Solo administradores');
  assertOrgActor(actor);
  const organizationId = actor.role === 'SUPERADMIN' ? undefined : actor.organizationId;
  const career = await careerRepository.findById(id, organizationId);
  if (!career) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Carrera no encontrada');
  return career;
};

export const createCareer = async (data, actor = {}) => {
  if (!isAdminActor(actor)) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Solo administradores');
  if (!actor.organizationId) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'El actor debe pertenecer a una organización');
  const existing = await careerRepository.findByCode(data.code, actor.organizationId);
  if (existing) {
    throw new ApiError(HTTP_STATUS.CONFLICT, `Ya existe una carrera con el código ${data.code}`);
  }
  return careerRepository.create({
    organizationId: actor.organizationId,
    code: data.code,
    name: data.name,
    total_cycles: data.total_cycles ?? 6,
  });
};

export const updateCareer = async (id, data, actor = {}) => {
  if (!isAdminActor(actor)) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Solo administradores');
  const organizationId = actor.role === 'SUPERADMIN' ? undefined : actor.organizationId;
  await getCareerById(id, actor);
  if (data.code) {
    const existing = await careerRepository.findByCode(data.code, organizationId);
    if (existing && existing.id !== id) {
      throw new ApiError(HTTP_STATUS.CONFLICT, `Otra carrera ya usa el código ${data.code}`);
    }
  }
  const updateData = { ...data }
  if (updateData.is_active !== undefined) {
    updateData.isActive = updateData.is_active
    delete updateData.is_active
  }
  return careerRepository.update(id, organizationId, updateData);
};

export const deleteCareer = async (id, actor = {}) => {
  if (!isAdminActor(actor)) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Solo administradores');
  await getCareerById(id, actor);
  const hasCourses = await careerRepository.hasAssociatedCourses(id);
  if (hasCourses) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'No se puede eliminar la carrera porque tiene cursos asociados. Desactívala en su lugar.',
    );
  }
  return careerRepository.deleteById(id);
};
