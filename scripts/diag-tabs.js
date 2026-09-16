import('pg').then(async (pg) => {
  const c = new pg.Client({ connectionString: 'postgres://postgres:72314592@localhost:5432/campusvote_test' });
  await c.connect();
  const r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('regions','organization_sites','user_site_assignments')");
  console.log(r.rows);
  await c.end();
});
