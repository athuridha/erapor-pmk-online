export type GroupEntry = {
	id?: number;
	deskripsi: string;
	teknikPenilaianId?: number | null;
	deleted?: boolean;
};

export type GroupFormState = {
	mode: 'create' | 'edit';
	lingkupMateri: string;
	entries: GroupEntry[];
	targetIds: number[];
};

export type SelectedGroupState = {
	lingkupMateri: string;
	ids: number[];
};

export type GroupBobotState = {
	value: number;
	isManual: boolean;
};

export type TujuanPembelajaranGroup = {
	lingkupMateri: string;
	items: Array<{
		id: number;
		deskripsi: string;
		bobot?: number | null;
		lingkupMateri?: string | null;
		teknikPenilaianId?: number | null;
		teknikPenilaian?: { id: number; nama: string; singkatan: string } | null;
	}>;
	bobot: number | null;
};
