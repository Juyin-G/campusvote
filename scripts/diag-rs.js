import('pg').then(async (pg) => {
  const c = new pg.Client({ connectionString: 'postgres://postgres:72314592@localhost:5432/campusvote_test' });
  await c.connect();
  const r = await c.query('SELECT COUNT(*) FROM regions');
  console.log('regions:', r.rows);
  const r2 = await c.query('SELECT COUNT(*) FROM organization_sites');
  console.log('organization_sites:', r2.rows);
  await c.end();
});
