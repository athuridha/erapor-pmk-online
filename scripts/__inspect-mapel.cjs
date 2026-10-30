const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./data/database.sqlite3' });
(async () => {
  const rows = await c.execute('SELECT DISTINCT nama FROM mata_pelajaran ORDER BY nama');
  console.log('distinct mapel:');
  rows.rows.forEach((r) => console.log(r.nama));
  const cnt = await c.execute('SELECT COUNT(*) c FROM mata_pelajaran');
  console.log('total rows:', cnt.rows[0].c);
  const j = await c.execute('SELECT jenis, COUNT(*) c FROM mata_pelajaran GROUP BY jenis');
  console.log('by jenis:', JSON.stringify(j.rows));
  const k = await c.execute('SELECT kode, tujuan, COUNT(*) c FROM kokurikuler GROUP BY kode');
  console.log('kokurikuler:');
  k.rows.forEach((r) => console.log(r.kode, '|', r.tujuan));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
