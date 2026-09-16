import('pg').then(async (pg) => {
  const c = new pg.Client({ connectionString: 'postgres://postgres:72314592@localhost:5432/campusvote_test' });
  await c.connect();
  const r = await c.query(`
    SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users'
  `);
  console.log(r.rows.map((x) => x.column_name).sort());
  await c.end();
});
