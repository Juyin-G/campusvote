// database/seeds/organization.ts
// PASO 8.5 — Seed de organizaciones + contexto académico para desarrollo.
// Idempotente: usa upsert por clave única (Organization.code,
// Faculty.code, Program.code, AcademicPeriod.name).

import { PrismaClient, OrganizationType } from '@prisma/client';

const PERIODS = [
  {
    name: 'DEV-2026-I',
    startDate: new Date('2026-03-01T00:00:00Z'),
    endDate: new Date('2026-07-31T23:59:59Z'),
    isActive: true,
  },
  {
    name: 'DEV-2026-II',
    startDate: new Date('2026-08-01T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59Z'),
    isActive: false,
  },
];

const ORGS = [
  {
    code: 'DEV-UNIV-A',
    name: 'CampusVote University A',
    orgType: OrganizationType.UNIVERSITY,
    country: 'Perú',
    timezone: 'America/Lima',
    primaryColor: '#1B5E20',
    secondaryColor: '#FFC107',
  },
  {
    code: 'DEV-INST-B',
    name: 'CampusVote Institute B',
    orgType: OrganizationType.INSTITUTE,
    country: 'Perú',
    timezone: 'America/Lima',
    primaryColor: '#0D47A1',
    secondaryColor: '#FF7043',
  },
];

const FACULTIES = [
  { code: 'DEV-FAC-ING-A', name: 'DEV Facultad de Ingeniería A' },
  { code: 'DEV-FAC-CIE-B', name: 'DEV Facultad de Ciencias B' },
];

const PROGRAMS = [
  {
    code: 'DEV-PROG-SIS-A',
    name: 'DEV Ingeniería de Sistemas A',
    facultyCode: 'DEV-FAC-ING-A',
  },
  {
    code: 'DEV-PROG-MAT-B',
    name: 'DEV Matemática Aplicada B',
    facultyCode: 'DEV-FAC-CIE-B',
  },
];

const CAREERS = [
  {
    code: 'C-24',
    name: 'DEV Ingeniería de Sistemas (legacy code)',
    cycle: 6,
    orgCode: 'DEV-UNIV-A',
    programCode: 'DEV-PROG-SIS-A',
  },
];

export async function seedOrganizations(prisma) {
  console.log('Poblando contexto organizacional...');

  // 1. Periodos académicos (no hay constraint único sobre name → findFirst + create/update).
  const periods = {};
  for (const p of PERIODS) {
    const existing = await prisma.academicPeriod.findFirst({
      where: { name: p.name },
      select: { id: true },
    });
    const period = existing
      ? await prisma.academicPeriod.update({
          where: { id: existing.id },
          data: {
            startDate: p.startDate,
            endDate: p.endDate,
            isActive: p.isActive,
          },
        })
      : await prisma.academicPeriod.create({
          data: {
            name: p.name,
            startDate: p.startDate,
            endDate: p.endDate,
            isActive: p.isActive,
          },
        });
    periods[p.name] = period;
  }

  // 2. Facultades.
  const faculties = {};
  for (const f of FACULTIES) {
    const faculty = await prisma.faculty.upsert({
      where: { code: f.code },
      update: { name: f.name },
      create: { code: f.code, name: f.name },
    });
    faculties[f.code] = faculty;
  }

  // 3. Programas (requieren facultad existente).
  const programs = {};
  for (const p of PROGRAMS) {
    const faculty = faculties[p.facultyCode];
    if (!faculty) throw new Error(`Facultad ${p.facultyCode} no encontrada`);
    const program = await prisma.program.upsert({
      where: { code: p.code },
      update: { name: p.name, facultyId: faculty.id },
      create: { code: p.code, name: p.name, facultyId: faculty.id },
    });
    programs[p.code] = program;
  }

  // 4. Organizaciones (requieren programa y facultad si se usan careers).
  const orgs = {};
  for (const o of ORGS) {
    const onboardingCompletedAt = new Date();
    const org = await prisma.organization.upsert({
      where: { code: o.code },
      update: {
        name: o.name,
        orgType: o.orgType,
        isActive: true,
        country: o.country,
        timezone: o.timezone,
        primaryColor: o.primaryColor,
        secondaryColor: o.secondaryColor,
        onboardingCompleted: true,
        onboardingCompletedAt,
      },
      create: {
        code: o.code,
        name: o.name,
        orgType: o.orgType,
        isActive: true,
        country: o.country,
        timezone: o.timezone,
        primaryColor: o.primaryColor,
        secondaryColor: o.secondaryColor,
        onboardingCompleted: true,
        onboardingCompletedAt,
      },
    });
    orgs[o.code] = org;
  }

  // 5. Carreras (vinculadas a organización + programa).
  const careers = {};
  for (const c of CAREERS) {
    const org = orgs[c.orgCode];
    const program = programs[c.programCode];
    if (!org || !program) throw new Error('Org/Program no encontrados para career');
    const career = await prisma.career.upsert({
      where: {
        uq_careers_org_code: { organizationId: org.id, code: c.code },
      },
      update: {
        name: c.name,
        cycle: c.cycle,
        isActive: true,
      },
      create: {
        organizationId: org.id,
        code: c.code,
        name: c.name,
        cycle: c.cycle,
        isActive: true,
      },
    });
    careers[c.code] = career;
  }

  console.log(
    `Organizaciones: ${Object.keys(orgs).length}, Facultades: ${Object.keys(faculties).length}, Programas: ${Object.keys(programs).length}, Periodos: ${Object.keys(periods).length}, Carreras: ${Object.keys(careers).length}`
  );

  return { orgs, faculties, programs, periods, careers };
}
