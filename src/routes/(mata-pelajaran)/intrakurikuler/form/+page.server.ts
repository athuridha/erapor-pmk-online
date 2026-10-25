import db from '$lib/server/db/index.js';
import { normMapelName, resolveReferensiMapelId } from '$lib/server/dapodik';
import { opsiMapelDapodik } from '$lib/server/dapodik-mapel-options';
import { tableDapodikPembelajaran, tableKelas, tableMataPelajaran } from '$lib/server/db/schema';
import { cookieNames, unflattenFormData } from '$lib/utils';
import { fail } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';

export async function load({ parent, locals }) {
	const { kelasAktif } = await parent();
	const sekolahId = locals.sekolah?.id;

	const daftarKelas = sekolahId
		? await db.query.tableKelas.findMany({
				where: eq(tableKelas.sekolahId, sekolahId),
				columns: { id: true, nama: true, fase: true },
				orderBy: (table, { asc }) => [asc(table.nama)]
			})
		: [];

	const { dapodikMapelList, indukList } = kelasAktif?.id
		? await opsiMapelDapodik(kelasAktif.id, locals.sekolah)
		: { dapodikMapelList: [], indukList: [] };
	return {
		meta: { title: `Form Mata Pelajaran` },
		kelasAktif,
		daftarKelas,
		dapodikMapelList,
		indukList: indukList.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
	};
}

export const actions = {
	async add({ request, cookies, locals }) {
		const rawFormData = await request.formData();
		const formMapel = unflattenFormData<{
			nama?: string;
			nama_lokal?: string;
			jenis?: string;
			kkm?: string;
			kode?: string;
			induk_pembelajaran_id?: string;
		}>(rawFormData);

		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(400, { fail: 'Pilih sekolah aktif terlebih dahulu.' });
		}

		const semuaKelasCheck =
			rawFormData.get('semuaKelas') === 'on' ||
			rawFormData.get('semuaKelas') === '1' ||
			rawFormData.get('semuaKelas') === 'true';

		const rawKelasIds = rawFormData.getAll('kelasIds');
		const selectedKelasIds = rawKelasIds
			.map((id) => Number(id))
			.filter((id) => Number.isInteger(id) && id > 0);

		const kelasIdCookie = cookies.get(cookieNames.ACTIVE_KELAS_ID);
		const cookieKelasId = kelasIdCookie && kelasIdCookie !== 'semua' ? Number(kelasIdCookie) : null;

		let targetKelasIds: number[] = [];
		if (semuaKelasCheck) {
			const allKelas = await db
				.select({ id: tableKelas.id })
				.from(tableKelas)
				.where(eq(tableKelas.sekolahId, sekolahId));
			targetKelasIds = allKelas.map((k) => k.id);
		} else if (selectedKelasIds.length > 0) {
			targetKelasIds = selectedKelasIds;
		} else if (cookieKelasId && Number.isInteger(cookieKelasId)) {
			targetKelasIds = [cookieKelasId];
		}

		if (!targetKelasIds.length) {
			return fail(400, { fail: 'Pilih minimal satu kelas tujuan untuk mata pelajaran ini.' });
		}

		const nama = formMapel.nama?.trim();
		const namaLokal = formMapel.nama_lokal?.toString().trim() ?? '';
		const jenis = formMapel.jenis?.toLowerCase() as MataPelajaran['jenis'] | undefined;
		const kkmValue = formMapel.kkm ? Number(formMapel.kkm) : Number.NaN;
		const kode = formMapel.kode?.toString().trim() ?? '';

		if (!nama || !jenis || Number.isNaN(kkmValue)) {
			return fail(400, { fail: 'Harap lengkapi data mata pelajaran.' });
		}

		if (
			!['belum_dipetakan', 'wajib', 'pilihan', 'mulok', 'kejuruan', 'pemberdayaan'].includes(jenis)
		) {
			return fail(400, { fail: 'Jenis mata pelajaran tidak valid.' });
		}

		const kkm = Math.max(0, Math.round(kkmValue));

		// Mapel agama (semua varian, termasuk versi Dapodik tanpa "Budi Pekerti") dibuat
		// otomatis oleh ensureAgamaMapelForClasses — larang tambah manual.
		if (/^pendidikan (agama|kepercayaan)/i.test(nama)) {
			return fail(400, {
				fail: 'Tidak dapat menambahkan mapel agama karena PAPB dan sub mapel sudah ada di tabel'
			});
		}

		let insertedCount = 0;
		for (const targetKelasId of targetKelasIds) {
			const existing = await db.query.tableMataPelajaran.findFirst({
				where: and(eq(tableMataPelajaran.kelasId, targetKelasId), eq(tableMataPelajaran.nama, nama))
			});

			if (existing) {
				continue;
			}

			const mirrorRows = await db
				.select()
				.from(tableDapodikPembelajaran)
				.where(eq(tableDapodikPembelajaran.kelasId, targetKelasId));
			const namaKunci = normMapelName(nama);
			const mirror =
				mirrorRows.find((m) => m.mataPelajaranId && m.nama === nama) ??
				mirrorRows.find((m) => m.mataPelajaranId && normMapelName(m.nama) === namaKunci);

			let indukRow: (typeof mirrorRows)[number] | null = null;
			const indukIdRaw = formMapel.induk_pembelajaran_id?.toString().trim() ?? '';
			if (!mirror && indukIdRaw) {
				indukRow = mirrorRows.find((m) => m.pembelajaranId === indukIdRaw) ?? null;
			}

			const dapodikMatpelId = mirror?.mataPelajaranId ?? (await resolveReferensiMapelId(nama));

			const [{ maxUrutan }] = await db
				.select({ maxUrutan: sql<number>`coalesce(max(${tableMataPelajaran.urutan}), 0)` })
				.from(tableMataPelajaran)
				.where(eq(tableMataPelajaran.kelasId, targetKelasId));

			await db.insert(tableMataPelajaran).values({
				nama,
				namaLokal: namaLokal || null,
				jenis,
				kkm,
				kelasId: targetKelasId,
				kode: kode || null,
				urutan: (maxUrutan ?? 0) + 1,
				...(mirror ? { dapodikPembelajaranId: mirror.pembelajaranId } : {}),
				...(!mirror && indukRow ? { dapodikIndukPembelajaranId: indukRow.pembelajaranId } : {}),
				...(dapodikMatpelId ? { dapodikMataPelajaranId: dapodikMatpelId } : {})
			});
			insertedCount++;
		}

		return {
			message: `Data mata pelajaran "${nama}" berhasil diterapkan ke ${insertedCount} kelas.`
		};
	}
};
