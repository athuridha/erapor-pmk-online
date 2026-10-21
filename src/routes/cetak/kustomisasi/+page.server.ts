import { fail, error } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import db from '$lib/server/db';
import { tableMurid, tableSemester, tableTahunAjaran } from '$lib/server/db/schema';
import {
	DEFAULT_CUSTOM_CETAK,
	loadCustomCetak,
	normalisasiCustomCetak,
	simpanCustomCetak,
	type CustomCetak
} from '$lib/server/cetak/customization';
import { composeAlamat, fallbackTempat, formatTanggal } from '$lib/server/pdf/preview-utils';

const MAKS_UPLOAD_GAMBAR = 1_500_000; // 1,5 MB (data URL disimpan di app_meta)

function pastikanAdmin(loci: App.Locals) {
	const user = loci.user as { type?: string } | null;
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Kustomisasi cetak hanya bisa diubah admin dan kepala sekolah.');
	}
}

/** Nilai sekolah yang dipakai dokumen cetak saat ini (sebagai teks bawaan form). */
async function ambilSekolahSekarang(loci: App.Locals) {
	const sekolah = loci.sekolah;
	const tanggal = await db
		.select({ tanggalBagiRaport: tableSemester.tanggalBagiRaport })
		.from(tableSemester)
		.innerJoin(tableTahunAjaran, eq(tableSemester.tahunAjaranId, tableTahunAjaran.id))
		.where(and(eq(tableTahunAjaran.sekolahId, sekolah?.id ?? 0), eq(tableSemester.isAktif, true)))
		.limit(1)
		.then((rows) => rows[0]?.tanggalBagiRaport ?? '');

	return {
		namaSekolah: sekolah?.nama ?? '',
		npsn: sekolah?.npsn ?? '',
		alamat: sekolah ? composeAlamat(sekolah) : '',
		email: sekolah?.email ?? '',
		kota: sekolah ? fallbackTempat(sekolah) : '',
		tanggal: formatTanggal(tanggal)
	};
}

export const load = async ({ locals }) => {
	pastikanAdmin(locals);

	const [custom, sekolahSekarang, muridRows] = await Promise.all([
		loadCustomCetak(),
		ambilSekolahSekarang(locals),
		db
			.select({ id: tableMurid.id, nama: tableMurid.nama, kelasId: tableMurid.kelasId })
			.from(tableMurid)
			.where(eq(tableMurid.sekolahId, locals.sekolah?.id ?? 0))
			.orderBy(asc(tableMurid.nama))
			.limit(60)
	]);

	return {
		meta: { title: 'Kustomisasi Cetak' },
		custom,
		defaults: DEFAULT_CUSTOM_CETAK,
		sekolahSekarang,
		daftarMurid: muridRows
	};
};

export const actions = {
	async simpan({ request, locals }) {
		pastikanAdmin(locals);

		const formData = await request.formData();
		const mentah = String(formData.get('custom') ?? '{}');
		let custom: CustomCetak;
		try {
			custom = normalisasiCustomCetak(JSON.parse(mentah));
		} catch {
			return fail(400, { fail: 'Data kustomisasi tidak valid.' });
		}

		// Nilai yang sama dengan data sekolah = bukan override, supaya perubahan
		// data master tetap ikut tercetak.
		const sekarang = await ambilSekolahSekarang(locals);
		const sama = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
		if (sama(custom.teks.namaSekolah, sekarang.namaSekolah)) custom.teks.namaSekolah = '';
		if (sama(custom.teks.npsn, sekarang.npsn)) custom.teks.npsn = '';
		if (sama(custom.teks.alamat, sekarang.alamat)) custom.teks.alamat = '';
		if (sama(custom.teks.email, sekarang.email)) custom.teks.email = '';
		if (sama(custom.teks.kota, sekarang.kota)) custom.teks.kota = '';
		if (sama(custom.teks.tanggal, sekarang.tanggal)) custom.teks.tanggal = '';

		await simpanCustomCetak(custom);
		return { message: 'Kustomisasi cetak disimpan.' };
	},

	async uploadGambar({ request, locals }) {
		pastikanAdmin(locals);

		const formData = await request.formData();
		const jenis = String(formData.get('jenis') ?? '');
		if (jenis !== 'logo' && jenis !== 'watermark') {
			return fail(400, { fail: 'Jenis gambar tidak valid.' });
		}

		const file = formData.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { fail: 'Pilih berkas gambar yang akan diunggah.' });
		}
		if (file.size > MAKS_UPLOAD_GAMBAR) {
			return fail(400, { fail: 'Ukuran gambar maksimal 1,5 MB.' });
		}
		if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
			return fail(400, { fail: 'Format gambar harus PNG, JPG, atau WEBP.' });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;

		const custom = await loadCustomCetak();
		custom.gambar[jenis] = dataUrl;
		await simpanCustomCetak(custom);

		return { message: 'Gambar berhasil diunggah.' };
	},

	async hapusGambar({ request, locals }) {
		pastikanAdmin(locals);

		const formData = await request.formData();
		const jenis = String(formData.get('jenis') ?? '');
		if (jenis !== 'logo' && jenis !== 'watermark') {
			return fail(400, { fail: 'Jenis gambar tidak valid.' });
		}

		const custom = await loadCustomCetak();
		custom.gambar[jenis] = null;
		await simpanCustomCetak(custom);

		return { message: 'Gambar dihapus.' };
	}
};
