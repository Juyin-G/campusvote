/**
 * user.excel — tests unit del parser .xlsx y utilidades (sin BD ni red).
 */

import ExcelJS from 'exceljs';
import {
  hasXlsxSignature,
  generateTemporaryPassword,
  parseUsersFromExcel,
} from '../../src/modules/users/user.excel.service.js';

const buildXlsxBuffer = async ({ headers, rows }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Carga');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
};

describe('user.excel (unit)', () => {
  describe('hasXlsxSignature', () => {
    it('acepta buffers xlsx reales (firma PK/ZIP)', async () => {
      const buffer = await buildXlsxBuffer({ headers: ['email'], rows: [['a@b.com']] });
      expect(hasXlsxSignature(buffer)).toBe(true);
    });

    it('rechaza texto plano, buffers vacíos y no-buffers', () => {
      expect(hasXlsxSignature(Buffer.from('HOLA ESTO NO ES XLSX'))).toBe(false);
      expect(hasXlsxSignature(Buffer.alloc(0))).toBe(false);
      expect(hasXlsxSignature('no buffer')).toBe(false);
      expect(hasXlsxSignature(null)).toBe(false);
    });
  });

  describe('generateTemporaryPassword', () => {
    it('cumple la política: longitud, mayúscula, minúscula, número y especial', () => {
      const password = generateTemporaryPassword(12);
      expect(password).toHaveLength(12);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/\d/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    });

    it('genera valores distintos en cada llamada', () => {
      const a = generateTemporaryPassword(12);
      const b = generateTemporaryPassword(12);
      expect(a).not.toBe(b);
    });
  });

  describe('parseUsersFromExcel', () => {
    it('mapea columnas en inglés y reporta números de fila reales', async () => {
      const buffer = await buildXlsxBuffer({
        headers: ['username', 'email', 'password', 'first_name', 'last_name', 'role', 'current_cycle'],
        rows: [
          ['ana.uno', 'ana@uni.edu.pe', 'Temp1!x', 'Ana', 'Uno', 'STUDENT', 5],
          ['beto.dos', 'beto@uni.edu.pe', '', 'Beto', 'Dos', 'JURY', 3],
        ],
      });
      const { rows } = await parseUsersFromExcel(buffer);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ row: 2 });
      expect(rows[0].data).toMatchObject({
        username: 'ana.uno',
        email: 'ana@uni.edu.pe',
        first_name: 'Ana',
        role: 'STUDENT',
        current_cycle: '5',
      });
      expect(rows[1].row).toBe(3);
    });

    it('soporta encabezados en español y omite filas vacías', async () => {
      const buffer = await buildXlsxBuffer({
        headers: ['usuario', 'correo', 'contraseña', 'nombres', 'apellidos', 'rol'],
        rows: [
          ['carlos.tres', 'carlos@uni.edu.pe', 'Temp2!x', 'Carlos', 'Tres', 'TEACHER'],
          [],
          ['dora.cuatro', 'dora@uni.edu.pe', 'Temp3!x', 'Dora', 'Cuatro', 'STUDENT'],
        ],
      });
      const { rows } = await parseUsersFromExcel(buffer);
      expect(rows).toHaveLength(2);
      expect(rows[0].row).toBe(2);
      expect(rows[0].data.username).toBe('carlos.tres');
      // La fila 3 estaba vacía; la fila 4 conserva su número real.
      expect(rows[1].row).toBe(4);
      expect(rows[1].data.email).toBe('dora@uni.edu.pe');
    });

    it('lanza ApiError si la hoja no contiene datos', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Vacia');
      sheet.addRow(['email']);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      await expect(parseUsersFromExcel(buffer)).rejects.toThrow('no tiene filas de datos');
    });
  });
});