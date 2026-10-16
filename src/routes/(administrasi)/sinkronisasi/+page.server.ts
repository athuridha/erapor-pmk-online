import db from '$lib/server/db';
import {
	tableAsesmenFormatif,
	tableAsesmenSumatif,
	tableCloudPackages,
	tableCloudSyncLogs,
	tableCloudSyncSettings,
	tableMataPelajaran,
	tableKelas
} from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { authority } from '../../pengguna/utils.server';
import { getD1Config } from '$lib/server/cloudflare-d1';

export async function load({ locals }) {
	authority('administrasi_sinkronisasi');

	const sekolah = locals.sekolah;
	const user = locals.user;

	const sekolahId = sekolah?.id ?? 1;

	const [syncSettings, syncLogs, packages, formatifCount, sumatifCount, kelasCount, mapelCount] =
		await Promise.all([
			db.query.tableCloudSyncSettings.findFirst({
				where: eq(tableCloudSyncSettings.sekolahId, sekolahId)
			}),
			db.query.tableCloudSyncLogs.findMany({
				where: eq(tableCloudSyncLogs.sekolahId, sekolahId),
				orderBy: [desc(tableCloudSyncLogs.id)],
				limit: 10
			}),
			db.query.tableCloudPackages.findMany({
				where: eq(tableCloudPackages.sekolahId, sekolahId),
				orderBy: [desc(tableCloudPackages.createdAt)],
				limit: 20
			}),
			db.select({ count: sql<number>`count(*)` }).from(tableAsesmenFormatif),
			db.select({ count: sql<number>`count(*)` }).from(tableAsesmenSumatif),
			db.select({ count: sql<number>`count(*)` }).from(tableKelas),
			db.select({ count: sql<number>`count(*)` }).from(tableMataPelajaran)
		]);

	const totalGrades = (formatifCount[0]?.count ?? 0) + (sumatifCount[0]?.count ?? 0);
	const d1Config = await getD1Config(sekolahId);

	return {
		meta: { title: 'Sinkronisasi Database Pusat' },
		sekolah,
		user,
		totalGrades,
		totalClasses: kelasCount[0]?.count ?? 0,
		totalSubjects: mapelCount[0]?.count ?? 0,
		syncSettings: {
			databaseId: syncSettings?.databaseId || d1Config.databaseId,
			accountId: syncSettings?.accountId || d1Config.accountId,
			hasToken: Boolean(d1Config.apiToken),
			tokenSource: d1Config.tokenSource,
			wranglerTokenExpired: d1Config.wranglerTokenExpired,
			lastPushedAt: syncSettings?.lastPushedAt ?? null,
			lastPulledAt: syncSettings?.lastPulledAt ?? null,
			lastChecksum: syncSettings?.lastChecksum ?? null
		},
		syncLogs,
		packages: packages.map((p) => {
			let summaryObj: Record<string, unknown> = {};
			try {
				const parsed = JSON.parse(p.payloadJson);
				summaryObj = (parsed?.summary as Record<string, unknown>) || {};
			} catch {}
			return {
				id: p.id,
				packageType: p.packageType,
				teacherName: p.teacherName || 'Guru',
				teacherUsername: p.teacherUsername || '-',
				status: p.status,
				notes: p.notes,
				createdAt: p.createdAt,
				approvedAt: p.approvedAt,
				summary: summaryObj
			};
		})
	};
}
