import { createClient } from '@libsql/client';

const API_URL = 'https://erapor-d1-api.beliimei.workers.dev/query';
const API_TOKEN = 'cf99eabfa99380f9bfc410fd793db0ff587151fc20dda6fb';

async function queryD1(sql, params = []) {
	const res = await fetch(API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${API_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ sql, params })
	});

	if (!res.ok) {
		const txt = await res.text();
		throw new Error(`D1 HTTP error ${res.status}: ${txt}`);
	}

	const data = await res.json();
	if (!data.success) {
		throw new Error(`D1 Query error: ${JSON.stringify(data.errors)}`);
	}
	return data.result?.results ?? data.result?.[0]?.results ?? [];
}

async function main() {
	const client = createClient({ url: 'file:D:/amar/pratamamulya/rapkumer-main/data/database.sqlite3' });

	// Turn off foreign keys in SQLite/D1 session if supported, or insert base rows with foreign keys deferred
	// In SQLite, PRAGMA foreign_keys = OFF is per connection. In D1 worker, each prepare is a statement.
	// To break circular dependency:
	// Insert pegawai with sekolahId = null, then sekolah, then update pegawai.sekolahId!

	console.log('Resolving circular dependency between pegawai and sekolah...');
	
	// 1. Insert sekolah with dummy/null FK or insert pegawai without sekolahId
	const pegawaiRows = (await client.execute('SELECT * FROM pegawai')).rows;
	const sekolahRows = (await client.execute('SELECT * FROM sekolah')).rows;

	console.log(`Inserting ${pegawaiRows.length} pegawai with sekolah_id = NULL...`);
	for (const p of pegawaiRows) {
		const cols = Object.keys(p);
		const colNames = cols.map(c => `"${c}"`).join(', ');
		const placeholders = cols.map(() => '?').join(', ');
		const vals = cols.map(c => (c === 'sekolah_id' ? null : p[c]));
		await queryD1(`INSERT OR REPLACE INTO "pegawai" (${colNames}) VALUES (${placeholders})`, vals);
	}

	console.log(`Inserting ${sekolahRows.length} sekolah...`);
	for (const s of sekolahRows) {
		const cols = Object.keys(s);
		const colNames = cols.map(c => `"${c}"`).join(', ');
		const placeholders = cols.map(() => '?').join(', ');
		const vals = cols.map(c => s[c]);
		await queryD1(`INSERT OR REPLACE INTO "sekolah" (${colNames}) VALUES (${placeholders})`, vals);
	}

	console.log(`Updating pegawai with original sekolah_id...`);
	for (const p of pegawaiRows) {
		if (p.sekolah_id) {
			await queryD1(`UPDATE "pegawai" SET "sekolah_id" = ? WHERE "id" = ?`, [p.sekolah_id, p.id]);
		}
	}

	console.log('Pegawai & Sekolah successfully migrated!');
}

main().catch(console.error);
