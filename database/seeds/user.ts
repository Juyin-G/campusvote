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

  console.log(`Usuario SuperAdmin verificado/creado: ${superAdmin.email}`);
  return { superAdmin };
}