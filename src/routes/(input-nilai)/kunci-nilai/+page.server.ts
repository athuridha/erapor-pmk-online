import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import db from '$lib/server/db';
import { tableKelas, tableMataPelajaran } from '$lib/server/db/schema';
import { authority } from '../../../pengguna/utils.server';
import { ensureKunciNilaiSchema } from '$lib/server/db/ensure-kunci-nilai';
import { bukaKunciNilaiMapel, kunciNilaiMapel, loadKunciNilai } from '$lib/server/nilai-kunci';

async function listMapelKelas(kelasId: number) {
	return db.query.tableMataPelajaran.findMany({
		columns: { id: true, nama: true, pengampuId: true },
		with: { pengampu: { columns: { nama: true } } },
		where: eq(tableMataPelajaran.kelasId, kelasId),
		orderBy: asc(tableMataPelajaran.nama)
	});
}

export const load = async ({ parent, locals }) => {
	authority('input_nilai_kunci_nilai');
	await ensureKunciNilaiSchema();

	const sekolahId = locals.sekolah?.id ?? null;
	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan.');
	}

	const { kelasAktif } = await parent();
	const kelasId = kelasAktif?.id ?? null;

	if (!kelasId) {
		return {
			meta: { title: 'Kunci Nilai' },
			kelasId: null,
			kelasNama: '',
			mapel: [],
			jumlahTerkunci: 0
		};
	}

	const mapelRows = await listMapelKelas(kelasId);
	const kunci = await loadKunciNilai(mapelRows.map((row) => row.id));

	const mapel = mapelRows.map((row) => {
		const info = kunci.get(row.id) ?? null;
		return {
			id: row.id,
			nama: row.nama,
			pengampu: row.pengampu?.nama ?? '—',
			terkunci: Boolean(info),
			dikunciOleh: info?.dikunciOleh ?? null,
			dikunciPada: info?.dikunciPada ?? null,
			alasan: info?.alasan ?? null
		};
	});

	return {
		meta: { title: 'Kunci Nilai' },
		kelasId,
		kelasNama: kelasAktif?.nama ?? '',
		mapel,
		jumlahTerkunci: mapel.filter((row) => row.terkunci).length
	};
};

function mapelMilikSekolah(mapelId: number, sekolahId: number) {
	return db.query.tableMataPelajaran
		.findFirst({
			columns: { id: true, nama: true, kelasId: true },
			with: { kelas: { columns: { sekolahId: true } } },
			where: eq(tableMataPelajaran.id, mapelId)
		})
		.then((row) => {
			if (!row || row.kelas?.sekolahId !== sekolahId) return null;
			return row;
		});
}

export const actions = {
	async kunci({ request, locals }) {
		authority('input_nilai_kunci_nilai');
		const sekolahId = locals.sekolah?.id ?? null;
		if (!sekolahId) return fail(401, { fail: 'Sekolah aktif tidak ditemukan.' });

		const formData = await request.formData();
		const mapelId = Number(formData.get('mapelId') ?? 0);
		const alasan = String(formData.get('alasan') ?? '').trim();
		if (!Number.isInteger(mapelId) || mapelId <= 0) {
			return fail(400, { fail: 'Mata pelajaran tidak valid.' });
		}

		const mapel = await mapelMilikSekolah(mapelId, sekolahId);
		if (!mapel) return fail(404, { fail: 'Mata pelajaran tidak ditemukan.' });

		await kunciNilaiMapel({
			mapelId: mapel.id,
			namaMapel: mapel.nama,
			sekolahId,
			userId: locals.user?.id ?? null,
			aktor: locals.user?.username ?? null,
			alasan: alasan || null
		});

		return { message: `Nilai ${mapel.nama} dikunci.` };
	},

	async buka({ request, locals }) {
		authority('input_nilai_kunci_nilai');
		const sekolahId = locals.sekolah?.id ?? null;
		if (!sekolahId) return fail(401, { fail: 'Sekolah aktif tidak ditemukan.' });

		const formData = await request.formData();
		const mapelId = Number(formData.get('mapelId') ?? 0);
		if (!Number.isInteger(mapelId) || mapelId <= 0) {
			return fail(400, { fail: 'Mata pelajaran tidak valid.' });
		}

		const mapel = await mapelMilikSekolah(mapelId, sekolahId);
		if (!mapel) return fail(404, { fail: 'Mata pelajaran tidak ditemukan.' });

		await bukaKunciNilaiMapel({
			mapelId: mapel.id,
			namaMapel: mapel.nama,
			sekolahId,
			userId: locals.user?.id ?? null,
			aktor: locals.user?.username ?? null
		});

		return { message: `Nilai ${mapel.nama} dibuka.` };
	},

	async kunciSemua({ request, locals }) {
		authority('input_nilai_kunci_nilai');
		const sekolahId = locals.sekolah?.id ?? null;
		if (!sekolahId) return fail(401, { fail: 'Sekolah aktif tidak ditemukan.' });

		const formData = await request.formData();
		const kelasId = Number(formData.get('kelasId') ?? 0);
		const kelas = await db.query.tableKelas.findFirst({
			columns: { id: true },
			where: eq(tableKelas.id, kelasId)
		});
		if (!kelas) return fail(404, { fail: 'Kelas tidak ditemukan.' });

		const mapelRows = await listMapelKelas(kelasId);
		for (const mapel of mapelRows) {
			await kunciNilaiMapel({
				mapelId: mapel.id,
				namaMapel: mapel.nama,
				sekolahId,
				userId: locals.user?.id ?? null,
				aktor: locals.user?.username ?? null,
				alasan: 'Dikunci massal oleh operator sekolah'
			});
		}

		return { message: `${mapelRows.length} mata pelajaran dikunci.` };
	},

	async bukaSemua({ request, locals }) {
		authority('input_nilai_kunci_nilai');
		const sekolahId = locals.sekolah?.id ?? null;
		if (!sekolahId) return fail(401, { fail: 'Sekolah aktif tidak ditemukan.' });

		const formData = await request.formData();
		const kelasId = Number(formData.get('kelasId') ?? 0);
		const kelas = await db.query.tableKelas.findFirst({
			columns: { id: true },
			where: eq(tableKelas.id, kelasId)
		});
		if (!kelas) return fail(404, { fail: 'Kelas tidak ditemukan.' });

		const mapelRows = await listMapelKelas(kelasId, sekolahId);
		for (const mapel of mapelRows) {
			await bukaKunciNilaiMapel({
				mapelId: mapel.id,
				namaMapel: mapel.nama,
				sekolahId,
				userId: locals.user?.id ?? null,
				aktor: locals.user?.username ?? null
			});
		}

		return { message: `Kunci nilai dibuka untuk ${mapelRows.length} mata pelajaran.` };
	}
};
