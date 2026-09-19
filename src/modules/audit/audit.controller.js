// src/modules/audit/audit.controller.js
// Orquestador del módulo de auditoría.
// Re-exporta la API pública desde los sub-controllers (logs + tokens).

import logsController from './audit.logs.controller.js';
import tokensController from './audit.tokens.controller.js';

// Adaptador para mantener compatibilidad con la API previa: expone los métodos
// del controller monolítico como funciones bound a su instancia.
const adapter = (ctrl, names) =>
  Object.fromEntries(names.map((name) => [name, ctrl[name].bind(ctrl)]));

const LOGS_METHODS = ['verifyAuditChain', 'getAuditLogs', 'getAuditLogById', 'createAuditLog'];
const TOKENS_METHODS = [
  'createOneTimeToken',
  'consumeOneTimeToken',
  'checkTokenStatus',
  'cleanupExpiredTokens',
];

export default {
  ...adapter(logsController, LOGS_METHODS),
  ...adapter(tokensController, TOKENS_METHODS),
};
