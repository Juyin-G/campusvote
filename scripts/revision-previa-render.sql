-- scripts/revision-previa-render.sql
-- Revisión de SOLO LECTURA antes de aplicar las migraciones en una base que ya
-- tiene datos (Render). No modifica nada.
--
-- Qué debe salir en 0 para que scripts/apply-sql.js no se detenga:
--   * usuarios con rol OBSERVER            → user/012 aborta si existen.
--   * proveedor distinto de LOCAL          → user/014 deja solo LOCAL.
--   * LOCAL sin contraseña (no pendientes) → user/015 lo prohíbe.
-- Las otras dos filas son informativas:
--   * usuarios en PENDING: no pueden iniciar sesión; el admin debe activarlos.
--   * admins sin institución: la regla nueva no los rechaza (NOT VALID), pero
--     conviene asignarles una.
--
-- Uso (PowerShell, con el contenedor local de Postgres como cliente):
--   Get-Content scripts\revision-previa-render.sql | docker exec -i campusvote_db psql "<cadena externa de Render>"

SELECT 'usuarios con rol OBSERVER' AS revision, count(*) AS cantidad
FROM users WHERE role::text = 'OBSERVER'
UNION ALL
SELECT 'usuarios con proveedor distinto de LOCAL (Google, etc.)', count(*)
FROM users WHERE auth_provider::text <> 'LOCAL'
UNION ALL
SELECT 'usuarios LOCAL sin contraseña (no pendientes de activar)', count(*)
FROM users
WHERE auth_provider::text = 'LOCAL'
  AND (password IS NULL OR password = '')
  AND status::text <> 'PENDING_ACTIVATION'
UNION ALL
SELECT 'usuarios en PENDING (no pueden entrar)', count(*)
FROM users WHERE status::text = 'PENDING'
UNION ALL
SELECT 'admins sin institución', count(*)
FROM users WHERE role::text = 'ADMIN' AND organization_id IS NULL;
