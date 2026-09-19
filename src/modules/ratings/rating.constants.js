// src/modules/ratings/rating.constants.js
// Constantes compartidas del módulo electoral de calificaciones.

import { ROLES } from '../../constants/roles.js';

// Tipos de proceso que admiten rating de proyectos (jurados).
export const RATING_PROCESS_TYPES = ['FAIR', 'AWARD', 'EVENT_POLL'];

// Estados en los que se permite calificar.
export const RATING_ALLOWED_STATUS = ['OPEN'];

// Puntos máximos de la escala de rúbrica (vigesimal, decisión F4).
export const RUBRIC_MAX_SCORE = 20;

// Estados en los que se permite configurar la rúbrica.
export const RUBRIC_CONFIGURABLE_STATUSES = ['DRAFT', 'SCHEDULED'];

export { ROLES };
