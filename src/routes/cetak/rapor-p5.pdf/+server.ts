import { error } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import db from '$lib/server/db';
import { type RequestHandler } from './$types';
import { tableMurid, tableP5Nilai, tableP5Projek } from '$lib/server/db/schema';
import { getKopSuratLines } from '$lib/statics';
import { renderPDF } from '$lib/server/pdf/pagedpdf';
import { composeAlamat, fallbackTempat, formatTanggal } from '$lib/server/pdf/preview-utils';
import { personSignatureDataUrl } from '$lib/server/ttd';
import {
	renderRaporP5HTML,
	type P5Rating,
	type RaporP5PrintData
} from '$lib/server/pdf/templates/rapor-p5';
import { isAuthorizedUser } from '../../pengguna/permissions';
import { buildUrl } from '$lib/server/pdf/request-params';

const REQUIRED_PERMISSION = 'input_nilai_p5';

function parseIdList(raw: string | null): number[] {
	const ids: number[] = [];
	for (const part of (raw ?? '').split(',')) {
		const id = Number(part.trim());
		if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
	}
	return ids;
}

async function handle({ locals, url }: { locals: App.Locals; url: URL }) {
	if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
		throw error(403, `Anda tidak memiliki izin mencetak laporan P5 (${REQUIRED_PERMISSION}).`);
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		throw error(404, 'Sekolah tidak ditemukan.');
	}

	const projekIds = parseIdList(url.searchParams.get('projek'));
	if (!projekIds.length) {
		throw error(
			400,
			'Parameter "?projek=" wajib diisi dengan ID projek P5 (bisa lebih dari satu, dipisah koma).'
		);
	}

	const muridParam = Number(url.searchParams.get('murid'));
	const muridFilter = Number.isInteger(muridParam) && muridParam > 0 ? muridParam : null;

	const projekRows = await db.query.tableP5Projek.findMany({
		columns: { id: true, tema: true, judul: true, catatan: true, pembinaPegawaiId: true },
		with: {
			kelas: { columns: { nama: true } },
			pembina: { columns: { id: true, nama: true, nip: true } },
			anggota: { columns: { muridId: true } }
		},
		where: and(eq(tableP5Projek.sekolahId, sekolah.id), inArray(tableP5Projek.id, projekIds)),
		orderBy: asc(tableP5Projek.id)
	});
	if (!projekRows.length) {
		throw error(404, 'Projek P5 tidak ditemukan di sekolah aktif.');
	}

	const muridIds = [
		...new Set(projekRows.flatMap((projek) => projek.anggota.map((a) => a.muridId)))
	].filter((id) => !muridFilter || id === muridFilter);
	if (muridFilter && !muridIds.length) {
		throw error(404, 'Murid tidak terdaftar sebagai anggota projek P5 ini.');
	}
	if (!muridIds.length) {
		throw error(404, 'Projek P5 belum memiliki anggota.');
	}

	const muridRows = await db.query.tableMurid.findMany({
		columns: { id: true, nama: true, nisn: true },
		with: { kelas: { columns: { nama: true } } },
		where: and(eq(tableMurid.sekolahId, sekolah.id), inArray(tableMurid.id, muridIds)),
		orderBy: asc(tableMurid.nama)
	});
	if (!muridRows.length) {
		throw error(404, 'Data murid anggota projek tidak ditemukan.');
	}

	const nilaiRows = await db.query.tableP5Nilai.findMany({
		columns: { projekId: true, muridId: true, dimensi: true, rating: true, catatan: true },
		where: inArray(
			tableP5Nilai.projekId,
			projekRows.map((projek) => projek.id)
		)
	});

	// Tanda tangan pembina ditarik sekali per pegawai (bisa diikuti >1 projek).
	const pembinaIds = [
		...new Set(
			projekRows.map((projek) => projek.pembinaPegawaiId).filter((id): id is number => id != null)
		)
	];
	const pembinaTtd = new Map<number, string | null>();
	for (const pembinaId of pembinaIds) {
		pembinaTtd.set(pembinaId, await personSignatureDataUrl(pembinaId));
	}

	const kopLines = getKopSuratLines({
		jenjangVariant: sekolah.jenjangVariant,
		naungan: sekolah.naungan,
		kabupaten: sekolah.alamat?.kabupaten ?? '',
		provinsi: sekolah.alamat?.provinsi ?? null
	});

	const printData: RaporP5PrintData[] = await Promise.all(
		muridRows.map(async (murid) => {
			const projekDiikuti = projekRows.filter((projek) =>
				projek.anggota.some((a) => a.muridId === murid.id)
			);

			const pembina: RaporP5PrintData['pembina'] = [];
			for (const projek of projekDiikuti) {
				if (!projek.pembina?.nama) continue;
				if (pembina.some((p) => p.nama === projek.pembina!.nama)) continue;
				pembina.push({
					nama: projek.pembina.nama,
					nip: projek.pembina.nip ?? null,
					tandaTangan: projek.pembinaPegawaiId
						? (pembinaTtd.get(projek.pembinaPegawaiId) ?? null)
						: null
				});
			}

			return {
				sekolah: {
					nama: sekolah.nama,
					alamat: composeAlamat(sekolah),
					kopLines
				},
				murid: {
					nama: murid.nama,
					nisn: murid.nisn,
					kelas: murid.kelas?.nama ?? ''
				},
				projek: projekDiikuti.map((projek) => ({
					tema: projek.tema,
					judul: projek.judul,
					pembina: projek.pembina?.nama ?? '',
					catatan: projek.catatan ?? '',
					dimensi: nilaiRows
						.filter((nilai) => nilai.muridId === murid.id && nilai.projekId === projek.id)
						.map((nilai) => ({
							dimensi: nilai.dimensi,
							rating: nilai.rating as P5Rating,
							catatan: nilai.catatan ?? ''
						}))
				})),
				ttd: {
					tempat: fallbackTempat(sekolah),
					tanggal: formatTanggal(new Date())
				},
				kepalaSekolah: {
					nama: sekolah.kepalaSekolah?.nama ?? '',
					nip: sekolah.kepalaSekolah?.nip ?? null,
					statusKepalaSekolah: sekolah.statusKepalaSekolah,
					tandaTangan: await personSignatureDataUrl(sekolah.kepalaSekolah?.id ?? null)
				},
				pembina
			};
		})
	);

	const html = renderRaporP5HTML(printData);
	const pdfBuffer = await renderPDF(html);

	const namaFile =
		muridFilter && printData.length === 1 ? printData[0].murid.nama : 'Semua-Anggota';
	const filename = `Laporan_P5_${namaFile.replace(/\s+/g, '_')}.pdf`;

	return new Response(new Blob([pdfBuffer as BlobPart], { type: 'application/pdf' }), {
		headers: {
			'Content-Disposition': `inline; filename="${filename}"`,
			'Cache-Control': 'no-store, no-cache, must-revalidate'
		}
	});
}

export const GET = (async (event) => handle(event)) satisfies RequestHandler;
export const POST = (async (event) => {
	const url = await buildUrl(event.request, event.url);
	return handle({ locals: event.locals, url });
}) satisfies RequestHandler;
