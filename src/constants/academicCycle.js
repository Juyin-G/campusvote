/**
 * Reglas de ciclos académicos según el tipo de organización.
 *
 * - UNIVERSITY: las carreras universitarias en Perú duran típicamente 5 años
 *   (10 ciclos); algunas duran más (p. ej. Medicina ~14, Arquitectura, Derecho
 *   ~12 ciclos).
 * - INSTITUTE: las carreras técnicas duran 3 años = 6 ciclos.
 *
 * Cualquier otro tipo usa el fallback genérico.
 */
const CYCLE_RULES = {
  UNIVERSITY: { min: 1, max: 14, default: 10 },
  INSTITUTE: { min: 1, max: 6, default: 6 },
};

const FALLBACK_RULE = { min: 1, max: 14, default: 6 };

/**
 * Devuelve la regla de ciclos aplicable a un tipo de organización.
 * @param {string|undefined} orgType - Tipo de organización (org_type).
 * @returns {{min: number, max: number, default: number}}
 */
export const getCycleRule = (orgType) => CYCLE_RULES[orgType] ?? FALLBACK_RULE;

export default {
  getCycleRule,
};