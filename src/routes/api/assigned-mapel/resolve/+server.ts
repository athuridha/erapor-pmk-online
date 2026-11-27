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
	const kelasId = kelasIdParam ? Number(kelasIdParam) : NaN;
	if (!Number.isInteger(kelasId) || kelasId <= 0) {
		return new Response(JSON.stringify({ error: 'kelas_id query parameter is required' }), {
			status: 400
		});
	}

	const user = locals.user;
	if (user.type !== 'user' || !user.mataPelajaranId) {
		return new Response(JSON.stringify({ assignedLocalMapelId: null }), { status: 200 });
	}

	try {
		const kelas = await db.query.tableKelas.findFirst({
			columns: { id: true },
			where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, locals.sekolah.id))
		});
		if (!kelas || !(await canAccessKelas(user, locals.sekolah.id, kelasId))) {
			return new Response(JSON.stringify({ error: 'Akses kelas ditolak' }), { status: 403 });
		}

		const assigned = await db.query.tableMataPelajaran.findFirst({
			columns: { nama: true },
			where: eq(tableMataPelajaran.id, Number(user.mataPelajaranId))
		});

		if (!assigned || !assigned.nama) {
			return new Response(JSON.stringify({ assignedLocalMapelId: null }), { status: 200 });
		}

		const local = await db.query.tableMataPelajaran.findFirst({
			columns: { id: true },
			where: and(
				eq(tableMataPelajaran.kelasId, kelasId),
				eq(tableMataPelajaran.nama, assigned.nama)
			)
		});

		if (!local) {
			return new Response(JSON.stringify({ assignedLocalMapelId: null }), { status: 200 });
		}

		return new Response(JSON.stringify({ assignedLocalMapelId: local.id }), { status: 200 });
	} catch (err) {
		console.error('[api/assigned-mapel] error', err);
		return new Response(JSON.stringify({ error: 'internal' }), { status: 500 });
	}
};
