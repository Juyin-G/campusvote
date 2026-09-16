import('pg').then(async (pg) => {
  const c = new pg.Client({ connectionString: 'postgres://postgres:72314592@localhost:5432/campusvote_test' });
  await c.connect();
  const r = await c.query("SELECT conname, contype FROM pg_constraint WHERE conname LIKE '%existe%' OR conname LIKE '%exists%'");
  console.log('Constraints:', r.rows);
  const r2 = await c.query("SELECT proname, pronargs FROM pg_proc WHERE proname LIKE '%existe%' OR proname LIKE '%exists%'");
  console.log('Functions:', r2.rows);
  await c.end();
});
