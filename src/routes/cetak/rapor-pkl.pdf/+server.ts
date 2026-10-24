import { error, redirect } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import db from '$lib/server/db';
import { tablePklKelompok, tablePklNilai, tablePklTujuan } from '$lib/server/db/schema';
import { renderPDF } from '$lib/server/pdf/pagedpdf';
import { buildRaporPklHtml, type RaporPklPrintData } from '$lib/server/pdf/templates/rapor-pkl';
import {
	getLogoSrc,
	getLogoDinasSrc,
	formatTanggal,
	fallbackTempat,
	requireInteger,
	optionalInteger
} from '$lib/server/pdf/preview-utils';
import { personSignatureDataUrl } from '$lib/server/ttd';
import { isAuthorizedUser } from '../../pengguna/permissions';
import type { RequestHandler } from './$types';

// The PKL tables ship via ensure-ekspansi-modul; pnpm db:push may be pending.
function isTableMissingError(err: unknown) {
	return err instanceof Error && err.message.includes('no such table');
}

function periodeLabel(mulai: string | null, selesai: string | null): string {
	const a = formatTanggal(mulai);
	const b = formatTanggal(selesai);
	if (a && b) return `${a} s.d. ${b}`;
	return a || b || '\u2014';
}

async function loadRaporPklData({
	locals,
	url
}: {
	locals: App.Locals;
	url: URL;
}): Promise<RaporPklPrintData> {
	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		throw error(404, 'Sekolah tidak ditemukan.');
	}

	const sekolahId = sekolah.id;
	const kelompokId = requireInteger('kelompok', url.searchParams.get('kelompok'));
	const muridOnly = optionalInteger('murid', url.searchParams.get('murid'));

	const kelompok = await db.query.tablePklKelompok.findFirst({
		columns: {
			id: true,
			nama: true,
			skPenugasan: true,
			tanggalMulai: true,
			tanggalSelesai: true,
			lokasi: true
		},
		with: {
			kelas: { columns: { nama: true } },
			perusahaan: {
				columns: { nama: true, alamat: true, pembimbing: true }
			},
			pembimbing: { columns: { id: true, nama: true } },
			anggota: {
				columns: { muridId: true, catatan: true },
				with: { murid: { columns: { nama: true, nisn: true } } }
			}
		},
		where: and(eq(tablePklKelompok.id, kelompokId), eq(tablePklKelompok.sekolahId, sekolahId))
	});
	if (!kelompok) {
		throw error(404, 'Kelompok PKL tidak ditemukan.');
	}

	const anggota = muridOnly
		? kelompok.anggota.filter((a) => a.muridId === muridOnly)
		: kelompok.anggota;
	if (!anggota.length) {
		throw error(404, 'Murid tidak terdaftar pada kelompok PKL ini.');
	}

	const memberIds = anggota.map((a) => a.muridId);

	const [tujuan, nilaiRows, logoSrc, logoDinasSrc] = await Promise.all([
		db.query.tablePklTujuan.findMany({
			columns: { id: true, urutan: true, deskripsi: true },
			where: eq(tablePklTujuan.sekolahId, sekolahId),
			orderBy: asc(tablePklTujuan.urutan)
		}),
		db
			.select({
				muridId: tablePklNilai.muridId,
				tujuanId: tablePklNilai.tujuanId,
				nilais: tablePklNilai.nilais,
				predikat: tablePklNilai.predikat
			})
			.from(tablePklNilai)
			.where(inArray(tablePklNilai.muridId, memberIds)),
		getLogoSrc(sekolahId),
		getLogoDinasSrc(sekolahId)
	]);

	// nilaiMap[muridId][tujuanId] → row
	const nilaiMap: Record<number, Record<number, { nilais: string; predikat: string | null }>> = {};
	for (const row of nilaiRows) {
		(nilaiMap[row.muridId] ??= {})[row.tujuanId] = { nilais: row.nilais, predikat: row.predikat };
	}

	const guruPembimbingNama = kelompok.pembimbing?.nama ?? null;

	// Signatures load once; guru/kepala names repeat across murid pages.
	const kepalaNama = sekolah.kepalaSekolah?.nama ?? null;
	const [guruTtdImg, kepalaTtdImg] = await Promise.all([
		kelompok.pembimbing?.id
			? personSignatureDataUrl(kelompok.pembimbing.id)
			: Promise.resolve(null),
		personSignatureDataUrl(sekolah.kepalaSekolah?.id ?? null)
	]);

	const halaman = await Promise.all(
		anggota.map(async (anggotaMurid) => {
			const muridNilai = nilaiMap[anggotaMurid.muridId] ?? {};
			const nilai = tujuan.map((t) => {
				const found = muridNilai[t.id];
				return {
					urutan: t.urutan ?? 0,
					deskripsi: t.deskripsi,
					nilai: found?.nilais ?? null,
					predikat: found?.predikat ?? null
				};
			});

			return {
				murid: {
					nama: anggotaMurid.murid?.nama ?? '',
					nisn: anggotaMurid.murid?.nisn ?? null,
					kelas: kelompok.kelas?.nama ?? null
				},
				nilai,
				catatan: anggotaMurid.catatan ?? null,
				ttdNama: {
					pembimbingPerusahaan: kelompok.perusahaan?.pembimbing ?? null,
					guruPembimbing: guruPembimbingNama,
					kepalaSekolah: kepalaNama
				},
				ttdImg: {
					guruPembimbing: guruTtdImg,
					kepalaSekolah: kepalaTtdImg
				}
			};
		})
	);

	return {
		sekolah: {
			nama: sekolah.nama,
			jenjang: sekolah.jenjangPendidikan,
			jenjangVariant: sekolah.jenjangVariant,
			naungan: sekolah.naungan,
			npsn: sekolah.npsn,
			alamat: {
				jalan: sekolah.alamat?.jalan ?? '',
				desa: sekolah.alamat?.desa ?? '',
				kecamatan: sekolah.alamat?.kecamatan ?? '',
				kabupaten: sekolah.alamat?.kabupaten ?? '',
				provinsi: sekolah.alamat?.provinsi ?? null,
				kodePos: sekolah.alamat?.kodePos ?? null
			},
			website: sekolah.website ?? null,
			email: sekolah.email ?? null,
			logoUrl: logoSrc,
			logoDinasUrl: logoDinasSrc
		},
		judul: 'Laporan Praktik Kerja Lapangan',
		subjudul: '',
		kelompokNama: kelompok.nama ?? null,
		skPenugasan: kelompok.skPenugasan ?? null,
		guruPembimbing: guruPembimbingNama,
		tempatPkl: {
			nama: kelompok.perusahaan?.nama ?? '',
			alamat: kelompok.perusahaan?.alamat ?? null,
			lokasi: kelompok.lokasi ?? null,
			pembimbing: kelompok.perusahaan?.pembimbing ?? null
		},
		periode: periodeLabel(kelompok.tanggalMulai, kelompok.tanggalSelesai),
		tempat: fallbackTempat(sekolah),
		tanggal: formatTanggal(new Date()) || '',
		halaman
	};
}

async function handle({ locals, url }: { locals: App.Locals; url: URL }) {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	if (!isAuthorizedUser(['input_nilai_pkl'], locals.user)) {
		throw redirect(303, '/forbidden?required=input_nilai_pkl');
	}

	let data: RaporPklPrintData;
	try {
		data = await loadRaporPklData({ locals, url });
	} catch (err) {
		if (isTableMissingError(err)) {
			throw error(500, 'Tabel PKL belum tersedia. Jalankan pnpm db:push.');
		}
		throw err;
	}

	const html = buildRaporPklHtml(data);
	const pdfBuffer = await renderPDF(html);

	const namaHeader = data.halaman.length === 1 ? data.halaman[0].murid.nama : data.kelompokNama;
	const filename = `Rapor_PKL_${(namaHeader || 'dokumen').replace(/\s+/g, '_')}.pdf`;

	return new Response(new Blob([pdfBuffer as BlobPart], { type: 'application/pdf' }), {
		headers: {
			'Content-Disposition': `inline; filename="${filename}"`,
			'Cache-Control': 'no-store, no-cache, must-revalidate'
		}
	});
}

export const GET = (async (event) => handle(event)) satisfies RequestHandler;
export const POST = (async (event) => handle(event)) satisfies RequestHandler;
