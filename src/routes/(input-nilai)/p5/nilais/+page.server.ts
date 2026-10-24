import db from '$lib/server/db';
import { tableP5Anggota, tableP5Nilai, tableP5Projek } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { isAuthorizedUser } from '../../../pengguna/permissions';
import type { Actions, PageServerLoad } from './$types';

const REQUIRED_PERMISSION: UserPermission = 'input_nilai_p5';

const TABLE_MISSING_MESSAGE =
	'Tabel P5 belum tersedia. Jalankan "pnpm db:push" untuk menerapkan migrasi terbaru.';

/** Dimensi Profil Pelajar Pancasila (urutan resmi). */
const P5_DIMENSI = [
	'Berkebinekaan Global',
	'Bergotong Royong',
	'Bermasyarakat',
	'Bernalar Kritis',
	'Kreatif'
];

const P5_RATING_LABEL = {
	BB: 'Belum Berkembang',
	MB: 'Mulai Berkembang',
	BSH: 'Berkembang Sesuai Harapan',
	BSB: 'Berkembang Sangat Baik'
} as const;

type P5Rating = keyof typeof P5_RATING_LABEL;

/** Badge class per rating ketika sel sudah terisi. */
const RATING_BADGE_CLASS: Record<P5Rating, string> = {
	BB: 'badge-neutral text-neutral',
	MB: 'badge-warning text-warning',
	BSH: 'badge-info text-info',
	BSB: 'badge-success text-success'
};

function isTableMissingError(error: unknown) {
	return (
		error instanceof Error &&
		error.message.includes('no such table') &&
		error.message.includes('p5')
	);
}

function isP5Rating(value: string): value is P5Rating {
	return value in P5_RATING_LABEL;
}

const ratingOptions = (Object.keys(P5_RATING_LABEL) as P5Rating[]).map((code) => ({
	code,
	label: P5_RATING_LABEL[code],
	badge: RATING_BADGE_CLASS[code]
}));

/** Murid anggota projek, diurutkan nama — urutan ini TIDAK boleh berubah antara
 *  load dan action karena nama field formulir memakai indeks baris. */
async function queryAnggotaRows(projekId: number) {
	const raw = await db.query.tableP5Anggota.findMany({
		columns: { muridId: true },
		where: eq(tableP5Anggota.projekId, projekId),
		with: { murid: { columns: { id: true, nama: true, nisn: true } } }
	});
	return raw.map((row) => row.murid).sort((a, b) => a.nama.localeCompare(b.nama));
}

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
		throw redirect(303, `/forbidden?required=${REQUIRED_PERMISSION}`);
	}

	const projekRaw = url.searchParams.get('projek');
	const projekId = Number(projekRaw);
	if (!projekRaw || !Number.isInteger(projekId) || projekId <= 0) {
		throw redirect(303, '/p5');
	}

	const meta: PageMeta = { title: 'Nilai P5' };
	const sekolahId = locals.sekolah?.id ?? null;

	let projek: {
		id: number;
		tema: string;
		judul: string;
		catatan: string | null;
		kelas: { id: number; nama: string; fase: string | null } | null;
		pembina: { id: number; nama: string } | null;
	} | null = null;
	let anggotaRows: Awaited<ReturnType<typeof queryAnggotaRows>> = [];
	let tableReady = true;

	if (sekolahId) {
		try {
			const projekRow = await db.query.tableP5Projek.findFirst({
				where: and(eq(tableP5Projek.id, projekId), eq(tableP5Projek.sekolahId, sekolahId)),
				with: {
					kelas: { columns: { id: true, nama: true, fase: true } },
					pembina: { columns: { id: true, nama: true } }
				}
			});
			if (projekRow) {
				projek = {
					id: projekRow.id,
					tema: projekRow.tema,
					judul: projekRow.judul,
					catatan: projekRow.catatan,
					kelas: projekRow.kelas,
					pembina: projekRow.pembina
				};
				anggotaRows = await queryAnggotaRows(projekId);

				// Current rating per murid per dimensi — picks the newest row when
				// the unique constraint was relaxed in legacy data.
				const nilais = await db.query.tableP5Nilai.findMany({
					columns: { muridId: true, dimensi: true, rating: true, id: true },
					where: eq(tableP5Nilai.projekId, projekId),
					orderBy: desc(tableP5Nilai.id)
				});
				const nilaiByMurid = new Map<number, Record<string, string>>();
				for (const nilai of nilais) {
					let byDimensi = nilaiByMurid.get(nilai.muridId);
					if (!byDimensi) {
						byDimensi = {};
						nilaiByMurid.set(nilai.muridId, byDimensi);
					}
					if (!(nilai.dimensi in byDimensi)) {
						byDimensi[nilai.dimensi] = nilai.rating;
					}
				}
				anggotaRows = anggotaRows.map((murid) => ({
					...murid,
					nilai: nilaiByMurid.get(murid.id) ?? {}
				}));
			}
		} catch (error) {
			if (isTableMissingError(error)) {
				tableReady = false;
			} else {
				throw error;
			}
		}
	}

	return {
		meta,
		tableReady,
		projekId,
		projek,
		anggotaRows,
		dims: [...P5_DIMENSI],
		ratingOptions
	};
};

export const actions: Actions = {
	simpanNilai: async ({ request, locals }) => {
		if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
			return fail(403, { fail: 'Anda tidak memiliki izin untuk menyimpan nilai P5.' });
		}

		const formData = await request.formData();
		const sekolahId = locals.sekolah?.id ?? null;
		if (!sekolahId) return fail(400, { fail: 'Sekolah aktif tidak ditemukan' });

		const projekIdRaw = Number(formData.get('projekId'));
		if (!Number.isInteger(projekIdRaw) || projekIdRaw <= 0) {
			return fail(400, { fail: 'ID projek tidak valid' });
		}

		const projekRow = await db.query.tableP5Projek.findFirst({
			columns: { id: true },
			where: and(eq(tableP5Projek.id, projekIdRaw), eq(tableP5Projek.sekolahId, sekolahId))
		});
		if (!projekRow) return fail(404, { fail: 'Projek tidak ditemukan atau sudah dihapus' });

		try {
			const anggotaRows = await queryAnggotaRows(projekIdRaw);
			if (anggotaRows.length === 0) {
				return fail(400, { fail: 'Projek belum memiliki anggota murid' });
			}

			// Existing rows so empty cells can delete only what really exists.
			const existing = await db.query.tableP5Nilai.findMany({
				columns: { id: true, muridId: true, dimensi: true, rating: true },
				where: eq(tableP5Nilai.projekId, projekIdRaw)
			});
			const existingByKey = new Map(existing.map((row) => [`${row.muridId}|${row.dimensi}`, row]));

			let insertCount = 0;
			let deleteCount = 0;

			for (let iRow = 0; iRow < anggotaRows.length; iRow++) {
				const murid = anggotaRows[iRow];
				for (let iDim = 0; iDim < P5_DIMENSI.length; iDim++) {
					const dimensi = P5_DIMENSI[iDim];
					const raw = formData.get(`rating_${iRow}_${iDim}`)?.toString() ?? '';
					const key = `${murid.id}|${dimensi}`;

					if (!raw) {
						// Empty cell: drop stored rating (if any), keep nothing.
						const stored = existingByKey.get(key);
						if (stored) {
							await db.delete(tableP5Nilai).where(eq(tableP5Nilai.id, stored.id));
							deleteCount++;
						}
						continue;
					}

					if (!isP5Rating(raw)) {
						return fail(400, { fail: `Rating tidak valid untuk ${murid.nama}` });
					}

					if (existingByKey.get(key)?.rating === raw) {
						continue;
					}

					await db
						.insert(tableP5Nilai)
						.values({ sekolahId, projekId: projekIdRaw, muridId: murid.id, dimensi, rating: raw })
						.onConflictDoUpdate({
							target: [tableP5Nilai.projekId, tableP5Nilai.muridId, tableP5Nilai.dimensi],
							set: { rating: raw }
						});
					insertCount++;
				}
			}

			if (insertCount === 0 && deleteCount === 0) {
				return { message: 'Tidak ada perubahan penilaian untuk disimpan' };
			}
			return { message: 'Penilaian P5 tersimpan.' };
		} catch (error) {
			if (isTableMissingError(error)) return fail(500, { fail: TABLE_MISSING_MESSAGE });
			throw error;
		}
	}
};
