// src/modules/fairEvaluations/fairEvaluation.helpers.js
// Mappers puros y funciones auxiliares (sin BD, sin HTTP).
// Permite mantener el service delgado y testeable.

const mapCriterion = (c) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  position: c.position,
  is_active: c.isActive,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

export const mapRubric = (rubric) => ({
  id: rubric.id,
  fair_id: rubric.fairId,
  name: rubric.name,
  description: rubric.description,
  created_at: rubric.createdAt,
  updated_at: rubric.updatedAt,
  criteria: (rubric.criteria || []).map(mapCriterion),
});

export const mapEvaluation = (e) => ({
  id: e.id,
  fair_id: e.fairId,
  project_id: e.projectId,
  rubric_id: e.rubricId,
  submitted: Boolean(e.submittedAt),
  submitted_at: e.submittedAt,
  created_at: e.createdAt,
  updated_at: e.updatedAt,
  project: e.project
    ? { id: e.project.id, name: e.project.name, status: e.project.status }
    : null,
  jury: e.jury
    ? {
        id: e.jury.id,
        first_name: e.jury.firstName,
        last_name: e.jury.lastName,
        institutional_id: e.jury.institutionalId,
      }
    : null,
  responses: (e.details || []).map((d) => ({
    id: d.id,
    criterion_id: d.criterionId,
    criterion_name: d.criterion?.name ?? null,
    criterion_position: d.criterion?.position ?? null,
    checked: Boolean(d.checked),
  })),
});

export const mapDeclaration = (d) => ({
  id: d.id,
  fair_id: d.fairId,
  signed_at: d.signedAt,
  statement: d.statement,
  created_at: d.createdAt,
  updated_at: d.updatedAt,
});

/**
 * Normaliza el array de respuestas del cliente a {criterionId, checked}.
 * Reglas:
 *   - El array de respuestas debe cubrir EXACTAMENTE los criterios ACTIVOS.
 *   - Cualquier respuesta a un criterio que NO está en la rúbrica → 400.
 *   - Cualquier respuesta a un criterio INACTIVO → 409.
 *   - No se permiten criterios duplicados → 400.
 *   - La rúbrica SIEMPRE la resuelve el backend por fairId; el cliente
 *     nunca envía criterios arbitrarios.
 */
export const normalizeChecklistResponses = ({ criteria, responses }) => {
  const activeCriteria = criteria.filter((c) => c.isActive);
  const byId = new Map(criteria.map((c) => [String(c.id), c]));
  const seen = new Set();

  if (!Array.isArray(responses)) {
    throw Object.assign(new Error('Debes enviar las respuestas de la rúbrica'), {
      http: 400,
      code: 'INVALID_RESPONSES',
    });
  }

  // Rechaza duplicados en el payload (precobertura).
  for (const r of responses) {
    const k = String(r.criterion_id);
    if (seen.has(k)) {
      throw Object.assign(new Error('No puedes enviar un criterio duplicado'), {
        http: 400,
        code: 'DUPLICATE_CRITERION',
      });
    }
    seen.add(k);
  }

  // Rechaza respuestas a criterios INACTIVOS antes de validar cobertura.
  for (const r of responses) {
    const c = byId.get(String(r.criterion_id));
    if (c && !c.isActive) {
      throw Object.assign(
        new Error(`El criterio "${c.name}" está inactivo y no admite respuestas`),
        { http: 409, code: 'INACTIVE_CRITERION' }
      );
    }
  }

  if (responses.length !== activeCriteria.length) {
    const missing = activeCriteria
      .filter((c) => !responses.some((r) => String(r.criterion_id) === String(c.id)))
      .map((c) => c.name);
    const extras = responses.filter((r) => !byId.has(String(r.criterion_id))).length;
    throw Object.assign(
      new Error(
        `Debes responder todos los criterios activos. Faltan: ${missing.join(', ') || 'ninguno'}` +
          (extras ? ` · ${extras} criterio(s) no pertenecen a esta rúbrica.` : '')
      ),
      { http: 400, code: 'INVALID_RESPONSES' }
    );
  }

  return responses.map((r) => {
    const c = byId.get(String(r.criterion_id));
    if (!c) {
      throw Object.assign(
        new Error('Uno de los criterios no pertenece a la rúbrica de esta feria'),
        { http: 400, code: 'INVALID_CRITERION' }
      );
    }
    return { criterionId: c.id, checked: Boolean(r.checked) };
  });
};
