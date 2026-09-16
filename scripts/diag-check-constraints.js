import('pg').then(async (pg) => {
  const c = new pg.Client({ connectionString: 'postgres://postgres:72314592@localhost:5432/campusvote_test' });
  await c.connect();
  const r = await c.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='users'::regclass AND contype='c'");
  for (const row of r.rows) {
    console.log(row.pg_get_constraintdef);
  }
  await c.end();
});
