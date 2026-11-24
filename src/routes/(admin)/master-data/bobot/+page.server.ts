import db from '$lib/server/db';
import { tableSekolah, tableMataPelajaran, tableKelas } from '$lib/server/db/schema';
import { recalcMapelSumatifScores } from '$lib/server/nilai-sumatif';
import { fail, redirect } from '@sveltejs/kit';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { isAdminUser } from '../../../pengguna/permissions';

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

	// Hanya hitung ulang mapel yang masih mengikuti default sekolah (belum dikustom guru).
	const mapelRecords = await db
		.select({ id: tableMataPelajaran.id })
		.from(tableMataPelajaran)
		.where(
			and(
				inArray(tableMataPelajaran.kelasId, kelasIds),
				isNull(tableMataPelajaran.bobotFormatif),
				isNull(tableMataPelajaran.bobotSumatif),
				isNull(tableMataPelajaran.bobotAs)
			)
		);
	const mapelIds = mapelRecords.map((r) => r.id);
	if (mapelIds.length === 0) return;

	await recalcMapelSumatifScores(mapelIds, {
		sumatifBobotLingkup: lingkup,
		sumatifBobotSts: sts,
		sumatifBobotSas: sas,
		sumatifBobotRtsLingkup: lingkupRts,
		sumatifBobotRtsSts: stsRts
	});
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
