// SISTEMA DE MENSAJES CENTRALIZADOS

export const MESSAGES = {
  // AUTENTICACIÓN (AUTH)
  AUTH: {
    LOGIN_SUCCESS: 'Inicio de sesión exitoso.',
    LOGIN_FAILED: 'Credenciales inválidas. Verifique su email y contraseña.',
    LOGIN_LOCKED: 'Su cuenta ha sido bloqueada temporalmente por múltiples intentos fallidos. Intente nuevamente en {minutes} minutos.',
    LOGIN_ACCOUNT_INACTIVE: 'Su cuenta se encuentra inactiva. Contacte al administrador.',
    LOGIN_EMAIL_NOT_VERIFIED: 'Debe verificar su correo electrónico antes de iniciar sesión.',
    LOGIN_MUST_CHANGE_PASSWORD: 'Debe cambiar su contraseña temporal para continuar.',
    LOGOUT_SUCCESS: 'Sesión cerrada correctamente.',

    // Onboarding (primera activación de administradores)
    ONBOARDING_REQUIRED: 'Debe completar la configuración de su cuenta para continuar.',
    ONBOARDING_COMPLETE_2FA_FIRST: 'Debe completar la configuración de 2FA antes de finalizar el acceso.',
    ACTIVATION_INVALID_TOKEN: 'El enlace de activación es inválido o ha expirado.',
    ACTIVATION_EMAIL_SENT: 'Invitación de activación enviada correctamente.',
    ACTIVATION_EMAIL_FAILED: 'El administrador fue creado, pero no se pudo enviar la invitación.',

    // 2FA
    TWO_FACTOR_REQUIRED: 'Se requiere autenticación de dos factores (2FA) para continuar.',
    TWO_FACTOR_INVALID_CODE: 'El código 2FA proporcionado es inválido o ha expirado.',
    TWO_FACTOR_ENABLED_SUCCESS: 'Autenticación de dos factores activada correctamente.',
    TWO_FACTOR_DISABLED_SUCCESS: 'Autenticación de dos factores desactivada correctamente.',
    TWO_FACTOR_BACKUP_CODES_GENERATED: 'Códigos de respaldo generados. Guárdelos en un lugar seguro.',
    TWO_FACTOR_NOT_CONFIGURED: 'El usuario no tiene configurado 2FA.',

    // Google OAuth
    GOOGLE_LOGIN_SUCCESS: 'Inicio de sesión con Google exitoso.',
    GOOGLE_AUTH_FAILED: 'No se pudo autenticar con Google. Intente nuevamente.',
    GOOGLE_ACCOUNT_NOT_LINKED: 'No existe una cuenta asociada a este correo de Google.',

    // Tokens
    TOKEN_EXPIRED: 'El token ha expirado. Inicie sesión nuevamente.',
    TOKEN_INVALID: 'Token inválido o malformado.',
    TOKEN_MISSING: 'Token de autenticación requerido.',
    TOKEN_REFRESH_SUCCESS: 'Token renovado correctamente.',

    // Recuperación de contraseña
    PASSWORD_RESET_REQUESTED: 'Si el correo existe, recibirá un enlace para restablecer su contraseña.',
    PASSWORD_RESET_INVALID_TOKEN: 'El enlace de recuperación es inválido o ha expirado.',
    PASSWORD_RESET_SUCCESS: 'Contraseña restablecida correctamente.',
    PASSWORD_RESET_RATE_LIMITED: 'Ha solicitado demasiados restablecimientos. Intente más tarde.',

    // Verificación de email
    EMAIL_VERIFICATION_SENT: 'Correo de verificación enviado. Revise su bandeja de entrada.',
    EMAIL_VERIFIED_SUCCESS: 'Correo electrónico verificado correctamente.',
    EMAIL_VERIFICATION_INVALID: 'El enlace de verificación es inválido o ha expirado.',
    EMAIL_ALREADY_VERIFIED: 'El correo electrónico ya se encuentra verificado.',
    EMAIL_SEND_FAILED: 'No se pudo enviar el correo electrónico. Intente más tarde.',
    REGISTER_EMAIL_FAILED:
      'La cuenta fue creada, pero no se pudo enviar el correo de verificación. Solicite el reenvío para activarla.',
  },

  // USUARIOS (USERS)
  USER: {
    CREATED_SUCCESS: 'Usuario creado correctamente.',
    UPDATED_SUCCESS: 'Usuario actualizado correctamente.',
    DELETED_SUCCESS: 'Usuario eliminado correctamente.',
    NOT_FOUND: 'El usuario solicitado no existe.',
    ALREADY_EXISTS: 'Ya existe un usuario con ese email o identificador institucional.',
    USERNAME_TAKEN: 'El nombre de usuario ya está en uso.',
    INSTITUTIONAL_ID_TAKEN: 'El identificador institucional ya está registrado.',

    // Validaciones
    PASSWORD_TOO_WEAK: 'La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y un carácter especial.',
    PASSWORD_SAME_AS_OLD: 'La nueva contraseña no puede ser igual a la actual.',
    PASSWORD_CHANGED_SUCCESS: 'Contraseña cambiada correctamente.',

    // Roles y permisos
    ROLE_ASSIGNED_SUCCESS: 'Rol asignado correctamente.',
    ROLE_REVOKED_SUCCESS: 'Rol revocado correctamente.',
    INVALID_ROLE: 'El rol especificado no es válido.',
  },

  // ORGANIZACIONES (ORGANIZATIONS)
  ORGANIZATION: {
    CREATED_SUCCESS: 'Organización creada correctamente.',
    UPDATED_SUCCESS: 'Organización actualizada correctamente.',
    DELETED_SUCCESS: 'Organización eliminada correctamente.',
    NOT_FOUND: 'La organización solicitada no existe.',
    CODE_TAKEN: 'El código de organización ya está en uso.',
    INACTIVE: 'La organización se encuentra inactiva.',

    // Onboarding
    ONBOARDING_COMPLETED_SUCCESS: 'Proceso de onboarding completado correctamente.',
    ONBOARDING_PENDING: 'La organización aún no ha completado el proceso de onboarding.',

    // Solicitudes (Leads)
    REQUEST_SUBMITTED_SUCCESS: 'Solicitud de organización enviada correctamente. Será revisada por un administrador.',
    REQUEST_NOT_FOUND: 'La solicitud de organización no existe.',
    REQUEST_ALREADY_PROCESSED: 'La solicitud ya ha sido procesada anteriormente.',
    REQUEST_APPROVED_SUCCESS: 'Solicitud aprobada. La organización ha sido creada.',
    REQUEST_REJECTED_SUCCESS: 'Solicitud rechazada. Se ha enviado un correo al solicitante.',
  },

  // SOLICITUDES / LEAD — emails automáticos al visitante
  REQUEST: {
    RECEIVED_SUBJECT: 'Recibimos tu solicitud — CampusVote',
    RECEIVED_HEADING: 'Gracias por tu interes en CampusVote',
    RECEIVED_BODY:
      'Recibimos la solicitud de tu organizacion "{institution}". Nuestro equipo la revisara y se pondra en contacto contigo para coordinar el siguiente paso.',
    RECEIVED_CTA: 'Visitar CampusVote',
    RECEIVED_FOOTER:
      'Si no solicitaste este registro, puedes ignorar este mensaje.',

    APPROVED_SUBJECT: 'Tu solicitud fue aprobada — CampusVote',
    APPROVED_HEADING: 'Tu solicitud fue aprobada',
    APPROVED_BODY:
      'La solicitud de "{institution}" fue aprobada por {approver}. Nuestro equipo se pondra en contacto contigo para coordinar el alta administrativa.',
    APPROVED_CTA: 'Conocer CampusVote',
    APPROVED_FOOTER:
      'Este correo es informativo; no requiere ninguna accion inmediata.',
  },

  // ELECCIONES (ELECTIONS)
  ELECTION: {
    CREATED_SUCCESS: 'Elección creada correctamente.',
    UPDATED_SUCCESS: 'Elección actualizada correctamente.',
    DELETED_SUCCESS: 'Elección eliminada correctamente.',
    NOT_FOUND: 'La elección solicitada no existe.',
    TITLE_TAKEN: 'Ya existe una elección con ese título en el mismo período.',

    // Estados
    DRAFT_ONLY_ACTION: 'Esta acción solo puede realizarse cuando la elección está en estado BORRADOR.',
    ALREADY_OPEN: 'La elección ya se encuentra abierta.',
    ALREADY_CLOSED: 'La elección ya ha finalizado.',
    OPENED_SUCCESS: 'Elección abierta. Los votantes ya pueden emitir su voto.',
    CLOSED_SUCCESS: 'Elección cerrada correctamente.',
    CANCELLED_SUCCESS: 'Elección cancelada correctamente.',
    NOT_OPEN: 'La elección no se encuentra abierta para votación.',
    ALREADY_FINISHED: 'La elección ya ha sido finalizada y no acepta más modificaciones.',
    CANNOT_MODIFY_ACTIVE: 'No se puede modificar una elección que se encuentra en curso.',
    INVALID_DATES: 'La fecha de inicio debe ser anterior a la fecha de finalización.',
  },

  // VOTACIÓN Y PAPELETAS (VOTING)
  VOTE: {
    SUBMITTED_SUCCESS: 'Voto emitido y registrado correctamente.',
    ALREADY_VOTED: 'Usted ya ha emitido su voto en esta elección.',
    NOT_ELIGIBLE: 'No se encuentra habilitado en el padrón electoral para votar en esta elección.',
    SELECTION_INVALID: 'La selección de candidatos u opciones elegidas no es válida.',
    RECEIPT_GENERATED: 'Comprobante de votación generado correctamente.',
    TOKEN_INVALID: 'El token único de votación es inválido o ya ha sido utilizado.',
  },

  // CANDIDATOS Y LISTAS (CANDIDATES)
  CANDIDATE: {
    CREATED_SUCCESS: 'Candidato registrado correctamente.',
    UPDATED_SUCCESS: 'Información del candidato actualizada correctamente.',
    DELETED_SUCCESS: 'Candidato eliminado correctamente.',
    NOT_FOUND: 'El candidato solicitado no existe.',
    ALREADY_EXISTS: 'El candidato ya se encuentra registrado en esta lista o elección.',
    LIST_FULL: 'La lista electoral ha alcanzado el número máximo de candidatos permitidos.',
  },

  // RESULTADOS Y ESCRUTINIO (RESULTS)
  RESULTS: {
    CALCULATED_SUCCESS: 'Escrutinio completado y resultados calculados correctamente.',
    NOT_AVAILABLE: 'Los resultados aún no están disponibles para esta elección.',
    PUBLISHED_SUCCESS: 'Resultados publicados correctamente.',
    EXPORTED_SUCCESS: 'Reporte de resultados exportado correctamente.',
  },

  // SISTEMA Y ERRORES COMUNES (COMMON / SYSTEM)
  COMMON: {
    INTERNAL_SERVER_ERROR: 'Ocurrió un error interno en el servidor. Intente nuevamente más tarde.',
    BAD_REQUEST: 'La solicitud contiene parámetros inválidos o malformados.',
    UNAUTHORIZED: 'No tiene autorización para realizar esta acción.',
    FORBIDDEN: 'Acceso denegado. No posee los permisos suficientes.',
    NOT_FOUND: 'El recurso solicitado no fue encontrado.',
    TOO_MANY_REQUESTS: 'Ha superado el límite de solicitudes. Intente nuevamente más tarde.',
    SERVICE_UNAVAILABLE: 'El servicio se encuentra temporalmente en mantenimiento.',
  },
};

Object.freeze(MESSAGES);

export default MESSAGES;