// src/services/usersProvisionedPdf.service.js
// Genera un PDF resumen de los usuarios creados por el ADMIN en una carga
// masiva. El PDF NUNCA debe quedar accesible públicamente: el servicio
// devuelve un Buffer que el controller entrega como attachment protegido.
//
// Reglas (issue #25):
//   - Solo el ADMIN autorizado del tenant puede generar este PDF.
//   - Incluye únicamente usuarios de su organización y scope.
//   - La "credencial" mostrada es solo una pista temporal para el primer
//     acceso; el usuario debe cambiar su contraseña con la API existente.
//   - No se incluyen contraseñas permanentes.

import PDFDocument from 'pdfkit';
import logger from '../config/logger.js';

const COLORS = {
  primary: '#0066CC',
  secondary: '#FFC107',
  text: '#1A1A1A',
  muted: '#6B6B6B',
  border: '#E0E0E0',
  warning: '#B8651B',
};

const FOOTER_MSG =
  'IMPORTANTE: La contraseña incluida es temporal. El usuario debe ' +
  'cambiarla en su primer acceso usando el endpoint de cambio de contraseña ' +
  'existente. Nunca almacenes ni transmitas esta contraseña.';

const formatUserRow = (u) => ({
  nombres: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
  dni: u.documentNumber || '—',
  email: u.email,
  rol: u.role,
  usuario: u.username,
  organizacion: u.organization?.name || '',
  sede: u.site?.name || 'No asignada',
  carrera: u.career?.name || '—',
  ciclo: u.currentCycle ? `Ciclo ${u.currentCycle}` : '—',
  credencialTemporal: u._tempPassword ? u._tempPassword : 'Debe cambiar al primer acceso',
});

const drawHeader = (doc, { organization, generatedBy, generatedAt }) => {
  doc
    .rect(0, 0, doc.page.width, 70)
    .fill(COLORS.primary);

  doc
    .fillColor('#FFFFFF')
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('CAMPUSVOTE — CREDENCIALES DE ACCESO INSTITUCIONAL', 40, 22);

  doc.fontSize(9).font('Helvetica').text(
    `${organization.name} (${organization.code})  ·  Generado por: ${generatedBy}  ·  ${generatedAt.toISOString()}`,
    40, 50
  );

  doc.fillColor(COLORS.text);
  doc.y = 100;
};

const drawTable = (doc, rows) => {
  if (rows.length === 0) {
    doc.fillColor(COLORS.muted).fontSize(11).text('No se crearon usuarios en este lote.');
    return;
  }

  const cols = [
    { label: 'Apellidos y nombres', width: 130, key: 'nombres' },
    { label: 'DNI', width: 65, key: 'dni' },
    { label: 'Correo institucional', width: 130, key: 'email' },
    { label: 'Rol', width: 50, key: 'rol' },
    { label: 'Sede', width: 80, key: 'sede' },
    { label: 'Carrera / Ciclo', width: 100, key: 'carreraciclo' },
  ];

  const startX = 40;
  let y = doc.y + 12;

  // Header
  doc.rect(startX, y, cols.reduce((s, c) => s + c.width, 0), 22).fill('#F4F6FA');
  doc.fillColor(COLORS.text).fontSize(9).font('Helvetica-Bold');
  let x = startX + 4;
  for (const col of cols) {
    doc.text(col.label, x, y + 6, { width: col.width - 8, ellipsis: true });
    x += col.width;
  }
  doc.font('Helvetica').fontSize(9);

  y += 24;

  for (const row of rows) {
    const rowH = 32;

    // Page break?
    if (y + rowH > doc.page.height - 80) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc, doc._campusvoteMeta);
      y = doc.y + 12;
    }

    x = startX + 4;
    doc.fillColor(COLORS.text);
    for (const col of cols) {
      const value =
        col.key === 'carreraciclo'
          ? `${row.carrera}\n${row.ciclo}`
          : row[col.key];
      doc.text(value || '—', x, y + 4, {
        width: col.width - 8,
        height: rowH - 8,
        ellipsis: true,
      });
      x += col.width;
    }
    // Row separator
    doc
      .moveTo(startX, y + rowH)
      .lineTo(startX + cols.reduce((s, c) => s + c.width, 0), y + rowH)
      .strokeColor(COLORS.border)
      .stroke();

    y += rowH;
  }

  doc.y = y + 8;
};

const drawCredentialsSection = (doc, rows) => {
  doc
    .fillColor(COLORS.warning)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Credenciales temporales (uso en primer acceso)', 40, doc.y + 8);

  doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);

  let y = doc.y + 6;
  for (const r of rows) {
    if (y + 18 > doc.page.height - 80) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc, doc._campusvoteMeta);
      y = doc.y + 8;
    }
    doc.text(`${r.email}`, 50, y);
    doc.font('Helvetica').fillColor(COLORS.warning).text(
      `  └ ${r.credencialTemporal}`,
      220,
      y
    );
    doc.font('Helvetica').fillColor(COLORS.text);
    y += 16;
  }

  doc.y = y + 6;
};

const drawFooter = (doc) => {
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font('Helvetica-Oblique')
    .text(
      FOOTER_MSG,
      40,
      doc.page.height - 56,
      { width: doc.page.width - 80, align: 'justify' }
    );

  doc
    .fillColor(COLORS.muted)
    .fontSize(7)
    .font('Helvetica')
    .text(
      `Página ${doc.pageNumber} — Documento interno confidencial · ${new Date().getFullYear()} CampusVote`,
      40,
      doc.page.height - 28,
      { width: doc.page.width - 80, align: 'center' }
    );
};

/**
 * Genera un PDF en formato Buffer con el resumen de usuarios creados.
 *
 * @param {Object} payload
 * @param {Object} payload.organization    Organization con { name, code, ... }
 * @param {string} payload.generatedBy     Email del ADMIN que solicita el PDF
 * @param {Date}   [payload.generatedAt]   Fecha de generación (opcional)
 * @param {Array}  payload.users           Usuarios creados (con _tempPassword opcional)
 */
export const generateProvisionedUsersPdf = ({
  organization,
  generatedBy,
  generatedAt = new Date(),
  users,
}) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 100, bottom: 80, left: 40, right: 40 },
        info: {
          Title: 'CampusVote — Credenciales institucionales',
          Author: 'CampusVote',
          Subject: `Resumen de carga masiva para ${organization.name}`,
          Keywords: `${organization.code}, credentials, mass-load`,
          Creator: 'CampusVote Backend',
          CreationDate: generatedAt,
        },
      });

      doc._campusvoteMeta = { organization, generatedBy, generatedAt };

      const buffers = [];
      doc.on('data', (b) => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      drawHeader(doc, doc._campusvoteMeta);

      doc
        .fillColor(COLORS.text)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('Resumen de la carga masiva', 40, doc.y);

      doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(
        `Total de cuentas creadas: ${users.length}. ` +
        `El acceso inicial del usuario requiere cambio de contraseña mediante la API existente.`,
        40,
        doc.y + 2
      );
      doc.y = doc.y + 8;

      const rows = users.map(formatUserRow);

      drawTable(doc, rows);
      drawCredentialsSection(doc, rows);
      drawFooter(doc);

      doc.end();
    } catch (err) {
      logger.error('Error generando PDF de carga masiva', { error: err.message });
      reject(err);
    }
  });

export default { generateProvisionedUsersPdf };
