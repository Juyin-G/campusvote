/**
 * @file passwordPolicy.js
 * @description Política de contraseñas única, compartida por el sistema completo.
 *
 * Existe en un solo sitio a propósito: la contraseña se fija desde cinco
 * lugares distintos (registro, reset, creación por admin, cambio propio y
 * reset por admin) y tenerla duplicada garantizaba que se desincronizara.
 *
 * Los requisitos son los que ya anunciaba MESSAGES.USER.PASSWORD_TOO_WEAK,
 * que hasta ahora prometía una complejidad que nadie validaba.
 */

import { z } from 'zod';

/**
 * bcrypt solo tiene en cuenta los primeros 72 bytes; lo que sobrepase ese
 * límite se ignora en silencio. Se rechaza de forma explícita en lugar de
 * aceptar una contraseña que después se recorta sin avisar al usuario.
 */
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Como mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(
    PASSWORD_MAX_LENGTH,
    `Como máximo ${PASSWORD_MAX_LENGTH} caracteres (límite de bcrypt)`
  )
  .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula')
  .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
  .regex(/\d/, 'Debe incluir al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial');

export default passwordSchema;
