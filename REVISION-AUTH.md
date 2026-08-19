# Revisión Auth — Logout + HTML demo

## Cambios realizados

### 1. Revisión
- `auth.middleware.js` migrado a ES modules (`import` / `export`)
- Modelo `User` agregado en `prisma/schema.prisma`
- `createUser` implementado en `auth.repository.js`
- Unificado `BCRYPT_ROUNDS` en `env.js` y `auth.service.js`
- `health.controller.js` usa el cliente Prisma compartido
- `auth.schema.js` sin dependencia de Zod (validación básica de login)

### 2. Logout
- `POST /api/auth/logout` protegido con `authenticate`
- Service, controller, ruta y documentación Swagger

### 3. HTML demo
- `public/index.html` — formulario login + botón logout
- `public/css/styles.css` — estilos
- `public/js/auth.js` — consume API y guarda/borra token en `localStorage`
- `app.js` sirve archivos estáticos y muestra la demo en `/`

## Cómo probar (paso 4)

```powershell
cd C:\campusvote
npm run db:up          # levantar PostgreSQL
npm run db:setup       # migraciones SQL
npm run db:generate    # generar cliente Prisma
npm run dev            # servidor en http://localhost:3000
```

1. Abrir `http://localhost:3000`
2. Login con un usuario existente en la BD
3. Ver "Sesión activa"
4. Clic en "Cerrar sesión"
5. Verificar en DevTools → Application → Local Storage que ya no hay `campusvote_token`

## Paso 5 — PR (después del commit)

1. `git checkout -b feature/auth-logout-and-html-demo`
2. `git add .` y `git commit -m "..."`  ← lo hacemos juntos
3. `git push -u origin feature/auth-logout-and-html-demo`
4. En GitHub/GitLab: **New Pull Request** → base: `develop`
