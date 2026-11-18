import { error, fail } from '@sveltejs/kit';
import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import db from '$lib/server/db';
import { chunk, queryInChunks, runInChunks } from '$lib/server/db/chunk';
import {
	tableKelas,
	tableMurid,
	tablePortalOrangtua,
	tablePortalOrangtuaMurid,
	tableSemester,
	tableWaliMurid
} from '$lib/server/db/schema';
import { ensurePortalOrangtuaSchema } from '$lib/server/db/ensure-portal-orangtua';
import { defaultPortalPassword, hashPortalPassword, normalizePhone } from '$lib/server/portal-auth';
import { publishPortalToD1 } from '$lib/server/portal-publish';
import { authority } from '../pengguna/utils.server';
import type { Actions, PageServerLoad } from './$types';

interface ParentGroup {
	nama: string;
	links: Array<{ muridId: number; hubungan: 'ayah' | 'ibu' | 'wali' }>;
}

function activeContext(locals: App.Locals) {
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) error(400, 'Sekolah aktif belum dipilih.');
	return sekolahId;
}

export const load: PageServerLoad = async ({ locals }) => {
	authority('portal_orang_tua');
	await ensurePortalOrangtuaSchema();
	const sekolahId = activeContext(locals);

	const semester =
		(await db.query.tableSemester.findFirst({ where: eq(tableSemester.isAktif, true) })) ??
		(await db.query.tableSemester.findFirst({ orderBy: (table, { desc }) => [desc(table.id)] }));

	const [classRows, studentRows, accountRows, contactCount, semesterRows] = await Promise.all([
		semester
			? db.query.tableKelas.findMany({
					where: and(eq(tableKelas.sekolahId, sekolahId), eq(tableKelas.semesterId, semester.id)),
					orderBy: (table, { asc }) => [asc(table.nama)]
				})
			: Promise.resolve([]),
		semester
			? db.query.tableMurid.findMany({
					where: and(eq(tableMurid.sekolahId, sekolahId), eq(tableMurid.semesterId, semester.id)),
					orderBy: (table, { asc }) => [asc(table.nama)]
				})
			: Promise.resolve([]),
		db.query.tablePortalOrangtua.findMany({
			where: eq(tablePortalOrangtua.sekolahId, sekolahId),
			orderBy: (table, { desc }) => [desc(table.id)]
		}),
		db
			.select({ count: sql<number>`count(*)` })
			.from(tableWaliMurid)
			.where(and(isNotNull(tableWaliMurid.kontak), ne(tableWaliMurid.kontak, ''))),
		db.query.tableSemester.findMany()
	]);

	const classMap = new Map(classRows.map((row) => [row.id, row.nama]));
	const accountIds = accountRows.map((row) => row.id);
	const linkRows = accountIds.length
		? await queryInChunks(accountIds, (ids) =>
				db
					.select({
						orangtuaId: tablePortalOrangtuaMurid.orangtuaId,
						muridId: tablePortalOrangtuaMurid.muridId,
						hubungan: tablePortalOrangtuaMurid.hubungan,
						muridNama: tableMurid.nama,
						nis: tableMurid.nis,
						kelasId: tableMurid.kelasId
					})
					.from(tablePortalOrangtuaMurid)
					.innerJoin(tableMurid, eq(tablePortalOrangtuaMurid.muridId, tableMurid.id))
					.where(inArray(tablePortalOrangtuaMurid.orangtuaId, ids))
			)
		: [];

	const childrenByAccount = new Map<
		number,
		Array<{ muridId: number; nama: string; nis: string; kelas: string; hubungan: string }>
	>();
	for (const row of linkRows) {
		const list = childrenByAccount.get(row.orangtuaId) ?? [];
		list.push({
			muridId: row.muridId,
			nama: row.muridNama,
			nis: row.nis,
			kelas: classMap.get(row.kelasId) ?? '',
			hubungan: row.hubungan
		});
		childrenByAccount.set(row.orangtuaId, list);
	}

	const accounts = accountRows.map((row) => ({
		id: row.id,
		nama: row.nama,
		telepon: row.telepon,
		isActive: row.isActive,
		mustChangePassword: row.mustChangePassword,
		lastPublishedAt: row.lastPublishedAt,
		createdAt: row.createdAt,
		children: childrenByAccount.get(row.id) ?? []
	}));

	const students = studentRows.map((row) => ({
		id: row.id,
		nama: row.nama,
		nis: row.nis,
		kelas: classMap.get(row.kelasId) ?? ''
	}));

	const lastPublish = accounts
		.map((account) => account.lastPublishedAt)
		.filter(Boolean)
		.sort()
		.at(-1);

	return {
		accounts,
		students,
		classes: classRows.map((row) => ({ id: row.id, nama: row.nama })),
		semester: semester
			? {
					id: semester.id,
					nama: semester.nama,
					tahunAjaran: semesterRows.find((row) => row.id === semester.tahunAjaranId)?.nama ?? ''
				}
			: null,
		contactCount: contactCount[0]?.count ?? 0,
		lastPublish: lastPublish ?? null,
		portalUrl: process.env.PORTAL_URL?.trim() || 'https://erapor-portal.pages.dev'
	};
};

export const actions: Actions = {
	generate: async ({ locals }) => {
		authority('portal_orang_tua');
		const sekolahId = activeContext(locals);

		try {
			await ensurePortalOrangtuaSchema();

			const semester =
				(await db.query.tableSemester.findFirst({ where: eq(tableSemester.isAktif, true) })) ??
				(await db.query.tableSemester.findFirst({
					orderBy: (table, { desc }) => [desc(table.id)]
				}));
			if (!semester) return fail(400, { error: 'Semester aktif belum diatur.' });

			const students = await db.query.tableMurid.findMany({
				where: and(eq(tableMurid.sekolahId, sekolahId), eq(tableMurid.semesterId, semester.id)),
				columns: { id: true, nama: true, ibuId: true, ayahId: true, waliId: true }
			});
			const waliIds = [
				...new Set(
					students
						.flatMap((student) => [student.ibuId, student.ayahId, student.waliId])
						.filter((id): id is number => id != null)
				)
			];
			// Pecah query IN per 90 parameter agar tidak melewati batas 100 parameter D1.
			const waliRows = waliIds.length
				? await queryInChunks(waliIds, (ids) =>
						db.query.tableWaliMurid.findMany({ where: inArray(tableWaliMurid.id, ids) })
					)
				: [];
			const waliMap = new Map(waliRows.map((row) => [row.id, row]));

			const groups = new Map<string, ParentGroup>();
			for (const student of students) {
				const relations: Array<['ayah' | 'ibu' | 'wali', number | null]> = [
					['ibu', student.ibuId],
					['ayah', student.ayahId],
					['wali', student.waliId]
				];
				for (const [hubungan, waliId] of relations) {
					if (!waliId) continue;
					const wali = waliMap.get(waliId);
					const telepon = normalizePhone(wali?.kontak);
					if (!wali || !telepon) continue;
					const group = groups.get(telepon) ?? { nama: wali.nama, links: [] };
					if (hubungan === 'ibu') group.nama = wali.nama;
					if (!group.links.some((link) => link.muridId === student.id)) {
						group.links.push({ muridId: student.id, hubungan });
					}
					groups.set(telepon, group);
				}
			}

			if (groups.size === 0) {
				return fail(400, {
					error:
						'Tidak ada nomor HP wali murid yang bisa dipakai. Isi kolom kontak orang tua/wali di menu Murid terlebih dahulu.'
				});
			}

			const existing = await db.query.tablePortalOrangtua.findMany({
				where: eq(tablePortalOrangtua.sekolahId, sekolahId)
			});
			const existingByPhone = new Map(existing.map((row) => [row.telepon, row]));
			const existingIds = existing.map((row) => row.id);
			const existingLinks = existingIds.length
				? await queryInChunks(existingIds, (ids) =>
						db
							.select({
								orangtuaId: tablePortalOrangtuaMurid.orangtuaId,
								muridId: tablePortalOrangtuaMurid.muridId
							})
							.from(tablePortalOrangtuaMurid)
							.where(inArray(tablePortalOrangtuaMurid.orangtuaId, ids))
					)
				: [];
			const existingLinkPairs = new Set(
				existingLinks.map((row) => `${row.orangtuaId}:${row.muridId}`)
			);

			const inactiveAccountIds: number[] = [];
			const toCreate: Array<{
				telepon: string;
				group: ParentGroup;
				values: typeof tablePortalOrangtua.$inferInsert;
			}> = [];
			const pendingLinks: Array<{
				orangtuaId: number;
				muridId: number;
				hubungan: 'ayah' | 'ibu' | 'wali';
			}> = [];

			for (const [telepon, group] of groups) {
				const account = existingByPhone.get(telepon);
				if (!account) {
					const initial = defaultPortalPassword(telepon);
					const hashed = hashPortalPassword(initial);
					toCreate.push({
						telepon,
						group,
						values: {
							sekolahId,
							telepon,
							nama: group.nama,
							passwordHash: hashed.hash,
							passwordSalt: hashed.salt,
							mustChangePassword: true,
							isActive: true,
							forcePasswordSync: true
						}
					});
				} else {
					if (!account.isActive) inactiveAccountIds.push(account.id);
					for (const link of group.links) {
						const key = `${account.id}:${link.muridId}`;
						if (!existingLinkPairs.has(key)) {
							existingLinkPairs.add(key);
							pendingLinks.push({
								orangtuaId: account.id,
								muridId: link.muridId,
								hubungan: link.hubungan
							});
						}
					}
				}
			}

			if (inactiveAccountIds.length > 0) {
				const now = new Date().toISOString();
				await runInChunks(inactiveAccountIds, (ids) =>
					db
						.update(tablePortalOrangtua)
						.set({ isActive: true, updatedAt: now })
						.where(inArray(tablePortalOrangtua.id, ids))
				);
			}

			let created = 0;
			for (const batch of chunk(toCreate, 8)) {
				const inserted = await db
					.insert(tablePortalOrangtua)
					.values(batch.map((entry) => entry.values))
					.returning({ id: tablePortalOrangtua.id, telepon: tablePortalOrangtua.telepon });
				const idByPhone = new Map(inserted.map((row) => [row.telepon, row.id]));
				created += inserted.length;
				for (const entry of batch) {
					const id = idByPhone.get(entry.telepon);
					if (!id) continue;
					for (const link of entry.group.links) {
						const key = `${id}:${link.muridId}`;
						if (!existingLinkPairs.has(key)) {
							existingLinkPairs.add(key);
							pendingLinks.push({
								orangtuaId: id,
								muridId: link.muridId,
								hubungan: link.hubungan
							});
						}
					}
				}
			}

			let linked = 0;
			for (const batch of chunk(pendingLinks, 25)) {
				await db.insert(tablePortalOrangtuaMurid).values(batch).onConflictDoNothing();
				linked += batch.length;
			}

			return {
				generated: { accounts: created, links: linked, phones: groups.size }
			};
		} catch (err) {
			console.error('[portal] gagal membuat akun dari data wali', err);
			return fail(500, {
				error: err instanceof Error ? err.message : 'Gagal membuat akun portal dari data wali.'
			});
		}
	},

	create: async ({ request, locals }) => {
		authority('portal_orang_tua');
		await ensurePortalOrangtuaSchema();
		const sekolahId = activeContext(locals);
		const form = await request.formData();
		const telepon = normalizePhone(form.get('telepon')?.toString() ?? '');
		const nama = form.get('nama')?.toString().trim() ?? '';
		const muridIds = [
			...new Set(
				form
					.getAll('muridIds')
					.map((value) => Number(value))
					.filter((value) => Number.isInteger(value) && value > 0)
			)
		];

		if (!telepon) return fail(400, { error: 'Nomor HP tidak valid.' });
		if (nama.length < 2) return fail(400, { error: 'Nama orang tua/wali minimal 2 karakter.' });
		if (muridIds.length === 0) return fail(400, { error: 'Pilih minimal satu anak.' });

		const existing = await db.query.tablePortalOrangtua.findFirst({
			where: and(
				eq(tablePortalOrangtua.sekolahId, sekolahId),
				eq(tablePortalOrangtua.telepon, telepon)
			)
		});
		if (existing) {
			return fail(400, { error: 'Nomor HP ini sudah punya akun. Gunakan tombol reset password.' });
		}

		const students = await queryInChunks(muridIds, (ids) =>
			db.query.tableMurid.findMany({
				where: and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, ids)),
				columns: { id: true }
			})
		);
		if (students.length !== muridIds.length) {
			return fail(400, { error: 'Ada murid yang tidak valid untuk sekolah ini.' });
		}

		const initial = defaultPortalPassword(telepon);
		const hashed = hashPortalPassword(initial);
		const inserted = await db
			.insert(tablePortalOrangtua)
			.values({
				sekolahId,
				telepon,
				nama,
				passwordHash: hashed.hash,
				passwordSalt: hashed.salt,
				mustChangePassword: true,
				isActive: true,
				forcePasswordSync: true
			})
			.returning({ id: tablePortalOrangtua.id });
		const id = inserted[0]?.id;
		if (!id) return fail(500, { error: 'Akun gagal dibuat.' });

		for (const muridId of muridIds) {
			await db
				.insert(tablePortalOrangtuaMurid)
				.values({ orangtuaId: id, muridId, hubungan: 'wali' })
				.onConflictDoNothing();
		}

		return { created: { nama, telepon, password: initial, children: muridIds.length } };
	},

	reset: async ({ request, locals }) => {
		authority('portal_orang_tua');
		const sekolahId = activeContext(locals);
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || id <= 0) return fail(400, { error: 'Akun tidak valid.' });
		const account = await db.query.tablePortalOrangtua.findFirst({
			where: and(eq(tablePortalOrangtua.id, id), eq(tablePortalOrangtua.sekolahId, sekolahId))
		});
		if (!account) return fail(404, { error: 'Akun tidak ditemukan.' });

		const initial = defaultPortalPassword(account.telepon);
		const hashed = hashPortalPassword(initial);
		await db
			.update(tablePortalOrangtua)
			.set({
				passwordHash: hashed.hash,
				passwordSalt: hashed.salt,
				mustChangePassword: true,
				forcePasswordSync: true,
				updatedAt: new Date().toISOString()
			})
			.where(eq(tablePortalOrangtua.id, id));

		return { reset: { nama: account.nama, telepon: account.telepon, password: initial } };
	},

	toggle: async ({ request, locals }) => {
		authority('portal_orang_tua');
		const sekolahId = activeContext(locals);
		const id = Number((await request.formData()).get('id'));
		const account = await db.query.tablePortalOrangtua.findFirst({
			where: and(eq(tablePortalOrangtua.id, id), eq(tablePortalOrangtua.sekolahId, sekolahId))
		});
		if (!account) return fail(404, { error: 'Akun tidak ditemukan.' });
		await db
			.update(tablePortalOrangtua)
			.set({ isActive: !account.isActive, updatedAt: new Date().toISOString() })
			.where(eq(tablePortalOrangtua.id, id));
		return { toggled: { nama: account.nama, active: !account.isActive } };
	},

	delete: async ({ request, locals }) => {
		authority('portal_orang_tua');
		const sekolahId = activeContext(locals);
		const id = Number((await request.formData()).get('id'));
		const account = await db.query.tablePortalOrangtua.findFirst({
			where: and(eq(tablePortalOrangtua.id, id), eq(tablePortalOrangtua.sekolahId, sekolahId))
		});
		if (!account) return fail(404, { error: 'Akun tidak ditemukan.' });
		await db.delete(tablePortalOrangtuaMurid).where(eq(tablePortalOrangtuaMurid.orangtuaId, id));
		await db.delete(tablePortalOrangtua).where(eq(tablePortalOrangtua.id, id));
		return { deleted: { nama: account.nama } };
	},

	publish: async ({ locals }) => {
		authority('portal_orang_tua');
		const sekolahId = activeContext(locals);
		try {
			const result = await publishPortalToD1(sekolahId);
			return { publish: result };
		} catch (err) {
			console.error('[portal] publikasi gagal', err);
			return fail(500, {
				error: err instanceof Error ? err.message : 'Publikasi ke portal gagal.'
			});
		}
	}
};
