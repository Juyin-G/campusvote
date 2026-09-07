/**
 * Catálogo de categorías de ferias/concursos (F8).
 * Por defecto se alinea a las 6 áreas temáticas de la OCDE (Frascati 2015)
 * usadas por CONCYTEC. Cada organización puede personalizar su propio
 * category_catalog; si está vacío se aplican estos valores.
 */
export const OCDE_CATEGORIES = Object.freeze([
  'CIENCIAS NATURALES',
  'INGENIERIA Y TECNOLOGIA',
  'CIENCIAS MEDICAS Y DE LA SALUD',
  'CIENCIAS AGRICOLAS Y VETERINARIAS',
  'CIENCIAS SOCIALES Y HUMANIDADES',
  'HUMANIDADES Y ARTES',
]);

// Normaliza (solo letras/números/espacios, sin tildes) para comparar.
const normalize = (value) =>
  String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

/**
 * Valida que una categoría pertenezca al catálogo de la organización, o al
 * catálogo OCDE por defecto. Devuelve true si es válida.
 */
export const isValidCategory = (category, catalog = []) => {
  const value = String(category || '').trim();
  if (!value) return true;
  const haystack = (Array.isArray(catalog) && catalog.length > 0 ? catalog : OCDE_CATEGORIES).map(
    normalize
  );
  return haystack.includes(normalize(value));
};

export default { OCDE_CATEGORIES, isValidCategory };