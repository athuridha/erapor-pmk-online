import { fail } from '@sveltejs/kit';
import { count, eq, and } from 'drizzle-orm';
import db from '$lib/server/db/index.js';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { tableKelas, tableMurid, tablePegawai } from '$lib/server/db/schema.js';
import { jalankanImpor } from '$lib/server/import-data/apply';
import { bacaWorkbook } from '$lib/server/import-data/parse';
import { kePratinjau, susunRencana } from '$lib/server/import-data/plan';
import { SHEETS, SHEET_ORDER } from '$lib/server/import-data/sheets';
import { ambilBerkas, hapusBerkas, simpanBerkas } from '$lib/server/import-data/stash';
import { getDapodikSettings } from '$lib/server/dapodik';
import { authority } from '../../pengguna/utils.server';

const MAKS_BERKAS = 2 * 1024 * 1024;

function daftarSheet() {
	return SHEET_ORDER.map((key) => {
		const spec = SHEETS[key];
		return {
			key,
			sheet: spec.sheet,
			judul: spec.judul,
			ringkas: spec.ringkas,
			kunci: spec.kunci,
			kolom: spec.kolom.map((k) => ({
				label: k.label,
				wajib: Boolean(k.wajib),
				petunjuk: k.petunjuk ?? ''
			}))
		};
	});
}

export async function load({ locals }) {
	authority('informasi_umum_sekolah');
	const sekolahId = locals.sekolah?.id;
	const meta: PageMeta = { title: 'Impor Data Pokok' };

	if (!sekolahId) {
		return {
			meta,
			semester: null,
			hitung: null,
			sheets: daftarSheet(),
			dapodik: { tersedia: false, url: null }
		};
	}

	const dapodikSettings = await getDapodikSettings(sekolahId);
	const ctx = await resolveSekolahAcademicContext(sekolahId);
	const tahunAjaran = ctx.tahunAjaranList.find((t) => t.id === ctx.activeTahunAjaranId);
	const semester = tahunAjaran?.semester.find((s) => s.id === ctx.activeSemesterId) ?? null;

	const [kelas, murid, pegawai] = await Promise.all([
		db.select({ jumlah: count() }).from(tableKelas).where(eq(tableKelas.sekolahId, sekolahId)),
		db
			.select({ jumlah: count() })
			.from(tableMurid)
			.where(
				ctx.activeSemesterId
					? and(
							eq(tableMurid.sekolahId, sekolahId),
							eq(tableMurid.semesterId, ctx.activeSemesterId)
						)
					: eq(tableMurid.sekolahId, sekolahId)
			),
		db.select({ jumlah: count() }).from(tablePegawai).where(eq(tablePegawai.sekolahId, sekolahId))
	]);

	return {
		meta,
		semester:
			semester && tahunAjaran ? { nama: semester.nama, tahunAjaran: tahunAjaran.nama } : null,
		hitung: {
			kelas: kelas[0]?.jumlah ?? 0,
			murid: murid[0]?.jumlah ?? 0,
			pegawai: pegawai[0]?.jumlah ?? 0
		},
		sheets: daftarSheet(),
		dapodik: {
			tersedia: Boolean(dapodikSettings?.url && dapodikSettings?.token),
			url: dapodikSettings?.url ?? null
		}
	};
}

type Konteks =
	| { ok: true; sekolahId: number; semesterId: number; tahunAjaranId: number }
	| { ok: false; pesan: string };

async function siapkanKonteks(locals: App.Locals): Promise<Konteks> {
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) return { ok: false, pesan: 'Sekolah aktif belum dipilih.' };

	const ctx = await resolveSekolahAcademicContext(sekolahId);
	if (!ctx.activeSemesterId || !ctx.activeTahunAjaranId) {
		return {
			ok: false,
			pesan:
				'Belum ada semester aktif. Atur tahun ajaran dan semester aktif lebih dulu di halaman Akademik.'
		};
	}
	return {
		ok: true,
		sekolahId,
		semesterId: ctx.activeSemesterId,
		tahunAjaranId: ctx.activeTahunAjaranId
	};
}

export const actions = {
	async pratinjau({ request, locals }) {
		authority('informasi_umum_sekolah');

		const formData = await request.formData();
		const berkas = formData.get('file');
		if (!(berkas instanceof File) || berkas.size === 0) {
			return fail(400, { fail: 'Pilih berkas Excel (.xlsx) lebih dulu.' });
		}
		if (berkas.size > MAKS_BERKAS) {
			return fail(400, { fail: 'Ukuran berkas maksimal 2MB.' });
		}

		const konteks = await siapkanKonteks(locals);
		if (!konteks.ok) return fail(400, { fail: konteks.pesan });

		let hasil;
		try {
			hasil = await bacaWorkbook(Buffer.from(await berkas.arrayBuffer()));
		} catch (e) {
			console.error('[import-data] berkas gagal dibaca:', e);
			return fail(400, { fail: 'Berkas tidak bisa dibaca. Pastikan formatnya .xlsx yang benar.' });
		}

		if (!hasil.sheets.length) {
			return fail(400, { fail: hasil.galat.join(' ') || 'Tidak ada sheet yang dikenali.' });
		}

		const rencana = await susunRencana(
			konteks.sekolahId,
			konteks.semesterId,
			konteks.tahunAjaranId,
			hasil
		);
		const pratinjau = kePratinjau(rencana);
		const token = simpanBerkas({
			sekolahId: konteks.sekolahId,
			userId: locals.user?.id ?? 0,
			namaBerkas: berkas.name,
			parse: hasil
		});

		return {
			message: pratinjau.akanDitulis
				? `Pratinjau siap: ${pratinjau.akanDitulis} baris akan ditulis.`
				: 'Pratinjau siap: tidak ada baris yang perlu ditulis.',
			pratinjau,
			token,
			namaBerkas: berkas.name,
			galatSheet: hasil.galat
		};
	},

	async simpan({ request, locals }) {
		authority('informasi_umum_sekolah');

		const formData = await request.formData();
		const token = ((formData.get('token') as string | null) ?? '').trim();
		if (!token) {
			return fail(400, { fail: 'Pratinjau sudah tidak berlaku. Unggah ulang berkasnya.' });
		}

		const konteks = await siapkanKonteks(locals);
		if (!konteks.ok) return fail(400, { fail: konteks.pesan });

		const berkas = ambilBerkas(token, konteks.sekolahId, locals.user?.id ?? 0);
		if (!berkas) {
			return fail(400, { fail: 'Pratinjau sudah kedaluwarsa. Unggah ulang berkasnya.' });
		}

		// Rencana disusun ulang dari data terkini, supaya perubahan di tab lain
		// setelah pratinjau tidak menghasilkan tulisan yang salah.
		const rencana = await susunRencana(
			konteks.sekolahId,
			konteks.semesterId,
			konteks.tahunAjaranId,
			berkas.parse
		);
		const hasil = await jalankanImpor(rencana);
		hapusBerkas(token);

		const bagian = [
			hasil.dibuat ? `${hasil.dibuat} data baru` : '',
			hasil.diubah ? `${hasil.diubah} data diperbarui` : '',
			hasil.gagal ? `${hasil.gagal} baris gagal` : ''
		].filter(Boolean);

		return {
			message: bagian.length
				? `Impor selesai: ${bagian.join(', ')}.`
				: 'Impor selesai: tidak ada perubahan.',
			hasil
		};
	}
};
