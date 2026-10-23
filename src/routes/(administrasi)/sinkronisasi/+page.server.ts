import db from '$lib/server/db';
import {
	tableAppMeta,
	tableAsesmenFormatif,
	tableAsesmenSumatif,
	tableCloudPackages,
	tableCloudSyncLogs,
	tableCloudSyncSettings,
	tableMataPelajaran,
	tableKelas
} from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { authority } from '../../pengguna/utils.server';
import { getD1Config } from '$lib/server/cloudflare-d1';
import {
	pullAllDataFromCloud,
	pushAllDataToCloud,
	syncGroupsToTables
} from '$lib/server/cloud-master';

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
			hasToken: Boolean(d1Config.apiToken),
			hasApiUrl: Boolean(d1Config.apiUrl),
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
			} catch {
				/* ignore invalid JSON payload */
			}
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

const MANUAL_PUSH_KEY = 'sync.manual.lastPushAt';

/** Baca pilihan cakupan form (checkbox `scope`). Kosong → error terkontrol. */
function readScopeOptions(form: FormData) {
	const scope = form
		.getAll('scope')
		.map((value) => String(value))
		.filter(Boolean);
	if (scope.length === 0) {
		return { scope, options: null };
	}
	return { scope, options: { tablesFilter: syncGroupsToTables(scope) } };
}

/** Pilih minimal satu jenis data — kalau kosong, tolak dengan pesan jelas. */
function needScopeOptions(form: FormData) {
	const { scope, options } = readScopeOptions(form);
	if (!options) {
		return {
			scope,
			options: null,
			failed: {
				scope,
				error: fail(400, { message: 'Pilih minimal satu jenis data.' }) as unknown
			}
		};
	}
	return { scope, options, failed: null };
}

export const actions = {
	/** Tarik paket terbaru dari pusat sesuai cakupan yang dipilih. */
	tarikPusat: async ({ locals, request }: { locals: App.Locals; request: Request }) => {
		const sekolahId = locals.sekolah?.id ?? 1;
		const userId = locals.user?.id ?? null;
		try {
			const form = await request.formData();
			const picked = needScopeOptions(form);
			if (picked.failed) return picked.failed.error;

			const pull = await pullAllDataFromCloud(sekolahId, userId, picked.options);
			if (!pull.success && !pull.message.includes('belum punya paket')) {
				return fail(502, { message: pull.message });
			}
			if (!pull.success) {
				return { success: true as const, message: pull.message };
			}
			const mergedMaster =
				(pull.lwwSummary?.master?.inserted ?? 0) + (pull.lwwSummary?.master?.updated ?? 0);
			const mergedAkademik =
				(pull.lwwSummary?.akademik?.inserted ?? 0) + (pull.lwwSummary?.akademik?.updated ?? 0);
			return {
				success: true as const,
				message: `Ditarik dari pusat: ${mergedMaster + mergedAkademik} baris baru/diperbarui.`
			};
		} catch (error) {
			return fail(
				500,
				error instanceof Error ? { message: error.message } : { message: 'Gagal menarik data.' }
			);
		}
	},
	/** PUSH: kirim delta lokal ke pusat sesuai cakupan yang dipilih. */
	pushPusat: async ({ locals, request }: { locals: App.Locals; request: Request }) => {
		const sekolahId = locals.sekolah?.id ?? 1;
		const userId = locals.user?.id ?? null;
		try {
			const form = await request.formData();
			const picked = needScopeOptions(form);
			if (picked.failed) return picked.failed.error;

			// Kirim delta lokal sejak push manual terakhir, sesuai cakupan pilihan.
			const [lastRow] = await db
				.select({ value: tableAppMeta.value })
				.from(tableAppMeta)
				.where(eq(tableAppMeta.key, MANUAL_PUSH_KEY));
			const since: string | null = lastRow?.value ?? null;
			const push = await pushAllDataToCloud(sekolahId, userId, since, picked.options);
			if (!push.success && !push.message.includes('Tidak ada perubahan')) {
				return fail(502, { message: push.message });
			}

			const pushedSomething = push.totalDeltaRecords > 0;
			if (pushedSomething) {
				const stamp = new Date().toISOString();
				await db
					.insert(tableAppMeta)
					.values({ key: MANUAL_PUSH_KEY, value: stamp, createdAt: stamp, updatedAt: stamp })
					.onConflictDoUpdate({
						target: tableAppMeta.key,
						set: { value: stamp, updatedAt: stamp }
					});
			}
			return {
				success: true as const,
				message: push.message.includes('Tidak ada perubahan')
					? 'Tidak ada perubahan baru untuk dikirim.'
					: push.message
			};
		} catch (error) {
			return fail(
				500,
				error instanceof Error ? { message: error.message } : { message: 'Gagal mengirim data.' }
			);
		}
	}
};
