// Penyusun rencana impor. Dua pemakai, satu logika:
//   - pratinjau: mengambil baris rencana tanpa fungsi `jalankan`
//   - simpan: menjalankan fungsi `jalankan` di dalam satu transaksi
// Dengan begitu hasil pratinjau dan hasil simpan tidak mungkin berbeda aturan.

import db from '$lib/server/db/index.js';
import {
	tableAlamat,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tablePegawai,
	tableWaliMurid
} from '$lib/server/db/schema.js';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { keJenisKelamin, keTanggalIso, type WorkbookParse } from './parse';
import { AGAMA_JENIS_MAPEL, SHEETS, normalKolom, type SheetKey } from './sheets';

export type TX = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Aksi = 'baru' | 'ubah' | 'tetap' | 'gagal';

export type BarisRencana = {
	sheet: SheetKey;
	// Nomor baris di berkas Excel, supaya pengguna bisa langsung membetulkan sumbernya.
	no: number;
	kunci: string;
	aksi: Aksi;
	ringkas: string;
	alasan?: string;
	jalankan?: (tx: TX) => Promise<void>;
};

export type RingkasanSheet = {
	key: SheetKey;
	nama: string;
	baru: number;
	ubah: number;
	tetap: number;
	gagal: number;
};

export type Rencana = {
	sekolahId: number;
	semesterId: number;
	baris: BarisRencana[];
	ringkasan: RingkasanSheet[];
};

export type BarisPratinjau = Omit<BarisRencana, 'jalankan'>;
export type Pratinjau = {
	baris: BarisPratinjau[];
	ringkasan: RingkasanSheet[];
	// Total baris yang akan ditulis (baru + ubah).
	akanDitulis: number;
};

/** Buang fungsi `jalankan` supaya hasilnya bisa dikirim ke peramban. */
export function kePratinjau(rencana: Rencana): Pratinjau {
	return {
		baris: rencana.baris.map(({ jalankan: _jalankan, ...sisa }) => sisa),
		ringkasan: rencana.ringkasan,
		akanDitulis: rencana.baris.filter((b) => b.aksi === 'baru' || b.aksi === 'ubah').length
	};
}

const KOSONG = 'Belum diisi';

type PegawaiAda = { id: number; nama: string; nuptk: string | null; sekolahId: number | null };
type KelasAda = { id: number; nama: string; fase: string | null; waliKelasId: number | null };
type MuridAda = {
	id: number;
	nis: string;
	nisn: string;
	nama: string;
	tempatLahir: string;
	tanggalLahir: string;
	jenisKelamin: 'L' | 'P';
	agama: string;
	pendidikanSebelumnya: string;
	tanggalMasuk: string;
	kelasId: number;
	alamatId: number;
	ibuId: number | null;
	ayahId: number | null;
};
type MapelAda = {
	id: number;
	kelasId: number;
	nama: string;
	kode: string | null;
	kkm: number;
	jenis: string;
	pengampuId: number | null;
};

export async function susunRencana(
	sekolahId: number,
	semesterId: number,
	tahunAjaranId: number,
	hasil: WorkbookParse
): Promise<Rencana> {
	const baris: BarisRencana[] = [];

	// --- Data yang sudah ada di basis data ---
	const pegawaiRows = await db
		.select({
			id: tablePegawai.id,
			nama: tablePegawai.nama,
			nip: tablePegawai.nip,
			nuptk: tablePegawai.nuptk,
			sekolahId: tablePegawai.sekolahId
		})
		.from(tablePegawai)
		.where(or(eq(tablePegawai.sekolahId, sekolahId), isNull(tablePegawai.sekolahId)));

	const pegawaiByNip = new Map<string, PegawaiAda>();
	for (const p of pegawaiRows) {
		const kunci = normalKolom(p.nip);
		if (kunci && !pegawaiByNip.has(kunci)) {
			pegawaiByNip.set(kunci, { id: p.id, nama: p.nama, nuptk: p.nuptk, sekolahId: p.sekolahId });
		}
	}

	const kelasRows = await db
		.select({
			id: tableKelas.id,
			nama: tableKelas.nama,
			fase: tableKelas.fase,
			waliKelasId: tableKelas.waliKelasId
		})
		.from(tableKelas)
		.where(and(eq(tableKelas.sekolahId, sekolahId), eq(tableKelas.semesterId, semesterId)));

	const kelasByNama = new Map<string, KelasAda>();
	for (const k of kelasRows) {
		const kunci = normalKolom(k.nama);
		if (kunci && !kelasByNama.has(kunci)) kelasByNama.set(kunci, k);
	}

	const muridRows = await db
		.select({
			id: tableMurid.id,
			nis: tableMurid.nis,
			nisn: tableMurid.nisn,
			nama: tableMurid.nama,
			tempatLahir: tableMurid.tempatLahir,
			tanggalLahir: tableMurid.tanggalLahir,
			jenisKelamin: tableMurid.jenisKelamin,
			agama: tableMurid.agama,
			pendidikanSebelumnya: tableMurid.pendidikanSebelumnya,
			tanggalMasuk: tableMurid.tanggalMasuk,
			kelasId: tableMurid.kelasId,
			alamatId: tableMurid.alamatId,
			ibuId: tableMurid.ibuId,
			ayahId: tableMurid.ayahId
		})
		.from(tableMurid)
		.where(and(eq(tableMurid.sekolahId, sekolahId), eq(tableMurid.semesterId, semesterId)));

	const muridByNis = new Map<string, MuridAda>();
	for (const m of muridRows) {
		const kunci = normalKolom(m.nis);
		if (kunci && !muridByNis.has(kunci)) muridByNis.set(kunci, m);
	}

	const kelasIds = kelasRows.map((k) => k.id);
	const mapelRows = kelasIds.length
		? await db
				.select({
					id: tableMataPelajaran.id,
					kelasId: tableMataPelajaran.kelasId,
					nama: tableMataPelajaran.nama,
					kode: tableMataPelajaran.kode,
					kkm: tableMataPelajaran.kkm,
					jenis: tableMataPelajaran.jenis,
					pengampuId: tableMataPelajaran.pengampuId
				})
				.from(tableMataPelajaran)
				.where(inArray(tableMataPelajaran.kelasId, kelasIds))
		: [];

	const mapelByKunci = new Map<string, MapelAda>();
	for (const m of mapelRows) {
		mapelByKunci.set(`${m.kelasId}|${normalKolom(m.nama)}`, m);
	}

	// Alamat murid ikut dibandingkan supaya baris yang benar-benar sama ditandai "tetap".
	const alamatIds = muridRows.map((m) => m.alamatId).filter((id): id is number => id != null);
	const alamatRows = alamatIds.length
		? await db
				.select({
					id: tableAlamat.id,
					jalan: tableAlamat.jalan,
					desa: tableAlamat.desa,
					kecamatan: tableAlamat.kecamatan,
					kabupaten: tableAlamat.kabupaten
				})
				.from(tableAlamat)
				.where(inArray(tableAlamat.id, alamatIds))
		: [];
	const alamatById = new Map(alamatRows.map((a) => [a.id, a]));

	const waliIds = muridRows
		.flatMap((m) => [m.ayahId, m.ibuId])
		.filter((id): id is number => id != null);
	const waliRows = waliIds.length
		? await db
				.select({ id: tableWaliMurid.id, nama: tableWaliMurid.nama })
				.from(tableWaliMurid)
				.where(inArray(tableWaliMurid.id, waliIds))
		: [];
	const waliById = new Map(waliRows.map((w) => [w.id, w]));

	const now = () => new Date().toISOString();

	// --- Kunci yang muncul di berkas, untuk mendeteksi duplikat & rujukan antar-sheet ---
	const sudahDipakai = new Set<string>();
	function tandaiDuplikat(sheet: SheetKey, kunci: string): boolean {
		const id = `${sheet}|${kunci}`;
		if (sudahDipakai.has(id)) return true;
		sudahDipakai.add(id);
		return false;
	}

	const nipDiBerkas = new Set<string>();
	for (const b of hasil.sheets.find((s) => s.key === 'guru')?.baris ?? []) {
		const nip = normalKolom(b.nilai.nip ?? '');
		if (nip) nipDiBerkas.add(nip);
	}

	// Pegawai yang baru akan dibuat dari berkas ini, supaya kelas dan mapel bisa
	// merujuk pengampu/wali kelas yang belum ada di basis data.
	const nipPegawaiBaru = new Map<string, number>();

	for (const sheet of hasil.sheets) {
		// Masalah tingkat sheet (kolom wajib tidak ada) dilaporkan sekali, bukan per baris.
		for (const pesan of sheet.galat) {
			baris.push({
				sheet: sheet.key,
				no: 0,
				kunci: SHEETS[sheet.key].judul,
				aksi: 'gagal',
				ringkas: 'sheet dilewati',
				alasan: pesan
			});
		}

		for (const { no, nilai } of sheet.baris) {
			if (sheet.key === 'guru') {
				const nip = (nilai.nip ?? '').trim();
				const nama = (nilai.nama ?? '').trim();
				if (!nip) {
					baris.push(gagal(sheet.key, no, nama || '-', 'NIP wajib diisi untuk mencocokkan data.'));
					continue;
				}
				if (!nama) {
					baris.push(gagal(sheet.key, no, nip, 'Nama wajib diisi.'));
					continue;
				}
				if (tandaiDuplikat('guru', normalKolom(nip))) {
					baris.push(gagal(sheet.key, no, `${nip} · ${nama}`, 'NIP ganda di berkas ini.'));
					continue;
				}
				const nuptk = (nilai.nuptk ?? '').trim() || null;
				const ada = pegawaiByNip.get(normalKolom(nip));
				const kunci = `${nip} · ${nama}`;

				if (!ada) {
					baris.push({
						sheet: 'guru',
						no,
						kunci,
						aksi: 'baru',
						ringkas: nuptk ? `NUPTK ${nuptk}` : 'tanpa NUPTK',
						jalankan: async (tx) => {
							const insert = await tx
								.insert(tablePegawai)
								.values({ nama, nip, nuptk, sekolahId, createdAt: now(), updatedAt: now() })
								.returning({ id: tablePegawai.id });
							const idBaru = insert[0]?.id ?? 0;
							pegawaiByNip.set(normalKolom(nip), { id: idBaru, nama, nuptk, sekolahId });
							nipPegawaiBaru.set(normalKolom(nip), idBaru);
						}
					});
					continue;
				}

				const ubah: string[] = [];
				if (ada.nama !== nama) ubah.push('nama');
				if ((ada.nuptk ?? '') !== (nuptk ?? '')) ubah.push('NUPTK');
				if (ada.sekolahId == null) ubah.push('sekolah');
				if (!ubah.length) {
					baris.push({ sheet: 'guru', no, kunci, aksi: 'tetap', ringkas: 'tidak ada perubahan' });
					continue;
				}
				baris.push({
					sheet: 'guru',
					no,
					kunci,
					aksi: 'ubah',
					ringkas: `ubah: ${ubah.join(', ')}`,
					jalankan: async (tx) => {
						await tx
							.update(tablePegawai)
							.set({ nama, nuptk, sekolahId, updatedAt: now() })
							.where(eq(tablePegawai.id, ada.id));
						pegawaiByNip.set(normalKolom(nip), { id: ada.id, nama, nuptk, sekolahId });
					}
				});
				continue;
			}

			if (sheet.key === 'kelas') {
				const nama = (nilai.nama ?? '').trim();
				if (!nama) {
					baris.push(gagal('kelas', no, '-', 'Nama kelas wajib diisi.'));
					continue;
				}
				if (tandaiDuplikat('kelas', normalKolom(nama))) {
					baris.push(gagal('kelas', no, nama, 'Nama kelas ganda di berkas ini.'));
					continue;
				}
				const fase = (nilai.fase ?? '').trim() || null;
				const nipWali = (nilai.wali_kelas_nip ?? '').trim();
				let waliKelasId: number | null = null;
				if (nipWali) {
					const wali = pegawaiByNip.get(normalKolom(nipWali));
					if (!wali && !nipDiBerkas.has(normalKolom(nipWali))) {
						baris.push(
							gagal(
								'kelas',
								no,
								nama,
								`NIP wali kelas ${nipWali} tidak ada di sheet Guru dan belum terdaftar.`
							)
						);
						continue;
					}
					// Kalau pegawainya baru dibuat oleh sheet Guru, id-nya diambil saat simpan.
					waliKelasId = wali?.id ?? null;
				}

				const ada = kelasByNama.get(normalKolom(nama));
				if (!ada) {
					baris.push({
						sheet: 'kelas',
						no,
						kunci: nama,
						aksi: 'baru',
						ringkas: [
							fase ? `fase ${fase}` : 'tanpa fase',
							nipWali ? 'dengan wali kelas' : 'tanpa wali kelas'
						].join(', '),
						jalankan: async (tx) => {
							const waliId = nipWali ? (resolveWali(nipWali) ?? null) : null;
							const insert = await tx
								.insert(tableKelas)
								.values({
									sekolahId,
									tahunAjaranId,
									semesterId,
									nama,
									fase,
									waliKelasId: waliId,
									createdAt: now(),
									updatedAt: now()
								})
								.returning({ id: tableKelas.id });
							const idBaru = insert[0]?.id ?? 0;
							kelasByNama.set(normalKolom(nama), { id: idBaru, nama, fase, waliKelasId: waliId });
						}
					});
					continue;
				}

				if (nipWali && waliKelasId == null) waliKelasId = ada.waliKelasId;
				const ubah: string[] = [];
				if ((ada.fase ?? '') !== (fase ?? '')) ubah.push('fase');
				if ((ada.waliKelasId ?? null) !== (waliKelasId ?? null)) ubah.push('wali kelas');
				if (!ubah.length) {
					baris.push({
						sheet: 'kelas',
						no,
						kunci: nama,
						aksi: 'tetap',
						ringkas: 'tidak ada perubahan'
					});
					continue;
				}
				baris.push({
					sheet: 'kelas',
					no,
					kunci: nama,
					aksi: 'ubah',
					ringkas: `ubah: ${ubah.join(', ')}`,
					jalankan: async (tx) => {
						const waliId = nipWali ? (resolveWali(nipWali) ?? null) : null;
						await tx
							.update(tableKelas)
							.set({ fase, waliKelasId: waliId, updatedAt: now() })
							.where(eq(tableKelas.id, ada.id));
						kelasByNama.set(normalKolom(nama), { id: ada.id, nama, fase, waliKelasId: waliId });
					}
				});
				continue;
			}

			if (sheet.key === 'murid') {
				const nis = (nilai.nis ?? '').trim();
				const nama = (nilai.nama ?? '').trim();
				const kelasNama = (nilai.kelas ?? '').trim();
				if (!nis || !nama) {
					baris.push(gagal('murid', no, nis || nama || '-', 'NIS dan nama wajib diisi.'));
					continue;
				}
				if (tandaiDuplikat('murid', normalKolom(nis))) {
					baris.push(gagal('murid', no, `${nis} · ${nama}`, 'NIS ganda di berkas ini.'));
					continue;
				}
				const jk = keJenisKelamin(nilai.jenis_kelamin ?? '');
				if (!jk) {
					baris.push(gagal('murid', no, `${nis} · ${nama}`, 'Jenis kelamin harus L atau P.'));
					continue;
				}
				if (!kelasByNama.has(normalKolom(kelasNama)) && !kelasDiBerkas(hasil, kelasNama)) {
					baris.push(
						gagal(
							'murid',
							no,
							`${nis} · ${nama}`,
							`Kelas "${kelasNama}" tidak ada di sheet Kelas dan belum terdaftar.`
						)
					);
					continue;
				}

				const tanggalLahir = nilai.tanggal_lahir?.trim() ?? '';
				const tanggalMasuk = nilai.tanggal_masuk?.trim() ?? '';
				const lahirIso = tanggalLahir ? keTanggalIso(tanggalLahir) : null;
				const masukIso = tanggalMasuk ? keTanggalIso(tanggalMasuk) : null;
				if (tanggalLahir && !lahirIso) {
					baris.push(
						gagal(
							'murid',
							no,
							`${nis} · ${nama}`,
							`Tanggal lahir "${tanggalLahir}" tidak dikenali.`
						)
					);
					continue;
				}
				if (tanggalMasuk && !masukIso) {
					baris.push(
						gagal(
							'murid',
							no,
							`${nis} · ${nama}`,
							`Tanggal masuk "${tanggalMasuk}" tidak dikenali.`
						)
					);
					continue;
				}

				const isian = {
					nisn: (nilai.nisn ?? '').trim(),
					tempatLahir: (nilai.tempat_lahir ?? '').trim(),
					tanggalLahir: lahirIso ?? '',
					agama: (nilai.agama ?? '').trim(),
					pendidikanSebelumnya: (nilai.pendidikan_sebelumnya ?? '').trim(),
					tanggalMasuk: masukIso ?? '',
					jenisKelamin: jk
				};
				const alamatIsian = {
					jalan: (nilai.alamat_jalan ?? '').trim(),
					desa: (nilai.alamat_desa ?? '').trim(),
					kecamatan: (nilai.alamat_kecamatan ?? '').trim(),
					kabupaten: (nilai.alamat_kabupaten ?? '').trim()
				};
				const adaAlamat = Object.values(alamatIsian).some((v) => v !== '');
				const namaAyah = (nilai.nama_ayah ?? '').trim();
				const namaIbu = (nilai.nama_ibu ?? '').trim();

				const ada = muridByNis.get(normalKolom(nis));
				const kunci = `${nis} · ${nama}`;

				if (!ada) {
					baris.push({
						sheet: 'murid',
						no,
						kunci,
						aksi: 'baru',
						ringkas: [
							kelasNama,
							`JK ${jk}`,
							adaAlamat ? 'dengan alamat' : 'alamat belum diisi'
						].join(', '),
						jalankan: async (tx) => {
							const kelas = kelasByNama.get(normalKolom(kelasNama));
							if (!kelas) throw new Error(`Kelas "${kelasNama}" gagal disiapkan.`);
							const alamatId = await siapkanAlamat(tx, alamatIsian, adaAlamat, null);
							const ayahId = namaAyah ? await siapkanWali(tx, namaAyah, null) : null;
							const ibuId = namaIbu ? await siapkanWali(tx, namaIbu, null) : null;
							const insert = await tx
								.insert(tableMurid)
								.values({
									nis,
									sekolahId,
									semesterId,
									kelasId: kelas.id,
									nama,
									alamatId,
									ibuId,
									ayahId,
									...isian,
									createdAt: now(),
									updatedAt: now()
								})
								.returning({ id: tableMurid.id });
							muridByNis.set(normalKolom(nis), {
								id: insert[0]?.id ?? 0,
								nis,
								nisn: isian.nisn,
								nama,
								tempatLahir: isian.tempatLahir,
								tanggalLahir: isian.tanggalLahir,
								jenisKelamin: isian.jenisKelamin,
								agama: isian.agama,
								pendidikanSebelumnya: isian.pendidikanSebelumnya,
								tanggalMasuk: isian.tanggalMasuk,
								kelasId: kelas.id,
								alamatId,
								ibuId,
								ayahId
							});
						}
					});
					continue;
				}

				const kelasAda = kelasByNama.get(normalKolom(kelasNama));
				const ubah: string[] = [];
				if (ada.nama !== nama) ubah.push('nama');
				if (ada.nisn !== isian.nisn) ubah.push('NISN');
				if (ada.jenisKelamin !== isian.jenisKelamin) ubah.push('jenis kelamin');
				if ((ada.tempatLahir ?? '') !== isian.tempatLahir) ubah.push('tempat lahir');
				if ((ada.tanggalLahir ?? '') !== isian.tanggalLahir) ubah.push('tanggal lahir');
				if ((ada.agama ?? '') !== isian.agama) ubah.push('agama');
				if ((ada.pendidikanSebelumnya ?? '') !== isian.pendidikanSebelumnya) {
					ubah.push('pendidikan sebelumnya');
				}
				if ((ada.tanggalMasuk ?? '') !== isian.tanggalMasuk) ubah.push('tanggal masuk');
				if (kelasAda && ada.kelasId !== kelasAda.id) ubah.push('kelas');

				const alamatAda = alamatById.get(ada.alamatId);
				if (
					adaAlamat &&
					(alamatAda == null ||
						alamatAda.jalan !== alamatIsian.jalan ||
						alamatAda.desa !== alamatIsian.desa ||
						alamatAda.kecamatan !== alamatIsian.kecamatan ||
						alamatAda.kabupaten !== alamatIsian.kabupaten)
				) {
					ubah.push('alamat');
				}
				if (namaAyah && (waliById.get(ada.ayahId ?? 0)?.nama ?? '') !== namaAyah)
					ubah.push('nama ayah');
				if (namaIbu && (waliById.get(ada.ibuId ?? 0)?.nama ?? '') !== namaIbu)
					ubah.push('nama ibu');

				if (!ubah.length) {
					baris.push({ sheet: 'murid', no, kunci, aksi: 'tetap', ringkas: 'tidak ada perubahan' });
					continue;
				}

				baris.push({
					sheet: 'murid',
					no,
					kunci,
					aksi: 'ubah',
					ringkas: `ubah: ${ubah.join(', ')}`,
					jalankan: async (tx) => {
						const kelas = kelasByNama.get(normalKolom(kelasNama));
						if (!kelas) throw new Error(`Kelas "${kelasNama}" gagal disiapkan.`);
						const alamatId = await siapkanAlamat(tx, alamatIsian, adaAlamat, ada.alamatId);
						const ayahId = namaAyah ? await siapkanWali(tx, namaAyah, ada.ayahId) : ada.ayahId;
						const ibuId = namaIbu ? await siapkanWali(tx, namaIbu, ada.ibuId) : ada.ibuId;
						await tx
							.update(tableMurid)
							.set({
								...isian,
								nama,
								kelasId: kelas.id,
								alamatId,
								ayahId,
								ibuId,
								updatedAt: now()
							})
							.where(eq(tableMurid.id, ada.id));
						muridByNis.set(normalKolom(nis), {
							...ada,
							...isian,
							nama,
							kelasId: kelas.id,
							alamatId,
							ayahId,
							ibuId
						});
					}
				});
				continue;
			}

			// sheet.key === 'mapel'
			const kelasNama = (nilai.kelas ?? '').trim();
			const nama = (nilai.nama ?? '').trim();
			const kunci = `${kelasNama} · ${nama}`;
			if (!kelasNama || !nama) {
				baris.push(gagal('mapel', no, kunci || '-', 'Kelas dan nama mapel wajib diisi.'));
				continue;
			}
			if (tandaiDuplikat('mapel', `${normalKolom(kelasNama)}|${normalKolom(nama)}`)) {
				baris.push(gagal('mapel', no, kunci, 'Mapel ganda untuk kelas yang sama di berkas ini.'));
				continue;
			}
			const kelas = kelasByNama.get(normalKolom(kelasNama));
			if (!kelas && !kelasDiBerkas(hasil, kelasNama)) {
				baris.push(
					gagal(
						'mapel',
						no,
						kunci,
						`Kelas "${kelasNama}" tidak ada di sheet Kelas dan belum terdaftar.`
					)
				);
				continue;
			}
			const jenis = normalJenis(nilai.jenis ?? '');
			if (!jenis) {
				baris.push(
					gagal(
						'mapel',
						no,
						kunci,
						`Jenis mapel harus salah satu dari: ${AGAMA_JENIS_MAPEL.join(', ')}.`
					)
				);
				continue;
			}
			const kkmTeks = (nilai.kkm ?? '').trim();
			const kkm = kkmTeks ? Number(kkmTeks) : 0;
			if (!Number.isFinite(kkm) || kkm < 0) {
				baris.push(gagal('mapel', no, kunci, `KKM "${kkmTeks}" bukan angka yang sah.`));
				continue;
			}
			const kode = (nilai.kode ?? '').trim() || null;
			const nipPengampu = (nilai.pengampu_nip ?? '').trim();
			if (
				nipPengampu &&
				!pegawaiByNip.has(normalKolom(nipPengampu)) &&
				!nipDiBerkas.has(normalKolom(nipPengampu))
			) {
				baris.push(
					gagal(
						'mapel',
						no,
						kunci,
						`NIP pengampu ${nipPengampu} tidak ada di sheet Guru dan belum terdaftar.`
					)
				);
				continue;
			}

			const ada = kelas ? mapelByKunci.get(`${kelas.id}|${normalKolom(nama)}`) : undefined;
			if (!ada) {
				baris.push({
					sheet: 'mapel',
					no,
					kunci,
					aksi: 'baru',
					ringkas: [jenis, `KKM ${kkm}`, nipPengampu ? 'dengan pengampu' : 'tanpa pengampu'].join(
						', '
					),
					jalankan: async (tx) => {
						const kelasKini = kelasByNama.get(normalKolom(kelasNama));
						if (!kelasKini) throw new Error(`Kelas "${kelasNama}" gagal disiapkan.`);
						const pengampuId = nipPengampu ? (resolveWali(nipPengampu) ?? null) : null;
						const insert = await tx
							.insert(tableMataPelajaran)
							.values({
								kelasId: kelasKini.id,
								nama,
								kode,
								kkm: Math.trunc(kkm),
								jenis,
								pengampuId,
								createdAt: now(),
								updatedAt: now()
							})
							.returning({ id: tableMataPelajaran.id });
						mapelByKunci.set(`${kelasKini.id}|${normalKolom(nama)}`, {
							id: insert[0]?.id ?? 0,
							kelasId: kelasKini.id,
							nama,
							kode,
							kkm: Math.trunc(kkm),
							jenis,
							pengampuId
						});
					}
				});
				continue;
			}

			const ubah: string[] = [];
			if ((ada.kode ?? '') !== (kode ?? '')) ubah.push('kode');
			if (ada.kkm !== Math.trunc(kkm)) ubah.push('KKM');
			if (ada.jenis !== jenis) ubah.push('jenis');
			if (nipPengampu) {
				const pengampuAda = pegawaiByNip.get(normalKolom(nipPengampu))?.id;
				// Pegawai yang baru dibuat oleh sheet Guru belum punya id saat pratinjau,
				// jadi baris apa pun yang belum punya pengampu dihitung sebagai berubah.
				if (pengampuAda != null) {
					if ((ada.pengampuId ?? null) !== pengampuAda) ubah.push('pengampu');
				} else if (ada.pengampuId == null) {
					ubah.push('pengampu');
				}
			}
			if (!ubah.length) {
				baris.push({ sheet: 'mapel', no, kunci, aksi: 'tetap', ringkas: 'tidak ada perubahan' });
				continue;
			}
			baris.push({
				sheet: 'mapel',
				no,
				kunci,
				aksi: 'ubah',
				ringkas: `ubah: ${ubah.join(', ')}`,
				jalankan: async (tx) => {
					const pengampuId = nipPengampu ? (resolveWali(nipPengampu) ?? null) : ada.pengampuId;
					await tx
						.update(tableMataPelajaran)
						.set({ kode, kkm: Math.trunc(kkm), jenis, pengampuId, updatedAt: now() })
						.where(eq(tableMataPelajaran.id, ada.id));
				}
			});
		}
	}

	// Pegawai yang dibuat pada tahap simpan belum punya id saat rencana disusun;
	// pengambilan id-nya dilakukan lewat peta ini.
	function resolveWali(nip: string): number | null {
		return pegawaiByNip.get(normalKolom(nip))?.id ?? nipPegawaiBaru.get(normalKolom(nip)) ?? null;
	}

	const ringkasan: RingkasanSheet[] = hasil.sheets.map((s) => {
		const milik = baris.filter((b) => b.sheet === s.key);
		return {
			key: s.key,
			nama: SHEETS[s.key].judul,
			baru: milik.filter((b) => b.aksi === 'baru').length,
			ubah: milik.filter((b) => b.aksi === 'ubah').length,
			tetap: milik.filter((b) => b.aksi === 'tetap').length,
			gagal: milik.filter((b) => b.aksi === 'gagal').length
		};
	});

	return { sekolahId, semesterId, baris, ringkasan };
}

function gagal(sheet: SheetKey, no: number, kunci: string, alasan: string): BarisRencana {
	return { sheet, no, kunci, aksi: 'gagal', ringkas: 'tidak diimpor', alasan };
}

function kelasDiBerkas(hasil: WorkbookParse, nama: string): boolean {
	const sheet = hasil.sheets.find((s) => s.key === 'kelas');
	if (!sheet) return false;
	return sheet.baris.some((b) => normalKolom(b.nilai.nama ?? '') === normalKolom(nama));
}

function normalJenis(input: string): (typeof AGAMA_JENIS_MAPEL)[number] | null {
	const nilai = normalKolom(input);
	const cocok = AGAMA_JENIS_MAPEL.find((j) => normalKolom(j) === nilai);
	return cocok ?? null;
}

/** Buat atau perbarui baris alamat murid. Tanpa isian, dipakai alamat penanda. */
async function siapkanAlamat(
	tx: TX,
	alamat: { jalan: string; desa: string; kecamatan: string; kabupaten: string },
	adaIsian: boolean,
	alamatId: number | null
): Promise<number> {
	const nilai = adaIsian
		? {
				jalan: alamat.jalan || KOSONG,
				desa: alamat.desa || KOSONG,
				kecamatan: alamat.kecamatan || KOSONG,
				kabupaten: alamat.kabupaten || KOSONG
			}
		: { jalan: KOSONG, desa: KOSONG, kecamatan: KOSONG, kabupaten: KOSONG };

	if (alamatId) {
		await tx
			.update(tableAlamat)
			.set({ ...nilai, updatedAt: new Date().toISOString() })
			.where(eq(tableAlamat.id, alamatId));
		return alamatId;
	}
	const insert = await tx
		.insert(tableAlamat)
		.values({ ...nilai, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
		.returning({ id: tableAlamat.id });
	return insert[0]?.id ?? 0;
}

async function siapkanWali(tx: TX, nama: string, waliId: number | null): Promise<number> {
	const timestamp = new Date().toISOString();
	if (waliId) {
		await tx
			.update(tableWaliMurid)
			.set({ nama, updatedAt: timestamp })
			.where(eq(tableWaliMurid.id, waliId));
		return waliId;
	}
	const insert = await tx
		.insert(tableWaliMurid)
		.values({ nama, pekerjaan: KOSONG, createdAt: timestamp, updatedAt: timestamp })
		.returning({ id: tableWaliMurid.id });
	return insert[0]?.id ?? 0;
}
