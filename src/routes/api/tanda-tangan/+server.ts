import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { tableKelas, tablePegawai, tableSekolah } from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { deletePersonSignature, hasPersonSignature, savePersonSignature } from '$lib/server/ttd';
import { isAdminUser } from '../../pengguna/permissions';

/**
 * Unggah tanda tangan kepala sekolah & wali kelas.
 *
 * Setiap orang punya satu tanda tangan (PNG transparan) yang disimpan di
 * folder data, lalu dipakai di dokumen cetak (rapor, piagam, berita acara).
 *
 * siapa boleh mengunggah:
 * - admin / kepala sekolah: untuk siapa saja di sekolahnya,
 * - wali kelas: hanya untuk dirinya sendiri.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ message: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
	}

	const sekolahId = locals.sekolah?.id ?? null;
	if (!sekolahId) {
		return json({ message: 'Data sekolah aktif tidak ditemukan.' }, { status: 400 });
	}

	let payload: { pegawaiId?: number; tandaTangan?: string | null };
	try {
		payload = await request.json();
	} catch {
		return json({ message: 'Format permintaan tidak dikenali.' }, { status: 400 });
	}

	const pegawaiId = Number(payload.pegawaiId);
	if (!Number.isInteger(pegawaiId) || pegawaiId <= 0) {
		return json({ message: 'Data penandatangan tidak valid.' }, { status: 400 });
	}

	const admin = isAdminUser(user);

	// Wali kelas hanya boleh mengunggah tanda tangannya sendiri.
	if (!admin) {
		const pegawaiIdSendiri = (user as { pegawaiId?: number | null }).pegawaiId ?? null;
		if (!pegawaiIdSendiri || pegawaiIdSendiri !== pegawaiId) {
			return json(
				{ message: 'Hanya tanda tangan Anda sendiri yang bisa diunggah.' },
				{ status: 403 }
			);
		}

		const kelasMilikSendiri = await db.query.tableKelas.findFirst({
			columns: { id: true },
			where: and(eq(tableKelas.sekolahId, sekolahId), eq(tableKelas.waliKelasId, pegawaiIdSendiri))
		});
		if (!kelasMilikSendiri) {
			return json(
				{ message: 'Tanda tangan hanya bisa diunggah oleh wali kelas atau admin.' },
				{ status: 403 }
			);
		}
	}

	const pegawai = await db.query.tablePegawai.findFirst({
		columns: { id: true, sekolahId: true },
		where: eq(tablePegawai.id, pegawaiId)
	});
	if (!pegawai) {
		return json({ message: 'Data pegawai tidak ditemukan.' }, { status: 404 });
	}
	if (pegawai.sekolahId != null && pegawai.sekolahId !== sekolahId) {
		return json(
			{ message: 'Tanda tangan hanya bisa diunggah untuk pegawai sekolah ini.' },
			{ status: 403 }
		);
	}

	const dataUrl = payload.tandaTangan;
	try {
		if (typeof dataUrl === 'string' && dataUrl.trim()) {
			await savePersonSignature(pegawaiId, dataUrl.trim());
		} else {
			await deletePersonSignature(pegawaiId);
		}
	} catch (error) {
		console.error('[tanda-tangan] gagal menyimpan tanda tangan:', error);
		return json(
			{
				message:
					error instanceof Error
						? error.message
						: 'Gagal menyimpan tanda tangan. Gunakan gambar PNG.'
			},
			{ status: 400 }
		);
	}

	return json({
		success: true,
		pegawaiId,
		hasSignature: await hasPersonSignature(pegawaiId)
	});
};

/** Daftar penandatangan (kepala sekolah + wali kelas) beserta status tandatangannya. */
export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ message: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
	}

	const sekolahId = locals.sekolah?.id ?? null;
	if (!sekolahId) {
		return json({ message: 'Data sekolah aktif tidak ditemukan.' }, { status: 400 });
	}

	if (!isAdminUser(user) && user.type !== 'wali_kelas') {
		return json({ message: 'Anda tidak memiliki akses ke tanda tangan.' }, { status: 403 });
	}

	const sekolah = await db.query.tableSekolah.findFirst({
		columns: { kepalaSekolahId: true },
		where: eq(tableSekolah.id, sekolahId)
	});

	const kelasRows = await db.query.tableKelas.findMany({
		columns: { id: true, nama: true, waliKelasId: true, waliAsuhId: true },
		where: eq(tableKelas.sekolahId, sekolahId)
	});

	const waliIds = [
		...new Set(
			kelasRows
				.map((kelas) => kelas.waliKelasId)
				.filter((value): value is number => typeof value === 'number')
		)
	];
	const semuaId = [
		...new Set([...(sekolah?.kepalaSekolahId ? [sekolah.kepalaSekolahId] : []), ...waliIds])
	];

	const pegawaiRows = semuaId.length
		? await db.query.tablePegawai.findMany({
				columns: { id: true, nama: true, nip: true },
				where: inArray(tablePegawai.id, semuaId)
			})
		: [];

	const penandatangan = await Promise.all(
		pegawaiRows.map(async (pegawai) => {
			const kelasMilik = kelasRows
				.filter((kelas) => kelas.waliKelasId === pegawai.id)
				.map((kelas) => kelas.nama);
			return {
				pegawaiId: pegawai.id,
				nama: pegawai.nama,
				nip: pegawai.nip,
				peran: sekolah?.kepalaSekolahId === pegawai.id ? 'Kepala Sekolah' : 'Wali Kelas',
				kelas: kelasMilik,
				hasSignature: await hasPersonSignature(pegawai.id)
			};
		})
	);

	return json({ penandatangan });
};
