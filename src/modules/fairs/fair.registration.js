// src/modules/fairs/fair.registration.js
// Ventana de INSCRIPCIÓN de proyectos de una feria.
//
// Reglas:
//   - Si la feria define registrationDeadline, esa es la fecha de cierre.
//   - Si no, la inscripción cierra 24 horas antes de startsAt.
//   - Si la feria tampoco tiene startsAt, la inscripción no tiene límite.
//   - Pasado el cierre nadie inscribe, edita, envía ni cambia integrantes.
//
// La evaluación del jurado empieza cuando inicia la feria (startsAt), para
// que califique la versión final de cada proyecto.

const HORAS_ANTES_DEL_INICIO = 24;

/** Fecha efectiva de cierre de inscripción, o null si no hay límite. */
export const getRegistrationDeadline = (fair) => {
  if (fair.registrationDeadline) return new Date(fair.registrationDeadline);
  if (fair.startsAt) {
    return new Date(new Date(fair.startsAt).getTime() - HORAS_ANTES_DEL_INICIO * 60 * 60 * 1000);
  }
  return null;
};

export const isRegistrationClosed = (fair, now = new Date()) => {
  const deadline = getRegistrationDeadline(fair);
  return deadline !== null && now > deadline;
};

/** La evaluación solo se permite desde el inicio de la feria (si lo tiene). */
export const hasFairStarted = (fair, now = new Date()) =>
  !fair.startsAt || now >= new Date(fair.startsAt);

export default {
  getRegistrationDeadline,
  isRegistrationClosed,
  hasFairStarted,
};
