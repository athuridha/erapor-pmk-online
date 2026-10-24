import db from '$lib/server/db';
import {
	tableKelas,
	tableMurid,
	tablePoinPelanggaran,
	tablePoinSiswa
} from '$lib/server/db/schema';
import { redirect } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { isAuthorizedUser } from '../../../pengguna/permissions';

const REQUIRED_PERMISSION = 'administrasi_poin_siswa';

type MuridRekap = {
	nama: string;
	nisn: string | null;
	totalPoin: number;
	count: number;
};

type KelasRekap = {
	namaKelas: string;
	murids: MuridRekap[];
};

async function ambilRekapSemuaKelas(sekolahId: number): Promise<KelasRekap[]> {
	const rows = await db
		.select({
			muridId: tableMurid.id,
			nama: tableMurid.nama,
			nisn: tableMurid.nisn,
			kelasNama: tableKelas.nama,
			totalPoin: sql<number>`coalesce(sum(${tablePoinPelanggaran.poin}), 0)`,
			count: sql<number>`count(${tablePoinSiswa.id})`
		})
		.from(tableMurid)
		.innerJoin(tableKelas, eq(tableMurid.kelasId, tableKelas.id))
		.leftJoin(
			tablePoinSiswa,
			and(eq(tablePoinSiswa.muridId, tableMurid.id), eq(tablePoinSiswa.sekolahId, sekolahId))
		)
		.leftJoin(tablePoinPelanggaran, eq(tablePoinSiswa.pelanggaranId, tablePoinPelanggaran.id))
		.where(and(eq(tableMurid.sekolahId, sekolahId), eq(tableKelas.sekolahId, sekolahId)))
		.groupBy(tableMurid.id, tableMurid.nama, tableMurid.nisn, tableKelas.nama)
		.orderBy(asc(tableKelas.nama), asc(tableMurid.nama));

	const byKelas = new Map<string, MuridRekap[]>();
	for (const row of rows) {
		const mapped: MuridRekap = {
			nama: row.nama,
			nisn: row.nisn,
			totalPoin: row.totalPoin ?? 0,
			count: row.count ?? 0
		};
		const list = byKelas.get(row.kelasNama);
		if (list) list.push(mapped);
		else byKelas.set(row.kelasNama, [mapped]);
	}

	// Sort students inside each class by total points descending.
	return [...byKelas.entries()]
		.map(([namaKelas, murids]) => ({
			namaKelas,
			murids: murids.sort((a, b) => b.totalPoin - a.totalPoin || a.nama.localeCompare(b.nama))
		}))
		.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas));
}

export async function load({ locals }) {
	if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
		redirect(303, `/forbidden?required=${REQUIRED_PERMISSION}`);
	}

	const sekolahId = locals.sekolah?.id ?? null;

	if (!sekolahId) {
		return {
			meta: { title: 'Rekap Poin Siswa' } satisfies PageMeta,
			kelas: [] as KelasRekap[]
		};
	}

	return {
		meta: { title: 'Rekap Poin Siswa' } satisfies PageMeta,
		kelas: await ambilRekapSemuaKelas(sekolahId)
	};
}
