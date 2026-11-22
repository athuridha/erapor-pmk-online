<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import DeskripsiCell from '$lib/components/nilai-ekstrakurikuler/deskripsi-cell.svelte';
	import { searchQueryMarker } from '$lib/utils';
	import type { EkstrakurikulerNilaiKategori } from '$lib/ekstrakurikuler';
	import { onDestroy } from 'svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import ActionButtons from '$lib/components/nilai-ekstrakurikuler/action-buttons.svelte';
	import ImportModalBody from '$lib/components/nilai-ekstrakurikuler/import-modal-body.svelte';
	import { downloadTemplate, importNilai } from '$lib/components/nilai-ekstrakurikuler/api';

	type EkstrakurikulerOption = {
		id: number;
		nama: string;
		tujuanCount: number;
		pembina?: string | null;
	};

	type EkstrakurikulerDetail = {
		id: number;
		nama: string;
		pembina?: string | null;
		tujuan: Array<{ id: number; deskripsi: string }>;
	};

	type NilaiEntry = {
		tujuanId: number;
		tujuan: string;
		kategori: EkstrakurikulerNilaiKategori | null;
		kategoriLabel: string | null;
		timestamp: string | null;
	};

	type MuridRow = {
		id: number;
		nama: string;
		kelasNama?: string | null;
		no: number;
		nilai: NilaiEntry[];
		deskripsi: string | null;
		hasNilai: boolean;
		lastUpdated: string | null;
	};

	type PaginationState = {
		currentPage: number;
		totalPages: number;
		// totalItems, perPage and search omitted when not used in this view
	};

	type PageData = {
		pembinaMode?: boolean;
		ekstrakurikulerList: EkstrakurikulerOption[];
		selectedEkstrakurikulerId: number | null;
		selectedEkstrakurikuler: EkstrakurikulerDetail | null;
		daftarMurid: MuridRow[];
		totalMurid: number;
		muridCount: number;
		search?: string | null;
		page: PaginationState;
	};

	let { data }: { data: PageData } = $props();

	const pembinaMode = $derived(Boolean(data.pembinaMode));
	const hasEkstrakurikuler = $derived.by(() => data.ekstrakurikulerList.length > 0);
	const selectedEkstrak = $derived.by(() => data.selectedEkstrakurikuler);
	const selectedEkstrakHasTujuan = $derived.by(() =>
		selectedEkstrak ? selectedEkstrak.tujuan.length > 0 : false
	);
	const currentPage = $derived.by(() => data.page?.currentPage ?? 1);
	const totalPages = $derived.by(() => Math.max(1, data.page?.totalPages ?? 1));
	const pages = $derived.by(() => Array.from({ length: totalPages }, (_, index) => index + 1));

	// svelte-ignore state_referenced_locally
	let selectedEkstrakValue = $state(
		data.selectedEkstrakurikulerId ? String(data.selectedEkstrakurikulerId) : ''
	);
	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.search ?? '');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let isDownloadingTemplate = $state(false);
	let isImportingFile = $state(false);
	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return null;
		return kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
	});
	// Restrict editing for wali_asuh
	const canEdit = $derived.by(() => {
		const u = page.data.user as { type?: string } | null | undefined;
		return u?.type !== 'wali_asuh';
	});

	$effect(() => {
		selectedEkstrakValue = data.selectedEkstrakurikulerId
			? String(data.selectedEkstrakurikulerId)
			: '';
		searchTerm = data.search ?? '';
	});

	$effect(() => {
		if (!hasEkstrakurikuler) return;
		if (data.ekstrakurikulerList.length !== 1) return;
		const onlyId = String(data.ekstrakurikulerList[0].id);
		if (selectedEkstrakValue === onlyId) return;
		selectedEkstrakValue = onlyId;
		handleEkstrakChange(onlyId);
	});

	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';

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

	function handleEkstrakChange(value: string) {
		void applyNavigation((params) => {
			if (value) {
				params.set('ekstrakurikuler_id', value);
			} else {
				params.delete('ekstrakurikuler_id');
			}
			params.delete('page');
		});
	}

	async function applySearch(value: string) {
		await applyNavigation((params) => {
			const cleaned = value.trim();
			if (cleaned) {
				params.set('q', cleaned);
			} else {
				params.delete('q');
			}
			params.delete('page');
		});
	}

	function handleSearchInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		searchTerm = value;
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
		searchTimer = setTimeout(() => {
			void applySearch(value);
		}, 400);
	}

	function submitSearch(event: Event) {
		event.preventDefault();
		if (searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = undefined;
		}
		void applySearch(searchTerm);
	}

	onDestroy(() => {
		if (searchTimer) {
			clearTimeout(searchTimer);
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

	async function handleDownloadTemplate() {
		if (!selectedEkstrakValue || !selectedEkstrakHasTujuan || (!kelasAktif?.id && !pembinaMode)) {
			toast(
				'Pilih ekstrakurikuler dan pastikan memiliki tujuan pembelajaran terlebih dahulu',
				'error'
			);
			return;
		}

		isDownloadingTemplate = true;
		try {
			const success = await downloadTemplate(selectedEkstrakValue, kelasAktif?.id ?? 0);
			if (success) {
				toast('Template berhasil diunduh', 'success');
			} else {
				toast('Gagal mengunduh template', 'error');
			}
		} catch (err) {
			console.error(err);
			toast('Terjadi kesalahan saat mengunduh template', 'error');
		} finally {
			isDownloadingTemplate = false;
		}
	}

	function openImportModal() {
		if (!selectedEkstrakValue || !selectedEkstrakHasTujuan || (!kelasAktif?.id && !pembinaMode)) {
			toast(
				'Pilih ekstrakurikuler dan pastikan memiliki tujuan pembelajaran terlebih dahulu',
				'error'
			);
			return;
		}

		let uploader: () => File | null = () => null;

		showModal({
			title: 'Import Nilai dari Excel',
			body: ImportModalBody,
			bodyProps: {
				setUploader: (fn: () => File | null) => (uploader = fn)
			},
			onPositive: {
				label: 'Import',
				icon: 'import',
				action: async ({ close }: { close: () => void }) => {
					const file = uploader();
					if (!file) {
						toast('Pilih file terlebih dahulu.', 'error');
						return;
					}

					isImportingFile = true;

					try {
						const result = await importNilai(file, selectedEkstrakValue, kelasAktif?.id ?? 0);

						if (result.success) {
							toast(result.message || 'Nilai berhasil diimport', 'success');
							close();
							await invalidate('app:nilai-ekstrakurikuler');
							await goto(`?ekstrakurikuler_id=${selectedEkstrakValue}`);
						} else {
							toast(result.message || 'Gagal import nilai', 'error');
						}
					} catch (err) {
						console.error(err);
						toast(
							'Terjadi kesalahan saat import: ' + String((err as Error)?.message ?? err),
							'error'
						);
					} finally {
						isImportingFile = false;
					}
				}
			},
			onNeutral: { label: 'Batal', icon: 'close' },
			spreadActions: true,
			dismissible: true
		});
	}

	async function handleFileImport() {
		openImportModal();
	}

	function buildNilaiLink(muridId: number) {
		if (!selectedEkstrak) return '#';
		const redirectTarget = encodeURIComponent(`${page.url.pathname}${page.url.search}`);
		return `/nilai-ekstrakurikuler/form-asesmen?murid_id=${muridId}&ekstrakurikuler_id=${selectedEkstrak.id}&redirect=${redirectTarget}`;
	}

	function capitalizeSentence(value: string | null | undefined) {
		if (!value) return '';
		const trimmed = value.trimStart();
		if (!trimmed) return '';
		return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Daftar Nilai Ekstrakurikuler
				{#if selectedEkstrak}
					: {capitalizeSentence(selectedEkstrak.nama)}
				{/if}
			</h1>
			{#if pembinaMode}
				<p class="mt-0.5 block text-xs text-slate-600 dark:text-zinc-400">
					Mode Pembina Eskul · Lintas Kelas
					{#if selectedEkstrak?.pembina}
						({selectedEkstrak.pembina})
					{/if}
				</p>
			{:else if kelasAktifLabel}
				<p class="mt-0.5 block text-xs text-slate-600 dark:text-zinc-400">
					{kelasAktifLabel}
					{#if selectedEkstrak?.pembina}
						· Pembina: {selectedEkstrak.pembina}
					{/if}
				</p>
			{/if}
		</div>
	</div>

	<ActionButtons
		isDownloading={isDownloadingTemplate}
		isImporting={isImportingFile}
		disabled={!selectedEkstrakHasTujuan || !canEdit}
		onDownload={handleDownloadTemplate}
		onImport={handleFileImport}
	/>

	<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
		<label class="w-full md:max-w-80">
			<span class="sr-only">Pilih ekstrakurikuler</span>
			<div class="relative flex items-center">
				<select
					class="h-11 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					title={!canEdit ? 'Anda tidak memiliki izin untuk mengubah' : 'Pilih ekstrakurikuler'}
					bind:value={selectedEkstrakValue}
					onchange={(event) =>
						handleEkstrakChange((event.currentTarget as HTMLSelectElement).value)}
					aria-disabled={!hasEkstrakurikuler || !canEdit}
					disabled={!hasEkstrakurikuler || !canEdit}
				>
					{#if !hasEkstrakurikuler}
						<option value="">Belum ada ekstrakurikuler</option>
					{:else}
						<option value="" disabled selected={selectedEkstrakValue === ''}>
							Pilih Ekstrakurikuler
						</option>
						{#each data.ekstrakurikulerList as item (item.id)}
							<option value={String(item.id)}>{capitalizeSentence(item.nama)}</option>
						{/each}
					{/if}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</label>
		<form
			class="w-full flex-1"
			autocomplete="off"
			data-sveltekit-keepfocus
			data-sveltekit-replacestate
			onsubmit={submitSearch}
		>
			<div class="relative">
				<span
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
				>
					<Icon name="search" class="h-4 w-4" />
				</span>
				<input
					type="search"
					name="q"
					class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none sm:h-9 sm:text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
					value={searchTerm}
					autocomplete="off"
					placeholder="Cari nama murid..."
					oninput={handleSearchInput}
				/>
			</div>
		</form>
	</div>

	{#if !hasEkstrakurikuler}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
			<span>
				{#if pembinaMode}
					Belum ada ekstrakurikuler yang ditugaskan kepada akun Pembina Anda. Hubungi Operator/Admin
					untuk menetapkan pembina di Master Data Ekstrakurikuler.
				{:else}
					Belum ada data ekstrakurikuler untuk kelas ini. Tambahkan terlebih dahulu di menu
					<strong>Ekstrakurikuler</strong>.
				{/if}
			</span>
		</div>
	{:else if !selectedEkstrak}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Pilih ekstrakurikuler untuk mulai menilai.</span>
		</div>
	{:else if !selectedEkstrakHasTujuan}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>
				Ekstrakurikuler ini belum memiliki tujuan pembelajaran. Tambahkan tujuan terlebih dahulu
				melalui menu <strong>Ekstrakurikuler &gt; Tujuan</strong>.
			</span>
		</div>
	{:else if data.muridCount === 0}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>
				{#if pembinaMode}
					Belum ada anggota terdaftar untuk ekstrakurikuler ini. Minta Operator/Admin memilih
					anggota di Master Data Ekstrakurikuler.
				{:else}
					Belum ada data murid di kelas ini. Tambahkan murid terlebih dahulu melalui menu
					<strong>Murid</strong>.
				{/if}
			</span>
		</div>
	{:else if data.totalMurid === 0}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
			<span>Tidak ada murid yang cocok dengan pencarian.</span>
		</div>
	{:else}
		<!-- Mobile: kartu per murid -->
		<div class="mt-3 space-y-2 sm:hidden">
			{#each data.daftarMurid as murid (murid.id)}
				<div
					class="rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<div class="flex items-start justify-between gap-2.5">
						<div class="min-w-0 flex-1">
							<p class="text-sm font-semibold leading-snug text-slate-900 dark:text-zinc-100">
								<span
									class="mr-1 text-xs font-semibold text-slate-400 tabular-nums dark:text-zinc-500"
									>{murid.no}.</span
								>
								{@html searchQueryMarker(data.search, murid.nama)}
							</p>
							{#if murid.kelasNama}
								<span
									class="mt-1 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
								>
									{murid.kelasNama}
								</span>
							{/if}
						</div>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- intentional prebuilt href -->
						<a
							class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 {!selectedEkstrakHasTujuan ||
							!canEdit
								? 'pointer-events-none opacity-50'
								: ''}"
							href={buildNilaiLink(murid.id)}
							aria-disabled={!selectedEkstrakHasTujuan || !canEdit}
							title={!canEdit ? 'Anda tidak memiliki izin untuk menilai' : ''}
						>
							<Icon name="edit" class="h-3.5 w-3.5" />
							Nilai
						</a>
					</div>
					<div class="mt-2.5 border-t border-slate-100 pt-2 dark:border-zinc-800/80">
						<DeskripsiCell text={murid.deskripsi} />
					</div>
				</div>
			{/each}
		</div>

		<div
			class="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full min-w-150 border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th style="width: 50px; min-width: 40px;" class="px-3 py-2.5">No</th>
						<th class="min-w-48 px-3 py-2.5">Nama</th>
						<th class="min-w-32 px-3 py-2.5">Aksi</th>
						<th class="w-full px-3 py-2.5" style="min-width: 240px;">Deskripsi Nilai</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
					{#each data.daftarMurid as murid (murid.id)}
						<tr class="transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50">
							<td class="px-3 py-2.5 align-top tabular-nums text-slate-600 dark:text-zinc-400">
								{murid.no}
							</td>
							<td class="px-3 py-2.5 align-top font-medium text-slate-900 dark:text-zinc-100">
								<div>{@html searchQueryMarker(data.search, murid.nama)}</div>
								{#if murid.kelasNama}
									<span
										class="mt-1 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
									>
										{murid.kelasNama}
									</span>
								{/if}
							</td>
							<td class="px-3 py-2.5 align-top">
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- intentional prebuilt href -->
								<a
									class="inline-flex h-8 items-center gap-1 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 {!selectedEkstrakHasTujuan ||
									!canEdit
										? 'pointer-events-none opacity-50'
										: ''}"
									href={buildNilaiLink(murid.id)}
									aria-disabled={!selectedEkstrakHasTujuan || !canEdit}
									title={!canEdit ? 'Anda tidak memiliki izin untuk menilai' : ''}
								>
									<Icon name="edit" class="h-3.5 w-3.5" />
									Nilai
								</a>
							</td>
							<td class="px-3 py-2.5 align-top">
								<DeskripsiCell text={murid.deskripsi} />
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if pages.length > 1}
			<div class="mt-4 flex flex-wrap items-center justify-center gap-1">
				{#each pages as pageNumber (pageNumber)}
					<button
						type="button"
						class="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-2.5 text-xs font-semibold tabular-nums transition-colors sm:h-8 sm:min-w-8 {pageNumber ===
						currentPage
							? 'border-blue-600 bg-blue-600 text-white shadow-sm'
							: 'border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
						onclick={() => handlePageClick(pageNumber)}
						aria-current={pageNumber === currentPage ? 'page' : undefined}
					>
						{pageNumber}
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>
