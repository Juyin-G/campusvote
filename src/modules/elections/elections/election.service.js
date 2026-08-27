// src/modules/elections/elections/election.service.js

import * as electionRepository from '../elections/election.repository.js';
import * as positionRepository from '../positions/position.repository.js'; // Ajusta la ruta si es necesario
import { ApiError } from '../../../shared/errors/ApiError.js';
import { prismaPagination, parsePagination } from '../../../shared/utils/pagination.js';
import MESSAGES from '../../../constants/messages.js';

const ALLOWED_TRANSITIONS = Object.freeze({
  DRAFT: ['SCHEDULED'],
  SCHEDULED: ['OPEN'],
  OPEN: ['CLOSED'],
  CLOSED: ['CERTIFIED'],
  CERTIFIED: ['PUBLISHED'],
  PUBLISHED: [],
});

// ⚠️ CORRECCIÓN: Alineado con el trigger de la BD y los módulos de listas/candidaturas
const EDITABLE_STATUSES = ['DRAFT', 'SCHEDULED'];

const asText = (value) => (typeof value === 'string' ? value.trim() : '');
const toDate = (value) => (value === undefined ? undefined : new Date(value));

const translatePrismaError = (err) => {
  if (err?.code === 'P2025') return ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  if (err?.code === 'P2003') return ApiError.badRequest('El período, la facultad o el programa indicado no existe');
  if (err?.code === 'P2002') return ApiError.conflict(MESSAGES.ELECTION.TITLE_TAKEN || 'Ya existe una elección con este título');
  return err;
};

const translateCertifyError = (err) => {
  const raw = String(err?.meta?.message ?? err?.message ?? '');
  if (raw.includes('no encontrada')) return ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  if (raw.includes('CERRADA')) return ApiError.conflict('Solo se puede certificar una elección CERRADA');
  return err;
};

export const listElections = async (query = {}) => {
  const { page, limit } = parsePagination(query);
  const { skip, take } = prismaPagination({ page, limit });

  const filters = {
    status: query.status,
    scopeType: query.scope_type, 
    periodId: query.period_id,
    facultyId: query.faculty_id,
    programId: query.program_id,
    search: asText(query.search) || undefined,
  };

  const [total, elections] = await Promise.all([
    electionRepository.countElections(filters),
    electionRepository.listElections({ ...filters, skip, take }),
  ]);

  return {
    elections,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  };
};

export const getElectionById = async (id) => {
  const election = await electionRepository.findElectionById(id);
  if (!election) throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  return election;
};

export const createElection = async (body = {}, createdBy) => {
  if (!createdBy) throw ApiError.unauthorized('No se pudo identificar al creador de la elección');

  const data = {
    title: asText(body.title),
    description: asText(body.description || ''),
    processType: body.process_type || 'VOTE',
    scopeType: body.scope_type, 
    periodId: body.period_id,
    facultyId: body.faculty_id ?? null,
    programId: body.program_id ?? null,
    startAt: toDate(body.start_at),
    endAt: toDate(body.end_at),
    createdBy: createdBy,
    formStructure: body.form_structure ?? null,
    isAnonymousAllowed: body.is_anonymous_allowed ?? false,
  };

  try {
    return await electionRepository.createElection(data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

const buildUpdateData = (body = {}) => {
  const data = {};
  if (body.title !== undefined) data.title = asText(body.title);
  if (body.description !== undefined) data.description = asText(body.description);
  if (body.process_type !== undefined) data.processType = body.process_type;
  if (body.scope_type !== undefined) data.scopeType = body.scope_type; // ⚠️ CORRECCIÓN
  if (body.period_id !== undefined) data.periodId = body.period_id;
  if (body.faculty_id !== undefined) data.facultyId = body.faculty_id ?? null;
  if (body.program_id !== undefined) data.programId = body.program_id ?? null;
  if (body.start_at !== undefined) data.startAt = toDate(body.start_at);
  if (body.end_at !== undefined) data.endAt = toDate(body.end_at);
  if (body.form_structure !== undefined) data.formStructure = body.form_structure;
  if (body.is_anonymous_allowed !== undefined) data.isAnonymousAllowed = body.is_anonymous_allowed;

  return data;
};

const requireEditable = async (id) => {
  const current = await electionRepository.findElectionStatus(id);
  if (!current) throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);

  if (!EDITABLE_STATUSES.includes(current.status)) {
    throw ApiError.conflict(MESSAGES.ELECTION.DRAFT_ONLY_ACTION || 'La elección ya no es editable');
  }
  return current;
};

export const updateElection = async (id, body = {}) => {
  const current = await requireEditable(id);
  const data = buildUpdateData(body);

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST || 'Solicitud inválida');
  }

  const inicio = data.startAt ?? current.startAt;
  const fin = data.endAt ?? current.endAt;
  if (new Date(fin) <= new Date(inicio)) {
    throw ApiError.badRequest(MESSAGES.ELECTION.INVALID_DATES || 'La fecha de fin debe ser posterior a la de inicio');
  }

  try {
    return await electionRepository.updateElection(id, data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const deleteElection = async (id) => {
  await requireEditable(id);
  try {
    await electionRepository.deleteElectionById(id);
    return { deleted: true };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

// S4-13 — WORKFLOW DE ESTADOS

const assertTransitionRules = async (election, target) => {
  if (target !== 'SCHEDULED') return;

  const positions = await positionRepository.countPositionsByElection(election.id);
  if (positions === 0) {
    throw ApiError.badRequest('No se puede programar una elección que no tiene cargos definidos');
  }

  if (new Date(election.endAt) <= new Date()) { // ⚠️ CORRECCIÓN: camelCase
    throw ApiError.badRequest(MESSAGES.ELECTION.INVALID_DATES || 'La fecha de fin ya pasó');
  }
};

export const changeStatus = async (id, targetStatus) => {
  const election = await electionRepository.findElectionStatus(id);
  if (!election) throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);

  const current = election.status;
  if (current === targetStatus) {
    throw ApiError.conflict(`La elección ya se encuentra en estado ${current}`);
  }

  const permitidos = ALLOWED_TRANSITIONS[current] ?? [];
  if (!permitidos.includes(targetStatus)) {
    const detalle = permitidos.length
      ? `Desde ${current} solo se puede pasar a ${permitidos.join(', ')}`
      : `${current} es un estado final`;
    throw ApiError.conflict(`Transición no permitida: ${current} -> ${targetStatus}. ${detalle}`);
  }

  await assertTransitionRules(election, targetStatus);

  if (targetStatus === 'CERTIFIED') {
    try {
      return await electionRepository.certifyElection(id);
    } catch (err) {
      throw translateCertifyError(err);
    }
  }

  try {
    return await electionRepository.updateElectionStatus(id, targetStatus);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const getAllowedTransitions = (status) => ALLOWED_TRANSITIONS[status] ?? [];

export default {
  listElections,
  getElectionById,
  createElection,
  updateElection,
  deleteElection,
  changeStatus,
  getAllowedTransitions,
};