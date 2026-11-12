export type TujuanEntry = {
	index: number;
	tujuanPembelajaranId: number;
	deskripsi: string;
	lingkupMateri: string;
	bobot: number | null;
	nilai: number | null;
	teknikPenilaianId?: number | null;
	teknikPenilaian?: {
		id: number;
		nama: string;
		singkatan: string;
		keterangan?: string | null;
	} | null;
};

export type EntryDraft = TujuanEntry & {
	nilaiText: string;
};

export type LingkupSummary = {
	lingkupMateri: string;
	bobot: number | null;
	rataRata: number | null;
};

export type NilaiAkhirCategory = {
	key: 'perlu-bimbingan' | 'cukup' | 'baik' | 'sangat-baik';
	label: string;
	className: string;
	icon: 'error' | 'alert' | 'check' | 'info';
	description: string;
};
