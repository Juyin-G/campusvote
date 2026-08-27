// src/modules/elections/elections/election.schema.js 
// S4-03 — Validación Zod de elecciones. Refleja los CHECK de la tabla `elections`.

import { z } from 'zod';

export const PROCESS_TYPES = ['VOTE', 'FAIR', 'FEEDBACK', 'FORM'];
export const SCOPE_TYPES = ['UNIVERSITY', 'FACULTY', 'PROGRAM'];
export const STATUS_TYPES = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CERTIFIED', 'PUBLISHED'];

const uuid = (label = 'ID') => z.string().uuid(`${label} inválido`);

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Fecha inválida (usa formato ISO-8601)');

const nonEmptyText = (max, label) =>
  z
    .string()
    .max(max, `Como máximo ${max} caracteres`)
    .refine((value) => value.trim().length > 0, `${label} no puede estar vacío`);

/**
 * chk_elections_scope_integrity:
 *   UNIVERSITY -> faculty_id NULL y program_id NULL
 *   FACULTY    -> faculty_id NOT NULL y program_id NULL
 *   PROGRAM    -> faculty_id NOT NULL y program_id NOT NULL
 */
const applyScopeRules = (data, ctx) => {
  const { scope_type, faculty_id, program_id } = data;
  const err = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });

  if (scope_type === 'UNIVERSITY') {
    if (faculty_id) err('faculty_id', 'Una elección UNIVERSITY no puede tener facultad');
    if (program_id) err('program_id', 'Una elección UNIVERSITY no puede tener programa');
  }

  if (scope_type === 'FACULTY') {
    if (!faculty_id) err('faculty_id', 'Una elección FACULTY requiere faculty_id');
    if (program_id) err('program_id', 'Una elección FACULTY no puede tener programa');
  }

  if (scope_type === 'PROGRAM') {
    if (!faculty_id) err('faculty_id', 'Una elección PROGRAM requiere faculty_id');
    if (!program_id) err('program_id', 'Una elección PROGRAM requiere program_id');
  }
};

const applyDateRules = (data, ctx) => {
  const { start_at, end_at } = data;
  if (!start_at || !end_at) return;

  if (Date.parse(end_at) <= Date.parse(start_at)) {
    ctx.addIssue({
      code: 'custom',
      path: ['end_at'],
      message: 'La fecha de fin debe ser posterior a la de inicio',
    });
  }
};

// NUEVO: Validación cruzada para chk_elections_form_structure
const applyFormStructureRules = (data, ctx) => {
  if (data.process_type === 'FORM') {
    if (!data.form_structure || Object.keys(data.form_structure).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['form_structure'],
        message: 'El proceso de tipo FORM requiere una estructura de formulario válida (no vacía)',
      });
    }
  }
};

export const electionParamsSchema = z.object({
  params: z.object({ id: uuid('ID de elección') }),
});

export const listElectionSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    status: z.enum(STATUS_TYPES).optional(),
    scope_type: z.enum(SCOPE_TYPES).optional(), 
    period_id: uuid('period_id').optional(),
    faculty_id: uuid('faculty_id').optional(),
    program_id: uuid('program_id').optional(),
    search: z.string().max(100).optional(),
  }),
});

export const createElectionSchema = z.object({
  body: z
    .object({
      title: nonEmptyText(255, 'El título'),
      description: z.string().max(5000).optional().default(''),
      process_type: z.enum(PROCESS_TYPES).optional().default('VOTE'),
      scope_type: z.enum(SCOPE_TYPES), // ⚠️ CORRECCIÓN
      period_id: uuid('period_id'),
      faculty_id: uuid('faculty_id').nullable().optional(),
      program_id: uuid('program_id').nullable().optional(),
      start_at: isoDate,
      end_at: isoDate,
      form_structure: z.record(z.string(), z.unknown()).nullable().optional(),
      is_anonymous_allowed: z.boolean().optional().default(false),
    })
    .superRefine((data, ctx) => {
      applyScopeRules(data, ctx);
      applyDateRules(data, ctx);
      applyFormStructureRules(data, ctx); 
    }),
});

export const updateElectionSchema = z.object({
  params: z.object({ id: uuid('ID de elección') }),
  body: z
    .object({
      title: nonEmptyText(255, 'El título').optional(),
      description: z.string().max(5000).optional(),
      process_type: z.enum(PROCESS_TYPES).optional(),
      scope_type: z.enum(SCOPE_TYPES).optional(), // ⚠️ CORRECCIÓN
      period_id: uuid('period_id').optional(),
      faculty_id: uuid('faculty_id').nullable().optional(),
      program_id: uuid('program_id').nullable().optional(),
      start_at: isoDate.optional(),
      end_at: isoDate.optional(),
      form_structure: z.record(z.string(), z.unknown()).nullable().optional(),
      is_anonymous_allowed: z.boolean().optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado'
    )
    .superRefine((data, ctx) => {
      if (data.scope_type) applyScopeRules(data, ctx);
      applyDateRules(data, ctx);
      applyFormStructureRules(data, ctx); // ⚠️ NUEVO
    }),
});

export const changeStatusSchema = z.object({
  params: z.object({ id: uuid('ID de elección') }),
  body: z.object({
    status: z.enum(STATUS_TYPES),
  }),
});