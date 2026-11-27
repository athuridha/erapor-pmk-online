import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { tableMataPelajaran, tableTujuanPembelajaran } from '$lib/server/db/schema';
import { canAccessKelas } from '$lib/server/kelas-akses';
import { and, eq, isNull, or } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.sekolah?.id) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
	}
	const mapelId = Number(params.mapelId ?? NaN);
	if (!Number.isInteger(mapelId) || mapelId <= 0) {
		return new Response(JSON.stringify({ error: 'mapelId invalid' }), { status: 400 });
	}

	try {
		const mapel = await db.query.tableMataPelajaran.findFirst({
			columns: { id: true, kelasId: true },
			with: { kelas: { columns: { sekolahId: true } } },
			where: eq(tableMataPelajaran.id, mapelId)
		});
		if (!mapel || mapel.kelas?.sekolahId !== locals.sekolah.id) {
			return new Response(JSON.stringify({ error: 'Mata pelajaran tidak ditemukan' }), {
				status: 404
			});
		}
		if (!(await canAccessKelas(locals.user, locals.sekolah.id, mapel.kelasId))) {
			return new Response(JSON.stringify({ error: 'Akses ditolak' }), { status: 403 });
		}

		// fetch tujuan rows for the mapel (Formatif only to match Excel template) and build ordered groups by lingkupMateri
		const rows = await db.query.tableTujuanPembelajaran.findMany({
			columns: { lingkupMateri: true },
			where: and(
				eq(tableTujuanPembelajaran.mataPelajaranId, mapelId),
				or(
					eq(tableTujuanPembelajaran.jenisAsesmen, 'formatif'),
					isNull(tableTujuanPembelajaran.jenisAsesmen)
				)
			)
		});

		const groups: Array<{ name: string; count: number }> = [];
		const indexMap = new Map<string, number>();
		for (const r of rows) {
			const name = (r.lingkupMateri ?? '').toString().trim();
			const key = name || '__default__';
			if (!indexMap.has(key)) {
				indexMap.set(key, groups.length);
				groups.push({ name: name || 'Tanpa Lingkup', count: 0 });
			}
			const idx = indexMap.get(key)!;
			groups[idx].count += 1;
		}

		const filtered = groups.filter((g) => g.name.trim().length > 0);
		return new Response(JSON.stringify({ groups: filtered }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch {
		return new Response(JSON.stringify({ error: 'server error' }), { status: 500 });
	}
};
