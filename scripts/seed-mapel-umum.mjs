import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:data/database.sqlite3' });

export const MAPEL_UMUM = [
	// 1. Agama & Budi Pekerti (Umum & Varian)
	{ nama: 'Pendidikan Agama dan Budi Pekerti', kode: 'PABP', jenis: 'wajib', urutan: 1 },
	{ nama: 'Pendidikan Agama Islam dan Budi Pekerti', kode: 'PAI', jenis: 'wajib', urutan: 1 },
	{ nama: 'Pendidikan Agama Kristen dan Budi Pekerti', kode: 'PAK', jenis: 'wajib', urutan: 1 },
	{ nama: 'Pendidikan Agama Katolik dan Budi Pekerti', kode: 'PAKat', jenis: 'wajib', urutan: 1 },
	{ nama: 'Pendidikan Agama Hindu dan Budi Pekerti', kode: 'PAH', jenis: 'wajib', urutan: 1 },
	{ nama: 'Pendidikan Agama Buddha dan Budi Pekerti', kode: 'PAB', jenis: 'wajib', urutan: 1 },
	{ nama: 'Pendidikan Agama Konghuchu dan Budi Pekerti', kode: 'PAKh', jenis: 'wajib', urutan: 1 },
	// 2. Pendidikan Pancasila
	{ nama: 'Pendidikan Pancasila', kode: 'PPKn', jenis: 'wajib', urutan: 2 },
	// 3. Bahasa Indonesia
	{ nama: 'Bahasa Indonesia', kode: 'BIN', jenis: 'wajib', urutan: 3 },
	// 4. Matematika
	{ nama: 'Matematika', kode: 'MTK', jenis: 'wajib', urutan: 4 },
	// 5. IPA
	{ nama: 'Ilmu Pengetahuan Alam (IPA)', kode: 'IPA', jenis: 'wajib', urutan: 5 },
	// 6. IPS
	{ nama: 'Ilmu Pengetahuan Sosial (IPS)', kode: 'IPS', jenis: 'wajib', urutan: 6 },
	// 7. Bahasa Inggris
	{ nama: 'Bahasa Inggris', kode: 'BIG', jenis: 'wajib', urutan: 7 },
	// 8. PJOK
	{
		nama: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
		kode: 'PJOK',
		jenis: 'wajib',
		urutan: 8
	},
	// 9. Informatika
	{ nama: 'Informatika', kode: 'INF', jenis: 'wajib', urutan: 9 },
	// 10. Seni dan Budaya
	{ nama: 'Seni dan Budaya', kode: 'SBU', jenis: 'wajib', urutan: 10 },
	// 11. Prakarya dan Kewirausahaan
	{ nama: 'Prakarya dan Kewirausahaan', kode: 'PKWU', jenis: 'wajib', urutan: 11 },
	// 12. Muatan Lokal
	{ nama: 'Muatan Lokal', kode: 'MLOK', jenis: 'mulok', urutan: 12 },
	// 13. Mata Pelajaran Pilihan
	{ nama: 'Mata Pelajaran Pilihan', kode: 'PIL', jenis: 'pilihan', urutan: 13 }
];

async function run() {
	const kelasRows = await db.execute('SELECT id, nama FROM kelas');
	console.log('Total kelas terdeteksi:', kelasRows.rows.length);

	let addedCount = 0;
	const now = new Date().toISOString();

	for (const k of kelasRows.rows) {
		for (const m of MAPEL_UMUM) {
			const res = await db.execute({
				sql: `INSERT INTO mata_pelajaran (kelas_id, nama, kode, kkm, jenis, urutan, created_at)
				      VALUES (?, ?, ?, 75, ?, ?, ?)
				      ON CONFLICT(kelas_id, nama) DO UPDATE SET
				        kode = coalesce(mata_pelajaran.kode, excluded.kode),
				        urutan = coalesce(mata_pelajaran.urutan, excluded.urutan)`,
				args: [k.id, m.nama, m.kode, m.jenis, m.urutan, now]
			});
			if (res.rowsAffected > 0) addedCount++;
		}
	}
	console.log('Selesai! Baris diproses:', addedCount);

	const totalMapel = await db.execute('SELECT count(*) as c FROM mata_pelajaran');
	console.log('Total baris mata_pelajaran sekarang:', totalMapel.rows[0].c);
}

run().catch(console.error);
