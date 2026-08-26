// src/modules/elections/election.service.js
// S4-01 — Lógica de negocio de elecciones.
// S4-13 — Validación del workflow de estados.

import * as electionRepository from './election.repository.js';
import * as positionRepository from './position.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import {
  prismaPagination,
  parsePagination,
} from '../../shared/utils/pagination.js';
import MESSAGES from '../../constants/messages.js';

/**
 * Workflow permitido. La base de datos NO restringe estas transiciones
 * (status es un enum sin trigger), así que la única garantía es esta tabla.
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  DRAFT: ['SCHEDULED'],
  SCHEDULED: ['OPEN'],
  OPEN: ['CLOSED'],
  CLOSED: ['CERTIFIED'],
  CERTIFIED: ['PUBLISHED'],
  PUBLISHED: [],
});

/** Solo se puede editar o borrar mientras la elección sea un borrador. */
const EDITABLE_STATUSES = ['DRAFT'];

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const toDate = (value) => (value === undefined ? undefined : new Date(value));

const translatePrismaError = (err) => {
  if (err?.code === 'P2025') {
    return ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  }
  if (err?.code === 'P2003') {
    return ApiError.badRequest(
      'El período, la facultad o el programa indicado no existe'
    );
  }
  if (err?.code === 'P2002') {
    return ApiError.conflict(MESSAGES.ELECTION.TITLE_TAKEN);
  }
  return err;
};

/** Traduce los RAISE EXCEPTION de certify_election() a errores de la API. */
const translateCertifyError = (err) => {
  const raw = String(err?.meta?.message ?? err?.message ?? '');

  if (raw.includes('no encontrada')) {
    return ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  }
  if (raw.includes('CERRADA')) {
    return ApiError.conflict('Solo se puede certificar una elección CERRADA');
  }
  return err;
};

export const listElections = async (query = {}) => {
  const { page, limit } = parsePagination(query);
  const { skip, take } = prismaPagination({ page, limit });

  const filters = {
    status: query.status,
    election_type: query.election_type,
    period_id: query.period_id,
    faculty_id: query.faculty_id,
    program_id: query.program_id,
    search: asText(query.search) || undefined,
  };

  const [total, elections] = await Promise.all([
    electionRepository.countElections(filters),
    electionRepository.listElections({ ...filters, skip, take }),
  ]);

  return {
    elections,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

export const getElectionById = async (id) => {
  const election = await electionRepository.findElectionById(id);

  if (!election) throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);

  return election;
};

export const createElection = async (body = {}, createdBy) => {
  if (!createdBy) {
    throw ApiError.unauthorized(
      'No se pudo identificar al creador de la elección'
    );
  }

  const data = {
    title: asText(body.title),
    description: asText(body.description),
    election_type: body.election_type,
    period_id: body.period_id,
    faculty_id: body.faculty_id ?? null,
    program_id: body.program_id ?? null,
    start_at: toDate(body.start_at),
    end_at: toDate(body.end_at),
    created_by: createdBy,
  };

  if (body.process_type !== undefined) data.process_type = body.process_type;
  if (body.form_structure !== undefined) {
    data.form_structure = body.form_structure;
  }
  if (body.is_anonymous_allowed !== undefined) {
    data.is_anonymous_allowed = body.is_anonymous_allowed;
  }

  try {
    return await electionRepository.createElection(data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

/** Construye el objeto de actualización solo con los campos presentes. */
const buildUpdateData = (body = {}) => {
  const data = {};

  if (body.title !== undefined) data.title = asText(body.title);
  if (body.description !== undefined) {
    data.description = asText(body.description);
  }
  if (body.process_type !== undefined) data.process_type = body.process_type;
  if (body.election_type !== undefined) {
    data.election_type = body.election_type;
  }
  if (body.period_id !== undefined) data.period_id = body.period_id;
  if (body.faculty_id !== undefined) data.faculty_id = body.faculty_id ?? null;
  if (body.program_id !== undefined) data.program_id = body.program_id ?? null;
  if (body.start_at !== undefined) data.start_at = toDate(body.start_at);
  if (body.end_at !== undefined) data.end_at = toDate(body.end_at);
  if (body.form_structure !== undefined) {
    data.form_structure = body.form_structure;
  }
  if (body.is_anonymous_allowed !== undefined) {
    data.is_anonymous_allowed = body.is_anonymous_allowed;
  }

  return data;
};

/** Carga la elección y exige que esté en un estado editable. */
const requireEditable = async (id) => {
  const current = await electionRepository.findElectionStatus(id);

  if (!current) throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);

  if (!EDITABLE_STATUSES.includes(current.status)) {
    throw ApiError.conflict(MESSAGES.ELECTION.DRAFT_ONLY_ACTION);
  }

  return current;
};

export const updateElection = async (id, body = {}) => {
  const current = await requireEditable(id);
  const data = buildUpdateData(body);

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }

  // Si solo llega una de las dos fechas, se compara contra la ya guardada.
  const inicio = data.start_at ?? current.start_at;
  const fin = data.end_at ?? current.end_at;
  if (new Date(fin) <= new Date(inicio)) {
    throw ApiError.badRequest(MESSAGES.ELECTION.INVALID_DATES);
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

// ─────────────────────────────────────────────
// S4-13 — WORKFLOW DE ESTADOS
// ─────────────────────────────────────────────

/** Requisitos extra que deben cumplirse antes de entrar a cada estado. */
const assertTransitionRules = async (election, target) => {
  if (target !== 'SCHEDULED') return;

  const positions = await positionRepository.countPositionsByElection(
    election.id
  );

  if (positions === 0) {
    throw ApiError.badRequest(
      'No se puede programar una elección que no tiene cargos definidos'
    );
  }

  if (new Date(election.end_at) <= new Date()) {
    throw ApiError.badRequest(MESSAGES.ELECTION.INVALID_DATES);
  }
};

export const changeStatus = async (id, targetStatus) => {
  const election = await electionRepository.findElectionStatus(id);

  if (!election) throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);

  const current = election.status;

  if (current === targetStatus) {
    throw ApiError.conflict(
      'La elección ya se encuentra en estado ' + current
    );
  }

  const permitidos = ALLOWED_TRANSITIONS[current] ?? [];

  if (!permitidos.includes(targetStatus)) {
    const detalle = permitidos.length
      ? 'Desde ' + current + ' solo se puede pasar a ' + permitidos.join(', ')
      : current + ' es un estado final';

    throw ApiError.conflict(
      'Transición no permitida: ' + current + ' -> ' + targetStatus + '. ' + detalle
    );
  }

  await assertTransitionRules(election, targetStatus);

  // La certificación tiene su propia función SQL transaccional.
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

export const getAllowedTransitions = (status) =>
  ALLOWED_TRANSITIONS[status] ?? [];

export default {
  listElections,
  getElectionById,
  createElection,
  updateElection,
  deleteElection,
  changeStatus,
  getAllowedTransitions,
};
