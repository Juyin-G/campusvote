// database/seeds/user.ts
// PASO 8.5 — Seed de usuarios de desarrollo.
// Idempotente: usa email como clave única de upsert.
// Mantiene la compatibilidad con la firma anterior (seedUsers) exportando
// también el resultado de SUPERADMIN para evitar romper consumers existentes.

import {
  AvatarType,
  AuthProviderType,
  PrismaClient,
  UserRole,
  UserScopeLevel,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

// Password única para todos los usuarios de desarrollo.
// Cumple la política del sistema: 1 mayúscula, 1 minúscula, 1 dígito, 1 especial,
// longitud >= 8 (ver src/shared/utils/passwordPolicy.js).
export const DEV_PASSWORD = '';

// Lista de usuarios a sembrar. `password` se ignora — todos usan DEV_PASSWORD.
// Los roles ADMIN/SUPERADMIN/JURY aceptan cualquier email
// (chk_users_institutional_email); TEACHER/STUDENT requieren .edu / .edu.pe.
const DEV_USERS = [
  // SUPERADMIN (mismo email que el seed previo — debe mantener compat).
  {
    email: 'superadmin@dev.campusvote.edu',
    username: 'dev.superadmin',
    firstName: 'Super',
    lastName: 'Admin Dev',
    institutionalId: 'DEV-SA-001',
    role: UserRole.SUPERADMIN,
    organizationCode: null, // SUPERADMIN no pertenece a org.
    facultyCode: null,
    programCode: null,
    careerCode: null,
    isSuperuser: true,
    isStaff: true,
  },
  // ORG A — ADMIN, TEACHER, STUDENT.
  {
    email: 'admin.a@dev-a.campusvote.edu',
    username: 'dev.admin.a',
    firstName: 'Ana',
    lastName: 'Admin Dev A',
    institutionalId: 'DEV-AA-001',
    role: UserRole.ADMIN,
    organizationCode: 'DEV-UNIV-A',
  },
  {
    email: 'teacher.a@dev-a.campusvote.edu',
    username: 'dev.teacher.a',
    firstName: 'Tomas',
    lastName: 'Teacher Dev A',
    institutionalId: 'DEV-TA-001',
    role: UserRole.TEACHER,
    organizationCode: 'DEV-UNIV-A',
    facultyCode: 'DEV-FAC-ING-A',
    specialty: 'Ingeniería de Software',
    department: 'DEV Departamento de Ingeniería',
  },
  {
    email: 'student.a@dev-a.campusvote.edu',
    username: 'dev.student.a',
    firstName: 'Sofia',
    lastName: 'Student Dev A',
    institutionalId: 'DEV-SA-002',
    role: UserRole.STUDENT,
    organizationCode: 'DEV-UNIV-A',
    facultyCode: 'DEV-FAC-ING-A',
    programCode: 'DEV-PROG-SIS-A',
    currentCycle: 4,
  },
  // ORG A — ADMIN con scope ORG (complemento del primer ADMIN).
  {
    email: 'admin.org.a@dev-a.campusvote.edu',
    username: 'dev.admin.org.a',
    firstName: 'Carla',
    lastName: 'Admin Org Dev A',
    institutionalId: 'DEV-AO-001',
    role: UserRole.ADMIN,
    organizationCode: 'DEV-UNIV-A',
    scopeLevel: 'ORG',
  },
  {
    email: 'jury.a@dev-a.campusvote.edu',
    username: 'dev.jury.a',
    firstName: 'Jorge',
    lastName: 'Jurado Dev A',
    institutionalId: 'DEV-JA-001',
    role: UserRole.JURY,
    organizationCode: 'DEV-UNIV-A',
  },
  // ORG B — ADMIN, TEACHER, STUDENT.
  {
    email: 'admin.b@dev-b.campusvote.edu',
    username: 'dev.admin.b',
    firstName: 'Bruno',
    lastName: 'Admin Dev B',
    institutionalId: 'DEV-AB-001',
    role: UserRole.ADMIN,
    organizationCode: 'DEV-INST-B',
  },
  {
    email: 'teacher.b@dev-b.campusvote.edu',
    username: 'dev.teacher.b',
    firstName: 'Teresa',
    lastName: 'Teacher Dev B',
    institutionalId: 'DEV-TB-001',
    role: UserRole.TEACHER,
    organizationCode: 'DEV-INST-B',
    facultyCode: 'DEV-FAC-CIE-B',
    specialty: 'Estadística',
    department: 'DEV Departamento de Ciencias',
  },
  {
    email: 'student.b@dev-b.campusvote.edu',
    username: 'dev.student.b',
    firstName: 'Sergio',
    lastName: 'Student Dev B',
    institutionalId: 'DEV-SB-001',
    role: UserRole.STUDENT,
    organizationCode: 'DEV-INST-B',
    facultyCode: 'DEV-FAC-CIE-B',
    programCode: 'DEV-PROG-MAT-B',
    currentCycle: 3,
  },
];

// Firma legacy preservada (usada por versiones previas del seed).
export async function seedUsers(prisma: PrismaClient) {
  console.log('Poblando usuarios (compat)...');

  const defaultPassword = process.env.SEED_SUPERADMIN_PASSWORD || '72314592';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const provisionUser = async (data) => {
    const existing = await prisma.user.findFirst({
      where: { email: data.email },
      select: { id: true },
    });

    const userData = {
      ...data,
      password: passwordHash,
      status: UserStatus.ACTIVE,
      isVerified: true,
      mustChangePassword: false,
      authProvider: AuthProviderType.LOCAL,
      avatarType: AvatarType.DEFAULT_DICEBEAR,
    };

    if (existing) {
      return prisma.user.update({ where: { id: existing.id }, data: userData });
    }
    return prisma.user.create({ data: userData });
  };

  const superAdmin = await provisionUser({
    username: 'juan.ochoa',
    email: 'juan.ochoa@tecsup.edu.pe',
    firstName: 'Juan',
    lastName: 'Ochoa',
    institutionalId: 'C-24',
    role: UserRole.SUPERADMIN,
    isSuperuser: true,
    isStaff: true,
  });

  console.log(`Usuario SuperAdmin verificado/creado: ${superAdmin.email}`);
  return { superAdmin };
}

export async function seedDevUsers(prisma, ctx) {
  console.log('Poblando usuarios de desarrollo...');

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);
  const result = { users: [] };

  for (const u of DEV_USERS) {
    const org = u.organizationCode ? ctx.orgs[u.organizationCode] : null;
    const faculty = u.facultyCode ? ctx.faculties[u.facultyCode] : null;
    const program = u.programCode ? ctx.programs[u.programCode] : null;
    const career = u.careerCode ? ctx.careers[u.careerCode] : null;

    const data = {
      username: u.username,
      email: u.email,
      password: passwordHash,
      firstName: u.firstName,
      lastName: u.lastName,
      institutionalId: u.institutionalId,
      role: u.role,
      status: UserStatus.ACTIVE,
      isVerified: true,
      isStaff: Boolean(u.isStaff),
      isSuperuser: Boolean(u.isSuperuser),
      mustChangePassword: false,
      authProvider: AuthProviderType.LOCAL,
      avatarType: AvatarType.DEFAULT_DICEBEAR,
      organizationId: org ? org.id : null,
      facultyId: faculty ? faculty.id : null,
      programId: program ? program.id : null,
      careerId: career ? career.id : null,
      currentCycle: u.currentCycle ?? null,
      specialty: u.specialty ?? null,
      department: u.department ?? null,
      scopeLevel: u.scopeLevel
        ? UserScopeLevel[u.scopeLevel]
        : null,
      regionId: u.regionCode && ctx.regions ? ctx.regions[u.regionCode] : null,
    };

    // Upsert por email (es unique no-DELETED). El hash se reemplaza cada
    // corrida para que la contraseña DEV_PASSWORD siempre sea válida.
    const existing = await prisma.user.findFirst({
      where: { email: u.email },
      select: { id: true },
    });

    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data })
      : await prisma.user.create({ data });

    result.users.push(user);
  }

  console.log(`Usuarios de desarrollo: ${result.users.length}`);
  return result;
}
