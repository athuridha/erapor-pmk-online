import db from '$lib/server/db';
import { isWaliKelasAccount, isWaliOfKelas, ownedKelasIdSet } from '$lib/server/kelas-akses';
import {
	P5_TEMA,
	tableP5Anggota,
	tableP5Projek,
	tableKelas,
	tableMurid,
	tablePegawai
} from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { isAuthorizedUser } from '../../pengguna/permissions';
import { chunk, queryInChunks } from '$lib/server/db/chunk';
import type { Actions, PageServerLoad } from './$types';

const REQUIRED_PERMISSION: UserPermission = 'input_nilai_p5';

const TABLE_MISSING_MESSAGE =
	'Tabel P5 belum tersedia. Jalankan "pnpm db:push" untuk menerapkan migrasi terbaru.';

/** Keterangan tarif P5, dipakai untuk keterangan ringkasan di kartu projek. */
const P5_RATING_LABEL = {
	BB: 'Belum Berkembang',
	MB: 'Mulai Berkembang',
	BSH: 'Berkembang Sesuai Harapan',
	BSB: 'Berkembang Sangat Baik'
} as const;

function isTableMissingError(error: unknown) {
	return (
		error instanceof Error &&
		error.message.includes('no such table') &&
		error.message.includes('p5')
	);
}

function parseId(raw: FormDataEntryValue | null): number | null {
	const value = Number(raw);
	return Number.isInteger(value) && value > 0 ? value : null;
}

function uniqueIds(values: FormDataEntryValue[]): number[] {
	const ids = new Set<number>();
	for (const raw of values) {
		const id = Number(raw);
		if (Number.isInteger(id) && id > 0) ids.add(id);
	}
	return [...ids];
}

/**
 * Guard manajemen kelas: admin/kepala sekolah boleh semua kelas, wali kelas
 * (termasuk guru merangkap wali) hanya kelas yang diwalikan. Lainnya ditolak.
 */
async function canManageKelas(
	user: { type?: string; pegawaiId?: number | null } | null | undefined,
	kelasId: number
): Promise<boolean> {
	if (!user) return false;
	if (user.type === 'admin' || user.type === 'kepala_sekolah') return true;
	if (user.type === 'wali_asuh') return false;
	if (await isWaliKelasAccount(user)) return isWaliOfKelas(user, kelasId);
	// Gives teacher without wali role manage nothing.
	return (await ownedKelasIdSet(user)).has(kelasId);
}

export const load: PageServerLoad = async ({ depends, parent, locals }) => {
	depends('app:p5');
	if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
		throw redirect(303, `/forbidden?required=${REQUIRED_PERMISSION}`);
	}

	const { kelasAktif, academicContext } = await parent();
	const meta: PageMeta = { title: 'P5 (Projek Pancasila)' };

	const sekolahId = locals.sekolah?.id ?? null;

	const daftarKelas = sekolahId
		? await db.query.tableKelas.findMany({
				columns: { id: true, nama: true, fase: true },
				where: academicContext?.activeSemesterId
					? and(
							eq(tableKelas.sekolahId, sekolahId),
							eq(tableKelas.semesterId, academicContext.activeSemesterId)
						)
					: eq(tableKelas.sekolahId, sekolahId),
				orderBy: asc(tableKelas.nama)
			})
		: [];

	const kelasAktifId = kelasAktif?.id ?? null;

	// Query helper exists so the empty-array fallback inherits the exact
	// findMany result shape (including with-relations) via inference.
	const queryProjek = (sid: number) =>
		db.query.tableP5Projek.findMany({
			where: kelasAktif
				? and(eq(tableP5Projek.sekolahId, sid), eq(tableP5Projek.kelasId, kelasAktif.id))
				: eq(tableP5Projek.sekolahId, sid),
			with: {
				kelas: { columns: { id: true, nama: true, fase: true } },
				pembina: { columns: { id: true, nama: true } },
				anggota: { columns: { muridId: true } },
				nilais: { columns: { muridId: true, dimensi: true, rating: true } }
			},
			orderBy: desc(tableP5Projek.id)
		});

	let projekRaw: Awaited<ReturnType<typeof queryProjek>> = [];
	let tableReady = true;

	if (sekolahId) {
		try {
			projekRaw = await queryProjek(sekolahId);
		} catch (error) {
			if (isTableMissingError(error)) {
				tableReady = false;
			} else {
				throw error;
			}
		}
	}

	const projek = projekRaw.map((row) => {
		const ratingCount: Record<keyof typeof P5_RATING_LABEL, number> = {
			BB: 0,
			MB: 0,
			BSH: 0,
			BSB: 0
		};
		const muridDinilai = new Set<number>();
		for (const nilai of row.nilais) {
			if (nilai.rating in ratingCount) {
				const key = nilai.rating as keyof typeof ratingCount;
				ratingCount[key] += 1;
			}
			muridDinilai.add(nilai.muridId);
		}
		return {
			id: row.id,
			kelasId: row.kelasId,
			tema: row.tema,
			judul: row.judul,
			catatan: row.catatan,
			kelas: row.kelas,
			pembina: row.pembina,
			anggotaIds: row.anggota.map((anggota) => anggota.muridId),
			anggotaCount: row.anggota.length,
			dinilaiCount: muridDinilai.size,
			dimensiDinilai: [...new Set(row.nilais.map((nilai) => nilai.dimensi))],
			ratingCount
		};
	});

	const pembinaList = sekolahId
		? await db.query.tablePegawai.findMany({
				columns: { id: true, nama: true },
				where: eq(tablePegawai.sekolahId, sekolahId),
				orderBy: asc(tablePegawai.nama)
			})
		: [];

	const muridList =
		daftarKelas.length > 0
			? await db.query.tableMurid.findMany({
					columns: { id: true, nama: true, kelasId: true },
					where: and(
						inArray(
							tableMurid.kelasId,
							daftarKelas.map((kelas) => kelas.id)
						),
						eq(tableMurid.status, 'aktif')
					),
					orderBy: asc(tableMurid.nama)
				})
			: [];

	return {
		meta,
		tableReady,
		kelasAktifId,
		projek,
		daftarKelas,
		pembinaList,
		muridList,
		temaList: [...P5_TEMA],
		ratingLabels: P5_RATING_LABEL
	};
};

export const actions: Actions = {
	tambahProjek: async ({ request, locals }) => {
		const formData = await request.formData();
		const sekolahId = locals.sekolah?.id ?? null;
		if (!sekolahId) return fail(400, { fail: 'Sekolah aktif tidak ditemukan' });

		const kelasId = parseId(formData.get('kelasId'));
		if (!kelasId) return fail(400, { fail: 'Kelas wajib dipilih' });

		const kelasRow = await db.query.tableKelas.findFirst({
			columns: { id: true, tahunAjaranId: true },
			where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
		});
		if (!kelasRow) return fail(404, { fail: 'Kelas tidak ditemukan di sekolah ini' });

		if (!(await canManageKelas(locals.user, kelasId))) {
			return fail(403, { fail: 'Anda tidak memiliki izin untuk menambah projek di kelas ini.' });
		}

		const tema = formData.get('tema')?.toString().trim() ?? '';
		if (!(P5_TEMA as readonly string[]).includes(tema)) {
			return fail(400, { fail: 'Tema wajib dipilih dari daftar tema resmi' });
		}

		const judul = formData.get('judul')?.toString().trim() ?? '';
		if (!judul) return fail(400, { fail: 'Judul projek wajib diisi' });

		let pembinaPegawaiId: number | null = null;
		const pembinaRaw = parseId(formData.get('pembinaPegawaiId'));
		if (pembinaRaw) {
			const pembina = await db.query.tablePegawai.findFirst({
				columns: { id: true },
				where: and(eq(tablePegawai.id, pembinaRaw), eq(tablePegawai.sekolahId, sekolahId))
			});
			if (!pembina) return fail(400, { fail: 'Guru pembina tidak ditemukan' });
			pembinaPegawaiId = pembina.id;
		}

		const catatan = formData.get('catatan')?.toString().trim() ?? '';

		try {
			await db.insert(tableP5Projek).values({
				sekolahId,
				kelasId,
				tema,
				judul,
				pembinaPegawaiId,
				tahunTahunAjaranId: kelasRow.tahunAjaranId,
				catatan: catatan || null
			});
			return { message: 'Projek P5 berhasil ditambahkan' };
		} catch (error) {
			if (isTableMissingError(error)) return fail(500, { fail: TABLE_MISSING_MESSAGE });
			throw error;
		}
	},

	aturAnggota: async ({ request, locals }) => {
		const formData = await request.formData();
		const sekolahId = locals.sekolah?.id ?? null;
		if (!sekolahId) return fail(400, { fail: 'Sekolah aktif tidak ditemukan' });

		const projekId = parseId(formData.get('projekId'));
		if (!projekId) return fail(400, { fail: 'ID projek tidak valid' });

		const projekRow = await db.query.tableP5Projek.findFirst({
			columns: { id: true, kelasId: true },
			where: and(eq(tableP5Projek.id, projekId), eq(tableP5Projek.sekolahId, sekolahId))
		});
		if (!projekRow) return fail(404, { fail: 'Projek tidak ditemukan' });

		if (!(await canManageKelas(locals.user, projekRow.kelasId))) {
			return fail(403, {
				fail: 'Anda tidak memiliki izin untuk mengatur anggota di kelas ini.'
			});
		}

		// Membership diff: add[] murid yang masuk, remove[] murid yang keluar.
		const addIds = uniqueIds(formData.getAll('add'));
		const removeIds = uniqueIds(formData.getAll('remove'));

		if (!addIds.length && !removeIds.length) {
			return { message: 'Tidak ada perubahan anggota projek' };
		}

		try {
			if (removeIds.length) {
				await db
					.delete(tableP5Anggota)
					.where(
						and(eq(tableP5Anggota.projekId, projekId), inArray(tableP5Anggota.muridId, removeIds))
					);
			}
			if (addIds.length) {
				// Hanya murid aktif dari kelas projek yang boleh jadi anggota.
				const muridRows = await queryInChunks(addIds, (ids) =>
					db.query.tableMurid.findMany({
						columns: { id: true },
						where: and(
							eq(tableMurid.kelasId, projekRow.kelasId),
							inArray(tableMurid.id, ids),
							eq(tableMurid.status, 'aktif')
						)
					})
				);
				for (const muridChunk of chunk(muridRows, 30)) {
					await db
						.insert(tableP5Anggota)
						.values(muridChunk.map((murid) => ({ sekolahId, projekId, muridId: murid.id })))
						.onConflictDoNothing();
				}
			}
			return { message: 'Anggota projek diperbarui' };
		} catch (error) {
			if (isTableMissingError(error)) return fail(500, { fail: TABLE_MISSING_MESSAGE });
			throw error;
		}
	},

	hapusProjek: async ({ request, locals }) => {
		const formData = await request.formData();
		const sekolahId = locals.sekolah?.id ?? null;
		if (!sekolahId) return fail(400, { fail: 'Sekolah aktif tidak ditemukan' });

		const id = parseId(formData.get('id'));
		if (!id) return fail(400, { fail: 'ID projek tidak valid' });

		const projekRow = await db.query.tableP5Projek.findFirst({
			columns: { id: true, kelasId: true },
			where: and(eq(tableP5Projek.id, id), eq(tableP5Projek.sekolahId, sekolahId))
		});
		if (!projekRow) return fail(404, { fail: 'Projek tidak ditemukan atau sudah dihapus' });

		if (!(await canManageKelas(locals.user, projekRow.kelasId))) {
			return fail(403, { fail: 'Anda tidak memiliki izin untuk menghapus projek ini.' });
		}

		try {
			// Anggota dan nilai terhapus otomatis via FK onDelete: cascade.
			await db.delete(tableP5Projek).where(eq(tableP5Projek.id, id));
			return { message: 'Projek P5 berhasil dihapus' };
		} catch (error) {
			if (isTableMissingError(error)) return fail(500, { fail: TABLE_MISSING_MESSAGE });
			throw error;
		}
	}
};
