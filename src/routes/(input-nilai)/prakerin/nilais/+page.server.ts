import db from '$lib/server/db';
import {
	tablePklKelompok,
	tablePklMurid,
	tablePklNilai,
	tablePklTujuan
} from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { isAuthorizedUser } from '../../../pengguna/permissions';

// The PKL tables ship via ensure-ekspansi-modul; pnpm db:push may be pending.
function isTableMissingError(error: unknown) {
	return error instanceof Error && error.message.includes('no such table');
}

function intParam(value: FormDataEntryValue | null) {
	if (typeof value !== 'string' || !value.trim()) return null;
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : null;
}

function predikatOf(nilai: number) {
	if (nilai >= 90) return 'Sangat Baik';
	if (nilai >= 80) return 'Baik';
	if (nilai >= 70) return 'Cukup';
	return 'Perlu Bimbingan';
}

export async function load({ locals, depends, url }) {
	depends('app:prakerin');

	if (!locals.user) redirect(303, '/login');

	const kelompokId = intParam(url.searchParams.get('kelompok'));
	if (!kelompokId) redirect(303, '/prakerin');

	const sekolahId = locals.sekolah?.id ?? null;
	const authorized = isAuthorizedUser(['input_nilai_pkl'], locals.user);

	const meta = { title: 'Nilai PKL' } satisfies PageMeta;

	if (!sekolahId || !authorized) {
		return {
			meta,
			authorized,
			kelompok: null,
			anggota: [],
			tujuan: [],
			nilaiMap: {} as Record<
				number,
				Record<number, { nilais: string; predikat: string | null; catatan: string | null }>
			>
		};
	}

	const kelompok = await db.query.tablePklKelompok.findFirst({
		columns: {
			id: true,
			kelasId: true,
			nama: true,
			skPenugasan: true,
			tanggalMulai: true,
			tanggalSelesai: true,
			lokasi: true,
			catatan: true
		},
		with: {
			kelas: { columns: { nama: true, fase: true } },
			perusahaan: { columns: { nama: true } },
			pembimbing: { columns: { nama: true } },
			anggota: {
				columns: { id: true, muridId: true, catatan: true },
				with: { murid: { columns: { nama: true, nisn: true } } }
			}
		},
		where: and(eq(tablePklKelompok.id, kelompokId), eq(tablePklKelompok.sekolahId, sekolahId))
	});
	if (!kelompok) redirect(303, '/prakerin');

	const memberIds = kelompok.anggota.map((a) => a.muridId);

	const [tujuan, nilaiRows] = await Promise.all([
		db.query.tablePklTujuan.findMany({
			columns: { id: true, urutan: true, deskripsi: true },
			where: eq(tablePklTujuan.sekolahId, sekolahId),
			orderBy: asc(tablePklTujuan.urutan)
		}),
		memberIds.length
			? db
					.select({
						muridId: tablePklNilai.muridId,
						tujuanId: tablePklNilai.tujuanId,
						nilais: tablePklNilai.nilais,
						predikat: tablePklNilai.predikat,
						catatan: tablePklNilai.catatan
					})
					.from(tablePklNilai)
					.where(inArray(tablePklNilai.muridId, memberIds))
			: Promise.resolve([])
	]);

	const nilaiMap: Record<
		number,
		Record<number, { nilais: string; predikat: string | null; catatan: string | null }>
	> = {};
	for (const row of nilaiRows) {
		(nilaiMap[row.muridId] ??= {})[row.tujuanId] = {
			nilais: row.nilais,
			predikat: row.predikat,
			catatan: row.catatan
		};
	}

	return {
		meta,
		authorized,
		kelompok,
		anggota: kelompok.anggota,
		tujuan,
		nilaiMap
	};
}

function requireAccess(locals: App.Locals) {
	const sekolahId = locals.sekolah?.id ?? null;
	if (!sekolahId) {
		return { sekolahId: null } as const;
	}
	if (!isAuthorizedUser(['input_nilai_pkl'], locals.user)) {
		return { sekolahId: null } as const;
	}
	return { sekolahId } as const;
}

export const actions = {
	simpanNilai: async ({ request, locals }) => {
		const { sekolahId } = requireAccess(locals);
		if (!sekolahId) return fail(403, { fail: 'Anda tidak memiliki izin.' });

		const formData = await request.formData();
		const kelompokId = intParam(formData.get('kelompokId'));
		if (!kelompokId) return fail(400, { fail: 'ID kelompok tidak valid.' });

		const kelompok = await db.query.tablePklKelompok.findFirst({
			columns: { id: true },
			where: and(eq(tablePklKelompok.id, kelompokId), eq(tablePklKelompok.sekolahId, sekolahId))
		});
		if (!kelompok) return fail(404, { fail: 'Kelompok tidak ditemukan.' });

		const anggota = await db
			.select({ muridId: tablePklMurid.muridId })
			.from(tablePklMurid)
			.where(and(eq(tablePklMurid.sekolahId, sekolahId), eq(tablePklMurid.kelompokId, kelompokId)));
		if (!anggota.length) return fail(400, { fail: 'Kelompok belum memiliki anggota.' });
		const memberIds = new Set(anggota.map((a) => a.muridId));

		const tujuanRows = await db
			.select({ id: tablePklTujuan.id })
			.from(tablePklTujuan)
			.where(eq(tablePklTujuan.sekolahId, sekolahId));
		const tujuanIds = new Set(tujuanRows.map((t) => t.id));

		// Collect filled `nilai_<muridId>_<tujuanId>` inputs (0-100). Empty or
		// invalid cells are skipped silently.
		type NilaiUpsert = {
			muridId: number;
			tujuanId: number;
			nilais: string;
			predikat: string;
		};
		const nilaiRows: NilaiUpsert[] = [];
		for (const [key, value] of formData.entries()) {
			const match = /^nilai_(\d+)_(\d+)$/.exec(key);
			if (!match) continue;
			const muridId = Number(match[1]);
			const tujuanId = Number(match[2]);
			if (!memberIds.has(muridId) || !tujuanIds.has(tujuanId)) continue;
			if (typeof value !== 'string') continue;
			const trimmed = value.trim();
			if (!trimmed) continue;
			const n = Number(trimmed.replace(',', '.'));
			if (!Number.isFinite(n) || n < 0 || n > 100) continue;
			nilaiRows.push({
				muridId,
				tujuanId,
				nilais: String(n),
				predikat: predikatOf(n)
			});
		}

		// Optional `catatan_<muridId>` inputs update the member rows.
		const catatanRows: { muridId: number; catatan: string | null }[] = [];
		for (const [key, value] of formData.entries()) {
			const match = /^catatan_(\d+)$/.exec(key);
			if (!match) continue;
			const muridId = Number(match[1]);
			if (!memberIds.has(muridId)) continue;
			if (typeof value !== 'string') continue;
			const trimmed = value.trim();
			catatanRows.push({ muridId, catatan: trimmed ? trimmed : null });
		}

		if (!nilaiRows.length && !catatanRows.length) {
			return fail(400, { fail: 'Tidak ada perubahan.' });
		}

		try {
			for (const row of nilaiRows) {
				await db
					.insert(tablePklNilai)
					.values({
						sekolahId,
						muridId: row.muridId,
						tujuanId: row.tujuanId,
						nilais: row.nilais,
						predikat: row.predikat
					})
					// Unique (muridId, tujuanId) — keep the existing row catatan intact.
					.onConflictDoUpdate({
						target: [tablePklNilai.muridId, tablePklNilai.tujuanId],
						set: { nilais: row.nilais, predikat: row.predikat }
					});
			}

			for (const row of catatanRows) {
				await db
					.update(tablePklMurid)
					.set({ catatan: row.catatan })
					.where(
						and(
							eq(tablePklMurid.sekolahId, sekolahId),
							eq(tablePklMurid.kelompokId, kelompokId),
							eq(tablePklMurid.muridId, row.muridId)
						)
					);
			}
		} catch (error) {
			if (isTableMissingError(error)) {
				return fail(500, { fail: 'Tabel PKL belum tersedia. Jalankan pnpm db:push.' });
			}
			throw error;
		}
		return { message: `Nilai PKL tersimpan (${nilaiRows.length} baris).` };
	}
};
