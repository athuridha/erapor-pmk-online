import { ensureAsesmenSumatifSchema } from '$lib/server/db/ensure-asesmen-sumatif';
import { kelasKontenSet, ownedKelasIdSet, resolveKelasKonten } from '$lib/server/kelas-akses';
import {
	buildLeggerKelas,
	buildLeggerMurid,
	listOpsiKelasLegger,
	type BarisLegger,
	type KolomLegger,
	type LeggerMuridDetail,
	type OpsiKelasLegger,
	type OpsiMuridLegger
} from '$lib/server/legger';
import { loadKonfigurasiNilai, type BobotSumatif } from '$lib/server/nilai-sumatif';
import { error } from '@sveltejs/kit';
import { isAdminUser, isAuthorizedUser } from '../../pengguna/permissions';
import type { PageServerLoad } from './$types';

export type LeggerMode = 'murid' | 'kelas';

export const load: PageServerLoad = async ({ parent, locals, url, depends }) => {
	depends('app:legger');
	const meta: PageMeta = { title: 'Legger' };

	if (!isAuthorizedUser(['administrasi_legger'], locals.user)) {
		error(403, 'Kamu tidak memiliki izin membuka halaman Legger.');
	}

	const rawMode = url.searchParams.get('mode');
	const mode: LeggerMode = rawMode === 'kelas' ? 'kelas' : 'murid';

	const empty = {
		meta,
		mode,
		sekolahNama: locals.sekolah?.nama ?? 'Sekolah',
		bobot: { lingkup: 60, sts: 20, sas: 20 } as BobotSumatif,
		kelasId: null as number | null,
		kelas: null as { id: number; nama: string; fase: string | null; semesterLabel: string } | null,
		daftarKelas: [] as OpsiKelasLegger[],
		daftarMuridKelas: [] as OpsiMuridLegger[],
		muridId: null as number | null,
		muridDetail: null as LeggerMuridDetail | null,
		kolom: [] as KolomLegger[],
		baris: [] as BarisLegger[],
		rekap: { terisi: 0, total: 0, persentase: null as number | null }
	};

	const sekolahId = locals.sekolah?.id ?? null;
	if (!sekolahId) return empty;

	const { kelasAktif, academicContext, activeModul } = await parent();
	const user = locals.user;
	const semesterId = academicContext?.activeSemesterId ?? null;

	const rawKelasParam = url.searchParams.get('kelas') ?? url.searchParams.get('kelas_id');
	const paramKelasId = Number(rawKelasParam) || null;

	let allowedSet: Set<number> | null = null;
	if (!isAdminUser(user)) {
		if (activeModul === 'wali_kelas') {
			allowedSet = await ownedKelasIdSet(user);
			if (allowedSet.size === 0 && user?.type === 'wali_kelas' && user.kelasId) {
				allowedSet.add(Number(user.kelasId));
			}
		} else {
			allowedSet = await kelasKontenSet(user, sekolahId, null);
		}
	}
	if (allowedSet && kelasAktif?.id) {
		allowedSet.add(kelasAktif.id);
	}

	const daftarKelas = await listOpsiKelasLegger(sekolahId, semesterId, allowedSet);

	// Resolve selected class without touching global kelas-aktif cookie
	let kelasDipilihMeta: OpsiKelasLegger | null = null;
	if (paramKelasId) {
		kelasDipilihMeta = daftarKelas.find((k) => k.id === paramKelasId) ?? null;
	}
	if (!kelasDipilihMeta && kelasAktif?.id) {
		kelasDipilihMeta = daftarKelas.find((k) => k.id === kelasAktif.id) ?? null;
	}
	if (!kelasDipilihMeta && paramKelasId) {
		const fallbackResolved = await resolveKelasKonten(
			user ?? undefined,
			sekolahId,
			paramKelasId,
			kelasAktif ? { id: kelasAktif.id, nama: kelasAktif.nama, fase: kelasAktif.fase } : null,
			null
		);
		if (fallbackResolved) {
			kelasDipilihMeta = daftarKelas.find((k) => k.id === fallbackResolved.id) ?? null;
		}
	}
	if (!kelasDipilihMeta) {
		kelasDipilihMeta =
			daftarKelas.find((k) => k.isSemesterAktif && k.jumlahMurid > 0) ??
			daftarKelas.find((k) => k.jumlahMurid > 0) ??
			daftarKelas.find((k) => k.isSemesterAktif) ??
			daftarKelas[0] ??
			null;
	}

	if (!kelasDipilihMeta) {
		return { ...empty, daftarKelas };
	}

	await ensureAsesmenSumatifSchema();
	const konfigurasi = await loadKonfigurasiNilai(sekolahId);
	const bobot = konfigurasi.bobotAkhir;

	const kelasObj = {
		id: kelasDipilihMeta.id,
		nama: kelasDipilihMeta.nama,
		fase: kelasDipilihMeta.fase,
		semesterLabel: kelasDipilihMeta.semesterLabel
	};

	if (mode === 'kelas') {
		const kelasGrid = await buildLeggerKelas({
			sekolahId,
			kelasId: kelasDipilihMeta.id,
			bobot
		});
		return {
			...empty,
			mode,
			bobot,
			kelasId: kelasDipilihMeta.id,
			kelas: kelasObj,
			daftarKelas,
			daftarMuridKelas: kelasGrid.muridRows.map((m) => ({
				id: m.id,
				nama: m.nama,
				nis: m.nis,
				nisn: m.nisn,
				agama: m.agama
			})),
			kolom: kelasGrid.kolom,
			baris: kelasGrid.baris,
			rekap: kelasGrid.rekap
		};
	}

	const paramMuridId = Number(url.searchParams.get('murid')) || null;
	const waktuParam = url.searchParams.get('waktu');
	const { daftarMuridKelas, detail } = await buildLeggerMurid({
		sekolahId,
		kelasId: kelasDipilihMeta.id,
		muridId: paramMuridId,
		waktuParam,
		bobot
	});

	return {
		...empty,
		mode,
		bobot,
		kelasId: kelasDipilihMeta.id,
		kelas: kelasObj,
		daftarKelas,
		daftarMuridKelas,
		muridId: detail?.murid.id ?? null,
		muridDetail: detail
	};
};
