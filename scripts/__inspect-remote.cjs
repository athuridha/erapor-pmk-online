const API = 'https://erapor-d1-api.beliimei.workers.dev/query';
const TOKEN = 'cf99eabfa99380f9bfc410fd793db0ff587151fc20dda6fb';

async function q(sql, params) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`
    },
    body: JSON.stringify({ sql, params })
  });
  if (!res.ok) throw new Error(`D1 ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.results ?? j;
}

(async () => {
  const t = await q('SELECT name FROM sqlite_master WHERE type="table"');
  console.log('tables:', t.map((r) => r.name).join(', '));
  const rows = await q('SELECT DISTINCT nama FROM mata_pelajaran ORDER BY nama');
  console.log('\ndistinct mapel:');
  rows.forEach((r) => console.log(' -', r.nama));
  const j = await q('SELECT jenis, COUNT(*) c FROM mata_pelajaran GROUP BY jenis');
  console.log('\nby jenis:', JSON.stringify(j));
  const k = await q('SELECT kode, tujuan, COUNT(*) c FROM kokurikuler GROUP BY kode ORDER BY kode');
  console.log('\nkokurikuler activities:');
  k.forEach((r) => console.log(' -', r.kode, '|', r.tujuan));
})().catch((e) => { console.error('ERR', e); process.exit(1); });
