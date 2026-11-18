<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import { onDestroy } from 'svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';
	import PresensiGuruEditModal from '$lib/components/presensi-guru/presensi-guru-edit-modal.svelte';
	import PresensiGuruDetailBody from '$lib/components/presensi-guru/presensi-guru-detail-body.svelte';
	import TablePresensiGuruBulanan from '$lib/components/presensi-guru/table-presensi-guru-bulanan.svelte';
	import { searchQueryMarker, signatureDisplaySrc } from '$lib/utils';

	type RecapRow = {
		no: number;
		userId: number;
		nama: string;
		status: string | null;
		waktu: string | null;
		tandaTangan: string | null;
		keterangan: string | null;
	};

	type BulananRow = {
		no: number;
		userId: number;
		nama: string;
		statusPerDay: Array<'hadir' | 'izin' | 'sakit' | 'dinas_luar' | 'cuti' | 'belum' | ''>;
		countHadir: number;
		countIzin: number;
		countSakit: number;
		countDinasLuar: number;
		countCuti: number;
		countBelum: number;
	};

	type PageState = {
		search: string | null;
		currentPage: number;
		totalPages: number;
	};

	type PageData = {
		mode: 'harian' | 'bulanan';
		rows: RecapRow[] | BulananRow[];
		page: PageState;
		guruCount: number;
		tanggal: string;
		bulan: number;
		tahun: number;
		daysInMonth: number;
		redDays: number[];
		totalHariBelajar: number;
		jamMasuk: string | null;
		jamPulang: string | null;
		isLibur: boolean;
		disabled?: boolean;
	};

	let { data }: { data: PageData } = $props();

	const STATUS_META: Record<string, { label: string; class: string }> = {
		hadir: {
			label: 'Hadir',
			class:
				'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
		},
		izin: {
			label: 'Izin',
			class:
				'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300'
		},
		sakit: {
			label: 'Sakit',
			class:
				'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'
		},
		dinas_luar: {
			label: 'Dinas Luar',
			class:
				'border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/50 dark:text-indigo-300'
		},
		cuti: {
			label: 'Cuti',
			class:
				'border-purple-200/80 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/50 dark:text-purple-300'
		}
	};

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

	function formatTanggal(dateStr: string) {
		const d = new Date(dateStr + 'T00:00:00');
		return `${hariList[d.getDay()]}, ${d.getDate()} ${bulanList[d.getMonth()]} ${d.getFullYear()}`;
	}

	function localDateString() {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
			d.getDate()
		).padStart(2, '0')}`;
	}

	// svelte-ignore state_referenced_locally
	let selectedMode = $state<'harian' | 'bulanan'>(data.mode);
	// svelte-ignore state_referenced_locally
	let selectedTanggal = $state(data.tanggal);
	// svelte-ignore state_referenced_locally
	let selectedBulan = $state(data.mode === 'bulanan' ? data.bulan : new Date().getMonth() + 1);
	// svelte-ignore state_referenced_locally
	let selectedTahun = $state(data.mode === 'bulanan' ? data.tahun : new Date().getFullYear());

	$effect(() => {
		if (data.tanggal) {
			selectedTanggal = data.tanggal;
		}
	});

	$effect(() => {
		if (data.mode === 'bulanan') {
			selectedBulan = data.bulan;
			selectedTahun = data.tahun;
		}
	});

	async function applyNavigation(mutate: (params: SvelteURLSearchParams) => void) {
		const params = new SvelteURLSearchParams(page.url.search);
		mutate(params);
		const query = params.toString();
		const nextUrl = `${page.url.pathname}${query ? `?${query}` : ''}`;
		await goto(nextUrl, { replaceState: true, keepFocus: true });
	}

	function handleModeChange() {
		void applyNavigation((params) => {
			if (selectedMode === 'bulanan') {
				params.set('mode', 'bulanan');
				params.set('bulan', String(selectedBulan));
				params.set('tahun', String(selectedTahun));
				params.delete('tanggal');
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
		if (data.mode === 'bulanan') {
			void applyNavigation((params) => {
				params.set('mode', 'bulanan');
				params.set('bulan', String(selectedBulan));
				params.set('tahun', String(selectedTahun));
				params.delete('page');
				params.delete('q');
			});
		} else {
			void applyNavigation((params) => {
				params.set('tanggal', selectedTanggal);
				params.delete('page');
				params.delete('q');
			});
		}
	}

	function resetToToday() {
		void applyNavigation((params) => {
			params.delete('tanggal');
			params.delete('page');
			params.delete('q');
		});
	}

	function resetToCurrentBulan() {
		void applyNavigation((params) => {
			params.set('mode', 'bulanan');
			params.set('bulan', String(new Date().getMonth() + 1));
			params.set('tahun', String(new Date().getFullYear()));
			params.delete('page');
			params.delete('tanggal');
			params.delete('q');
		});
	}

	const isToday = $derived(data.tanggal === localDateString());

	const isCurrentBulan = $derived.by(() => {
		if (data.mode !== 'bulanan') return false;
		return data.bulan === new Date().getMonth() + 1 && data.tahun === new Date().getFullYear();
	});

	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.page.search ?? '');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (searchTimer) return;
		const latestSearchTerm = data.page.search ?? '';
		if (searchTerm !== latestSearchTerm) {
			searchTerm = latestSearchTerm;
		}
	});

	function buildSearchUrl(rawValue: string) {
		const params = new SvelteURLSearchParams(page.url.search);
		const cleaned = rawValue.trim();
		const current = params.get('q') ?? '';
		const searchChanged = cleaned !== current;
		if (cleaned) {
			params.set('q', cleaned);
		} else {
			params.delete('q');
		}
		if (searchChanged) {
			params.delete('page');
		}
		const nextQuery = params.toString();
		const nextUrl = `${page.url.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
		const currentUrl = `${page.url.pathname}${page.url.search}`;
		if (nextUrl === currentUrl) {
			return null;
		}
		return nextUrl;
	}

	async function applySearch(rawValue: string) {
		const target = buildSearchUrl(rawValue);
		if (!target) return;
		searchTimer = undefined;
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
			void applySearch(value);
		}, 400);
	}

	function submitSearch(event: Event) {
		event.preventDefault();
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
		searchTimer = undefined;
		void applySearch(searchTerm);
	}

	function buildPageUrl(pageNumber: number) {
		const params = new SvelteURLSearchParams(page.url.search);
		const sanitized = pageNumber < 1 ? 1 : pageNumber;
		if (sanitized <= 1) {
			params.delete('page');
		} else {
			params.set('page', String(sanitized));
		}
		const nextQuery = params.toString();
		const nextUrl = `${page.url.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
		const currentUrl = `${page.url.pathname}${page.url.search}`;
		if (nextUrl === currentUrl) {
			return null;
		}
		return nextUrl;
	}

	async function gotoPage(pageNumber: number) {
		const target = buildPageUrl(pageNumber);
		if (!target) return;
		await goto(target, { replaceState: true, keepFocus: true });
	}

	function handlePageClick(pageNumber: number) {
		if (pageNumber === currentPage) return;
		void gotoPage(pageNumber);
	}

	const currentPage = $derived.by(() => data.page?.currentPage ?? 1);
	const totalPages = $derived.by(() => Math.max(1, data.page?.totalPages ?? 1));
	const pages = $derived.by(() => Array.from({ length: totalPages }, (_, index) => index + 1));

	function openEdit(row: RecapRow) {
		showModal({
			title: `Ubah Presensi - ${row.nama}`,
			body: PresensiGuruEditModal,
			bodyProps: {
				userId: row.userId,
				nama: row.nama,
				tanggal: data.tanggal,
				tanggalJam: page.url.searchParams.get('tanggal-jam'),
				initialStatus: row.status,
				initialTandaTangan: signatureDisplaySrc(row.tandaTangan),
				initialKeterangan: row.keterangan
			},
			dismissible: true
		});
	}

	function viewDetail(row: RecapRow) {
		const statusMeta = row.status
			? (STATUS_META[row.status] ?? { label: row.status, class: '' })
			: null;

		showModal({
			title: `Detail Presensi - ${row.nama}`,
			body: PresensiGuruDetailBody,
			bodyProps: {
				nama: row.nama,
				tanggal: data.tanggal,
				status: row.status,
				statusLabel: statusMeta?.label ?? null,
				statusClass: statusMeta?.class ?? '',
				waktu: row.waktu,
				keterangan: row.keterangan,
				tandaTangan: signatureDisplaySrc(row.tandaTangan)
			},
			dismissible: true,
			onNeutral: { label: 'Tutup' }
		});
	}

	onDestroy(() => {
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
		searchTimer = undefined;
	});
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	{#if data.disabled}
		<div
			class="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="warning" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>
				Fitur presensi guru sedang dinonaktifkan. Aktifkan kembali melalui
				<strong>Akademik &gt; Pengaturan Presensi</strong> untuk menggunakan halaman ini.
			</span>
		</div>
	{:else}
		<div
			class="mb-4 flex items-start justify-between gap-2 border-b border-slate-100 pb-4 max-sm:flex-col sm:flex-row dark:border-zinc-800"
		>
			<div>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Presensi Guru ·
					<span class="text-blue-600 dark:text-blue-400">
						{#if data.mode === 'bulanan'}
							{bulanList[data.bulan - 1]} {data.tahun}
						{:else}
							{formatTanggal(data.tanggal)}
						{/if}
					</span>
				</h1>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					{#if data.mode === 'bulanan'}
						{data.guruCount} guru
						{#if data.totalHariBelajar > 0}
							· {data.totalHariBelajar} hari belajar
						{/if}
					{:else}
						{data.guruCount} guru
						{#if data.jamMasuk && data.jamPulang}
							· jam presensi {data.jamMasuk} - {data.jamPulang}
						{/if}
						· {data.isLibur ? 'Libur' : 'Masuk'}
					{/if}
				</p>
			</div>
		</div>

		<div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex flex-wrap items-center gap-2 max-sm:w-full">
				{#if data.mode === 'bulanan'}
					<div class="relative flex min-w-36 flex-1 items-center sm:flex-none">
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
						class="h-9 w-24 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={selectedTahun}
						min="2000"
						max="2099"
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
					class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					aria-label="Lihat presensi"
					title="Lihat presensi"
					onclick={viewDate}
				>
					<Icon name="eye" class="h-4 w-4" />
				</button>
				<button
					type="button"
					class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					aria-label={data.mode === 'bulanan' ? 'Kembali ke bulan ini' : 'Kembali ke hari ini'}
					title={data.mode === 'bulanan' ? 'Kembali ke bulan ini' : 'Kembali ke hari ini'}
					onclick={data.mode === 'bulanan' ? resetToCurrentBulan : resetToToday}
					disabled={data.mode === 'bulanan' ? isCurrentBulan : isToday}
					aria-disabled={data.mode === 'bulanan' ? isCurrentBulan : isToday}
				>
					<Icon name="repeat" class="h-4 w-4" />
				</button>
			</div>

			<form
				class="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap max-sm:w-full"
				data-sveltekit-keepfocus
				data-sveltekit-replacestate
				autocomplete="off"
				spellcheck="false"
				onsubmit={submitSearch}
			>
				<div class="relative flex min-w-0 grow items-center">
					<span
						aria-hidden="true"
						class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
					>
						<Icon name="search" class="h-3.5 w-3.5" />
					</span>
					<input
						type="search"
						name="q"
						value={searchTerm}
						placeholder="Cari nama guru..."
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						oninput={handleSearchInput}
						autocomplete="off"
					/>
				</div>
				<div class="relative flex shrink-0 items-center">
					<select
						class="h-9 w-28 appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						value={selectedMode}
						title="Pilih mode presensi"
						onchange={(e) => {
							selectedMode = (e.currentTarget as HTMLSelectElement).value as 'harian' | 'bulanan';
							handleModeChange();
						}}
					>
						<option value="harian">Harian</option>
						<option value="bulanan">Bulanan</option>
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</div>
			</form>
		</div>

		{#if data.guruCount === 0}
			<div
				class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
			>
				<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
				<span>Belum ada guru terdaftar di sekolah ini.</span>
			</div>
		{:else if !data.rows.length}
			<div
				class="mt-5 flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
			>
				<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<span>Tidak ada guru yang cocok dengan pencarian.</span>
			</div>
		{:else if data.mode === 'bulanan'}
			<TablePresensiGuruBulanan
				rows={data.rows as BulananRow[]}
				daysInMonth={data.daysInMonth}
				redDays={data.redDays}
				search={data.page.search}
			/>
		{:else}
			{@const harianRows = data.rows as RecapRow[]}
			<div
				class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<table class="w-full border-collapse text-xs">
					<thead>
						<tr
							class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
						>
							<th class="w-12 px-3.5 py-2.5">No</th>
							<th class="min-w-44 px-3.5 py-2.5">Nama Guru</th>
							<th class="min-w-28 px-3.5 py-2.5">Status</th>
							<th class="min-w-20 px-3.5 py-2.5">Jam</th>
							<th class="w-28 px-3.5 py-2.5 text-center">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
						{#each harianRows as row (row.userId)}
							{@const statusMeta = row.status
								? (STATUS_META[row.status] ?? {
										label: row.status,
										class:
											'border-slate-200/80 bg-slate-100 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
									})
								: null}
							<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
								<td class="px-3.5 py-2.5 text-slate-500 dark:text-zinc-400">{row.no}</td>
								<td class="px-3.5 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
									{@html searchQueryMarker(data.page.search, row.nama)}
								</td>
								<td class="px-3.5 py-2.5">
									{#if statusMeta}
										<span
											class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {statusMeta.class}"
											>{statusMeta.label}</span
										>
									{:else}
										<span
											class="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
											>Belum presensi</span
										>
									{/if}
								</td>
								<td class="px-3.5 py-2.5 whitespace-nowrap text-slate-600 dark:text-zinc-300">
									{#if row.waktu}
										{new Date(row.waktu).toLocaleTimeString('id-ID', {
											hour: '2-digit',
											minute: '2-digit'
										})}
									{:else}
										<span class="text-slate-400 dark:text-zinc-500">-</span>
									{/if}
								</td>
								<td class="px-3.5 py-2.5 text-center whitespace-nowrap">
									<div class="flex justify-center gap-1.5">
										<button
											type="button"
											class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200/80 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
											aria-label="Ubah presensi"
											title="Ubah presensi"
											onclick={() => openEdit(row)}
										>
											<Icon name="edit" class="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
											aria-label="Lihat detail"
											title="Lihat detail"
											onclick={() => viewDetail(row)}
										>
											<Icon name="eye" class="h-3.5 w-3.5" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if totalPages > 1}
			<div class="mt-4 flex flex-wrap items-center justify-center gap-1.5">
				{#each pages as pageNumber (pageNumber)}
					<button
						type="button"
						class="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold transition-colors {pageNumber ===
						currentPage
							? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
							: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
						onclick={() => handlePageClick(pageNumber)}
						aria-current={pageNumber === currentPage ? 'page' : undefined}
					>
						{pageNumber}
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</section>
