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

function serializeValue(v) {
	if (v === null || v === undefined) return null;
	if (Buffer.isBuffer(v) || v instanceof Uint8Array || (typeof v === 'object' && v.type === 'Buffer')) {
		// D1 supports blobs via Uint8Array or array of numbers
		return Array.from(new Uint8Array(v.data || v));
	}
	if (typeof v === 'object') {
		// JSON or date
		if (v instanceof Date) return v.toISOString();
		return JSON.stringify(v);
	}
	return v;
}

// Ordered table list to satisfy foreign keys
const TABLE_ORDER = [
	'alamat',
	'pegawai',
	'sekolah',
	'tahun_ajaran',
	'semester',
	'kelas',
	'mata_pelajaran',
	'auth_user',
	'auth_session',
	'auth_user_kelas',
	'auth_user_mata_pelajaran',
	'wali_murid',
	'murid',
	'murid_mata_pelajaran',
	'murid_ekstrakurikuler',
	'murid_lampiran',
	'ekstrakurikuler',
	'ekstrakurikuler_tujuan',
	'kokurikuler',
	'teknik_penilaian',
	'tujuan_pembelajaran',
	'jadwal_pelajaran',
	'kegiatan_custom',
	'kelas_presensi',
	'absensi',
	'kehadiran_murid',
	'ketidakhadiran_harian',
	'ketidakhadiran_rapor',
	'presensi_guru',
	'presensi_settings',
	'jurnal_mengajar',
	'catatan_wali_kelas',
	'asesmen_formatif',
	'asesmen_sumatif',
	'asesmen_sumatif_tujuan',
	'asesmen_kokurikuler',
	'asesmen_ekstrakurikuler',
	'kunci_nilai',
	'keputusan_murid',
	'pkl_perusahaan',
	'pkl_kelompok',
	'pkl_tujuan',
	'pkl_murid',
	'pkl_nilai',
	'p5_projek',
	'p5_anggota',
	'p5_nilai',
	'poin_pelanggaran',
	'poin_siswa',
	'buku_tamu_settings',
	'buku_tamu',
	'dinas_luar_permohonan',
	'dinas_luar_bukti',
	'sppd',
	'sppd_pegawai',
	'sppd_pengikut',
	'portal_orangtua',
	'portal_orangtua_murid',
	'app_meta',
	'ai_settings',
	'bell_settings',
	'bell_sounds',
	'dapodik_settings',
	'dapodik_mata_pelajaran',
	'dapodik_pembelajaran',
	'audit_log',
	'tasks',
	'user_favorites',
	'login_attempt'
];

async function main() {
	const client = createClient({ url: 'file:D:/amar/pratamamulya/rapkumer-main/data/database.sqlite3' });

	console.log(`Starting migration in FK dependency order...`);

	for (const tableName of TABLE_ORDER) {
		let localCount = 0;
		try {
			const countRes = await client.execute(`SELECT COUNT(*) as c FROM "${tableName}"`);
			localCount = Number(countRes.rows[0].c);
		} catch (e) {
			continue;
		}

		if (localCount === 0) continue;

		let d1Count = 0;
		try {
			const d1Res = await queryD1(`SELECT COUNT(*) as c FROM "${tableName}"`);
			d1Count = Number(d1Res[0]?.c ?? 0);
		} catch (e) {
			console.log(`[D1] Count check error for ${tableName}:`, e.message);
		}

		if (d1Count >= localCount) {
			console.log(`[OK] ${tableName}: ${d1Count}/${localCount} rows`);
			continue;
		}

		console.log(`[Migrating] ${tableName} (${d1Count} in D1, ${localCount} in local)...`);

		const dataRes = await client.execute(`SELECT * FROM "${tableName}"`);
		const rows = dataRes.rows;

		for (const r of rows) {
			const cols = Object.keys(r);
			const colNames = cols.map(c => `"${c}"`).join(', ');
			const placeholders = cols.map(() => '?').join(', ');
			const vals = cols.map(c => serializeValue(r[c]));

			const sql = `INSERT OR REPLACE INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;
			try {
				await queryD1(sql, vals);
			} catch (err) {
				console.error(`Error on ${tableName} row:`, err.message);
				throw err;
			}
		}
		console.log(`[Done] ${tableName}`);
	}

	console.log('\n=== All data successfully migrated to Cloudflare D1! ===');
}

main().catch(console.error);
