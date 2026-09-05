# Despliegue en Render: staging y produccion

## Veredicto actual

El repositorio puede desplegarse en Render como **staging**, pero no debe recibir una eleccion real hasta cerrar los bloqueadores de `AUDITORIA_COMPLETA_PRODUCCION.md`.

## 1. Crear PostgreSQL

1. Render -> New -> PostgreSQL.
2. Misma region que el Web Service.
3. Copiar la Internal Database URL.
4. No usar la URL local de Docker ni `MIGRATION_DATABASE_URL` con localhost.

## 2. Crear Web Service

- Runtime: Node.
- Root directory: raiz del repositorio.
- Build command: `npm ci && npm run db:generate`.
- Start command: `npm start`.
- Health check: `/health`.
- Usar plan Starter o superior para una operacion real; Free duerme y no es apropiado para votacion.

## 3. Variables obligatorias

Configurar en Render, nunca en Git:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Internal Database URL de Render |
| `JWT_SECRET` | secreto aleatorio de 32+ caracteres |
| `CORS_ORIGIN` | URL exacta del frontend |
| `APP_URL` | URL publica de la API |
| `FRONTEND_URL` | URL publica del frontend |
| `SWAGGER_ENABLED` | `false` en produccion publica, `true` solo en staging protegido |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | proveedor de correo |

Solo si se habilita Google OAuth:

| Variable | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de Google Cloud |
| `GOOGLE_CLIENT_SECRET` | secreto de Google Cloud |
| `GOOGLE_CALLBACK_URL` | `https://api-dominio.com/api/auth/google/callback` |

No configurar `PORT`; Render lo inyecta.

## 4. Aplicar SQL de forma controlada

El script `scripts/apply-sql.js` existe y usa `MIGRATION_DATABASE_URL` o `DATABASE_URL`, pero actualmente omite silenciosamente varios archivos si fallan. Para una base nueva de staging:

1. Ejecutar el script desde un job manual o shell seguro.
2. Revisar cada `OK` y cada `omito`.
3. No aceptar omisiones en `claims`, `challenges`, `public` o `reports` si el alcance las necesita.
4. Ejecutar luego `npm run db:generate`.
5. Ejecutar seeds solo con datos sinteticos.

No ejecutar migraciones automaticamente en cada arranque del Web Service sin lock de migracion y rollback.

## 5. Verificacion post-deploy

```text
GET https://api-dominio.com/health
GET https://api-dominio.com/api/health
```

Despues probar:

- registro/login/email;
- refresh/logout;
- TOTP setup/verify/login;
- Google solo si esta configurado;
- creacion de eleccion en staging;
- asignacion de jurado;
- revision y rating;
- inicio de sesion de voto y recibo;
- resultados/certificacion en datos sinteticos.

## 6. Frontend web administrativo

Recomendacion: un Static Site separado en Render, por ejemplo `campusvote-admin-web`, construido con React/Vite o el stack que el equipo adopte.

- Build command: `npm ci && npm run build`.
- Publish directory: `dist`.
- Variable publica: `VITE_API_URL=https://api-dominio.com`.
- Configurar rewrite de SPA a `/index.html`.
- Configurar `CORS_ORIGIN` de la API con la URL exacta del Static Site.
- No incluir `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, SMTP ni `DATABASE_URL` en el frontend.

Orden de construccion:

1. login, MFA y refresh;
2. shell administrativo y permisos;
3. organizaciones y padron;
4. elecciones, cargos, reglas y candidaturas;
5. tachas y documentos;
6. asignacion de jurados y conflictos;
7. switch **Revision de proyectos** y rating;
8. votacion, resultados, certificacion y auditoria.

## Google y Firebase durante la prueba

Para el piloto de 100 personas **no es necesario configurar Google Cloud ni Firebase**.
El flujo recomendado para staging es:

- login local con email y password;
- verificacion de correo si se habilita SMTP;
- Google Authenticator mediante TOTP para las cuentas que requieran MFA;
- access/refresh tokens emitidos por CampusVote.

Mantener vacias `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_CALLBACK_URL`.
El backend dejara Google OAuth deshabilitado. Esto no bloquea la prueba de votacion,
jurados, ratings, resultados ni auditoria.

Si posteriormente se necesita login con cuenta Google, hay dos opciones:

### Opcion A: Google OAuth directo

- Mantener `/api/auth/google`.
- Crear OAuth Client en Google Cloud.
- Registrar callback de staging y produccion.
- El backend vincula el `googleId` a un usuario existente.
- No agregar Firebase ni credenciales de servicio.

### Opcion B: Firebase Authentication

Usarla solo si el frontend necesita Google Sign-In gestionado por Firebase:

1. Flutter/Web inicia Google con Firebase Auth.
2. Firebase entrega un ID token.
3. El backend usa `POST /api/auth/firebase/verify`.
4. El backend verifica el ID token con Firebase Admin SDK.
5. El backend resuelve el usuario por `sub`/email y emite sus propios access/refresh tokens.

Configuracion minima:

1. Crear un proyecto en Firebase Console.
2. Activar Authentication -> Sign-in method -> Google.
3. Registrar los dominios del frontend web si aplica.
4. Crear una cuenta de servicio y guardar sus datos solo en Render.
5. Configurar `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y
   `FIREBASE_PRIVATE_KEY` en el Web Service.
6. Registrar previamente a los estudiantes en CampusVote. El endpoint no crea
   usuarios automaticamente.

No mezclar el callback OAuth actual y Firebase para el mismo flujo sin una politica clara. Firebase no elimina la necesidad de autorizacion, tenant checks, MFA ni auditoria del backend.

## Piloto controlado de 100 personas

### Preparacion

1. Crear un proyecto separado de Render llamado `campusvote-staging`.
2. Usar una base PostgreSQL separada, nunca la base de produccion.
3. Cargar datos sinteticos: una organizacion, una eleccion, proyectos, jurados y electores.
4. Crear 100 cuentas de prueba con identificadores ficticios.
5. Separar perfiles: administradores, comision electoral, jurados, expositores y electores.
6. Activar TOTP para cuentas administrativas y de jurado.
7. Confirmar que no se usan datos personales reales.

### Escenarios obligatorios

- Login local correcto, password incorrecta y cuenta bloqueada.
- TOTP correcto, TOTP incorrecto, backup code y expiracion de `tempToken`.
- Jurado solo ve proyectos asignados.
- Conflicto de interes bloquea la calificacion.
- Rating valido, rating duplicado y rating fuera de ventana.
- Elector no elegible, doble voto y eleccion cerrada.
- Perdida de red durante inicio y emision del voto.
- Recibo valido e invalido.
- Quorum alcanzado/no alcanzado, certificacion y publicacion.
- Dos organizaciones intentando acceder a los mismos recursos.
- Carga concurrente de logins, ratings y sesiones de votacion.

### Criterio de salida del piloto

El piloto es exitoso solo si todas las pruebas funcionales y de autorizacion pasan,
no hay votos duplicados, no se filtran datos entre organizaciones, todos los eventos
criticos tienen auditoria y se puede restaurar la base de staging desde un backup.

El piloto **no equivale** a certificacion de produccion: aun se debe completar una
revision legal, operativa, de seguridad, disponibilidad y proteccion de datos.
