# CampusVote — Escalabilidad y Visión a Futuro

Documento de estrategia de crecimiento: de un monolito académico a una
plataforma de votación elástica y segura.

---

## 1. Arquitectura actual (punto de partida)

- **Backend:** API REST en Node.js + Express (monolítico).
- **Base de datos:** PostgreSQL 16 (Docker local, `127.0.0.1:5433`).
- **ORM:** Prisma (schema PascalCase + campos camelCase, mapeados a tablas SQL).
- **Lógica crítica embebida en la BD:** funciones `SECURITY DEFINER`
  (`start_voting_session`, `cast_secure_vote_with_session`, `tally_votes`,
  `certify_election`, `sync_sis_voters`, token de un solo uso).
- **Seguridad:** JWT (HS256), bcrypt, Helmet, rate limiting, TOTP/2FA,
  tokens de acceso de un solo uso, auditoría encadenada con HMAC.

**Fortaleza:** la integridad del voto (elección abierta, elegibilidad, voto
único, límites por cargo) vive **dentro de transacciones SQL**, no sólo en la
capa de aplicación. Esto es la base correcta para escalar.

**Cuello de botella actual:** una sola instancia Node + una sola BD. Todo
(correo, cálculos de tally, reportes) corre en el mismo proceso.

---

## 2. Escalado inmediato (bajo esfuerzo)

### 2.1 Configuración ("escoria" de entorno)
- `CORS_ORIGIN` debe soportar **lista de orígenes** (hoy es una sola URL).
  Cambiar `src/config/cors.js` para aceptar un array separado por comas.
- El rate limit global está fijado en 100 req/15 min en `src/app.js`.
  Parametrizarlo por entorno (`RATE_LIMIT_MAX_REQUESTS` ya existe en `.env`).

### 2.2 Proceso
- Activar **clúster Node** o correr varias instancias detrás de un
  balanceador (Render, Nginx, Cloudflare). La API es *stateless* (JWT),
  así que escalar horizontalmente es directo.
- Mover `trust proxy` y los logs a un formato estructurado.

### 2.3 Base de datos
- Índices: revisar `database/sql/**/003_*_indexes.sql`; añadir índices para
  `where` de alta frecuencia (`votes(election_id)`, `vote_selections(vote_id)`,
  `tallies(election_id)`).
- **Connection pool:** Prisma ya usa un pool; ajustar `connection_limit` en
  `DATABASE_URL` (`?connection_limit=20`).

---

## 3. Escalado medio (siguiente fase)

### 3.1 Cache (Redis)
- Cachear resultados públicos: `GET /api/results/live` y `final` con TTL corto
  (ej. invalida el cache al certificar/publicar). Evita recalcular y reducir
  carga en la BD.
- Cachear el diccionario de traducciones (casi estático).
- Sesiones de votación efímeras / tokens de un solo uso pre-generados.

### 3.2 Colas de tareas (BullMQ + Redis o un worker)
Mover operaciones lentas fuera del ciclo de petición:
- Envío de correos (verificación, reset, notificaciones) → cola.
- **Tally / escrutinio** masivo → worker que procesa `votes` en lotes.
- **Integración SIS** (sincronización masiva del padrón) → job async.
- Generación de reportes PDF/CSV → job + almacenar en objeto storage.

### 3.3 Almacenamiento de objetos
- Reportes de actas, backups y CSV de exportación en **S3 / Cloudflare R2 /
  Render Disk** en lugar de columnas `BYTEA`/`TEXT` en la BD.

### 3.4 Observabilidad
- `pino-pretty`/JSON logs (el logger actual ya estructura en JSON).
- Métricas con **Prometheus + Grafana** o el endpoint de Render.
- Rastreo con Sentry/OpenTelemetry para errores y trazas.

---

## 4. Escalado avanzado (futuro a largo plazo)

### 4.1 Separación de dominios
El monolito ya está modularizado (`src/modules/**`). Candidatos a servicios
independientes / bounded contexts:
- **Auth + Users**
- **Elections + Ballots + Voting** (núcleo de votación)
- **Results + Reports**
- **Audit** (append-only chain)

> ⚠️ Regla clave de negocio: la transacción de voto DEBE seguir atomizada en
> la BD y de baja latencia. Mantener `cast_vote` cerca de la capa de datos.

### 4.2 Alta disponibilidad de la votación
- Replicas de PostgreSQL (**lectura** para resultados, **escritura** única para
  votos) para evitar split-brain.
- Ventana de votación con **concurrencia controlada**: las funciones SQL usan
  `FOR UPDATE` / restricciones `UNIQUE` — pruebalas bajo carga con
  `pgbench`/`k6`.
- Backups con PITR y prueba de restauración.

### 4.3 Acceso concurrente
- El token de un solo uso + `UNIQUE (vote_id, ballot_option_id)` + la función
  `SECURITY DEFINER` ya previenen el doble voto a nivel de BD. Documentar y
  probar el escenario de "doble clic / doble pestaña".

### 4.4 Escalado de escritura (solo si es necesario)
- Particionar `votes`/`vote_selections` por `election_id` (marco temporal de
  votación) para mantener índices pequeños y lecturas de tally rápidas.
- Eventualmente, agregadores/read models para resultados.

---

## 5. Hoja de ruta sugerida (prioridades)

| Fase | Tareas | Esfuerzo | Impacto |
|---|---|---|---|
| **P0 (ahora)** | CORS multi-origen, rate limit configurable, índice `votes(election_id)`, backup automático | Bajo | Estabilidad/Seguridad |
| **P1 (corto)** | Redis cache de resultados, cola de correos, worker de tally, objetos storage para reportes | Medio | Rendimiento/UX |
| **P2 (medio)** | Observabilidad (Prometheus/Sentry), healthchecks avanzados, clúster/servicios auth+users | Medio | Operabilidad |
| **P3 (largo)** | Desacoplar dominios, réplicas de lectura, particionado de votos, load testing | Alto | Elasticidad |

---

## 6. Principios de diseño a preservar

1. **Integridad en la capa de datos:** las invariantes del voto se validan en
   la BD, no solo en Express.
2. **Módulos autocontenidos:** `src/modules/**` con `routes / controller /
   service / repository / schema / docs`.
3. **API stateless con JWT →** escala horizontal directa.
4. **No exponer secretos ni mensajes internos** en respuestas de producción.
5. **Auditoría encadenada e inmutable** (HMAC + hash previo) en `audit_logs`.

---
*Generado como guía de escalabilidad; ajustar prioridades según carga real.*
