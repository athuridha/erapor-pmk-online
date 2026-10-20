import { and, eq } from 'drizzle-orm';

import db from '$lib/server/db';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { tableKelas, tableSekolah } from '$lib/server/db/schema';
import { redirect } from '@sveltejs/kit';
import { hasPersonSignature, personSignatureRelPath } from '$lib/server/ttd';
import { isAdminUser } from '../pengguna/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		redirect(303, '/login');
	}

	const sekolahId = locals.sekolah?.id ?? null;
	const admin = isAdminUser(user);
	const waliKelas = user.type === 'wali_kelas';

	if (!admin && !waliKelas) {
		redirect(303, '/forbidden?required=administrasi_tanda_tangan');
	}

	if (!sekolahId) {
		return {
			meta: { title: 'Tanda Tangan' },
			penandatangan: [],
			bisaUbahSemua: admin
		};
	}

	const academic = await resolveSekolahAcademicContext(sekolahId);
	const sekolah = await db.query.tableSekolah.findFirst({
		columns: { kepalaSekolahId: true },
		where: eq(tableSekolah.id, sekolahId)
	});

	const kelasRows = await db.query.tableKelas.findMany({
		columns: { id: true, nama: true, waliKelasId: true },
		where: academic?.activeSemesterId
			? and(
					eq(tableKelas.sekolahId, sekolahId),
					eq(tableKelas.semesterId, academic.activeSemesterId)
				)
			: eq(tableKelas.sekolahId, sekolahId)
	});

	const entries = new Map<
		number,
		{ pegawaiId: number; peran: 'Kepala Sekolah' | 'Wali Kelas'; kelas: string[] }
	>();

	if (sekolah?.kepalaSekolahId) {
		entries.set(sekolah.kepalaSekolahId, {
			pegawaiId: sekolah.kepalaSekolahId,
			peran: 'Kepala Sekolah',
			kelas: []
		});
	}

	for (const kelas of kelasRows) {
		if (!kelas.waliKelasId) continue;
		const entry = entries.get(kelas.waliKelasId) ?? {
			pegawaiId: kelas.waliKelasId,
			peran: 'Wali Kelas' as const,
			kelas: []
		};
		entry.kelas.push(kelas.nama);
		entries.set(kelas.waliKelasId, entry);
	}

	const pegawaiIds = [...entries.keys()];
	const pegawaiRows = pegawaiIds.length
		? await db.query.tablePegawai.findMany({
				columns: { id: true, nama: true, nip: true },
				where: (pegawai, { inArray }) => inArray(pegawai.id, pegawaiIds)
			})
		: [];
	const pegawaiMap = new Map(pegawaiRows.map((pegawai) => [pegawai.id, pegawai]));

	const pegawaiIdSendiri = (user as { pegawaiId?: number | null }).pegawaiId ?? null;

	const penandatangan = [];
	for (const entry of entries.values()) {
		// Wali kelas hanya melihat dan mengubah tanda tangannya sendiri.
		if (!admin && entry.pegawaiId !== pegawaiIdSendiri) continue;
		const pegawai = pegawaiMap.get(entry.pegawaiId);
		if (!pegawai) continue;
		const hasSignature = await hasPersonSignature(entry.pegawaiId);
		penandatangan.push({
			pegawaiId: entry.pegawaiId,
			nama: pegawai.nama,
			nip: pegawai.nip,
			peran: entry.peran,
			kelas: entry.kelas,
			hasSignature,
			signatureUrl: hasSignature ? `/api/ttd/${personSignatureRelPath(entry.pegawaiId)}` : null,
			bisaUbah: admin || entry.pegawaiId === pegawaiIdSendiri
		});
	}

	penandatangan.sort((a, b) => {
		if (a.peran !== b.peran) return a.peran === 'Kepala Sekolah' ? -1 : 1;
		return a.nama.localeCompare(b.nama, 'id');
	});

	return {
		meta: { title: 'Tanda Tangan' },
		penandatangan,
		bisaUbahSemua: admin
	};
};
