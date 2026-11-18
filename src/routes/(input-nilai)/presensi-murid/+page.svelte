<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import IsiSekaligusModal from '$lib/components/absen/isi-sekaligus-modal.svelte';
	import DownloadRekapModal from '$lib/components/absen/download-rekap-modal.svelte';
	import HapusPresensiModal from '$lib/components/absen/hapus-presensi-modal.svelte';
	import TableHarian from '$lib/components/absen/table-harian.svelte';
	import TableBulanan from '$lib/components/absen/table-bulanan.svelte';
	import TableRapor from '$lib/components/absen/table-rapor.svelte';
	import TablePersentaseHarian from '$lib/components/absen/table-persentase-harian.svelte';
	import TablePersentaseBulanan from '$lib/components/absen/table-persentase-bulanan.svelte';
	import TablePersentaseSemester from '$lib/components/absen/table-persentase-semester.svelte';
	import AbsenPagination from '$lib/components/absen/absen-pagination.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { onDestroy } from 'svelte';
	import { serverTime } from '$lib/server-time.svelte';

	const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
	const bulanList = [
		'Januari',
		'Februari',
		'Maret',
		'April',
		'Mei',
		'Juni',
		'Juli',
		'Agustus',
		'September',
		'Oktober',
		'November',
		'Desember'
	];

	type KehadiranRow = {
		id: number;
		no: number;
		nama: string;
		hadir: boolean;
		keterangan: string | null;
		keteranganPulang: string | null;
		updatedAt: string | null;
	};

	type RaporRow = {
		id: number;
		no: number;
		nama: string;
		hadir: number;
		sakit: number;
		izin: number;
		alfa: number;
		overridden: boolean;
	};

	type PageState = {
		search: string | null;
		currentPage: number;
		totalPages: number;
		// totalItems and perPage intentionally omitted when not used in this view
	};

	type PageData = {
		page: PageState;
		daftarMurid: KehadiranRow[];
		semuaMurid: Array<{ id: number; nama: string; keterangan: string | null }>;
		tableReady: boolean;
		totalMurid: number;
		muridCount: number;
		tanggal: string;
		mode:
			| 'harian'
			| 'bulanan'
			| 'rapor'
			| 'persentase_harian'
			| 'persentase_bulanan'
			| 'persentase_semester';
		bulan: number;
		tahun: number;
		daysInMonth: number;
		bulananRows: Array<{
			no: number;
			nama: string;
			statusPerDay: Array<'' | 'H' | 'S' | 'I' | 'TK'>;
			countS: number;
			countI: number;
			countTK: number;
			countHadir: number;
		}>;
		raporRows: RaporRow[];
		redDays: number[];
		persentaseSemesterRows: Array<{
			no: number;
			nama: string;
			persentase: number;
			hadir: number;
			sakit: number;
			izin: number;
			alfa: number;
		}>;
		totalHariBelajar: number;
		totalPertemuan: number;
		persentaseBulananRows: Array<{
			no: number;
			nama: string;
			persentase: number;
			hadir: number;
			sakit: number;
			izin: number;
			alfa: number;
		}>;
		tanggalMulaiRapor: string;
		tanggalAkhirRapor: string;
		presensiReady: boolean;
		presensiWarningMessage: string;
		jenisPresensi: string;
		persentaseHarianSubjects: Array<{ kodeKegiatan: string; label: string }>;
		persentaseHarianRows: Array<{
			no: number;
			muridId: number;
			nama: string;
			subjects: Record<string, string>;
			sessionStatuses: Record<string, { masuk: string; selesai: string }>;
			persentase: number;
		}>;
		tipePresensi: string;
		jadwalSaatIni: {
			mataPelajaranId: number | null;
			namaMataPelajaran: string;
			jamKe: number;
			perkiraanJam: string;
		} | null;
		guruMapelSubject: { id: number; nama: string } | null;
		isMapelOnJadwal: boolean;
		harianMapelId: number | null;
		simulasiHari: string | null;
		simulasiJam: string | null;
		isLibur: boolean;
	};

	let { data }: { data: PageData } = $props();

	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return null;
		const base = kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
		const presensiLabel = data.jenisPresensi === 'tiap_mapel' ? 'Per Mapel' : 'Presensi Wali Kelas';
		const tipeLabel =
			data.tipePresensi === 'masuk_pulang'
				? 'Masuk Pulang'
				: data.tipePresensi === 'awal_akhir_mapel'
					? 'Awal & Akhir Mapel'
					: data.tipePresensi === 'awal_mapel'
						? 'Awal Mapel'
						: 'Masuk Saja';
		return `${base} - ${presensiLabel} - ${tipeLabel}`;
	});

	// Guru merangkap wali kelas (tipe 'user' + relasi waliKelasId): hak wali
	// berlaku di kelas yang diwalikan — paritas akun wali kelas lama.
	const isWaliOwnClass = $derived.by(() => {
		const u = page.data.user as { type?: string; ownKelasIds?: number[] } | null | undefined;
		return (
			u?.type === 'user' &&
			kelasAktif?.id != null &&
			(u.ownKelasIds?.includes(kelasAktif.id) ?? false)
		);
	});

	// Restrict editing: admin, kepala sekolah, wali_kelas, dan guru-wali di kelasnya
	const canEdit = $derived.by(() => {
		const u = page.data.user as { type?: string } | null | undefined;
		return isAdminUser(u) || u?.type === 'wali_kelas' || isWaliOwnClass;
	});

	const currentPage = $derived.by(() => data.page?.currentPage ?? 1);
	const totalPages = $derived.by(() => Math.max(1, data.page?.totalPages ?? 1));
	const pages = $derived.by(() => Array.from({ length: totalPages }, (_, index) => index + 1));

	const getSearch = () => data.page.search ?? '';
	let searchTerm = $state(getSearch());
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	let editingRowId = $state<number | null>(null);
	let editingValues = $state<{ keterangan: string; keteranganPulang: string }>({
		keterangan: '',
		keteranganPulang: ''
	});
	let editingSubmitting = $state(false);

	let raporEditingRowId = $state<number | null>(null);
	let raporEditingValues = $state<{ sakit: number; izin: number; alfa: number }>({
		sakit: 0,
		izin: 0,
		alfa: 0
	});
	let raporEditingSubmitting = $state(false);

	// Multi-select massal (khusus mode Harian): centang beberapa murid lalu
	// terapkan satu status MASUK/PULANG sekaligus lewat aksi `?/simpanMassal`.
	let selectedMuridIds = $state<number[]>([]);
	let bulkMasuk = $state('');
	let bulkPulang = $state('');
	let bulkSubmitting = $state(false);
	const bulkFormId = 'bulk-presensi-massal-form';

	const showBulkPulang = $derived(data.tipePresensi === 'masuk_pulang');
	const canBulkSelect = $derived(data.mode === 'harian' && canEdit);
	const bulkCount = $derived(selectedMuridIds.length);
	const muridIdsPayload = $derived(JSON.stringify(selectedMuridIds));

	function toggleSelectMurid(muridId: number, checked: boolean) {
		if (checked) {
			if (!selectedMuridIds.includes(muridId)) {
				selectedMuridIds = [...selectedMuridIds, muridId];
			}
		} else {
			selectedMuridIds = selectedMuridIds.filter((id) => id !== muridId);
		}
	}

	function toggleSelectAll(checked: boolean) {
		selectedMuridIds = checked ? data.daftarMurid.map((murid) => murid.id) : [];
	}

	function clearSelection() {
		selectedMuridIds = [];
	}

	async function handleBulkSuccess() {
		selectedMuridIds = [];
		await invalidate('app:absen');
	}

	$effect(() => {
		if (searchTimer) return;
		const latestSearchTerm = data.page.search ?? '';
		if (searchTerm !== latestSearchTerm) {
			searchTerm = latestSearchTerm;
		}
	});

	$effect(() => {
		if (editingRowId == null) {
			editingValues = { keterangan: '', keteranganPulang: '' };
		}
	});

	$effect(() => {
		if (raporEditingRowId == null) {
			raporEditingValues = { sakit: 0, izin: 0, alfa: 0 };
		}
	});

	// Keluar dari mode edit & kosongkan pilihan massal saat konteks tabel
	// berganti (tanggal/mode/bulan/halaman/pencarian).
	$effect(() => {
		void data.tanggal;
		void data.mode;
		void data.bulan;
		void data.tahun;
		void data.page.currentPage;
		void data.page.search;
		editingRowId = null;
		raporEditingRowId = null;
		selectedMuridIds = [];
	});

	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';
	import { isAdminUser } from '../../pengguna/permissions';

	function buildUrl(updateParams: (params: SvelteURLSearchParams) => void) {
		const params = new SvelteURLSearchParams(page.url.search);
		updateParams(params);
		const nextQuery = params.toString();
		const nextUrl = `${page.url.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
		const currentUrl = `${page.url.pathname}${page.url.search}`;
		return nextUrl === currentUrl ? null : nextUrl;
	}

	async function applyNavigation(updateParams: (params: SvelteURLSearchParams) => void) {
		const target = buildUrl(updateParams);
		if (!target) return;

		await goto(target, { replaceState: true, keepFocus: true });
	}

	function handleSearchInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		searchTerm = value;
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
		searchTimer = setTimeout(() => {
			searchTimer = undefined;
			void applyNavigation((params) => {
				const cleaned = value.trim();
				if (cleaned) {
					params.set('q', cleaned);
				} else {
					params.delete('q');
				}
				params.delete('page');
			});
		}, 400);
	}

	function submitSearch(event: Event) {
		event.preventDefault();
		if (searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = undefined;
		}
		void applyNavigation((params) => {
			const cleaned = searchTerm.trim();
			if (cleaned) {
				params.set('q', cleaned);
			} else {
				params.delete('q');
			}
			params.delete('page');
		});
	}

	onDestroy(() => {
		if (searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = undefined;
		}
	});

	function gotoPage(pageNumber: number) {
		const sanitized = pageNumber < 1 ? 1 : pageNumber;
		void applyNavigation((params) => {
			if (sanitized <= 1) {
				params.delete('page');
			} else {
				params.set('page', String(sanitized));
			}
		});
	}

	function handlePageClick(pageNumber: number) {
		if (pageNumber === currentPage) return;
		gotoPage(pageNumber);
	}

	function startEdit(row: KehadiranRow) {
		editingRowId = row.id;
		editingValues = {
			keterangan: row.keterangan ?? '',
			keteranganPulang: row.keteranganPulang ?? ''
		};
	}

	function cancelEdit() {
		editingRowId = null;
	}

	async function handleUpdateSuccess() {
		editingRowId = null;
		await invalidate('app:absen');
	}

	const raporEditingSaveDisabled = $derived.by(
		() => raporEditingRowId == null || raporEditingSubmitting
	);

	function startRaporEdit(row: RaporRow) {
		raporEditingRowId = row.id;
		raporEditingValues = {
			sakit: row.sakit,
			izin: row.izin,
			alfa: row.alfa
		};
	}

	function cancelRaporEdit() {
		raporEditingRowId = null;
	}

	async function handleRaporUpdateSuccess() {
		raporEditingRowId = null;
		await invalidate('app:absen');
	}

	const hasMurid = $derived.by(() => data.muridCount > 0);
	const hasFilteredMurid = $derived.by(() => data.totalMurid > 0);

	const isToday = $derived.by(() => {
		const y = serverTime.now.getFullYear();
		const m = String(serverTime.now.getMonth() + 1).padStart(2, '0');
		const day = String(serverTime.now.getDate()).padStart(2, '0');
		return data.tanggal === `${y}-${m}-${day}`;
	});

	type PresensiMode = PageData['mode'];

	// Pemilih mode/tanggal memakai writable `$derived` supaya binding
	// <select>/<input> mengikuti pilihan pengguna sekaligus tersinkron saat server
	// mengembalikan nilai baru.
	let selectedMode = $derived<PresensiMode>(data.mode);
	let selectedTanggal = $derived(data.tanggal);
	// svelte-ignore state_referenced_locally
	let selectedBulan = $state<number>(
		data.mode === 'bulanan' || data.mode === 'persentase_bulanan'
			? data.bulan
			: serverTime.now.getMonth() + 1
	);
	// svelte-ignore state_referenced_locally
	let selectedTahun = $state<number>(
		data.mode === 'bulanan' || data.mode === 'persentase_bulanan'
			? data.tahun
			: serverTime.now.getFullYear()
	);

	$effect(() => {
		if (data.mode === 'bulanan' || data.mode === 'persentase_bulanan') {
			selectedBulan = data.bulan;
			selectedTahun = data.tahun;
		}
	});

	let simulasiHari = $state(page.url.searchParams.get('simHari') ?? 'Senin');
	let simulasiJam = $state(page.url.searchParams.get('simJam') ?? '07:00');
	let showSimulasi = $state(false);
	const simActive = $derived(!!page.url.searchParams.get('simHari'));

	function applySimulasi() {
		if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(simulasiJam)) {
			toast('Format jam tidak valid (HH:mm)', 'warning');
			return;
		}
		void applyNavigation((params) => {
			params.set('simHari', simulasiHari);
			params.set('simJam', simulasiJam);
		});
	}

	function resetSimulasi() {
		void applyNavigation((params) => {
			params.delete('simHari');
			params.delete('simJam');
		});
		showSimulasi = false;
	}

	function handleModeChange(mode: PresensiMode = selectedMode) {
		selectedMode = mode;
		void applyNavigation((params) => {
			if (mode === 'bulanan') {
				params.set('mode', 'bulanan');
				params.set('bulan', String(selectedBulan));
				params.set('tahun', String(selectedTahun));
				params.delete('tanggal');
			} else if (mode === 'persentase_bulanan') {
				params.set('mode', 'persentase_bulanan');
				params.set('bulan', String(selectedBulan));
				params.set('tahun', String(selectedTahun));
				params.delete('tanggal');
			} else if (mode === 'persentase_semester') {
				params.set('mode', 'persentase_semester');
				params.delete('bulan');
				params.delete('tahun');
				params.delete('tanggal');
			} else if (mode === 'rapor') {
				params.set('mode', 'rapor');
				params.delete('bulan');
				params.delete('tahun');
				params.delete('tanggal');
			} else if (mode === 'persentase_harian') {
				params.set('mode', 'persentase_harian');
				params.delete('bulan');
				params.delete('tahun');
			} else {
				params.set('mode', 'harian');
				params.delete('bulan');
				params.delete('tahun');
			}
			params.delete('page');
			const cleaned = searchTerm.trim();
			if (cleaned) {
				params.set('q', cleaned);
			} else {
				params.delete('q');
			}
		});
	}

	function viewDate() {
		// Terapkan mode yang sedang dipilih di dropdown + tanggal/bulan yang
		// diisi, sehingga perubahan mode tetap berlaku saat tombol "Lihat
		// presensi" diklik (tidak hanya mengandalkan onchange).
		void applyNavigation((params) => {
			params.set('mode', selectedMode);
			params.delete('page');
			if (selectedMode === 'bulanan' || selectedMode === 'persentase_bulanan') {
				params.set('bulan', String(selectedBulan));
				params.set('tahun', String(selectedTahun));
				params.delete('tanggal');
			} else if (selectedMode === 'rapor' || selectedMode === 'persentase_semester') {
				params.delete('bulan');
				params.delete('tahun');
				params.delete('tanggal');
			} else {
				params.set('tanggal', selectedTanggal);
				params.delete('bulan');
				params.delete('tahun');
			}
			const cleaned = searchTerm.trim();
			if (cleaned) {
				params.set('q', cleaned);
			} else {
				params.delete('q');
			}
		});
	}

	function resetToToday() {
		void applyNavigation((params) => {
			params.delete('tanggal');
			params.delete('page');
			params.delete('q');
		});
	}

	const isCurrentBulan = $derived.by(() => {
		if (data.mode !== 'bulanan' && data.mode !== 'persentase_bulanan') return false;
		return (
			data.bulan === serverTime.now.getMonth() + 1 && data.tahun === serverTime.now.getFullYear()
		);
	});

	function resetToCurrentBulan() {
		void applyNavigation((params) => {
			params.set('mode', data.mode);
			params.set('bulan', String(serverTime.now.getMonth() + 1));
			params.set('tahun', String(serverTime.now.getFullYear()));
			params.delete('page');
			params.delete('tanggal');
			params.delete('q');
		});
	}

	function openDownloadRekap() {
		let actions: { download: () => Promise<void>; cancel: () => void };
		showModal({
			title: 'Download Rekap Kehadiran',
			body: DownloadRekapModal,
			bodyProps: {
				onAction: (a: { download: () => Promise<void>; cancel: () => void }) => {
					actions = a;
				}
			},
			onPositive: {
				label: 'Download',
				action: () => actions.download()
			},
			onNegative: {
				label: 'Batal'
			},
			dismissible: true
		});
	}

	function presensiNotReady() {
		showModal({
			title: 'Pengaturan Presensi',
			body: data.presensiWarningMessage,
			onPositive: {
				label: 'Atur sekarang',
				class: 'btn-primary',
				action: ({ close }) => {
					close();
					goto('/akademik');
				}
			},
			onNeutral: {
				label: 'Tutup'
			},
			dismissible: true
		});
	}

	const isGuruMapelMode = $derived(
		page.data.user?.type === 'user' && data.jenisPresensi === 'tiap_mapel' && !isWaliOwnClass
	);

	const jadwalBelumDimulai = $derived(false);

	function formatTanggal(dateStr: string) {
		const d = new Date(dateStr + 'T00:00:00');
		const hari = hariList[d.getDay()];
		const tgl = d.getDate();
		const bln = bulanList[d.getMonth()];
		const thn = d.getFullYear();
		return `${hari}, ${tgl} ${bln} ${thn}`;
	}

	function openDeleteConfirm() {
		showModal({
			title: 'Hapus Data Presensi',
			body: HapusPresensiModal,
			bodyProps: {
				tanggal: data.tanggal,
				labelTanggal: formatTanggal(data.tanggal),
				kelasId: kelasAktif?.id ?? undefined
			},
			dismissible: true
		});
	}
</script>

{#if !data.tableReady}
	<div
		class="mb-5 flex items-center gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
	>
		<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
		<span>
			Tabel ketidakhadiran harian belum tersedia. Jalankan <strong>pnpm db:push</strong> untuk menerapkan
			migrasi terbaru.
		</span>
	</div>
{/if}

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4 max-sm:flex-col sm:flex-row dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				{#if data.mode === 'bulanan'}
					Kehadiran murid bulan:
					<span class="text-blue-600 dark:text-blue-400"
						>{bulanList[data.bulan - 1]} {data.tahun}</span
					>
				{:else if data.mode === 'persentase_bulanan'}
					Persentase Kehadiran bulan:
					<span class="text-blue-600 dark:text-blue-400"
						>{bulanList[data.bulan - 1]} {data.tahun}</span
					>
				{:else if data.mode === 'persentase_semester'}
					Persentase Kehadiran Semester
					{#if data.tanggalMulaiRapor && data.tanggalAkhirRapor}
						:
						<span class="text-blue-600 dark:text-blue-400">
							{formatTanggal(data.tanggalMulaiRapor)} - {formatTanggal(data.tanggalAkhirRapor)}
						</span>
					{/if}
				{:else if data.mode === 'rapor'}
					Rekap Kehadiran Rapor
					{#if data.tanggalMulaiRapor && data.tanggalAkhirRapor}
						:
						<span class="text-blue-600 dark:text-blue-400">
							{formatTanggal(data.tanggalMulaiRapor)} - {formatTanggal(data.tanggalAkhirRapor)}
						</span>
					{/if}
				{:else if data.mode === 'persentase_harian'}
					Persentase Kehadiran per Mapel:
					<span class="text-blue-600 dark:text-blue-400">{formatTanggal(data.tanggal)}</span>
				{:else if isToday}
					Kehadiran murid hari ini:
					<span class="text-blue-600 dark:text-blue-400">{formatTanggal(data.tanggal)}</span>
				{:else}
					Kehadiran murid:
					<span class="text-blue-600 dark:text-blue-400">{formatTanggal(data.tanggal)}</span>
				{/if}
			</h1>
			{#if kelasAktifLabel}
				<p class="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">
					{kelasAktifLabel}
					{#if data.mode === 'harian' || data.mode === 'persentase_harian'}
						· {data.isLibur ? 'Libur' : 'Masuk'}
					{/if}
				</p>
			{/if}
		</div>
		{#if data.mode === 'rapor' || data.mode === 'persentase_bulanan' || data.mode === 'persentase_semester' || data.mode === 'bulanan'}{:else}
			{@const currentMapel = data.jadwalSaatIni}
			<div class="inline-flex max-sm:w-full">
				<button
					type="button"
					class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-l-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
					disabled={!canEdit && page.data.user?.type !== 'user'}
					aria-disabled={!canEdit && page.data.user?.type !== 'user'}
					title={!canEdit && page.data.user?.type !== 'user'
						? 'Anda tidak memiliki izin untuk mengisi sekaligus'
						: ''}
					onclick={() => {
						if (!data.presensiReady) {
							presensiNotReady();
							return;
						}
						if (jadwalBelumDimulai) {
							toast({ message: 'Jam pelajaran bapak/ibu belum dimulai', type: 'warning' });
							return;
						}
						if (page.data.user?.type === 'user' && !data.isMapelOnJadwal) {
							toast({
								message: 'Mata pelajaran tidak dijadwalkan pada tanggal ini',
								type: 'warning'
							});
							return;
						}
						const useMapelData = page.data.user?.type === 'user';
						const fallbackSubject = data.guruMapelSubject;
						const isiMapelId = useMapelData
							? (currentMapel?.mataPelajaranId ?? fallbackSubject?.id ?? null)
							: (data.harianMapelId ?? null);
						showModal({
							title: 'Isi Kehadiran Sekaligus',
							body: IsiSekaligusModal,
							bodyProps: {
								daftarMurid: data.semuaMurid,
								kelasId: kelasAktif?.id ?? undefined,
								tanggal: data.tanggal,
								mataPelajaranId: isiMapelId,
								namaMataPelajaran: useMapelData
									? (currentMapel?.namaMataPelajaran ?? fallbackSubject?.nama ?? undefined)
									: undefined,
								perkiraanJam: useMapelData ? (currentMapel?.perkiraanJam ?? undefined) : undefined,
								simulasiHari: data.simulasiHari,
								simulasiJam: data.simulasiJam,
								tipePresensi: data.tipePresensi,
								jenisPresensi: data.jenisPresensi
							},
							dismissible: true
						});
					}}
				>
					<Icon name="copy" class="h-4 w-4" /> Isi Sekaligus
				</button>
				<div class="dropdown dropdown-end max-sm:flex-none">
					<button
						type="button"
						tabindex="0"
						aria-label="Opsi simulasi"
						class="inline-flex h-9 items-center justify-center rounded-r-xl border-l border-blue-700 bg-blue-600 px-2.5 text-white transition-colors hover:bg-blue-700 dark:border-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</button>
					<ul
						tabindex="-1"
						class="dropdown-content menu z-50 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
					>
						<li>
							<button
								type="button"
								class="w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800 {simActive
									? 'font-semibold text-amber-700 dark:text-amber-400'
									: 'text-slate-700 dark:text-zinc-200'}"
								aria-label="Simulasi hari & jam"
								title={simActive
									? `Simulasi: ${data.simulasiHari} ${data.simulasiJam}`
									: 'Simulasi hari & jam'}
								onclick={() => (showSimulasi = !showSimulasi)}
							>
								<Icon name={simActive ? 'pause' : 'play'} class="h-4 w-4" />
								Simulasi
							</button>
						</li>
					</ul>
				</div>
			</div>
		{/if}
	</div>

	<div
		class="mb-4 flex items-start justify-between gap-2 max-sm:flex-col sm:flex-row sm:items-center"
	>
		<div class="flex flex-wrap items-center gap-1.5 max-sm:w-full">
			<div class="flex flex-wrap items-center gap-1.5 max-sm:w-full">
				{#if data.mode === 'bulanan' || data.mode === 'persentase_bulanan'}
					<div class="relative flex min-w-36 flex-1 items-center">
						<select
							class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							bind:value={selectedBulan}
						>
							{#each bulanList as nama, i (nama)}
								<option value={i + 1}>{nama}</option>
							{/each}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
					<input
						type="number"
						class="h-9 w-24 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={selectedTahun}
						min="2000"
						max="2099"
					/>
				{:else if data.mode === 'rapor'}
					<span
						class="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
					>
						{data.tanggalMulaiRapor && data.tanggalAkhirRapor
							? `${formatTanggal(data.tanggalMulaiRapor)} - ${formatTanggal(data.tanggalAkhirRapor)}`
							: 'Rentang tanggal tidak tersedia'}
					</span>
				{:else if data.mode === 'persentase_semester'}
					<span
						class="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
					>
						{data.tanggalMulaiRapor && data.tanggalAkhirRapor
							? `${formatTanggal(data.tanggalMulaiRapor)} - ${formatTanggal(data.tanggalAkhirRapor)}`
							: 'Rentang tanggal tidak tersedia'}
					</span>
				{:else if data.mode === 'persentase_harian'}
					<input
						type="date"
						class="h-9 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none max-sm:flex-1 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={selectedTanggal}
					/>
				{:else}
					<input
						type="date"
						class="h-9 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none max-sm:flex-1 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={selectedTanggal}
					/>
				{/if}
				<button
					type="button"
					class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
					aria-label="Lihat presensi"
					title="Lihat presensi"
					onclick={viewDate}
					disabled={data.mode === 'rapor' || data.mode === 'persentase_semester'}
				>
					<Icon name="eye" class="h-4 w-4" />
				</button>
				<button
					type="button"
					class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
					aria-label={data.mode === 'bulanan' || data.mode === 'persentase_bulanan'
						? 'Kembali ke bulan ini'
						: 'Kembali ke hari ini'}
					title={data.mode === 'bulanan' || data.mode === 'persentase_bulanan'
						? 'Kembali ke bulan ini'
						: 'Kembali ke hari ini'}
					onclick={data.mode === 'bulanan' || data.mode === 'persentase_bulanan'
						? resetToCurrentBulan
						: resetToToday}
					disabled={data.mode === 'bulanan' || data.mode === 'persentase_bulanan'
						? isCurrentBulan
						: data.mode === 'rapor' || data.mode === 'persentase_semester'
							? true
							: isToday}
				>
					<Icon name="repeat" class="h-4 w-4" />
				</button>
				<button
					type="button"
					class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
					aria-label="Hapus data presensi"
					aria-disabled={data.mode === 'bulanan' ||
						data.mode === 'persentase_bulanan' ||
						data.mode === 'rapor' ||
						data.mode === 'persentase_semester' ||
						data.mode === 'persentase_harian' ||
						!canEdit ||
						isGuruMapelMode}
					title={isGuruMapelMode
						? 'Guru mapel tidak dapat menghapus presensi'
						: data.mode === 'bulanan'
							? 'Tidak dapat menghapus dalam mode bulanan'
							: data.mode === 'persentase_bulanan'
								? 'Tidak dapat menghapus dalam mode persentase bulanan'
								: data.mode === 'rapor'
									? 'Tidak dapat menghapus dalam mode rapor'
									: data.mode === 'persentase_semester'
										? 'Tidak dapat menghapus dalam mode persentase semester'
										: data.mode === 'persentase_harian'
											? 'Tidak dapat menghapus dalam mode persentase harian'
											: !canEdit
												? 'Anda tidak memiliki izin untuk menghapus presensi'
												: 'Hapus data presensi tanggal ini'}
					onclick={openDeleteConfirm}
					disabled={data.mode === 'bulanan' ||
						data.mode === 'persentase_bulanan' ||
						data.mode === 'rapor' ||
						data.mode === 'persentase_semester' ||
						data.mode === 'persentase_harian' ||
						!canEdit ||
						isGuruMapelMode}
				>
					<Icon name="del" class="h-4 w-4" />
				</button>
			</div>
		</div>
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 max-sm:w-full sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			onclick={openDownloadRekap}
		>
			<Icon name="download" class="h-4 w-4" />
			Download Rekap (.xlsx)
		</button>
	</div>

	{#if showSimulasi}
		<div
			class="mb-4 rounded-xl border border-slate-200 bg-slate-50/85 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50"
		>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
				<label class="flex flex-col gap-1 sm:flex-1">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Hari</span>
					<div class="relative flex items-center">
						<select
							class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							bind:value={simulasiHari}
						>
							{#each ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as h (h)}
								<option>{h}</option>
							{/each}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
				</label>
				<label class="flex flex-col gap-1 sm:flex-1">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Jam</span>
					<input
						type="text"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={simulasiJam}
						pattern="[0-9]{2}:[0-9]{2}"
						inputmode="numeric"
						placeholder="HH:mm"
					/>
				</label>
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
					onclick={applySimulasi}
				>
					<Icon name="play" class="h-3.5 w-3.5" /> Terapkan
				</button>
				{#if simActive}
					<button
						type="button"
						class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
						onclick={resetSimulasi}
					>
						Reset
					</button>
				{:else}
					<button
						type="button"
						class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
						onclick={() => (showSimulasi = false)}
					>
						Tutup
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<form
		class="flex flex-col gap-2 sm:flex-row sm:items-center"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
		autocomplete="off"
		spellcheck="false"
		onsubmit={submitSearch}
	>
		<div class="relative flex-1">
			<span
				class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
			>
				<Icon name="search" class="h-4 w-4" />
			</span>
			<input
				type="search"
				name="q"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				value={searchTerm}
				placeholder="Cari nama murid..."
				oninput={handleSearchInput}
				autocomplete="off"
			/>
		</div>
		<div class="relative flex items-center sm:w-52">
			<select
				class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={selectedMode}
				title="Pilih mode presensi"
				onchange={(event) =>
					handleModeChange((event.currentTarget as HTMLSelectElement).value as PresensiMode)}
			>
				<option value="harian">Harian</option>
				<option value="bulanan">Bulanan</option>
				{#if data.jenisPresensi === 'tiap_mapel'}
					<option value="persentase_harian">Persentase Harian</option>
				{/if}
				<option value="persentase_bulanan">Persentase Bulanan</option>
				<option value="persentase_semester">Persentase Semester</option>
				<option value="rapor">Rapor</option>
			</select>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
			>
				<Icon name="down" class="h-3.5 w-3.5" />
			</span>
		</div>
	</form>

	{#if canBulkSelect && bulkCount > 0}
		<div
			class="mt-4 flex flex-col gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 p-3 sm:flex-row sm:items-center dark:border-blue-900/60 dark:bg-blue-950/30"
		>
			<span class="text-xs font-semibold text-blue-950 tabular-nums dark:text-blue-200">
				{bulkCount} murid dipilih
			</span>
			<label class="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300">
				<span>Masuk</span>
				<div class="relative flex items-center">
					<select
						class="h-8 w-28 appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={bulkMasuk}
						disabled={bulkSubmitting}
						title="Status masuk untuk murid terpilih"
					>
						<option value="">Hadir</option>
						<option value="sakit">Sakit</option>
						<option value="izin">Izin</option>
						<option value="alfa">TK</option>
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3 w-3" />
					</span>
				</div>
			</label>
			{#if showBulkPulang}
				<label
					class="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300"
				>
					<span>Pulang</span>
					<div class="relative flex items-center">
						<select
							class="h-8 w-28 appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							bind:value={bulkPulang}
							disabled={bulkSubmitting}
							title="Status pulang untuk murid terpilih"
						>
							<option value="">Hadir</option>
							<option value="sakit">Sakit</option>
							<option value="izin">Izin</option>
							<option value="alfa">TK</option>
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3 w-3" />
						</span>
					</div>
				</label>
			{/if}
			<div class="flex gap-2 sm:ml-auto">
				<button
					type="button"
					class="inline-flex h-8 items-center rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
					onclick={clearSelection}
					disabled={bulkSubmitting}
				>
					Batal pilihan
				</button>
				<FormEnhance
					id={bulkFormId}
					action="?/simpanMassal"
					submitStateChange={(value) => (bulkSubmitting = value)}
					onsuccess={handleBulkSuccess}
					showToast
				>
					<input type="hidden" name="tanggal" value={data.tanggal} />
					<input type="hidden" name="kelasId" value={kelasAktif?.id ?? ''} />
					<input type="hidden" name="mataPelajaranId" value={data.harianMapelId ?? ''} />
					<input type="hidden" name="muridIds" value={muridIdsPayload} />
					<input type="hidden" name="masuk" value={bulkMasuk} />
					<input type="hidden" name="pulang" value={showBulkPulang ? bulkPulang : ''} />
				</FormEnhance>
				<button
					type="submit"
					form={bulkFormId}
					class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
					disabled={bulkSubmitting}
				>
					{#if bulkSubmitting}
						<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
					{/if}
					Simpan Massal
				</button>
			</div>
		</div>
	{/if}

	{#if !hasMurid}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Belum ada murid di kelas ini. Tambahkan murid terlebih dahulu.</span>
		</div>
	{:else if (data.mode === 'persentase_harian' || data.mode === 'persentase_bulanan') && !data.presensiReady && data.presensiWarningMessage}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>{data.presensiWarningMessage}</span>
		</div>
	{:else if !hasFilteredMurid}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/80 px-4 py-3 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
			<span>Tidak ada murid yang cocok dengan pencarian.</span>
		</div>
	{:else if data.mode === 'rapor' && !data.presensiReady && data.presensiWarningMessage}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>{data.presensiWarningMessage}</span>
		</div>
	{:else if data.mode === 'rapor' && (!data.tanggalMulaiRapor || !data.tanggalAkhirRapor)}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>
				Tanggal masuk semester atau tanggal bagi rapor belum diatur. Atur di halaman /akademik.
			</span>
		</div>
	{:else if data.mode === 'persentase_semester' && !data.presensiReady && data.presensiWarningMessage}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>{data.presensiWarningMessage}</span>
		</div>
	{:else if data.mode === 'persentase_semester' && (!data.tanggalMulaiRapor || !data.tanggalAkhirRapor)}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>
				Tanggal masuk semester atau tanggal bagi rapor belum diatur. Atur di halaman /akademik.
			</span>
		</div>
	{:else if data.mode === 'bulanan'}
		<TableBulanan
			rows={data.bulananRows}
			daysInMonth={data.daysInMonth}
			redDays={data.redDays}
			search={data.page.search}
		/>
		<AbsenPagination {pages} {currentPage} onPageClick={handlePageClick} />
	{:else if data.mode === 'rapor'}
		<TableRapor
			rows={data.raporRows}
			search={data.page.search}
			{canEdit}
			tableReady={data.tableReady}
			editingRowId={raporEditingRowId}
			editingValues={raporEditingValues}
			editingSubmitting={raporEditingSubmitting}
			editingSaveDisabled={raporEditingSaveDisabled}
			totalHariBelajar={data.totalHariBelajar}
			onStartEdit={startRaporEdit}
			onCancelEdit={cancelRaporEdit}
			onEditValueChange={(v) => (raporEditingValues = v)}
			onUpdateSuccess={handleRaporUpdateSuccess}
			onSubmitStateChange={(v) => (raporEditingSubmitting = v)}
		/>
		<AbsenPagination {pages} {currentPage} onPageClick={handlePageClick} />
	{:else if data.mode === 'persentase_bulanan'}
		<TablePersentaseBulanan
			rows={data.persentaseBulananRows}
			namaBulan={bulanList[data.bulan - 1] ?? ''}
			totalHariBelajar={data.totalHariBelajar}
			jenisPresensi={data.jenisPresensi}
			tipePresensi={data.tipePresensi}
			totalPertemuan={data.totalPertemuan}
		/>
		<AbsenPagination {pages} {currentPage} onPageClick={handlePageClick} />
	{:else if data.mode === 'persentase_harian'}
		<TablePersentaseHarian
			subjects={data.persentaseHarianSubjects}
			rows={data.persentaseHarianRows}
			tipePresensi={data.tipePresensi}
		/>
	{:else if data.mode === 'persentase_semester'}
		<TablePersentaseSemester
			rows={data.persentaseSemesterRows}
			tanggalMulai={data.tanggalMulaiRapor}
			tanggalAkhir={data.tanggalAkhirRapor}
			totalHariBelajar={data.totalHariBelajar}
			jenisPresensi={data.jenisPresensi}
			tipePresensi={data.tipePresensi}
			totalPertemuan={data.totalPertemuan}
		/>
		<AbsenPagination {pages} {currentPage} onPageClick={handlePageClick} />
	{:else}
		<TableHarian
			rows={data.daftarMurid}
			search={data.page.search}
			{canEdit}
			tableReady={data.tableReady}
			tanggal={data.tanggal}
			kelasId={kelasAktif?.id ?? null}
			{editingRowId}
			{editingValues}
			{editingSubmitting}
			onStartEdit={startEdit}
			onCancelEdit={cancelEdit}
			onEditValueChange={(v) => (editingValues = v)}
			onUpdateSuccess={handleUpdateSuccess}
			onSubmitStateChange={(v) => (editingSubmitting = v)}
			jenisPresensi={data.jenisPresensi}
			tipePresensi={data.tipePresensi}
			harianMapelId={data.harianMapelId}
			selectable={canBulkSelect}
			selectedIds={selectedMuridIds}
			onToggleSelect={toggleSelectMurid}
			onToggleAll={toggleSelectAll}
		/>
		<AbsenPagination {pages} {currentPage} onPageClick={handlePageClick} />
	{/if}
</div>

<style>
	:global(form#bulk-presensi-massal-form) {
		display: contents;
	}
</style>
