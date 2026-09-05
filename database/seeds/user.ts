import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function seedUsers(prisma: PrismaClient) {
  console.log('Poblando usuarios...');

  // Se extrae de variable de entorno o usa un fallback seguro para desarrollo
  const defaultPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'juan.ochoa@tecsup.edu.pe' },
    update: {},
    create: {
      username: 'juan.ochoa',
      email: 'juan.ochoa@tecsup.edu.pe',
      firstName: 'Juan',
      lastName: 'Ochoa',
      password: passwordHash,
      authProvider: 'LOCAL',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      isSuperuser: true,
      isStaff: true,
      isVerified: true,
      institutionalId: 'C-24',
      avatarType: 'DEFAULT_DICEBEAR',
      mustChangePassword: false,
    },
  });

  // Cuentas del equipo de desarrollo (org+feria). El rol determina el flujo:
  // ADMIN gestiona la organización y crea jurados; JURY califica proyectos.
  const teammates = [
    {
      email: 'ricky.ushinahua@tecsup.edu.pe',
      username: 'ushinahua.ricky',
      firstName: 'Ricky',
      lastName: 'Ushinahua',
      institutionalId: 'C-01',
      role: 'ADMIN' as const,
    },
    {
      email: 'rosa.garcia@tecsup.edu.pe',
      username: 'garcia.rosa',
      firstName: 'Rosa',
      lastName: 'García',
      institutionalId: 'C-02',
      role: 'JURY' as const,
    },
    {
      email: 'valeria.inga@tecsup.edu.pe',
      username: 'inga.valeria',
      firstName: 'Valeria',
      lastName: 'Inga',
      institutionalId: 'C-03',
      role: 'JURY' as const,
    },
  ];

  const created = [];
  for (const t of teammates) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        username: t.username,
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        password: passwordHash,
        authProvider: 'LOCAL',
        role: t.role,
        status: 'ACTIVE',
        isVerified: true,
        institutionalId: t.institutionalId,
        avatarType: 'DEFAULT_DICEBEAR',
        mustChangePassword: false,
      },
    });
    created.push(user);
    console.log(`Usuario verificado/creado: ${user.email} (${user.role})`);
  }

  console.log(`Usuario SuperAdmin verificado/creado: ${superAdmin.email}`);
  return { superAdmin, teammates: created };
}