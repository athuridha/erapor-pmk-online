import db from '$lib/server/db';

/**
 * Data hygiene that runs once per startup (registered in ensure-bootstrap.ts
 * *after* ensureSmkPratamaMulya so the seeded defaults cannot overwrite it).
 *
 * Only touches data that is unambiguously wrong or left over from testing:
 * phase values that are not the canonical `Fase E` / `Fase F`, placeholder
 * NIPs, the duplicated school street line, and TESTQA fixtures. Every step is
 * idempotent and guarded so a second run changes nothing, and nothing real is
 * deleted as long as a row is still referenced by another table.
 */

async function run(label: string, sql: string, args: (string | number | null)[] = []) {
	try {
		const result = await db.$client.execute({ sql, args });
		const changes = result?.rowsAffected ?? 0;
		if (changes > 0) console.info(`[data-cleanup] ${label}: ${changes} row(s)`);
		return changes;
	} catch (err) {
		// A failed cleanup step must never block the boot; log and continue.
		console.warn(`[data-cleanup] ${label} failed:`, err);
		return 0;
	}
}

export async function ensureDataCleanup() {
	const nowIso = new Date().toISOString();

	// 1. Kelas.fase: single letter and already-prefixed values are the same
	//    phase. The form, seed, badge, and tingkat helpers all expect "Fase X".
	await run(
		'normalize fase E',
		`UPDATE kelas SET fase = 'Fase E', updated_at = ?
		 WHERE lower(trim(fase)) IN ('e', 'fase e') AND fase <> 'Fase E'`,
		[nowIso]
	);
	await run(
		'normalize fase F',
		`UPDATE kelas SET fase = 'Fase F', updated_at = ?
		 WHERE lower(trim(fase)) IN ('f', 'fase f') AND fase <> 'Fase F'`,
		[nowIso]
	);

	// 2. Sekolah jenjang: the form stores the option keys ('sma' + variant
	//    'smk'), so stray casing from imports/sync would not match the select.
	await run(
		'normalize jenjang_pendidikan',
		`UPDATE sekolah SET jenjang_pendidikan = lower(trim(jenjang_pendidikan)), updated_at = ?
		 WHERE jenjang_pendidikan <> lower(trim(jenjang_pendidikan))`,
		[nowIso]
	);
	await run(
		'normalize jenjang_variant',
		`UPDATE sekolah SET jenjang_variant = lower(trim(jenjang_variant)), updated_at = ?
		 WHERE jenjang_variant IS NOT NULL AND jenjang_variant <> lower(trim(jenjang_variant))`,
		[nowIso]
	);

	// 3. Placeholder NIP "12345678" is not a real NIP. The form allows an
	//    empty NIP, so clear it instead of showing a fake number on rapor.
	await run(
		'clear placeholder NIP',
		`UPDATE pegawai SET nip = '', updated_at = ?
		 WHERE trim(nip) = '12345678'`,
		[nowIso]
	);

	// 4. School address: the seed used to copy the whole "desa, kecamatan,
	//    kabupaten, provinsi" line into `alamat.jalan`. composeAlamat() already
	//    joins those columns, so such a street line prints twice. Only the
	//    school's own address row is touched, and only when the street text
	//    repeats every component it is made of.
	await run(
		'normalize school alamat.jalan',
		`UPDATE alamat SET jalan = '', updated_at = ?
		 WHERE id IN (SELECT alamat_id FROM sekolah)
		   AND trim(jalan) <> ''
		   AND instr(lower(jalan), lower(desa)) > 0
		   AND instr(lower(jalan), lower(kecamatan)) > 0
		   AND instr(lower(jalan), lower(kabupaten)) > 0`,
		[nowIso]
	);

	// 5. TESTQA fixtures. Accounts first (their children cascade), then the
	//    person/pelanggaran/master rows, each only when nothing references them.

	await run(
		'delete TESTQA auth_user',
		`DELETE FROM auth_user
		 WHERE lower(username) LIKE '%testqa%'
		   AND type <> 'admin'
		   AND pegawai_id IN (SELECT id FROM pegawai WHERE nama LIKE 'TESTQA%')`
	);

	await run(
		'delete TESTQA poin_pelanggaran',
		`DELETE FROM poin_pelanggaran
		 WHERE nama LIKE 'TESTQA%'
		   AND NOT EXISTS (SELECT 1 FROM poin_siswa WHERE poin_siswa.pelanggaran_id = poin_pelanggaran.id)`
	);

	await run(
		'delete TESTQA kelas',
		`DELETE FROM kelas
		 WHERE nama LIKE 'TESTQA%'
		   AND NOT EXISTS (SELECT 1 FROM murid WHERE murid.kelas_id = kelas.id)
		   AND NOT EXISTS (SELECT 1 FROM mata_pelajaran WHERE mata_pelajaran.kelas_id = kelas.id)
		   AND NOT EXISTS (SELECT 1 FROM jadwal_pelajaran WHERE jadwal_pelajaran.kelas_id = kelas.id)
		   AND NOT EXISTS (SELECT 1 FROM p5_projek WHERE p5_projek.kelas_id = kelas.id)
		   AND NOT EXISTS (SELECT 1 FROM pkl_kelompok WHERE pkl_kelompok.kelas_id = kelas.id)
		   AND NOT EXISTS (SELECT 1 FROM kokurikuler WHERE kokurikuler.kelas_id = kelas.id)
		   AND NOT EXISTS (SELECT 1 FROM ekstrakurikuler WHERE ekstrakurikuler.kelas_id = kelas.id)
		   AND NOT EXISTS (SELECT 1 FROM auth_user WHERE auth_user.kelas_id = kelas.id)`
	);

	await run(
		'delete uji pegawai',
		`DELETE FROM pegawai
		 WHERE (nama LIKE 'TESTQA%' OR trim(nama) = 'Guru Uji')
		   AND NOT EXISTS (SELECT 1 FROM auth_user WHERE auth_user.pegawai_id = pegawai.id)
		   AND NOT EXISTS (
		     SELECT 1 FROM kelas
		     WHERE kelas.wali_kelas_id = pegawai.id OR kelas.wali_asuh_id = pegawai.id
		   )
		   AND NOT EXISTS (SELECT 1 FROM sekolah WHERE sekolah.kepala_sekolah_id = pegawai.id)
		   AND NOT EXISTS (SELECT 1 FROM mata_pelajaran WHERE mata_pelajaran.pengampu_id = pegawai.id)
		   AND NOT EXISTS (SELECT 1 FROM p5_projek WHERE p5_projek.pembina_pegawai_id = pegawai.id)
		   AND NOT EXISTS (
		     SELECT 1 FROM pkl_kelompok WHERE pkl_kelompok.pembimbing_pegawai_id = pegawai.id
		   )
		   AND NOT EXISTS (SELECT 1 FROM poin_siswa WHERE poin_siswa.pelapor_pegawai_id = pegawai.id)`
	);

	await run(
		'delete uji murid',
		`DELETE FROM murid
		 WHERE trim(nama) = 'Murid Uji'
		   AND nis = '777179273304'
		   AND NOT EXISTS (SELECT 1 FROM asesmen_formatif WHERE asesmen_formatif.murid_id = murid.id)
		   AND NOT EXISTS (SELECT 1 FROM asesmen_sumatif WHERE asesmen_sumatif.murid_id = murid.id)
		   AND NOT EXISTS (SELECT 1 FROM asesmen_kokurikuler WHERE asesmen_kokurikuler.murid_id = murid.id)
		   AND NOT EXISTS (SELECT 1 FROM kehadiran_murid WHERE kehadiran_murid.murid_id = murid.id)
		   AND NOT EXISTS (SELECT 1 FROM p5_nilai WHERE p5_nilai.murid_id = murid.id)
		   AND NOT EXISTS (SELECT 1 FROM pkl_nilai WHERE pkl_nilai.murid_id = murid.id)
		   AND NOT EXISTS (SELECT 1 FROM poin_siswa WHERE poin_siswa.murid_id = murid.id)`
	);

	await run(
		'delete TESTQA alamat',
		`DELETE FROM alamat
		 WHERE desa LIKE 'TESTQA%'
		   AND NOT EXISTS (SELECT 1 FROM murid WHERE murid.alamat_id = alamat.id)
		   AND NOT EXISTS (SELECT 1 FROM sekolah WHERE sekolah.alamat_id = alamat.id)`
	);

	// 6. One person, one NIK/NIP. Partial indexes so rows without an identity
	//    number (empty string) can still be many. If an old database still has
	//    a real duplicate the index is skipped (logged) instead of failing boot.
	await run(
		'index pegawai.nik unique',
		`CREATE UNIQUE INDEX IF NOT EXISTS pegawai_nik_unique
		 ON pegawai(nik) WHERE nik IS NOT NULL AND trim(nik) <> ''`
	);
	await run(
		'index pegawai.nip unique',
		`CREATE UNIQUE INDEX IF NOT EXISTS pegawai_nip_unique
		 ON pegawai(nip) WHERE nip IS NOT NULL AND trim(nip) <> ''`
	);
}
