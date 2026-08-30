/**
 * Utilidades de parseo del código institucional para derivar la carrera (y ciclo)
 * del estudiante según las carreras configuradas por su organización.
 */

/**
 * Encuentra la carrera cuya `code` es prefijo del código institucional.
 * Gana el prefijo más largo (mayor especificidad).
 * @param {string} institutionalId - ej: "C-24-12345" o "DDS-2023-001"
 * @param {Array<{code:string,cycle?:number}>} careers - carreras de la org
 * @returns {object|null} la carrera que coincide o null
 */
export const matchCareerFromCode = (institutionalId, careers) => {
  if (!institutionalId || !Array.isArray(careers) || careers.length === 0) return null;

  const norm = String(institutionalId).toUpperCase().trim();
  let best = null;

  for (const career of careers) {
    const code = career && career.code ? String(career.code).toUpperCase().trim() : '';
    if (code && norm.startsWith(code)) {
      if (!best || code.length > String(best.code).length) best = career;
    }
  }

  return best;
};

/**
 * Extrae el ciclo (1-20) del código institucional. Si el código trae dígitos luego
 * del prefijo de la carrera (ej: "C-24" → 24), se usa ese valor; si no, se usa el
 * ciclo configurado de la carrera (si existe).
 * @param {string} institutionalId
 * @param {object|null} career - carrera coincidente (con `code` y opcional `cycle`)
 * @returns {number|null}
 */
export const extractCycleFromCode = (institutionalId, career) => {
  if (!institutionalId) return null;

  const norm = String(institutionalId).toUpperCase().trim();
  const code = career && career.code ? String(career.code).toUpperCase().trim() : '';
  const rest = code ? norm.slice(code.length) : norm;

  const cycleMatch = rest.match(/(\d+)/);
  if (cycleMatch) {
    const value = parseInt(cycleMatch[1], 10);
    if (value >= 1 && value <= 20) return value;
  }

  if (career && career.cycle && career.cycle >= 1 && career.cycle <= 20) {
    return career.cycle;
  }

  return null;
};

export default { matchCareerFromCode, extractCycleFromCode };
