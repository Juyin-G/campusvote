// src/modules/results/report/report.service.js
// S7-09 — Generador de reportes PDF de resultados.
//
// Responsabilidades:
//   - Generar un Buffer PDF en memoria (sin archivos temporales).
//   - Aplicar hash SHA-256 sobre el PDF para integridad.
//   - NO volver a consultar la BD: recibe datos normalizados
//     desde Results.
//
// NO accede a Prisma.
// NO escribe archivos en disco.
// NO depende de fuentes del sistema.

import PDFDocument from 'pdfkit';
import crypto from 'node:crypto';

/**
 * Devuelve el sufijo descriptivo según el tipo de opción.
 * BLANK → ' (en blanco)', NULL → ' (nulo)', otros → ''.
 */
const getOptionSuffix = (optionType) => {
  if (optionType === 'BLANK') return ' (en blanco)';
  if (optionType === 'NULL') return ' (nulo)';
  return '';
};

/**
 * Genera el PDF del acta de resultados a partir de datos
 * ya normalizados por Results Service.
 *
 * @param {Object} data  Datos normalizados:
 *   {
 *     election: { id, title, status, ... },
 *     summary: election_results row,
 *     positions: [
 *       { position_id, position_name, seats, options: [
 *           { option_id, label, option_type, votes_count, percentage }
 *         ]
 *       }
 *     ]
 *   }
 *
 * @returns {Promise<{ buffer: Buffer, hash: string, size: number }>}
 */
export const generateResultsPdf = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Acta de Resultados',
          Author: 'CampusVote',
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        resolve({ buffer, hash, size: buffer.length });
      });
      doc.on('error', (err) => reject(err));

      // ───── Encabezado ─────
      doc.fontSize(20).text('Acta de Resultados', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#555555')
        .text('CampusVote - Sistema de Votación Académica', { align: 'center' });
      doc.moveDown(1);

      // ───── Datos de la elección ─────
      doc.fillColor('#000000').fontSize(14).text('Datos de la elección');
      doc.moveDown(0.3);
      doc.fontSize(10);
      const election = data.election || {};
      const summary = data.summary || {};

      doc.text(`ID: ${election.id || 'N/A'}`);
      doc.text(`Título: ${election.title || 'N/A'}`);
      doc.text(`Estado: ${election.status || 'N/A'}`);
      if (summary.certified_at) {
        doc.text(`Certificada: ${new Date(summary.certified_at).toISOString()}`);
      }
      if (summary.published_at) {
        doc.text(`Publicada: ${new Date(summary.published_at).toISOString()}`);
      }
      doc.moveDown(1);

      // ───── Resumen (acta) ─────
      doc.fontSize(14).text('Resumen');
      doc.moveDown(0.3);
      doc.fontSize(10);
      doc.text(`Electores habilitados: ${summary.total_voters ?? 0}`);
      doc.text(`Votos emitidos: ${summary.total_votes_cast ?? 0}`);
      doc.text(`Participación: ${Number(summary.turnout_percentage ?? 0).toFixed(2)}%`);
      doc.text(`Votos en blanco: ${summary.blank_votes ?? 0}`);
      doc.text(`Votos nulos: ${summary.null_votes ?? 0}`);
      doc.moveDown(1);

      // ───── Detalle por cargo ─────
      const positions = Array.isArray(data.positions) ? data.positions : [];
      for (const position of positions) {
        doc.fontSize(13).fillColor('#000000').text(position.position_name || 'Cargo');
        doc.moveDown(0.2);
        doc.fontSize(9).fillColor('#555555')
          .text(`Escaños: ${position.seats ?? 1}`);
        doc.moveDown(0.2);

        doc.fillColor('#000000');
        for (const opt of position.options || []) {
          const tipo = getOptionSuffix(opt.option_type);
          doc.fontSize(10)
            .text(`• ${opt.label || 'Opción'}${tipo}: ${opt.votes_count} voto(s) (${Number(opt.percentage ?? 0).toFixed(2)}%)`);
        }
        doc.moveDown(0.8);
      }

      // ───── Pie ─────
      doc.moveDown(1);
      doc.fontSize(8).fillColor('#888888')
        .text(`Documento generado el ${new Date().toISOString()}`, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Calcula el hash SHA-256 sobre un buffer PDF.
 */
export const sha256OfBuffer = (buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');

export default {
  generateResultsPdf,
  sha256OfBuffer,
};
