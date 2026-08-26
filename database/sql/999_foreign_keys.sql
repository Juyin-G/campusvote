-- Relación Organization Request -> User
--
-- ON DELETE RESTRICT y no SET NULL: la restricción
-- chk_req_reviewed_fields_mandatory exige que toda solicitud ya procesada
-- conserve reviewed_by. Con SET NULL, borrar al revisor intentaba anular esa
-- columna y la fila violaba el CHECK, así que el DELETE fallaba con un error
-- confuso de restricción. Con RESTRICT el intento se rechaza de forma
-- explícita y el rastro de auditoría queda intacto.
--
-- Se recrea siempre para que el script pueda ejecutarse más de una vez.

ALTER TABLE organization_requests
  DROP CONSTRAINT IF EXISTS fk_org_requests_reviewed_by;

ALTER TABLE organization_requests
  ADD CONSTRAINT fk_org_requests_reviewed_by
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT;
