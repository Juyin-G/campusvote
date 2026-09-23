// src/modules/users/user.excel.service.js
// Importación masiva de usuarios desde un archivo .xlsx (ADMIN tenant).
// Reutiliza createUsersBulk íntegramente: dominio de email, identidad
// DNI/CE, duplicados, scope de sede. Este archivo solo parsea el Excel,
// mapea columnas, infiere passwords temporales y reporta errores por fila.

import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { createUsersBulk } from './user.create.service.js';
import auditService from '../audit/audit.service.js';
import logger from '../../config/logger.js';

const MAX_EXCEL_ROWS = 500;
const EXCEL_ALLOWED_ROLES = [ROLES.STUDENT, ROLES.TEACHER, ROLES.JURY];
const REQUIRED_FIELDS = ['username', 'email', 'first_name', 'last_name'];

const HEADER_ALIASES = {
  username: ['username', 'usuario'],
  email: ['email', 'correo'],
  password: ['password', 'contrasena', 'clave'],
  first_name: ['first_name', 'primer nombre', 'nombres', 'first name'],
  last_name: ['last_name', 'apellidos', 'apellido', 'last name'],
  role: ['role', 'rol'],
  institutional_id: ['institutional_id', 'codigo', 'codigo institucional'],
  document_type: ['document_type', 'tipo de documento', 'tipo documento', 'document type'],
  document_number: ['document_number', 'numero de documento', 'document number'],
  career_id: ['career_id', 'career id'],
  program_id: ['program_id', 'programa id'],
  current_cycle: ['current_cycle', 'ciclo'],
};

const XLSX_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04], // ZIP normal (núcleo de .xlsx)
  [0x50, 0x4b, 0x05, 0x06], // ZIP vacío/spanned
  [0x50, 0x4b, 0x07, 0x08], // ZIP con data descriptor
];

const PASSWORD_POOLS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnpqrstuvwxyz',
  digit: '23456789',
  special: '#!_$%-',
};

const startsWithSignature = (buffer, signature) =>
  signature.every((byte, i) => buffer[i] === byte);

/** Rechaza archivos que no sean .xlsx por firma mágica (PK/ZIP). */
export const hasXlsxSignature = (buffer) =>
  Buffer.isBuffer(buffer) &&
  buffer.length >= 4 &&
  XLSX_SIGNATURES.some((sig) => startsWithSignature(buffer, sig));

/** Password temporal que cumple la política (mayúscula, minúscula, número, especial). */
export const generateTemporaryPassword = (length = 12) => {
  const all = Object.values(PASSWORD_POOLS).join('');
  const randomIndex = (max) => crypto.randomInt(0, max);

  const chars = Object.values(PASSWORD_POOLS).map((pool) => pool[randomIndex(pool.length)]);
  while (chars.length < length) {
    chars.push(all[randomIndex(all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const normalizeHeader = (value) => {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const resolveField = (header) => {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalized)) return field;
  }
  return null;
};

const cellToString = (cell) => {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  if (typeof cell === 'object') {
    const value = cell.text !== undefined ? cell.text : cell.result;
    return value === null || value === undefined ? '' : String(value).trim();
  }
  return '';
};

const isValidEmailFormat = (email) => {
  if (email.length > 254) return false;
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;
  const dot = email.lastIndexOf('.');
  return dot > at + 1 && dot < email.length - 1;
};

const validateRow = ({ row, data, defaultRole }) => {
  const missing = REQUIRED_FIELDS.filter((field) => !data[field]);
  if (missing.length > 0) {
    return `Faltan campos obligatorios: ${missing.join(', ')}`;
  }
  if (!isValidEmailFormat(data.email)) {
    return `Correo inválido en la fila: ${data.email}`;
  }
  const role = (data.role || defaultRole || '').toUpperCase().trim();
  if (!role) {
    return 'Rol no indicado: usa la columna role o el selector de destino (default_role)';
  }
  if (!EXCEL_ALLOWED_ROLES.includes(role)) {
    return `Rol no permitido en carga masiva: ${role} (solo STUDENT, TEACHER o JURY)`;
  }
  return null;
};

/** Lee y valida la hoja activa del buffer; devuelve filas con su número. */
export const parseUsersFromExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    throw ApiError.badRequest('El archivo Excel no tiene filas de datos');
  }

  const columnMap = {};
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const field = resolveField(cell.value);
        if (field && !(field in columnMap)) columnMap[field] = colNumber;
      });
      return;
    }

    const data = {};
    for (const [field, colNumber] of Object.entries(columnMap)) {
      const value = cellToString(row.getCell(colNumber).value);
      if (value) data[field] = value;
    }

    if (Object.keys(data).length === 0) return; // fila completamente vacía
    rows.push({ row: rowNumber, data });
  });

  return { rows, columnMap };
};

/** Importa usuarios desde un buffer .xlsx delegando en createUsersBulk. */
export const importUsersFromExcel = async ({ buffer, organization_id, site_id, default_role }, actor = {}) => {
  if (!buffer || buffer.length === 0) {
    throw ApiError.badRequest('Debes enviar el archivo Excel');
  }
  if (!hasXlsxSignature(buffer)) {
    throw ApiError.badRequest('El archivo no es un Excel válido. Solo se aceptan archivos .xlsx');
  }

  const { rows } = await parseUsersFromExcel(buffer);
  if (rows.length === 0) {
    throw ApiError.badRequest('El archivo no contiene filas de datos');
  }
  if (rows.length > MAX_EXCEL_ROWS) {
    throw ApiError.badRequest(`Máximo ${MAX_EXCEL_ROWS} filas por operación`);
  }

  const defaultRole = (default_role || '').toUpperCase().trim();
  if (defaultRole && !EXCEL_ALLOWED_ROLES.includes(defaultRole)) {
    throw ApiError.badRequest('default_role solo admite STUDENT, TEACHER o JURY');
  }

  const preErrors = [];
  const users = [];
  const emailToRow = new Map();

  for (const { row, data } of rows) {
    const item = {
      username: data.username ? data.username.toLowerCase().trim() : undefined,
      email: data.email ? data.email.toLowerCase().trim() : undefined,
      first_name: data.first_name,
      last_name: data.last_name,
      role: (data.role || defaultRole || '').toUpperCase().trim(),
      document_type: data.document_type ? data.document_type.toUpperCase().trim() : undefined,
      document_number: data.document_number,
      institutional_id: data.institutional_id,
      career_id: data.career_id,
      program_id: data.program_id,
    };

    const rowError = validateRow({ row, data, defaultRole });
    if (rowError) {
      preErrors.push({ row, message: rowError });
      continue;
    }

    if (data.current_cycle !== undefined) {
      const cycle = Number(data.current_cycle);
      if (!Number.isInteger(cycle) || cycle < 1 || cycle > 20) {
        preErrors.push({ row, message: 'current_cycle debe ser un número entre 1 y 20' });
        continue;
      }
      item.current_cycle = cycle;
    }

    item.password = data.password || generateTemporaryPassword();
    users.push(item);
    emailToRow.set(item.email, row);
  }

  const result =
    users.length > 0
      ? await createUsersBulk({ organization_id, site_id, users }, actor)
      : { created: [], errors: [], temp_passwords: {} };

  const creationErrors = (result.errors || []).map((e) => ({
    row: emailToRow.get(e.email) || null,
    email: e.email,
    message: e.message,
  }));
  const errors = [...preErrors, ...creationErrors];

  try {
    await auditService.logAction({
      actorId: actor?.id || actor?.userId || null,
      action: 'USER_BULK_EXCEL_IMPORT',
      metadata: {
        organization_id,
        total_rows: rows.length,
        total_ok: result.created.length,
        total_failed: errors.length,
      },
    });
  } catch (err) {
    logger.warn('No se pudo registrar importación excel en auditoría', { error: err.message });
  }

  return {
    created: result.created,
    errors,
    totalOk: result.created.length,
    totalFailed: errors.length,
    temp_passwords: result.temp_passwords || {},
    pdf_endpoint: '/api/users/bulk/pdf',
  };
};

export default { hasXlsxSignature, generateTemporaryPassword, parseUsersFromExcel, importUsersFromExcel };