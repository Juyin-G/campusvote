/**
 * Users Bulk-Excel — pruebas de integración HTTP (app + BD real).
 * El handler reutiliza createUsersBulk: aquí se valida el flujo completo
 * multipart → parser exceljs → creación por fila → errores con número de fila.
 */

import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import ExcelJS from 'exceljs';

jest.unstable_mockModule('../../src/middlewares/rateLimiter.middleware.js', () => ({
  loginLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  userLimiter: () => (_req, _res, next) => next(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/database/prisma.js');
const env = (await import('../../src/config/env.js')).default;

const PASSWORD = 'ExcelTest123!';
const runId = Date.now();

const buildXlsxBuffer = async ({ headers, rows }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Carga');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
};

describe('Users Bulk-Excel Integration (HTTP + DB)', () => {
  let orgId;
  let adminToken;

  beforeAll(async () => {
    const hash = await bcrypt.hash(PASSWORD, 12);
    const org = await prisma.organization.create({
      data: { name: `OrgExcel ${runId}`, code: `XORG${runId}` },
    });
    orgId = org.id;

    const admin = await prisma.user.create({
      data: {
        username: `excel.admin.${runId}`,
        email: `excel.admin.${runId}@campusvote.edu.pe`,
        password: hash,
        firstName: 'Admin',
        lastName: 'Excel',
        institutionalId: `XADM${runId}`,
        role: 'ADMIN',
        authProvider: 'LOCAL',
        isVerified: true,
        status: 'ACTIVE',
        mustChangePassword: false,
        organizationId: orgId,
        scopeLevel: 'ORG',
      },
    });

    // Bajo la política 2FA actual ("no SUPERADMIN sin 2FA no recibe sesión"),
    // login no emite JWT para ADMIN. Firmamos el token directamente, igual que
    // el resto de suites de integración (teachingEvaluation, fairJury*).
    adminToken = jwt.sign(
      {
        userId: admin.id,
        email: admin.email,
        role: admin.role,
        organizationId: admin.organizationId,
        scopeLevel: admin.scopeLevel,
        regionId: admin.regionId ?? null,
        isSuperuser: admin.isSuperuser ?? false,
        isStaff: admin.isStaff ?? false,
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // El trigger de inmutabilidad de auditoría impide borrar al admin que
    // generó registros (USER_BULK_EXCEL_IMPORT). Se ignora el error de
    // cleanup, igual que en users.integration.test.js.
    await prisma.user.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  });

  it('procesa un lote mixto: crea la fila válida y reporta errores con número de fila', async () => {
    const emailOk = `excel.ok.${runId}@uni.edu.pe`;
    const emailTeacher = `excel.teacher.${runId}@uni.edu.pe`;
    const emailNoRole = `excel.norole.${runId}@uni.edu.pe`;

    const buffer = await buildXlsxBuffer({
      headers: ['username', 'email', 'password', 'first_name', 'last_name', 'role', 'document_type', 'document_number'],
      rows: [
        // 1 fila válida (STUDENT)
        [`excel.a.${runId}`, emailOk, 'TempOk1!x', 'Ana', 'Uno', 'STUDENT', '', ''],
        // TEACHER sin DNI/CE → error de identidad por fila (sin llamada externa)
        [`excel.b.${runId}`, emailTeacher, 'TempX1!x', 'Beto', 'Dos', 'TEACHER', '', ''],
        // Duplicado del correo de la fila 2 → conflicto
        [`excel.c.${runId}`, emailOk, 'Temp3!x', 'Carla', 'Tres', 'STUDENT', '', ''],
        // Sin rol y sin default_role → error de rol
        [`excel.d.${runId}`, emailNoRole, 'Temp4!x', 'Diego', 'Cuatro', '', '', ''],
      ],
    });

    const res = await request(app)
      .post('/api/users/bulk-excel')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('organization_id', orgId)
      .attach('file', buffer, 'carga.xlsx');

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.totalOk).toBe(1);
    expect(data.totalFailed).toBe(3);
    expect(data.created).toHaveLength(1);
    expect(data.created[0]).toMatchObject({ email: emailOk, role: 'STUDENT' });
    // temp_passwords incluye la password "entregable" de cada fila creada
    // (venía en la fila; no fue autogenerada).
    expect(data.temp_passwords[emailOk]).toBe('TempOk1!x');

    const byRow = Object.fromEntries(data.errors.map((e) => [e.row, e]));
    expect(byRow[3]).toMatchObject({ email: emailTeacher });
    expect(byRow[3].message).toContain('DNI o Carné');
    expect(byRow[4]).toMatchObject({ email: emailOk });
    expect(byRow[4].message).toContain('ya está registrado');
    // Error de validación de fila (sin email): solo row + message.
    expect(byRow[5]).toMatchObject({ row: 5 });
    expect(byRow[5].message).toContain('Rol no indicado');

    const createdUser = await prisma.user.findUnique({ where: { email: emailOk } });
    expect(createdUser).not.toBeNull();
  });

  it('aplica default_role y genera password temporal (G1) si la fila no trae', async () => {
    const emailDefault = `excel.default.${runId}@uni.edu.pe`;

    const buffer = await buildXlsxBuffer({
      headers: ['username', 'email', 'password', 'first_name', 'last_name'],
      rows: [[`excel.e.${runId}`, emailDefault, '', 'Elsa', 'Cinco']],
    });

    const res = await request(app)
      .post('/api/users/bulk-excel')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('organization_id', orgId)
      .field('default_role', 'STUDENT')
      .attach('file', buffer, 'carga.xlsx');

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.totalOk).toBe(1);
    expect(data.created[0]).toMatchObject({ email: emailDefault, role: 'STUDENT' });
    expect(data.temp_passwords[emailDefault]).toBeTruthy();
  });

  it('rechaza archivos que no son Excel', async () => {
    const res = await request(app)
      .post('/api/users/bulk-excel')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('organization_id', orgId)
      .attach('file', Buffer.from('esto no es un excel'), 'carga.txt');

    expect(res.status).toBe(400);
  });

  it('rechaza la petición sin archivo', async () => {
    const res = await request(app)
      .post('/api/users/bulk-excel')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('organization_id', orgId);

    expect(res.status).toBe(400);
  });
});