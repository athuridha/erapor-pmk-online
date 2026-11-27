import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { tableKelas, tableMataPelajaran } from '$lib/server/db/schema';
import { canAccessKelas } from '$lib/server/kelas-akses';
import { and, eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user || !locals.sekolah?.id) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
	}
	const kelasIdParam = url.searchParams.get('kelas_id');
	const name = url.searchParams.get('name') ?? '';
	const kelasId = kelasIdParam ? Number(kelasIdParam) : NaN;
	if (!Number.isInteger(kelasId) || kelasId <= 0 || !name) {
		return new Response(JSON.stringify({ mapelId: null }), { status: 200 });
	}

	try {
		const kelas = await db.query.tableKelas.findFirst({
			columns: { id: true },
			where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, locals.sekolah.id))
		});
		if (!kelas || !(await canAccessKelas(locals.user, locals.sekolah.id, kelasId))) {
			return new Response(JSON.stringify({ error: 'Akses kelas ditolak' }), { status: 403 });
		}

		const normalized = name.trim();
		const found = await db.query.tableMataPelajaran.findFirst({
			columns: { id: true },
			where: and(eq(tableMataPelajaran.kelasId, kelasId), eq(tableMataPelajaran.nama, normalized))
		});
		if (!found) return new Response(JSON.stringify({ mapelId: null }), { status: 200 });
		return new Response(JSON.stringify({ mapelId: found.id }), { status: 200 });
	} catch (err) {
		console.error('[api/mapel/resolve-by-name] error', err);
		return new Response(JSON.stringify({ error: 'internal' }), { status: 500 });
	}
};
