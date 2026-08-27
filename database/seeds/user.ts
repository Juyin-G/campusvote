import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function seedUsers(prisma: PrismaClient) {
  console.log('🌱 Poblando usuarios...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Super Admin
  await prisma.user.upsert({
    where: { email: 'admin@universidad.edu.pe' },
    update: {},
    create: {
      username: 'admin_sys',
      email: 'admin@universidad.edu.pe',
      firstName: 'Admin',
      lastName: 'Sistema',
      password: passwordHash,
      authProvider: 'LOCAL',
      role: 'ADMIN',
      status: 'ACTIVE',
      isSuperuser: true,
      isStaff: true,
      isVerified: true,
      institutionalId: 'ADM-001',
      avatarType: 'DEFAULT_DICEBEAR',
      mustChangePassword: false,
    },
  });

  // 2. Comisión Electoral
  await prisma.user.upsert({
    where: { email: 'comision@universidad.edu.pe' },
    update: {},
    create: {
      username: 'comision_elec',
      email: 'comision@universidad.edu.pe',
      firstName: 'Presidente',
      lastName: 'Comisión',
      password: passwordHash,
      authProvider: 'LOCAL',
      role: 'ELECTORAL_COMMISSION',
      status: 'ACTIVE',
      isStaff: true,
      isVerified: true,
      institutionalId: 'CE-001',
      avatarType: 'DEFAULT_DICEBEAR',
      mustChangePassword: false,
    },
  });

  // 3. Docente
  await prisma.user.upsert({
    where: { email: 'docente@universidad.edu.pe' },
    update: {},
    create: {
      username: 'docente_juan',
      email: 'docente@universidad.edu.pe',
      firstName: 'Juan',
      lastName: 'Pérez',
      password: passwordHash,
      authProvider: 'LOCAL',
      role: 'TEACHER',
      status: 'ACTIVE',
      isVerified: true,
      institutionalId: 'DOC-1020',
      specialty: 'Ingeniería de Software',
      department: 'Ciencias de la Computación',
      avatarType: 'DEFAULT_DICEBEAR',
      mustChangePassword: false,
    },
  });

  // 4. Estudiante
  await prisma.user.upsert({
    where: { email: 'estudiante@universidad.edu.pe' },
    update: {},
    create: {
      username: 'estudiante_maria',
      email: 'estudiante@universidad.edu.pe',
      firstName: 'María',
      lastName: 'Gómez',
      password: passwordHash,
      authProvider: 'LOCAL',
      role: 'STUDENT',
      status: 'ACTIVE',
      isVerified: true,
      institutionalId: '202310150',
      currentCycle: 7,
      avatarType: 'DEFAULT_DICEBEAR',
      mustChangePassword: false,
    },
  });

  console.log('✅ Usuarios procesados correctamente.');
}