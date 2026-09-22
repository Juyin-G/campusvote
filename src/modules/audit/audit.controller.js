// src/modules/audit/audit.controller.js
// Orquestador del módulo de auditoría.
// Re-exporta la API pública desde el sub-controller de logs.

import logsController from './audit.logs.controller.js';

// Adaptador para mantener compatibilidad con la API previa: expone los métodos
// del controller monolítico como funciones bound a su instancia.
const adapter = (ctrl, names) =>
  Object.fromEntries(names.map((name) => [name, ctrl[name].bind(ctrl)]));

const LOGS_METHODS = ['verifyAuditChain', 'getAuditLogs', 'getAuditLogById', 'createAuditLog'];

export default {
  ...adapter(logsController, LOGS_METHODS),
};