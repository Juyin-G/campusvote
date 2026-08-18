/**
 * @file user.schema.js
 * @description Schemas relacionados con el modelo User
 * @see database/sql/user/002_users_table.sql
 */

const UserSchema = {
  type: 'object',
  required: ['username', 'email', 'institutional_id', 'role'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'ID único del usuario (UUID v4)',
    },
    username: {
      type: 'string',
      description: 'Nombre de usuario único (case-insensitive)',
      example: 'jperez',
    },
    email: {
      type: 'string',
      format: 'email',
      description: 'Email del usuario (único)',
      example: 'juan.perez@universidad.edu',
    },
    institutional_id: {
      type: 'string',
      description: 'ID institucional (código de estudiante/profesor)',
      example: '20210123',
    },
    first_name: {
      type: 'string',
      description: 'Nombre del usuario',
      example: 'Juan',
    },
    last_name: {
      type: 'string',
      description: 'Apellido del usuario',
      example: 'Pérez',
    },
    role: {
      type: 'string',
      enum: ['STUDENT', 'TEACHER', 'ADMIN', 'ELECTORAL_COMMISSION', 'OBSERVER'],
      description: 'Rol del usuario en el sistema',
      example: 'STUDENT',
    },
    auth_provider: {
      type: 'string',
      enum: ['LOCAL', 'GOOGLE'],
      description: 'Proveedor de autenticación',
      example: 'LOCAL',
    },
    organization_id: {
      type: 'string',
      format: 'uuid',
      description: 'ID de la organización a la que pertenece',
      nullable: true,
    },
    is_verified: {
      type: 'boolean',
      description: 'Si el email está verificado',
    },
    is_active: {
      type: 'boolean',
      description: 'Si la cuenta está activa',
    },
    two_factor_enabled: {
      type: 'boolean',
      description: 'Si el usuario tiene 2FA habilitado',
    },
    date_joined: {
      type: 'string',
      format: 'date-time',
      description: 'Fecha de registro',
    },
    last_login: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Último inicio de sesión',
    },
    created_at: {
      type: 'string',
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
  },
};

const UserListSchema = {
  type: 'array',
  items: { $ref: '#/components/schemas/User' },
};

export default {
  User: UserSchema,
  UserList: UserListSchema,
};