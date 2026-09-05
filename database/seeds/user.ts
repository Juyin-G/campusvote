import {
  AvatarType,
  AuthProviderType,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function seedUsers(prisma: PrismaClient) {
  console.log('Poblando usuarios...');

  // Se extrae de variable de entorno o usa un fallback seguro para desarrollo
  const defaultPassword = process.env.SEED_SUPERADMIN_PASSWORD || '72314592';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const provisionUser = async (data: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    institutionalId: string;
    role: UserRole;
    isSuperuser?: boolean;
    isStaff?: boolean;
  }) => {
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
      return prisma.user.update({
        where: { id: existing.id },
        data: userData,
      });
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

  // Cuentas del equipo de desarrollo (org+feria). El rol determina el flujo:
  // ADMIN gestiona la organización y crea jurados; JURY califica proyectos.
  const teammates = [
    {
      email: 'ricky.ushinahua@tecsup.edu.pe',
      username: 'ushinahua.ricky',
      firstName: 'Ricky',
      lastName: 'Ushinahua',
      institutionalId: 'C-01',
      role: UserRole.ADMIN,
    },
    {
      email: 'rosa.garcia@tecsup.edu.pe',
      username: 'garcia.rosa',
      firstName: 'Rosa',
      lastName: 'García',
      institutionalId: 'C-02',
      role: UserRole.JURY,
    },
    {
      email: 'valeria.inga@tecsup.edu.pe',
      username: 'inga.valeria',
      firstName: 'Valeria',
      lastName: 'Inga',
      institutionalId: 'C-03',
      role: UserRole.JURY,
    },
  ];

  const created = [];
  for (const t of teammates) {
    const user = await provisionUser(t);
    created.push(user);
    console.log(`Usuario verificado/creado: ${user.email} (${user.role})`);
  }

  console.log(`Usuario SuperAdmin verificado/creado: ${superAdmin.email}`);
  return { superAdmin, teammates: created };
}