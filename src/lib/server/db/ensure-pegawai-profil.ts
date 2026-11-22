import db from '$lib/server/db';

const COLUMNS: Array<[string, string]> = [
	['foto_profil', 'text'],
	['jenis_kelamin', 'text'],
	['tempat_lahir', 'text'],
	['tanggal_lahir', 'text'],
	['alamat', 'text'],
	['no_hp', 'text'],
	['email', 'text'],
	['status_kepegawaian', 'text'],
	['jabatan', 'text'],
	['pangkat_golongan', 'text'],
	['status_aktif', "text DEFAULT 'aktif'"],
	['tanggal_mulai_tugas', 'text'],
	['pendidikan_terakhir', 'text'],
	['program_studi', 'text']
];

async function existingColumns(): Promise<Set<string>> {
	try {
		const result = await db.$client.execute('PRAGMA table_info("pegawai")');
		return new Set(result.rows.map((row) => String((row as { name?: unknown }).name ?? '')));
	} catch {
		return new Set();
	}
}

/** Kolom profil guru pada `pegawai` (identitas, kepegawaian, foto). */
export async function ensurePegawaiProfilSchema() {
	const existing = await existingColumns();
	if (existing.size === 0) return;
	for (const [name, type] of COLUMNS) {
		if (existing.has(name)) continue;
		try {
			await db.$client.execute(`ALTER TABLE "pegawai" ADD COLUMN "${name}" ${type}`);
		} catch {
			// column already exists / concurrent migration
		}
	}
}
