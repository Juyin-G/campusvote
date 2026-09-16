// src/modules/certificate/certificate.pdf.js
// Generador determinista de PDFs para certificados oficiales de FERIAS.
//
// Decisiones:
//   * NO depende de la hora del sistema: la "fecha de generación" del PDF
//     es la fecha de emisión del certificado (issue_date). El propio PDF
//     incluye la fecha/hora en texto, pero NO se usa como dato de entrada
//     para variar el contenido: dos llamadas con los mismos parámetros
//     producen exactamente la misma información lógica.
//   * NO accede a Prisma: recibe los datos ya normalizados por el service.
//   * NO incluye DNI ni información sensible innecesaria.
//   * El identificador del certificado es su `id` (UUID).
//   * Para WINNER, el PDF indica que corresponde al ganador general.

import PDFDocument from 'pdfkit';

const TITLE_BY_TYPE = {
  PARTICIPATION: 'Certificado de Participación',
  WINNER: 'Certificado de Ganador General',
};

const BODY_BY_TYPE = {
  PARTICIPATION: (fairName, projectName) =>
    `Por su participación en el proyecto "${projectName}" presentado en la feria "${fairName}".`,
  WINNER: (fairName, projectName) =>
    `Por haber obtenido el primer puesto general con el proyecto "${projectName}" presentado en la feria "${fairName}".`,
};

/**
 * Formatea una fecha en DD/MM/YYYY HH:mm (UTC) de forma estable.
 * No usa la zona horaria local para mantener determinismo entre entornos.
 */
const formatDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
};

/**
 * Genera el PDF de un certificado oficial.
 *
 * @param {Object} data  Datos normalizados:
 *   {
 *     certificate: {
 *       id, issue_date, certificate_type,
 *       description?: string|null, valid_until?: Date|null
 *     },
 *     fair:    { id, name },
 *     project: { id, name },
 *     participant: { id, first_name, last_name }
 *   }
 * @returns {Promise<Buffer>}
 */
export const generateCertificatePdf = (data) =>
  new Promise((resolve, reject) => {
    try {
      const certificate = data?.certificate || {};
      const fair = data?.fair || {};
      const project = data?.project || {};
      const participant = data?.participant || {};

      const type = certificate.certificate_type;
      const title = TITLE_BY_TYPE[type] || 'Certificado';
      const bodyText = (BODY_BY_TYPE[type] || (() => ''))(
        fair.name || 'Feria',
        project.name || 'Proyecto'
      );

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 60,
        // compress: false mantiene los streams de contenido en claro para
        // permitir la verificación textual de los datos incluidos en el PDF
        // sin necesidad de un parser. El tamaño sigue siendo razonable
        // porque los certificados son documentos de una sola página.
        compress: false,
        info: {
          Title: title,
          Author: 'CampusVote',
          // Subject incluye el identificador del certificado y la feria
          // para que sea verificable desde la metadata del PDF (almacenada
          // en claro en el Info dictionary).
          Subject: `Certificado ${type} - Feria ${fair.name || ''}`,
          Keywords: `${certificate.id} | ${type} | ${fair.name || ''} | ${project.name || ''}`,
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // ── Borde decorativo ─────────────────────────────────────────
      doc.lineWidth(2).strokeColor('#1f3a93')
        .rect(30, 30, doc.page.width - 60, doc.page.height - 60)
        .stroke();
      doc.lineWidth(0.5).strokeColor('#1f3a93')
        .rect(36, 36, doc.page.width - 72, doc.page.height - 72)
        .stroke();

      // ── Encabezado ────────────────────────────────────────────────
      doc.fillColor('#1f3a93').fontSize(14)
        .text('CampusVote', { align: 'center' });
      doc.moveDown(0.3);
      doc.fillColor('#000000').fontSize(28).text(title, { align: 'center' });
      doc.moveDown(0.6);
      doc.fillColor('#555555').fontSize(11)
        .text('Sistema de Votación Académica - Ferias', { align: 'center' });
      doc.moveDown(1.5);

      // ── Cuerpo ────────────────────────────────────────────────────
      const fullName =
        `${participant.first_name || ''} ${participant.last_name || ''}`.trim() ||
        'Participante';

      doc.fillColor('#000000').fontSize(14)
        .text('Se otorga el presente a:', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(22).fillColor('#1f3a93')
        .text(fullName, { align: 'center' });
      doc.moveDown(0.6);
      doc.fontSize(12).fillColor('#000000')
        .text(bodyText, { align: 'center' });
      doc.moveDown(1.5);

      // ── Detalle ───────────────────────────────────────────────────
      doc.fontSize(11).fillColor('#000000');
      const lineY = doc.y;
      doc.text(`Feria: ${fair.name || 'N/A'}`, 100, lineY, { width: 280 });
      doc.text(`Proyecto: ${project.name || 'N/A'}`, 100, lineY + 16, { width: 280 });
      doc.text(`Tipo de certificado: ${type}`, 100, lineY + 32, { width: 280 });
      doc.text(
        `Fecha de emisión: ${formatDate(certificate.issue_date)}`,
        100,
        lineY + 48,
        { width: 280 }
      );

      if (certificate.valid_until) {
        doc.text(
          `Válido hasta: ${formatDate(certificate.valid_until)}`,
          100,
          lineY + 64,
          { width: 280 }
        );
      }

      // ── Identificador único (UUID del certificado) ────────────────
      doc.fontSize(9).fillColor('#444444');
      doc.text(
        `Identificador del certificado: ${certificate.id}`,
        60,
        doc.page.height - 70,
        { align: 'center', width: doc.page.width - 120 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

export default {
  generateCertificatePdf,
};