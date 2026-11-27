import { eq, isNotNull, or } from 'drizzle-orm';
import db from '$lib/server/db';
import { tableAppMeta, tableAsesmenSumatif } from '$lib/server/db/schema';
import { konfigurasiNilaiDariSekolah, nilaiSumatifEfektif } from '$lib/server/nilai-sumatif';
import { ensureColumns, ensureSchema } from './ensure-helper';

const WEIGHTED_SYNC_META_KEY = 'sumatif.weighted_contribution_v1';
let weightedSyncChecked = false;

async function ensureWeightedSumatifBackfill() {
	if (weightedSyncChecked) return;
	weightedSyncChecked = true;
	try {
		const marker = await db.query.tableAppMeta.findFirst({
			columns: { value: true },
			where: eq(tableAppMeta.key, WEIGHTED_SYNC_META_KEY)
		});
		if (marker?.value === '1') return;

		const [sekolahRows, mapelRows, sumatifRows] = await Promise.all([
			db.query.tableSekolah.findMany({
				columns: {
					id: true,
					sumatifBobotLingkup: true,
					sumatifBobotSts: true,
					sumatifBobotSas: true,
					sumatifBobotRtsLingkup: true,
					sumatifBobotRtsSts: true
				}
			}),
			db.query.tableMataPelajaran.findMany({
				columns: {
					id: true,
					bobotFormatif: true,
					bobotSumatif: true,
					bobotAs: true
				},
				with: { kelas: { columns: { sekolahId: true } } }
			}),
			db.query.tableAsesmenSumatif.findMany({
				columns: {
					id: true,
					mataPelajaranId: true,
					naLingkup: true,
					sts: true,
					sas: true,
					nilaiAkhirAsli: true,
					nilaiRevisi: true,
					nilaiAkhir: true,
					nilaiAkhirRts: true
				},
				where: or(
					isNotNull(tableAsesmenSumatif.naLingkup),
					isNotNull(tableAsesmenSumatif.sts),
					isNotNull(tableAsesmenSumatif.sas)
				)
			})
		]);

		const configBySekolah = new Map(sekolahRows.map((s) => [s.id, konfigurasiNilaiDariSekolah(s)]));
		const mapelById = new Map(mapelRows.map((m) => [m.id, m]));
		const fallbackConfig = konfigurasiNilaiDariSekolah(sekolahRows[0] ?? null);
		const now = new Date().toISOString();

		for (const row of sumatifRows) {
			const mapel = mapelById.get(row.mataPelajaranId);
			const config =
				(mapel?.kelas?.sekolahId ? configBySekolah.get(mapel.kelas.sekolahId) : null) ??
				fallbackConfig;
			const computed = nilaiSumatifEfektif(row, mapel, config);
			if (
				computed.nilaiAkhirAsli !== (row.nilaiAkhirAsli ?? null) ||
				computed.nilaiAkhir !== (row.nilaiAkhir ?? null) ||
				computed.nilaiAkhirRts !== (row.nilaiAkhirRts ?? null)
			) {
				await db
					.update(tableAsesmenSumatif)
					.set({
						nilaiAkhirAsli: computed.nilaiAkhirAsli,
						nilaiAkhir: computed.nilaiAkhir,
						nilaiAkhirRts: computed.nilaiAkhirRts,
						updatedAt: now
					})
					.where(eq(tableAsesmenSumatif.id, row.id));
			}
		}

		await db
			.insert(tableAppMeta)
			.values({ key: WEIGHTED_SYNC_META_KEY, value: '1', updatedAt: now })
			.onConflictDoUpdate({
				target: tableAppMeta.key,
				set: { value: '1', updatedAt: now }
			});
	} catch (err) {
		weightedSyncChecked = false;
		console.warn('[ensure-asesmen-sumatif] weighted backfill skipped', err);
	}
}

export async function ensureAsesmenSumatifSchema() {
	await ensureSchema('asesmen_sumatif', [
		`CREATE TABLE IF NOT EXISTS "asesmen_sumatif" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"murid_id" integer NOT NULL,
			"mata_pelajaran_id" integer NOT NULL,
			"na_lingkup" real,
			"sts_tes" real,
			"sts_non_tes" real,
			"sts" real,
			"sas_tes" real,
			"sas_non_tes" real,
			"sas" real,
			"nilai_akhir_asli" real,
			"nilai_revisi" real,
			"nilai_akhir" real,
			"nilai_akhir_rts" real,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "asesmen_sumatif_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "asesmen_sumatif_mata_pelajaran_id_mata_pelajaran_id_fk" FOREIGN KEY ("mata_pelajaran_id") REFERENCES "mata_pelajaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS "asesmen_sumatif_tujuan" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"murid_id" integer NOT NULL,
			"mata_pelajaran_id" integer NOT NULL,
			"tujuan_pembelajaran_id" integer NOT NULL,
			"nilai" real,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "asesmen_sumatif_tujuan_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "asesmen_sumatif_tujuan_mata_pelajaran_id_mata_pelajaran_id_fk" FOREIGN KEY ("mata_pelajaran_id") REFERENCES "mata_pelajaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "asesmen_sumatif_tujuan_tujuan_pembelajaran_id_tujuan_pembelajaran_id_fk" FOREIGN KEY ("tujuan_pembelajaran_id") REFERENCES "tujuan_pembelajaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "asesmen_sumatif_unique" ON "asesmen_sumatif" ("murid_id", "mata_pelajaran_id")`,
		`CREATE INDEX IF NOT EXISTS "asesmen_sumatif_murid_idx" ON "asesmen_sumatif" ("murid_id")`,
		`CREATE INDEX IF NOT EXISTS "asesmen_sumatif_mapel_idx" ON "asesmen_sumatif" ("mata_pelajaran_id")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "asesmen_sumatif_tujuan_unique" ON "asesmen_sumatif_tujuan" ("murid_id", "tujuan_pembelajaran_id")`,
		`CREATE INDEX IF NOT EXISTS "asesmen_sumatif_tujuan_murid_idx" ON "asesmen_sumatif_tujuan" ("murid_id")`,
		`CREATE INDEX IF NOT EXISTS "asesmen_sumatif_tujuan_mapel_idx" ON "asesmen_sumatif_tujuan" ("mata_pelajaran_id")`,
		`CREATE INDEX IF NOT EXISTS "asesmen_sumatif_tujuan_tp_idx" ON "asesmen_sumatif_tujuan" ("tujuan_pembelajaran_id")`
	]);

	await ensureColumns('asesmen_sumatif_columns_v2', [
		{ table: 'asesmen_sumatif', column: 'sts_tes', definition: 'real' },
		{ table: 'asesmen_sumatif', column: 'sts_non_tes', definition: 'real' },
		{ table: 'asesmen_sumatif', column: 'sts', definition: 'real' },
		{ table: 'asesmen_sumatif', column: 'nilai_akhir_rts', definition: 'real' },
		{ table: 'asesmen_sumatif', column: 'nilai_akhir_asli', definition: 'real' },
		{ table: 'asesmen_sumatif', column: 'nilai_revisi', definition: 'real' },
		{ table: 'mata_pelajaran', column: 'bobot_formatif', definition: 'integer' },
		{ table: 'mata_pelajaran', column: 'bobot_sumatif', definition: 'integer' },
		{ table: 'mata_pelajaran', column: 'bobot_as', definition: 'integer' },
		{
			table: 'tujuan_pembelajaran',
			column: 'jenis_asesmen',
			definition: "text NOT NULL DEFAULT 'formatif'"
		}
	]);
	await ensureWeightedSumatifBackfill();
}
