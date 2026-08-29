# CampusVote — Despliegue en Render

Guía paso a paso para publicar la API en **Render** (PaaS → Web Service +
PostgreSQL gestionada). Cubre desde cero hasta producción segura.

---

## 1. Requisitos

- Cuenta en [render.com](https://render.com) (plan gratis o de pago).
- Repositorio Git con el código (GitHub/GitLab).
- El proyecto usa **Node.js + Express** y **PostgreSQL**: en Render
  desplegaremos el **Web Service** (API) y una **Postgres manejada**.

---

## 2. Resumen de la arquitectura en Render

```
Cliente/Frontend (Vite en :5173 o en Render Static Site)
        │  HTTPS
        ▼
Render Web Service  →  Node.js (src/server.js)   PUERTO = ${PORT} (Render lo asigna)
        │
        ▼
Render PostgreSQL (manejada)   →   UUID interna + endpoint interno
```

- `PORT` en Render lo asigna el propio servicio (Render inyecta la variable
  `PORT`). No fuerces un puerto fijo.
- La API ya hace caso de `env.PORT` (`src/config/env.js` lee `process.env.PORT`).
- `app.set('trust proxy', 1)` ya está configurado (`src/app.js`) → los proxies
  de Render (`X-Forwarded-For`, `req.ip`) funcionan.

---

## 3. Paso 1 — Crear la base de datos (Render PostgreSQL)

1. En Render → **New → PostgreSQL**.
2. Configura:
   - **Name**: `campusvote-db`
   - **Database**: `campusvote_db`
   - **User**: `campusvote_app`
   - **Region**: la misma del Web Service (para latencia).
   - **Plan**: Starter (o el que necesites).
3. En la ficha de la base, copia la **`Internal Database URL`**
   (ej. `postgresql://campusvote_app:XXXX@dpg-...-a.oregon-postgres.render.com/campusvote_db`).
   Esta conexión es la que usará el Web Service.

> 🔒 **Seguridad:** Render genera una contraseña. NUNCA la incluyas en Git.

---

## 4. Paso 2 — Aplicar el esquema SQL a la BD en Render

El proyecto define tablas/functiones SQL en `database/sql/**`. Debes crearlas
antes de arrancar la API. Dos opciones:

### Opción A — Desde tu máquina (recomendada)

Con `psql` local apuntando a la URL interna/externa:

```powershell
# Con la External Database URL que da Render
$env:PGPASSWORD="<la_password_que_genera_render>"
psql "<EXTERNAL_DATABASE_URL>" -f database/sql/000_extensions.sql
# ... y así sucesivamente con el resto, en el orden de scripts/db-setup.ps1
```

### Opción B — Durante el build (automatizada)

Render ejecuta un **comando de build** por despliegue. El más simple y robusto
es un **script de post-deploy**. Añade al `package.json`:

```jsonc
{
  "scripts": {
    "db:setup:prod": "node scripts/apply-sql.js"
  }
}
```

> ⚠️ **Importante:** en Render la BD **no está en `localhost:5433`** ni corre por
> Docker. El script `scripts/db-setup.ps1` usa `docker exec`, así que **no sirve
> en Render**. Para producción crea un script Node (`pg`/`psql`) que ejecute los
> `.sql` en orden usando `DATABASE_URL` de Render (aplica para migrar la BD).

---

## 5. Paso 3 — Crear el Web Service (la API)

1. Render → **New → Web Service** → conecta tu repo.
2. Configura:
   - **Name**: `campusvote-api`
   - **Runtime**: `Node`
   - **Root Directory**: `.` (raíz)
   - **Build Command**: `npm install && npm run db:generate`
   - **Start Command**: `npm start`
   - **Region**: la misma que la BD.
   - **Plan**: Free (con dormir) / Starter / Pro.
3. **Environment Variables** (botón *Advanced → Add Environment Variable*):

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | *(no la pongas; Render la inyecta)* |
   | `DATABASE_URL` | `Internal Database URL` de la BD de Render |
   | `JWT_SECRET` | Clave aleatoria de ≥32 chars (ver abajo) |
   | `JWT_REFRESH_SECRET` | Otra clave aleatoria (≥32 chars) |
   | `CORS_ORIGIN` | la URL de tu frontend (p. ej. `https://mi-frontend.onrender.com`) |
   | `BG` / `FRONTEND_URL` | URL pública del frontend |
   | `SMTP_HOST`,`SMTP_PORT`,`SMTP_USER`,`SMTP_PASS`,`SMTP_FROM` | Credenciales de correo (Mailgun/SendGrid/Mailtrap) |
   | `BCRYPT_ROUNDS` | `12` (puedes subir a 13 para pruebas de seguridad) |

   **Generar claves seguras:**
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Dos ejecuciones → una para `JWT_SECRET`, otra para `JWT_REFRESH_SECRET`.

4. **Deploy** → **Create Web Service**. Render clona, instala y lanza.

> ⚠️ En producción el servidor exige `JWT_SECRET` de **≥32 caracteres** y no
> permisivo con valores de ejemplo (`src/config/env.js` aborta si no).
> No uses los secretos del `.env` de desarrollo.

---

## 6. Paso 4 — Verificar

Visita `https://<tu-api>.onrender.com/health` → debe responder:

```json
{ "status": "UP", "timestamp": "...", "uptime": 123 }
```

- **Docs:** `https://<tu-api>.onrender.com/api-docs`
- **API:** `https://<tu-api>.onrender.com/api/...`

Si `/health` responde pero las rutas fallan por BD, confirma que la BD está
creada (`db:setup` ejecutado) y `DATABASE_URL` correcta.

---

## 7. Deploys automáticos (CI/CD)

Render vuelve a desplegar en cada `push` a la rama principal si lo activas
(*Auto-Deploy*). Para migraciones en cada despliegue, usa el **hook
`onStart`/post-deploy**:

- Para SQL idempotente, plantéate ejecutar el setup de BD en un **comando de
  arranque** seguro e idempotente (los scripts SQL usan `CREATE IF NOT EXISTS`).
- Alternativa profesional: ejecutar migraciones como **paso manual** tras cada
  deploy (no automático) para control total.

---

## 8. Variables/secretos — buenas prácticas en Render

- Guarda secretos en **Environment Variables** de Render, nunca en el repo ni
  en el `Dockerfile`.
- Reutiliza la **Internal Database URL** (no la pública) para el tráfico
  interno entre Web Service y Postgres — no expone la BD a Internet.
- Si migras del `.env` local, **no subas `.env` al repo** (ya está en
  `.gitignore`).

---

## 9. Notas y advertencias para Render

| Tema | Acción |
|---|---|
| **Base local (Docker)** | `docker-compose.yml` usa `localhost:5433` → **solo desarrollo**. En Render usa su Postgres. |
| **Macro de rate limit** | El límite global de 100 req/15 min (`src/app.js`) puede quedar corto en producción. Parametrizar/producir un valor mayor. |
| **Plan Free** | Los Web Services gratis se duermen tras periodo de inactividad y el primer request puede demorar. Para producción real considera Starter+. |
| **SMTP** | La verificación de correo/reset necesita SMTP configurado; usa SendGrid/Mailgun (Render no provee correo). |
| **Tally/reportes** | Operaciones pesadas (escrutinio, export CSV/PDF) pueden superar el timeout del request; considera moverlas a un job/worker (ver ESCALABILIDAD.md). |

---

## 10. Checklist final antes de producción

- [ ] `JWT_SECRET` y `JWT_REFRESH_SECRET` únicos y fuertes (≥32 chars).
- [ ] `CORS_ORIGIN` apunta al frontend real (opcionalmente lista).
- [ ] `NODE_ENV=production` (oculta stacks en errores).
- [ ] Passwords de BD únicos (no los de dev).
- [ ] `npm run db:setup` aplicado a la BD de Render (tablas + funciones SQL).
- [ ] SMTP configurado y probado (`npm run test:email` localmente).
- [ ] `/health` responde UP.
- [ ] Logs: revisar `dstderr`/`stdout` en Render para errores de arranque.

---
*Documento de despliegue objetivo; adapta nombres/planes a tu cuenta de Render.*
