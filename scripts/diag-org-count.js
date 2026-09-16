import('pg').then(async (pg) => {
  const c = new pg.Client({ connectionString: 'postgres://postgres:72314592@localhost:5432/campusvote_test' });
  await c.connect();
  const r = await c.query('SELECT COUNT(*) FROM organizations');
  console.log('rows:', r.rows);
  await c.end();
});
