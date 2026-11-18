<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import NilaiModal from '$lib/components/asesmen-kokurikuler/nilai-modal.svelte';
	import { searchQueryMarker } from '$lib/utils';
	import { onDestroy } from 'svelte';
	import type { DimensiProfilLulusanKey } from '$lib/statics';
	import type { NilaiKategori } from '$lib/kokurikuler';
	import { toast } from '$lib/components/toast.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import ActionButtons from '$lib/components/asesmen-kokurikuler/action-buttons.svelte';
	import ImportModalBody from '$lib/components/asesmen-kokurikuler/import-modal-body.svelte';
	import { downloadTemplate, importNilai } from '$lib/components/asesmen-kokurikuler/api';

	type DimensiDetail = {
		key: DimensiProfilLulusanKey;
		label: string;
	};

	type KokurikulerDetail = {
		id: number;
		kode: string;
		tujuan: string;
		dimensi: DimensiDetail[];
	};

	type MuridRow = {
		id: number;
		nama: string;
		no: number;
		deskripsi: string | null;
		nilaiByDimensi: Record<DimensiProfilLulusanKey, NilaiKategori | null>;
		hasNilai: boolean;
		lastUpdated: string | null;
	};

	type PaginationState = {
		currentPage: number;
		totalPages: number;
		// totalItems, perPage and search are omitted when not used by this view
	};

	type PageData = {
		kokurikulerList: KokurikulerDetail[];
		selectedKokurikulerId: number | null;
		selectedKokurikuler: KokurikulerDetail | null;
		kategoriOptions: Array<{ value: NilaiKategori; label: string }>;
		daftarMurid: MuridRow[];
		search: string | null;
		totalMurid: number;
		muridCount: number;
		// summary not used in this view; omitted to avoid unused prop lint
		page: PaginationState;
	};

	let { data }: { data: PageData } = $props();

	const hasKokurikuler = $derived.by(() => data.kokurikulerList.length > 0);
	const selectedKokurikuler = $derived.by(() => data.selectedKokurikuler);
	const selectedKokurikulerLabel = $derived.by(() =>
		selectedKokurikuler ? capitalizeSentence(selectedKokurikuler.tujuan) : null
	);
	const selectedKokurikulerHasDimensi = $derived.by(() =>
		selectedKokurikuler ? selectedKokurikuler.dimensi.length > 0 : false
	);
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
	const currentPage = $derived.by(() => data.page?.currentPage ?? 1);
	const totalPages = $derived.by(() => Math.max(1, data.page?.totalPages ?? 1));
	const pages = $derived.by(() => Array.from({ length: totalPages }, (_, index) => index + 1));

	// svelte-ignore state_referenced_locally
	let selectedKokurikulerValue = $state(
		data.selectedKokurikulerId ? String(data.selectedKokurikulerId) : ''
	);
	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.search ?? '');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	let modalOpen = $state(false);
	let activeMurid = $state<MuridRow | null>(null);
	let isDownloadingTemplate = $state(false);
	let isImportingFile = $state(false);

	$effect(() => {
		selectedKokurikulerValue = data.selectedKokurikulerId ? String(data.selectedKokurikulerId) : '';
		searchTerm = data.search ?? '';
	});

	$effect(() => {
		if (!hasKokurikuler) return;
		if (data.kokurikulerList.length !== 1) return;
		const onlyId = String(data.kokurikulerList[0].id);
		if (selectedKokurikulerValue === onlyId) return;
		selectedKokurikulerValue = onlyId;
		handleKokurikulerChange(onlyId);
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

	function handleKokurikulerChange(value: string) {
		void applyNavigation((params) => {
			if (value) {
				params.set('kokurikuler_id', value);
			} else {
				params.delete('kokurikuler_id');
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

	function openModalFor(murid: MuridRow) {
		activeMurid = murid;
		modalOpen = true;
	}

	function closeModal() {
		modalOpen = false;
		activeMurid = null;
	}

	async function handleModalSuccess() {
		closeModal();
		await invalidate('app:asesmen-kokurikuler');
	}

	async function handleDownloadTemplate() {
		if (!selectedKokurikulerValue || !selectedKokurikulerHasDimensi || !kelasAktif?.id) {
			toast('Pilih kokurikuler terlebih dahulu', 'error');
			return;
		}

		isDownloadingTemplate = true;
		try {
			const success = await downloadTemplate(selectedKokurikulerValue, kelasAktif.id);
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
		if (!selectedKokurikulerValue || !selectedKokurikulerHasDimensi || !kelasAktif?.id) {
			toast('Pilih kokurikuler terlebih dahulu', 'error');
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
						const result = await importNilai(file, selectedKokurikulerValue, kelasAktif?.id ?? 0);

						if (result.success) {
							toast(result.message || 'Nilai berhasil diimport', 'success');
							close();
							await invalidate('app:asesmen-kokurikuler');

							await goto(`?kokurikuler_id=${selectedKokurikulerValue}`);
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
				Daftar Nilai Kokurikuler
				{#if selectedKokurikuler}
					: {capitalizeSentence(selectedKokurikuler.tujuan)}
				{/if}
			</h1>

			{#if kelasAktifLabel}
				<p class="mt-0.5 block text-xs text-slate-600 dark:text-zinc-400">{kelasAktifLabel}</p>
			{/if}
		</div>
	</div>

	<ActionButtons
		isDownloading={isDownloadingTemplate}
		isImporting={isImportingFile}
		disabled={!selectedKokurikulerHasDimensi || !canEdit}
		onDownload={handleDownloadTemplate}
		onImport={openImportModal}
	/>

	<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
		<label class="w-full md:max-w-80">
			<span class="sr-only">Pilih kokurikuler</span>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					title={!canEdit
						? 'Anda tidak memiliki izin untuk mengubah'
						: (selectedKokurikulerLabel ?? 'Pilih kokurikuler')}
					bind:value={selectedKokurikulerValue}
					onchange={(event) =>
						handleKokurikulerChange((event.currentTarget as HTMLSelectElement).value)}
					aria-disabled={!hasKokurikuler || !canEdit}
					disabled={!hasKokurikuler || !canEdit}
				>
					{#if !hasKokurikuler}
						<option value="">Belum ada kokurikuler</option>
					{:else}
						<option value="" disabled selected={selectedKokurikulerValue === ''}>
							Pilih Kokurikuler
						</option>
						{#each data.kokurikulerList as item (item.id)}
							<option value={String(item.id)}>{capitalizeSentence(item.tujuan)}</option>
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
			data-sveltekit-keepfocus
			data-sveltekit-replacestate
			autocomplete="off"
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
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
					value={searchTerm}
					autocomplete="name"
					placeholder="Cari nama murid..."
					oninput={handleSearchInput}
				/>
			</div>
		</form>
	</div>

	{#if !hasKokurikuler}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
			<span>
				Belum ada data kokurikuler untuk kelas ini. Tambahkan terlebih dahulu di menu
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a
					class="font-semibold text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
					href="/kokurikuler">Kokurikuler</a
				>.
			</span>
		</div>
	{:else if !selectedKokurikuler}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Pilih kokurikuler untuk mulai menilai.</span>
		</div>
	{:else if data.muridCount === 0}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>
				Belum ada data murid di kelas ini. Tambahkan murid terlebih dahulu melalui menu
				<strong>Murid</strong>.
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
		<div
			class="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full min-w-150 border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th style="width: 50px; min-width: 40px;" class="px-3 py-2.5">No</th>
						<th class="min-w-44 px-3 py-2.5">Nama</th>
						<th class="px-3 py-2.5">Aksi</th>
						<th class="w-full px-3 py-2.5" style="min-width: 240px;">Deskripsi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
					{#each data.daftarMurid as murid (murid.id)}
						<tr class="transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50">
							<td class="px-3 py-2.5 align-top tabular-nums text-slate-600 dark:text-zinc-400">
								{murid.no}
							</td>
							<td class="px-3 py-2.5 align-top font-medium text-slate-900 dark:text-zinc-100">
								{@html searchQueryMarker(data.search, murid.nama)}
							</td>
							<td class="px-3 py-2.5 align-top">
								<button
									type="button"
									class="inline-flex h-8 items-center gap-1 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
									onclick={() => openModalFor(murid)}
									disabled={!canEdit}
									aria-disabled={!canEdit}
									title={!canEdit ? 'Anda tidak memiliki izin untuk menilai' : ''}
								>
									<Icon name="edit" class="h-3.5 w-3.5" />
									Nilai
								</button>
							</td>
							<td class="px-3 py-2.5 align-top">
								{#if murid.deskripsi}
									<p class="text-xs text-slate-800 dark:text-zinc-200">{murid.deskripsi}</p>
								{:else}
									<span class="text-xs italic text-slate-500 dark:text-zinc-400">
										Belum ada nilai
									</span>
								{/if}
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
						class="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border px-2.5 text-xs font-semibold tabular-nums transition-colors {pageNumber ===
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

<NilaiModal
	open={modalOpen}
	murid={activeMurid}
	kokurikuler={selectedKokurikuler}
	kategoriOptions={data.kategoriOptions}
	action="?/nilai"
	onClose={closeModal}
	onSuccess={handleModalSuccess}
/>
