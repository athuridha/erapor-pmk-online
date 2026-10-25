import db from '$lib/server/db';
import {
	tableSekolah,
	tableAsesmenSumatif,
	tableMataPelajaran,
	tableKelas
} from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { isAdminUser } from '../../../pengguna/permissions';

function recalcNilaiAkhirRts(
	naLingkup: number | null | undefined,
	sts: number | null | undefined,
	bobotLingkup: number,
	bobotSts: number
) {
	let weighted = 0;
	let totalW = 0;
	if (naLingkup != null) {
		weighted += naLingkup * bobotLingkup;
		totalW += bobotLingkup;
	}
	if (sts != null) {
		weighted += sts * bobotSts;
		totalW += bobotSts;
	}
	if (totalW === 0) return null;
	return Math.round((weighted / totalW) * 100) / 100;
}

function recalcNilaiAkhir(
	naLingkup: number | null | undefined,
	sts: number | null | undefined,
	sas: number | null | undefined,
	bobotLingkup: number,
	bobotSts: number,
	bobotSas: number
) {
	const eff =
		sts == null
			? { lingkup: 70, sts: 0, sas: 30 }
			: { lingkup: bobotLingkup, sts: bobotSts, sas: bobotSas };
	let weighted = 0;
	let totalW = 0;
	if (naLingkup != null) {
		weighted += naLingkup * eff.lingkup;
		totalW += eff.lingkup;
	}
	if (sts != null) {
		weighted += sts * eff.sts;
		totalW += eff.sts;
	}
	if (sas != null) {
		weighted += sas * eff.sas;
		totalW += eff.sas;
	}
	if (totalW === 0) return null;
	return Math.round((weighted / totalW) * 100) / 100;
}

async function recalculateScores(
	sekolahId: number,
	lingkup: number,
	sts: number,
	sas: number,
	lingkupRts: number,
	stsRts: number
) {
	const kelasRecords = await db
		.select({ id: tableKelas.id })
		.from(tableKelas)
		.where(eq(tableKelas.sekolahId, sekolahId));
	const kelasIds = kelasRecords.map((r) => r.id);
	if (kelasIds.length === 0) return;

	const mapelRecords = await db
		.select({ id: tableMataPelajaran.id })
		.from(tableMataPelajaran)
		.where(inArray(tableMataPelajaran.kelasId, kelasIds));
	const mapelIds = mapelRecords.map((r) => r.id);
	if (mapelIds.length === 0) return;

	const records = await db
		.select({
			id: tableAsesmenSumatif.id,
			naLingkup: tableAsesmenSumatif.naLingkup,
			sts: tableAsesmenSumatif.sts,
			sas: tableAsesmenSumatif.sas,
			nilaiAkhir: tableAsesmenSumatif.nilaiAkhir,
			nilaiAkhirRts: tableAsesmenSumatif.nilaiAkhirRts
		})
		.from(tableAsesmenSumatif)
		.where(inArray(tableAsesmenSumatif.mataPelajaranId, mapelIds));

	for (const record of records) {
		const newNa = recalcNilaiAkhir(record.naLingkup, record.sts, record.sas, lingkup, sts, sas);
		const newNaRts = recalcNilaiAkhirRts(record.naLingkup, record.sts, lingkupRts, stsRts);
		if (newNa !== record.nilaiAkhir || newNaRts !== record.nilaiAkhirRts) {
			await db
				.update(tableAsesmenSumatif)
				.set({
					nilaiAkhir: newNa,
					nilaiAkhirRts: newNaRts
				})
				.where(eq(tableAsesmenSumatif.id, record.id));
		}
	}
}

export async function load({ locals }) {
	if (!locals.user) throw redirect(303, '/login');
	if (!isAdminUser(locals.user)) {
		throw redirect(303, '/forbidden?required=admin');
	}

	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) throw redirect(303, '/');

	const sekolah = await db.query.tableSekolah.findFirst({
		where: eq(tableSekolah.id, sekolahId),
		columns: {
			id: true,
			nama: true,
			sumatifBobotLingkup: true,
			sumatifBobotSts: true,
			sumatifBobotSas: true,
			sumatifBobotRtsLingkup: true,
			sumatifBobotRtsSts: true
		}
	});

	return {
		sekolahNama: sekolah?.nama ?? 'Sekolah',
		bobot: {
			ras: {
				lingkup: Number(sekolah?.sumatifBobotLingkup ?? 60),
				sts: Number(sekolah?.sumatifBobotSts ?? 20),
				sas: Number(sekolah?.sumatifBobotSas ?? 20)
			},
			rts: {
				lingkup: Number(sekolah?.sumatifBobotRtsLingkup ?? 70),
				sts: Number(sekolah?.sumatifBobotRtsSts ?? 30)
			}
		}
	};
}

export const actions = {
	async simpanBobot({ request, locals }) {
		if (!locals.user || !isAdminUser(locals.user)) {
			return fail(403, { fail: 'Anda tidak memiliki hak akses.' });
		}
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) return fail(401, { fail: 'Sekolah tidak ditemukan.' });

		const formData = await request.formData();
		const rasLingkup = Number(formData.get('rasLingkup'));
		const rasSts = Number(formData.get('rasSts'));
		const rasSas = Number(formData.get('rasSas'));

		const rtsLingkup = Number(formData.get('rtsLingkup'));
		const rtsSts = Number(formData.get('rtsSts'));

		if (
			!Number.isFinite(rasLingkup) ||
			!Number.isFinite(rasSts) ||
			!Number.isFinite(rasSas) ||
			!Number.isFinite(rtsLingkup) ||
			!Number.isFinite(rtsSts)
		) {
			return fail(400, { fail: 'Semua nilai bobot harus berupa angka.' });
		}

		if (rasLingkup + rasSts + rasSas !== 100) {
			return fail(400, {
				fail: `Total bobot Rapor Akhir Semester (RAS) harus 100% (saat ini ${rasLingkup + rasSts + rasSas}%).`
			});
		}

		if (rtsLingkup + rtsSts !== 100) {
			return fail(400, {
				fail: `Total bobot Rapor Tengah Semester (RTS) harus 100% (saat ini ${rtsLingkup + rtsSts}%).`
			});
		}

		await db
			.update(tableSekolah)
			.set({
				sumatifBobotLingkup: rasLingkup,
				sumatifBobotSts: rasSts,
				sumatifBobotSas: rasSas,
				sumatifBobotRtsLingkup: rtsLingkup,
				sumatifBobotRtsSts: rtsSts,
				updatedAt: new Date().toISOString()
			})
			.where(eq(tableSekolah.id, sekolahId));

		try {
			await recalculateScores(sekolahId, rasLingkup, rasSts, rasSas, rtsLingkup, rtsSts);
		} catch (err) {
			console.error('Gagal menghitung ulang nilai sumatif:', err);
		}

		return { message: 'Bobot penilaian sumatif berhasil disimpan dan nilai akhir diperbarui.' };
	},

	async resetDefault({ locals }) {
		if (!locals.user || !isAdminUser(locals.user)) {
			return fail(403, { fail: 'Anda tidak memiliki hak akses.' });
		}
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) return fail(401, { fail: 'Sekolah tidak ditemukan.' });

		await db
			.update(tableSekolah)
			.set({
				sumatifBobotLingkup: 60,
				sumatifBobotSts: 20,
				sumatifBobotSas: 20,
				sumatifBobotRtsLingkup: 70,
				sumatifBobotRtsSts: 30,
				updatedAt: new Date().toISOString()
			})
			.where(eq(tableSekolah.id, sekolahId));

		try {
			await recalculateScores(sekolahId, 60, 20, 20, 70, 30);
		} catch (err) {
			console.error('Gagal menghitung ulang nilai default:', err);
		}

		return { message: 'Bobot dikembalikan ke standar default (60/20/20 & 70/30).' };
	}
};
