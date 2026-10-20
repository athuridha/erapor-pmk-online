import db from '$lib/server/db';
import {
	tablePresensiSettings,
	tableBellSettings,
	tableKegiatanCustom,
	tableSemester
} from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { BellSettingsData, CustomKegiatanData } from '$lib/server/absen-utils';
import type { AcademicContext } from '$lib/server/db/academic';

export type PresensiCheckResult = {
	presensiReady: boolean;
	presensiWarningMessage: string;
	presensiSettings: typeof tablePresensiSettings.$inferSelect | null;
	bellSettings: BellSettingsData | null;
	kegiatanCustom: CustomKegiatanData[];
};

export async function checkPresensiReadiness(
	sekolahId: number | null,
	kelasId: number | null,
	tahunAjaranId: number | null,
	academicContext: AcademicContext | null
): Promise<PresensiCheckResult> {
	const defaults = {
		presensiReady: false,
		presensiWarningMessage: '',
		presensiSettings: null as typeof tablePresensiSettings.$inferSelect | null,
		bellSettings: null as BellSettingsData | null,
		kegiatanCustom: [] as CustomKegiatanData[]
	};

	if (sekolahId && kelasId && tahunAjaranId) {
		let presensiSettings =
			(await db.query.tablePresensiSettings.findFirst({
				where: and(
					eq(tablePresensiSettings.sekolahId, sekolahId),
					eq(tablePresensiSettings.tahunAjaranId, tahunAjaranId)
				)
			})) ?? null;

		// Instalasi baru — atau instalasi yang datanya baru ditarik dari Database
		// Pusat — belum punya baris pengaturan presensi. Tanpa baris ini halaman
		// presensi menampilkan daftar kosong padahal muridnya ada. Buat default
		// supaya daftar siswa langsung tampil dan bisa diatur dari halaman /
		// pengaturan.
		if (!presensiSettings) {
			try {
				const [created] = await db
					.insert(tablePresensiSettings)
					.values({ sekolahId, tahunAjaranId })
					.onConflictDoNothing({
						target: [tablePresensiSettings.sekolahId, tablePresensiSettings.tahunAjaranId]
					})
					.returning();
				presensiSettings =
					created ??
					(await db.query.tablePresensiSettings.findFirst({
						where: and(
							eq(tablePresensiSettings.sekolahId, sekolahId),
							eq(tablePresensiSettings.tahunAjaranId, tahunAjaranId)
						)
					})) ??
					null;
			} catch (error) {
				console.warn('[presensi] gagal membuat pengaturan presensi default:', error);
			}
		}

		const bellSettings =
			(await db.query.tableBellSettings.findFirst({
				columns: {
					jamMulai: true,
					jamPelajaranMenit: true,
					durasiIstirahat: true,
					durasiUpacara: true
				},
				where: eq(tableBellSettings.sekolahId, sekolahId)
			})) ?? null;

		const kegiatanCustom = await db.query.tableKegiatanCustom.findMany({
			columns: { kode: true, durasi: true },
			where: eq(tableKegiatanCustom.sekolahId, sekolahId)
		});

		const activeTa = academicContext?.tahunAjaranList.find(
			(ta) => ta.id === academicContext?.activeTahunAjaranId
		);
		const activeSem = activeTa?.semester.find((s) => s.id === academicContext?.activeSemesterId);

		// Tanggal masuk semester menentukan mulai hitung presensi. Data master dari
		// Database Pusat belum tentu menyertakannya, jadi lengkapi dengan tanggal
		// mulai semester bila kosong.
		let tanggalMasuk = activeSem?.tanggalMasuk ?? null;
		if (!tanggalMasuk && activeSem?.tanggalMulai) {
			tanggalMasuk = activeSem.tanggalMulai;
			try {
				await db
					.update(tableSemester)
					.set({ tanggalMasuk, updatedAt: new Date().toISOString() })
					.where(eq(tableSemester.id, activeSem.id));
			} catch (error) {
				console.warn('[presensi] gagal melengkapi tanggal masuk semester:', error);
			}
		}
		const activeSemesterLabel = activeSem && activeTa ? `${activeSem.nama} (${activeTa.nama})` : '';

		const hasPresensiSettings = !!presensiSettings;
		const hasTanggalMasuk = !!tanggalMasuk;
		const presensiReady = hasPresensiSettings && hasTanggalMasuk;

		let presensiWarningMessage = '';
		if (!presensiReady) {
			const parts: string[] = [];
			if (!hasPresensiSettings) parts.push('melakukan pengaturan presensi');
			if (!hasTanggalMasuk) parts.push('menetapkan tanggal masuk semester ' + activeSemesterLabel);
			presensiWarningMessage = `Tidak dapat melakukan presensi sebelum ${parts.join(' dan ')}`;
		}

		return {
			presensiReady,
			presensiWarningMessage,
			presensiSettings,
			bellSettings,
			kegiatanCustom
		};
	}

	return {
		...defaults,
		presensiWarningMessage:
			'Tidak dapat melakukan presensi karena pengaturan sekolah atau kelas belum lengkap.'
	};
}
