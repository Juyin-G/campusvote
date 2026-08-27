// src/modules/results/export/export.service.js
// S7-10 — Exportadores de resultados a CSV y XLSX.
//
// Responsabilidades:
//   - CSV: usar Node estándar (sin librerías externas).
//   - XLSX: usar exceljs.
//   - Ambos reciben los MISMOS datos normalizados (cero
//     duplicación de consultas).
//
// CSV: UTF-8 + BOM + escape de comillas/comas/saltos + protección
//      contra Formula Injection (=, +, -, @, \t, \r).
//
// XLSX: workbook con 1 hoja "Resultados" + encabezados + datos
//       formateados.

import ExcelJS from 'exceljs';

// ─────────────────────────────────────────────────────────────
// CSV (Node nativo)
// ─────────────────────────────────────────────────────────────

const FORMULA_INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escapa una celda CSV según RFC 4180 + protección frente a
 * CSV/Formula Injection.
 *
 * - Si el valor empieza por =, +, -, @, \t, \r → se prefija con
 *   un apóstrofo (') para neutralizar la fórmula en Excel.
 * - Si contiene ", , \n, \r → se envuelve en comillas dobles y
 *   se duplican las comillas internas.
 * - Si es null/undefined → vacío.
 */
export const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // Protección frente a Formula Injection.
  if (str.length > 0 && FORMULA_INJECTION_PREFIXES.includes(str[0])) {
    str = "'" + str;
  }

  // Escape RFC 4180.
  if (/[",\n\r]/.test(str)) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

/**
 * Normaliza un set de resultados en filas planas para CSV/XLSX.
 * Salida: Array<Array<string|number>>
 *   [election_id, position_id, position_name, option_id, option_label,
 *    option_type, candidate_list_id, votes_count, percentage]
 */
export const flattenResults = (data) => {
  const rows = [];
  const positions = data.detail?.positions || [];
  for (const position of positions) {
    for (const opt of position.options || []) {
      rows.push([
        data.election_id,
        position.position_id,
        position.position_name,
        opt.option_id,
        opt.label,
        opt.option_type,
        opt.candidate_list_id || '',
        opt.votes_count,
        Number(opt.percentage ?? 0).toFixed(2),
      ]);
    }
  }
  return rows;
};

const CSV_HEADERS = [
  'election_id',
  'position_id',
  'position_name',
  'option_id',
  'option_label',
  'option_type',
  'candidate_list_id',
  'votes_count',
  'percentage',
];

/**
 * Genera un Buffer CSV con BOM UTF-8 y CRLF.
 */
export const generateResultsCsv = (data) => {
  const rows = flattenResults(data);
  const lines = [CSV_HEADERS.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';
  return Buffer.from(csv, 'utf8');
};

// ─────────────────────────────────────────────────────────────
// XLSX (exceljs)
// ─────────────────────────────────────────────────────────────

/**
 * Genera un Buffer XLSX con un workbook que contiene 1 hoja
 * 'Resultados' con los mismos datos normalizados que el CSV.
 */
export const generateResultsXlsx = async (data) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CampusVote';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Resultados', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = CSV_HEADERS.map((header) => ({
    header,
    key: header,
    width: Math.max(header.length + 2, 14),
  }));

  sheet.getRow(1).font = { bold: true };

  const rows = flattenResults(data);
  for (const row of rows) {
    const obj = {};
    CSV_HEADERS.forEach((h, i) => {
      obj[h] = row[i];
    });
    sheet.addRow(obj);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

export default {
  csvEscape,
  flattenResults,
  generateResultsCsv,
  generateResultsXlsx,
};
