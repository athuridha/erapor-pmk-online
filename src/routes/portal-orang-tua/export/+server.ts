import { eq, inArray } from 'drizzle-orm';
import db from '$lib/server/db';
import { tableMurid, tablePortalOrangtua, tablePortalOrangtuaMurid } from '$lib/server/db/schema';
import { defaultPortalPassword } from '$lib/server/portal-auth';
import { authority } from '../../pengguna/utils.server';
import type { RequestHandler } from './$types';

function csvCell(value: string | number | null | undefined): string {
	const text = value == null ? '' : String(value);
	return `"${text.replaceAll('"', '""')}"`;
}

export const GET: RequestHandler = async ({ locals }) => {
	authority('portal_orang_tua');
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) return new Response('Sekolah aktif belum dipilih.', { status: 400 });

	const accounts = await db.query.tablePortalOrangtua.findMany({
		where: eq(tablePortalOrangtua.sekolahId, sekolahId),
		orderBy: (table, { asc }) => [asc(table.nama)]
	});
	const accountIds = accounts.map((account) => account.id);
	const links = accountIds.length
		? await db
				.select({
					orangtuaId: tablePortalOrangtuaMurid.orangtuaId,
					nama: tableMurid.nama,
					nis: tableMurid.nis
				})
				.from(tablePortalOrangtuaMurid)
				.innerJoin(tableMurid, eq(tablePortalOrangtuaMurid.muridId, tableMurid.id))
				.where(inArray(tablePortalOrangtuaMurid.orangtuaId, accountIds))
		: [];

	const children = new Map<number, string[]>();
	for (const link of links) {
		const list = children.get(link.orangtuaId) ?? [];
		list.push(`${link.nama} (${link.nis})`);
		children.set(link.orangtuaId, list);
	}

	const lines = [
		['Nama', 'Nomor HP', 'Anak', 'Password Awal', 'Wajib Ganti Password', 'Status']
			.map(csvCell)
			.join(','),
		...accounts.map((account) =>
			[
				account.nama,
				account.telepon,
				(children.get(account.id) ?? []).join('; '),
				defaultPortalPassword(account.telepon),
				account.mustChangePassword ? 'Ya' : 'Tidak',
				account.isActive ? 'Aktif' : 'Nonaktif'
			]
				.map(csvCell)
				.join(',')
		)
	];

	return new Response('\uFEFF' + lines.join('\r\n'), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="kredensial-portal-orang-tua.csv"',
			'Cache-Control': 'no-store'
		}
	});
};
