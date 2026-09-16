// database/seeds/election.ts
// PASO 8.5 — Seed de elección publicada de desarrollo.
// Crea una elección en estado PUBLISHED en ORG_A con un ElectionRule
// mínimo. Se persiste directamente con Prisma para no tener que ejecutar
// el flujo certify → publish (que requiere votos reales y quorum).

import {
  ElectionProcessType,
  ElectionScopeType,
  ElectionStatusType,
} from '@prisma/client';

const ELECTION_TITLE = 'DEV Elección de Prueba CampusVote 2026-I';
const ELECTION_DESCRIPTION =
  'Elección sembrada por el seed de desarrollo (Paso 8.5). Solo para pruebas.';

export async function seedElections(prisma, ctx) {
  console.log('Poblando elecciones de desarrollo...');

  const period = ctx.periods['DEV-2026-I'];
  const org = ctx.orgs['DEV-UNIV-A'];
  const faculty = ctx.faculties['DEV-FAC-ING-A'];
  const program = ctx.programs['DEV-PROG-SIS-A'];

  if (!period || !org) throw new Error('Period u Org DEV no encontrados');

  // Necesitamos un createdBy: usamos el ADMIN de ORG_A sembrado en user seed.
  const adminA = ctx.users?.admin_a;
  if (!adminA) {
    throw new Error('ADMIN_A no encontrado — ejecutar seed de usuarios primero.');
  }

  // Upsert por combinación (organizationId + title). Como no hay índice único
  // natural, hacemos findFirst → create/update.
  // Para scope_type = UNIVERSITY la constraint chk_elections_scope_integrity
  // exige faculty_id = NULL y program_id = NULL.
  const existing = await prisma.election.findFirst({
    where: { organizationId: org.id, title: ELECTION_TITLE },
    select: { id: true, status: true },
  });

  // Si ya existe y NO está en DRAFT (PUBLISHED/CLOSED/etc.), no podemos
  // modificar ElectionRule por el trigger de inmutabilidad. Solo lo creamos
  // cuando es seguro.
  const safeToMutate = !existing || existing.status === ElectionStatusType.DRAFT;

  const dataBase = {
    title: ELECTION_TITLE,
    description: ELECTION_DESCRIPTION,
    processType: ElectionProcessType.VOTE,
    scopeType: ElectionScopeType.UNIVERSITY,
    periodId: period.id,
    organizationId: org.id,
    facultyId: null,
    programId: null,
    startAt: new Date('2026-03-15T00:00:00Z'),
    endAt: new Date('2026-06-30T23:59:59Z'),
    createdBy: adminA.id,
    isAnonymousAllowed: false,
  };

  let election;
  if (!existing) {
    // Crear como DRAFT primero para poder agregar ElectionRule.
    election = await prisma.election.create({
      data: { ...dataBase, status: ElectionStatusType.DRAFT },
    });
  } else if (existing.status === ElectionStatusType.DRAFT) {
    // Actualizar campos no-inmutables.
    election = await prisma.election.update({
      where: { id: existing.id },
      data: dataBase,
    });
  } else {
    // Ya está en estado terminal (PUBLISHED/CLOSED). Reutilizar tal cual.
    election = await prisma.election.findUnique({
      where: { id: existing.id },
    });
  }

  // ElectionRule mínimo (idempotente por electionId, que es unique).
  if (safeToMutate) {
    await prisma.electionRule.upsert({
      where: { electionId: election.id },
      update: {
        minTurnoutPercentage: 0,
        allowBlankVote: true,
        allowNullVote: true,
        maxVotesPerPosition: 1,
        requires2fa: true,
      },
      create: {
        electionId: election.id,
        minTurnoutPercentage: 0,
        allowBlankVote: true,
        allowNullVote: true,
        maxVotesPerPosition: 1,
        requires2fa: true,
      },
    });

    // Solo publicar si aún no lo está (idempotencia).
    if (election.status !== ElectionStatusType.PUBLISHED) {
      election = await prisma.election.update({
        where: { id: election.id },
        data: { status: ElectionStatusType.PUBLISHED },
      });
    }
  }

  console.log(
    `Elección sembrada: id=${election.id} status=${election.status}`
  );
  return { elections: [election] };
}
