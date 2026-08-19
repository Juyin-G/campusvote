/**
 * Validation shapes for auth routes (manual checks until Zod is added).
 */

export const loginBodyShape = {
  email: 'string',
  password: 'string',
};

export const registerBodyShape = {
  username: 'string',
  email: 'string',
  password: 'string',
  firstName: 'string',
  lastName: 'string',
  institutionalId: 'string',
};

export function assertLoginBody(body) {
  if (!body?.email || !body?.password) {
    const error = new Error('Email y contraseña son obligatorios');
    error.statusCode = 400;
    throw error;
  }
}
