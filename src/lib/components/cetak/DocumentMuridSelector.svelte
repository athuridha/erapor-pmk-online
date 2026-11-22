<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { onDestroy } from 'svelte';
	import { searchQueryMarker } from '$lib/utils';
	import { buildPageNumbers } from '$lib/utils/pagination';
	import PreviewFooter from './PreviewFooter.svelte';

	type DocumentType = 'cover' | 'biodata' | 'rapor' | 'piagam' | 'jurnal-mengajar' | 'buku-tamu';
	type RaporPeriode = 'rts' | 'ras';

	type MuridData = {
		id: number;
		nama: string;
		nis?: string | null;
		nisn?: string | null;
	};

	type PiagamRankingOption = {
		muridId: number;
		nama: string;
		peringkat: number;
		nilaiRataRata: number | null;
	};

	let {
		selectedDocument = $bindable(''),
		selectedTemplate = $bindable<'1' | '2'>('1'),
		selectedRaporPeriode = $bindable<RaporPeriode>('ras'),
		searchTerm = $bindable(''),
		daftarMurid = [],
		piagamRankingOptions = [],
		muridCount: _muridCount = 0,
		documentOptions = [
			{ value: 'cover', label: 'Cover' },
			{ value: 'biodata', label: 'Biodata' },
			{ value: 'rapor', label: 'Rapor' },
			{ value: 'piagam', label: 'Piagam' }
		],
		onBulkDownload,
		onPreviewJurnal = () => {},
		onPreviewBukuTamu = () => {},
		bukuTamuTanggalMulai = $bindable(''),
		bukuTamuTanggalSelesai = $bindable(''),
		downloadDisabled = false,
		downloadLoading = false,
		jurnalTanggalMulai = $bindable(''),
		jurnalTanggalSelesai = $bindable(''),
		showTable = true,
		// preview footer props
		isRaporSelected = false,
		isBiodataSelected = false,
		onBgRefresh = () => {},
		onSetKriteria = () => {},
		kritCukup = 85,
		kritBaik = 95,
		tpMode = 'compact',
		onToggleFullTP = () => {},
		kelasId = null,
		showBgLogo = false,
		onToggleBgLogo = () => {}
	}: {
		selectedDocument: DocumentType | '';
		selectedTemplate: '1' | '2';
		selectedRaporPeriode?: RaporPeriode | '';
		searchTerm: string;
		daftarMurid: MuridData[];
		piagamRankingOptions: PiagamRankingOption[];
		documentOptions?: Array<{ value: DocumentType; label: string }>;
		onBulkDownload: () => void;
		onPreviewJurnal?: () => void;
		onPreviewBukuTamu?: () => void;
		bukuTamuTanggalMulai?: string;
		bukuTamuTanggalSelesai?: string;
		downloadDisabled?: boolean;
		downloadLoading?: boolean;
		jurnalTanggalMulai?: string;
		jurnalTanggalSelesai?: string;
		showTable?: boolean;
		muridCount?: number;
		isRaporSelected?: boolean;
		isBiodataSelected?: boolean;
		onBgRefresh?: () => void;
		onSetKriteria?: (cukup: number | null, baik: number | null) => void;
		kritCukup?: number;
		kritBaik?: number;
		tpMode?: 'compact' | 'full-desc';
		onToggleFullTP?: (value: 'compact' | 'full-desc') => void;
		kelasId?: string | number | null;
		showBgLogo?: boolean;
		onToggleBgLogo?: (value: boolean) => void;
	} = $props();

	const isPiagamSelected = $derived(selectedDocument === 'piagam');
	const isJurnalMengajar = $derived(selectedDocument === 'jurnal-mengajar');
	const isBukuTamu = $derived(selectedDocument === 'buku-tamu');
	const hasMurid = $derived(daftarMurid.length > 0);
	const hasPiagamRankingOptions = $derived(piagamRankingOptions.length > 0);

	function buildMuridPreviewHref(muridId: number): string {
		const doc = selectedDocument || 'cover';
		const params = new URLSearchParams();
		params.set('murid_id', String(muridId));
		if (kelasId != null && String(kelasId).trim() !== '') {
			params.set('kelas_id', String(kelasId));
		}
		if (doc === 'rapor') {
			if (tpMode === 'full-desc') params.set('full_tp', 'desc');
			params.set('krit_cukup', String(kritCukup));
			params.set('krit_baik', String(kritBaik));
			if (selectedRaporPeriode) params.set('rapor_periode', selectedRaporPeriode);
		}
		if (doc === 'piagam') {
			params.set('template', selectedTemplate);
		}
		if (showBgLogo) {
			params.set('bg_logo', '1');
		}
		return `/cetak/${doc}.pdf?${params.toString()}`;
	}

	const jurnalPreviewHref = $derived(
		jurnalTanggalMulai && jurnalTanggalSelesai
			? `/api/pdf/jurnal-mengajar?${new URLSearchParams({ tanggal_mulai: jurnalTanggalMulai, tanggal_selesai: jurnalTanggalSelesai }).toString()}`
			: null
	);
	const bukuTamuPreviewHref = $derived(
		bukuTamuTanggalMulai && bukuTamuTanggalSelesai
			? `/api/pdf/buku-tamu?${new URLSearchParams({ tanggal_mulai: bukuTamuTanggalMulai, tanggal_selesai: bukuTamuTanggalSelesai }).toString()}`
			: null
	);

	const filteredMurid = $derived.by(() => {
		if (!searchTerm.trim()) return daftarMurid;
		const q = searchTerm.trim().toLowerCase();
		return daftarMurid.filter((m) => m.nama.toLowerCase().includes(q));
	});

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let localSearch = $state(searchTerm);

	function handleSearchInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		localSearch = value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchTimer = undefined;
			searchTerm = value;
			currentPage = 1;
		}, 300);
	}

	function submitSearch(event: Event) {
		event.preventDefault();
		if (searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = undefined;
		}
		searchTerm = localSearch;
		currentPage = 1;
	}

	$effect(() => {
		void selectedDocument;
		currentPage = 1;
	});

	onDestroy(() => {
		if (searchTimer) clearTimeout(searchTimer);
	});

	const PER_PAGE = 10;
	let currentPage = $state(1);

	const filteredPiagamOptions = $derived.by(() => {
		if (!searchTerm.trim()) return piagamRankingOptions;
		const q = searchTerm.trim().toLowerCase();
		return piagamRankingOptions.filter((o) => o.nama.toLowerCase().includes(q));
	});

	const showPiagamTable = $derived(isPiagamSelected && hasPiagamRankingOptions);
	const currentItems = $derived(showPiagamTable ? filteredPiagamOptions : filteredMurid);
	const totalPages = $derived(Math.max(1, Math.ceil(currentItems.length / PER_PAGE)));
	const nomorHalaman = $derived(buildPageNumbers(currentPage, totalPages));

	const paginatedMurid = $derived(
		!showPiagamTable
			? (currentItems as MuridData[]).slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)
			: []
	);
	const paginatedPiagam = $derived(
		showPiagamTable
			? (currentItems as PiagamRankingOption[]).slice(
					(currentPage - 1) * PER_PAGE,
					currentPage * PER_PAGE
				)
			: []
	);

	$effect(() => {
		if (currentItems.length > 0 && currentPage > totalPages) {
			currentPage = totalPages;
		}
	});

	function handlePageClick(pageNumber: number) {
		if (pageNumber === currentPage) return;
		currentPage = pageNumber;
	}

	const showMuridTable = $derived(
		!isJurnalMengajar &&
			!isBukuTamu &&
			selectedDocument &&
			((isPiagamSelected && hasPiagamRankingOptions) || (showTable && hasMurid))
	);
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-end">
		<div class="relative flex min-w-0 flex-1 items-center">
			<select
				class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
				bind:value={selectedDocument}
				title="Pilih dokumen yang ingin dipreview"
			>
				<option value="" disabled selected>Pilih dokumen…</option>
				{#each documentOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
			>
				<Icon name="down" class="h-3.5 w-3.5" />
			</span>
		</div>
		{#if isPiagamSelected}
			<div class="relative flex min-w-0 flex-1 items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					bind:value={selectedTemplate}
					title="Pilih template piagam"
				>
					<option value="1">Template 1</option>
					<option value="2">Template 2</option>
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		{/if}
		{#if selectedDocument === 'rapor'}
			<div class="relative flex min-w-0 flex-1 items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					bind:value={selectedRaporPeriode}
					title="Pilih periode rapor"
				>
					<option value="" disabled selected>Pilih periode…</option>
					<option value="ras">Rapor Akhir Semester</option>
					<option value="rts">Rapor Tengah Semester</option>
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		{/if}
		{#if isJurnalMengajar}
			<label class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="text-xs font-semibold text-slate-600 dark:text-zinc-400">Tanggal mulai</span>
				<input
					type="date"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					bind:value={jurnalTanggalMulai}
				/>
			</label>
			<label class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="text-xs font-semibold text-slate-600 dark:text-zinc-400">Tanggal selesai</span>
				<input
					type="date"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					bind:value={jurnalTanggalSelesai}
				/>
			</label>
		{/if}
		{#if isBukuTamu}
			<label class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="text-xs font-semibold text-slate-600 dark:text-zinc-400">Tanggal mulai</span>
				<input
					type="date"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					value={bukuTamuTanggalMulai}
					onchange={(e) => {
						bukuTamuTanggalMulai = (e.target as HTMLInputElement).value;
					}}
				/>
			</label>
			<label class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="text-xs font-semibold text-slate-600 dark:text-zinc-400">Tanggal selesai</span>
				<input
					type="date"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					value={bukuTamuTanggalSelesai}
					onchange={(e) => {
						bukuTamuTanggalSelesai = (e.target as HTMLInputElement).value;
					}}
				/>
			</label>
		{/if}

		<div class="flex flex-row gap-2 max-sm:flex-col">
			{#if isJurnalMengajar}
				{#if jurnalPreviewHref && !downloadLoading}
					<a
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 max-sm:w-full"
						href={jurnalPreviewHref}
						target="_blank"
						rel="noopener noreferrer"
						title="Buka preview Jurnal Mengajar di tab baru"
					>
						<Icon name="eye" class="h-4 w-4" />
						Preview
					</a>
				{:else}
					<button
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 max-sm:w-full"
						type="button"
						disabled={!jurnalTanggalMulai || !jurnalTanggalSelesai || downloadLoading}
						aria-disabled={!jurnalTanggalMulai || !jurnalTanggalSelesai || downloadLoading}
						onclick={onPreviewJurnal}
						title={!jurnalTanggalMulai || !jurnalTanggalSelesai
							? 'Pilih rentang tanggal terlebih dahulu'
							: 'Preview Jurnal Mengajar'}
					>
						{#if downloadLoading}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<Icon name="eye" class="h-4 w-4" />
						{/if}
						Preview
					</button>
				{/if}
			{:else if isBukuTamu}
				{#if bukuTamuPreviewHref && !downloadLoading}
					<a
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 max-sm:w-full"
						href={bukuTamuPreviewHref}
						target="_blank"
						rel="noopener noreferrer"
						title="Buka preview Buku Tamu di tab baru"
					>
						<Icon name="eye" class="h-4 w-4" />
						Preview
					</a>
				{:else}
					<button
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 max-sm:w-full"
						type="button"
						disabled={!bukuTamuTanggalMulai || !bukuTamuTanggalSelesai || downloadLoading}
						aria-disabled={!bukuTamuTanggalMulai || !bukuTamuTanggalSelesai || downloadLoading}
						onclick={onPreviewBukuTamu}
						title={!bukuTamuTanggalMulai || !bukuTamuTanggalSelesai
							? 'Pilih rentang tanggal terlebih dahulu'
							: 'Preview Buku Tamu'}
					>
						{#if downloadLoading}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<Icon name="eye" class="h-4 w-4" />
						{/if}
						Preview
					</button>
				{/if}
			{:else}
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 max-sm:w-full dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="button"
					disabled={downloadDisabled}
					aria-disabled={downloadDisabled}
					onclick={onBulkDownload}
					title="Download semua murid"
				>
					{#if downloadLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<Icon name="download" class="h-4 w-4" />
					{/if}
					Semua
				</button>
			{/if}
		</div>
	</div>

	<PreviewFooter
		{hasMurid}
		muridCount={daftarMurid.length}
		{isPiagamSelected}
		{selectedTemplate}
		{onBgRefresh}
		{isRaporSelected}
		{tpMode}
		{onToggleFullTP}
		{onSetKriteria}
		{kritCukup}
		{kritBaik}
		{kelasId}
		{isBiodataSelected}
		{showBgLogo}
		{onToggleBgLogo}
		{isJurnalMengajar}
		{isBukuTamu}
	/>

	{#if showMuridTable}
		<form
			class="flex flex-col gap-2"
			data-sveltekit-keepfocus
			data-sveltekit-replacestate
			autocomplete="off"
			spellcheck="false"
			onsubmit={submitSearch}
		>
			<div class="relative flex items-center">
				<span
					aria-hidden="true"
					class="pointer-events-none absolute left-3 flex items-center text-slate-500 dark:text-zinc-400"
				>
					<Icon name="search" class="h-4 w-4" />
				</span>
				<input
					type="search"
					name="q"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
					value={localSearch}
					placeholder="Cari nama murid..."
					oninput={handleSearchInput}
					autocomplete="off"
				/>
			</div>
		</form>

		{#if currentItems.length === 0}
			<div
				class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300"
			>
				<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<span
					>{isPiagamSelected
						? 'Tidak ada peringkat piagam yang cocok dengan pencarian.'
						: 'Tidak ada murid yang cocok dengan pencarian.'}</span
				>
			</div>
		{:else}
			<div
				class="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<table class="w-full border-collapse text-xs">
					<thead>
						<tr
							class="border-b border-slate-200/80 bg-slate-50/75 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300"
						>
							<th class="px-3 py-2.5" style="width: 50px; min-width: 40px;">No</th>
							{#if isPiagamSelected}
								<th class="px-3 py-2.5" style="min-width: 80px;">Peringkat</th>
							{/if}
							<th class="w-full px-3 py-2.5" style="min-width: 160px;">Nama</th>
							{#if isPiagamSelected}
								<th class="px-3 py-2.5" style="min-width: 100px;">Nilai Rata-rata</th>
							{:else}
								<th class="px-3 py-2.5" style="min-width: 100px;">NISN</th>
							{/if}
							<th class="px-3 py-2.5 text-center" style="min-width: 120px;">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200/70 dark:divide-zinc-800">
						{#if isPiagamSelected}
							{#each paginatedPiagam as item, i (item.muridId)}
								<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
									<td class="px-3 py-2.5 text-slate-600 tabular-nums dark:text-zinc-400"
										>{(currentPage - 1) * PER_PAGE + i + 1}</td
									>
									<td
										class="px-3 py-2.5 font-semibold text-slate-900 tabular-nums dark:text-zinc-100"
										>{item.peringkat}</td
									>
									<td class="px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100"
										>{@html searchQueryMarker(searchTerm || null, item.nama)}</td
									>
									<td class="px-3 py-2.5 text-slate-700 tabular-nums dark:text-zinc-300"
										>{item.nilaiRataRata != null
											? item.nilaiRataRata.toLocaleString('id-ID', {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2
												})
											: '-'}</td
									>
									<td class="px-3 py-2.5 text-center">
										<a
											href={buildMuridPreviewHref(item.muridId)}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
											title="Buka preview piagam untuk {item.nama} di tab baru"
										>
											<Icon name="eye" class="h-3.5 w-3.5" />
											Preview
										</a>
									</td>
								</tr>
							{/each}
						{:else}
							{#each paginatedMurid as murid, i (murid.id)}
								<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
									<td class="px-3 py-2.5 text-slate-600 tabular-nums dark:text-zinc-400"
										>{(currentPage - 1) * PER_PAGE + i + 1}</td
									>
									<td class="px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100"
										>{@html searchQueryMarker(searchTerm || null, murid.nama)}</td
									>
									<td class="px-3 py-2.5 text-slate-700 tabular-nums dark:text-zinc-300"
										>{murid.nisn ?? murid.nis ?? '-'}</td
									>
									<td class="px-3 py-2.5 text-center">
										<a
											href={buildMuridPreviewHref(murid.id)}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
											title="Buka preview dokumen untuk {murid.nama} di tab baru"
										>
											<Icon name="eye" class="h-3.5 w-3.5" />
											Preview
										</a>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
			{#if totalPages > 1}
				<div class="mt-1 flex flex-wrap items-center justify-center gap-1">
					<button
						type="button"
						class="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
						disabled={currentPage <= 1}
						onclick={() => handlePageClick(currentPage - 1)}
						aria-label="Halaman sebelumnya"
					>
						&laquo;
					</button>
					{#each nomorHalaman as nomor, index (index)}
						{#if nomor === '…'}
							<span
								class="inline-flex h-8 min-w-8 items-center justify-center text-xs text-slate-400"
								>…</span
							>
						{:else}
							<button
								type="button"
								class="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold tabular-nums transition-colors {nomor ===
								currentPage
									? 'border-blue-600 bg-blue-600 text-white'
									: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
								onclick={() => handlePageClick(nomor)}
								aria-current={nomor === currentPage ? 'page' : undefined}
							>
								{nomor}
							</button>
						{/if}
					{/each}
					<button
						type="button"
						class="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
						disabled={currentPage >= totalPages}
						onclick={() => handlePageClick(currentPage + 1)}
						aria-label="Halaman berikutnya"
					>
						&raquo;
					</button>
				</div>
			{/if}
		{/if}
	{/if}

	{#if !selectedDocument}
		<div
			class="flex items-center gap-2 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3.5 py-3 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
			<span>Pilih dokumen terlebih dahulu untuk melihat file yang ingin dicetak.</span>
		</div>
	{:else if (!showTable || isJurnalMengajar || isBukuTamu) && !isPiagamSelected}
		<!-- no table shown for jurnal / buku tamu / presensi guru / laporan tpp -->
	{:else if !hasMurid && !isPiagamSelected}
		<div
			class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0" />
			<span>Belum ada murid di kelas ini. Tambahkan murid terlebih dahulu.</span>
		</div>
	{:else if isPiagamSelected && !hasPiagamRankingOptions}
		<div
			class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0" />
			<span>Belum ada data peringkat piagam untuk kelas ini.</span>
		</div>
	{/if}
</div>
