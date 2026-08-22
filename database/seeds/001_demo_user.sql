-- Usuario de prueba para login/logout (CampusVote)
-- Credenciales: estudiante@campusvote.edu.pe / Password123!
-- Ejecutar: docker exec -i campusvote_db psql -U postgres -d campusvote_db -f /database/seeds/001_demo_user.sql
-- (o copiar el INSERT y pegarlo en pgAdmin)

INSERT INTO users (
  username,
  email,
  password,
  first_name,
  last_name,
  institutional_id,
  role,
  is_verified,
  is_active,
  must_change_password,
  auth_provider
) VALUES (
  'estudiante.demo',
  'estudiante@campusvote.edu.pe',
  '$2b$12$3KnJtYBu6NtwOcSGdIDwQOJ5XLaBMbTJ0cSxkk8ZmGe/62xn76f5q',
  'Estudiante',
  'Demo',
  '20260001',
  'STUDENT',
  TRUE,
  TRUE,
  FALSE,
  'LOCAL'
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  is_verified = EXCLUDED.is_verified,
  is_active = EXCLUDED.is_active,
  must_change_password = EXCLUDED.must_change_password;
