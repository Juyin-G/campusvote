import('pg').then(async (pg) => {
  const c = new pg.Client({ connectionString: 'postgres://postgres:72314592@localhost:5432/campusvote_test' });
  await c.connect();
  try {
    const r = await c.query("SELECT 1 FROM organizations LIMIT 1");
    console.log('simple select:', r.rows);
  } catch (e) {
    console.log('err:', e.message);
  }
  await c.end();
});
