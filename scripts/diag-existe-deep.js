import('pg').then(async (pg) => {
  const c = new pg.Client({ connectionString: 'postgres://postgres:72314592@localhost:5432/campusvote_test' });
  await c.connect();
  // Try to find anything resembling "existe"
  const r = await c.query("SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname ILIKE '%existe%' OR c.relname ILIKE '%exists%'");
  console.log('relations:', r.rows);
  const r2 = await c.query("SELECT tgname FROM pg_trigger WHERE tgname ILIKE '%existe%'");
  console.log('triggers:', r2.rows);
  // What columns does "organizations" actually have? Check for differences with what Prisma expects
  const r3 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' ORDER BY ordinal_position");
  console.log('organizations columns:', r3.rows.map(r => r.column_name).join(','));
  await c.end();
});
