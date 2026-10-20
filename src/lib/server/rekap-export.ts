import { writeAoaToBuffer } from '$lib/utils/excel.js';
import type { RekapKeseluruhan } from '$lib/admin/rekap.server';

/**
 * Susun berkas Excel rekap nilai: judul, matriks murid per semester, rata-rata
 * kelas, lalu ringkasan per mata pelajaran dan per guru.
 */
export async function rekapKeExcel(rekap: RekapKeseluruhan, judul: string): Promise<Buffer> {
	const rows: Array<Array<unknown>> = [
		[judul, rekap.kelas.nama],
		[
			'Bobot nilai (lingkup/STS/SAS)',
			`${rekap.konfigurasi.bobotLingkup}/${rekap.konfigurasi.bobotSts}/${rekap.konfigurasi.bobotSas}`
		],
		[
			'Ambang kriteria (cukup/baik)',
			`${rekap.konfigurasi.kriteriaCukup}/${rekap.konfigurasi.kriteriaBaik}`
		],
		[],
		[
			'No',
			'Nama',
			'NIS',
			'NISN',
			...rekap.semester.map((sem) => sem.label),
			'Rata-rata Kumulatif',
			'Kriteria',
			'Peringkat'
		]
	];

	rekap.baris.forEach((row, index) => {
		rows.push([
			index + 1,
			row.nama,
			row.nis,
			row.nisn,
			...row.perSemester.map((sel) => (sel.nilai == null ? '' : sel.nilai)),
			row.rataKumulatif ?? '',
			row.kriteriaKumulatif ?? '',
			row.peringkat
		]);
	});

	rows.push([
		'',
		'Rata-rata Kelas',
		'',
		'',
		...rekap.ringkasan.map((item) => (item.nilai == null ? '' : item.nilai)),
		'',
		'',
		''
	]);

	rows.push(
		[],
		['Rekap per Mata Pelajaran'],
		['Mata Pelajaran', 'Guru', 'Kelas', 'Jumlah Nilai', 'Rata-rata']
	);
	for (const item of rekap.rekapMapel) {
		rows.push([item.nama, item.guru.join(', '), item.kelas, item.jumlahNilai, item.rataRata ?? '']);
	}

	rows.push(
		[],
		['Rekap per Guru'],
		['Guru', 'Mata Pelajaran', 'Murid', 'Jumlah Nilai', 'Rata-rata']
	);
	for (const item of rekap.rekapGuru) {
		rows.push([
			item.nama,
			item.mapel.join(', '),
			item.jumlahMurid,
			item.jumlahNilai,
			item.rataRata ?? ''
		]);
	}

	return writeAoaToBuffer(rows);
}
