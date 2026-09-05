// src/modules/elections/elections/election.service.js

import * as electionRepository from '../elections/election.repository.js';
import * as positionRepository from '../positions/position.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { prismaPagination, parsePagination } from '../../../shared/utils/pagination.js';
import MESSAGES from '../../../constants/messages.js';
import { prisma } from '../../../database/prisma.js';
import auditService from '../../audit/audit.service.js';
import logger from '../../../config/logger.js';

const ALLOWED_TRANSITIONS = Object.freeze({
  DRAFT: ['SCHEDULED'],
  SCHEDULED: ['OPEN'],
  OPEN: ['CLOSED'],
  CLOSED: ['CERTIFIED'],
  CERTIFIED: ['PUBLISHED'],
  PUBLISHED: [],
});

const EDITABLE_STATUSES = ['DRAFT'];

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
    const created = await electionRepository.createElection(data);

    try {
      await auditService.logAction({
        actorId: createdBy,
        electionId: created.id,
        action: 'CREATE_ELECTION',
        metadata: { title: data.title, process_type: data.processType },
      });
    } catch (err) {
      logger.warn('No se pudo registrar CREATE_ELECTION en auditoría', { error: err.message });
    }

    return created;
  } catch (err) {
    throw translatePrismaError(err);
  }
};

const buildUpdateData = (body = {}) => {
  const data = {};
  if (body.title !== undefined) data.title = asText(body.title);
  if (body.description !== undefined) data.description = asText(body.description);
  if (body.process_type !== undefined) data.processType = body.process_type;
  if (body.scope_type !== undefined) data.scopeType = body.scope_type; 
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
  if (target === 'SCHEDULED') {
    // Se utiliza findPositionsByElection para evitar llamadas a funciones inexistentes
    const positions = await positionRepository.findPositionsByElection(election.id);
    if (!positions || positions.length === 0) {
      throw ApiError.badRequest('No se puede programar una elección que no tiene cargos definidos');
    }

    if (new Date(election.endAt) <= new Date()) {
      throw ApiError.badRequest(MESSAGES.ELECTION.INVALID_DATES || 'La fecha de fin ya pasó');
    }
  }

  // F3: no se abre un proceso con tachas pendientes de resolver.
  if (target === 'OPEN') {
    const pending = await prisma.candidacyObjection.count({
      where: { electionId: election.id, status: 'PENDING' },
    });
    if (pending > 0) {
      throw ApiError.conflict(
        `No se puede abrir la votación mientras existan ${pending} tacha(s) pendiente(s) de resolver`
      );
    }
  }
};

export const changeStatus = async (id, targetStatus, actorId = null) => {
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
      return await electionRepository.certifyElection(id, actorId);
    } catch (err) {
      throw translateCertifyError(err);
    }
  }

  try {
    const updated = await electionRepository.updateElectionStatus(id, targetStatus);

    // Auditoría de cambio de estado (OPEN_ELECTION / CLOSE_ELECTION).
    const stateActionMap = { OPEN: 'OPEN_ELECTION', CLOSED: 'CLOSE_ELECTION' };
    const action = stateActionMap[targetStatus];
    if (action && actorId) {
      try {
        await auditService.logAction({
          actorId,
          electionId: id,
          action,
          metadata: { from: current, to: targetStatus },
        });
      } catch (err) {
        logger.warn('No se pudo registrar el cambio de estado en auditoría', {
          error: err.message,
        });
      }
    }

    return updated;
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