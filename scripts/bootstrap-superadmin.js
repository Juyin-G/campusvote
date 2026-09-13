import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/database/prisma.js';

const required = ['SUPERADMIN_EMAIL', 'SUPERADMIN_PASSWORD', 'SUPERADMIN_USERNAME'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Faltan variables: ${missing.join(', ')}`);

const email = process.env.SUPERADMIN_EMAIL.trim().toLowerCase();
const username = process.env.SUPERADMIN_USERNAME.trim().toLowerCase();
const existing = await prisma.user.findFirst({
  where: { OR: [{ email }, { username }], role: 'SUPERADMIN' },
  select: { id: true, email: true, username: true },
});

if (existing) {
  if (process.env.SUPERADMIN_UPDATE === 'true') {
    const password = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 12);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        username,
        password,
        firstName: process.env.SUPERADMIN_FIRST_NAME || undefined,
        lastName: process.env.SUPERADMIN_LAST_NAME || undefined,
        role: 'SUPERADMIN',
        status: 'ACTIVE',
        isSuperuser: true,
        isStaff: true,
        isVerified: true,
        mustChangePassword: true,
      },
    });
    console.log(`SUPERADMIN actualizado: ${email}. Debe configurar TOTP nuevamente.`);
  } else {
    console.log(`SUPERADMIN ya existe: ${existing.email}. Usa SUPERADMIN_UPDATE=true para rotar credenciales.`);
  }
} else {
  const password = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password,
      firstName: process.env.SUPERADMIN_FIRST_NAME || 'Super',
      lastName: process.env.SUPERADMIN_LAST_NAME || 'Admin',
      institutionalId: `SUPERADMIN-${username}`,
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      isSuperuser: true,
      isStaff: true,
      isVerified: true,
      mustChangePassword: true,
    },
    select: { id: true, email: true },
  });
  console.log(`SUPERADMIN creado: ${user.email}. Debe configurar TOTP al iniciar sesión.`);
}

await prisma.$disconnect();
