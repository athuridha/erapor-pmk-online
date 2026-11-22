<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import BulkFillModal from '$lib/components/catatan-wali/bulk-fill-modal.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { hideModal, showModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { searchQueryMarker } from '$lib/utils';
	import { buildPageNumbers, OPSI_BARIS_PER_HALAMAN } from '$lib/utils/pagination';
	import { onDestroy, tick } from 'svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.page.search ?? '');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let editingRowId = $state<number | null>(null);
	let editingTextarea = $state<HTMLTextAreaElement | null>(null);
	let editingCatatan = $state('');
	let editingOriginal = $state('');
	let editingSubmitting = $state(false);
	let bulkCatatan = $state('');
	const bulkFormId = 'bulk-catatan-form';

	const currentPage = $derived.by(() => data.page.currentPage ?? 1);
	const totalPages = $derived.by(() => Math.max(1, data.page.totalPages ?? 1));
	const nomorHalaman = $derived(buildPageNumbers(currentPage, totalPages));

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

	const editingSaveDisabled = $derived.by(
		() =>
			editingRowId === null || editingSubmitting || editingCatatan.trim() === editingOriginal.trim()
	);
	const muridIds = $derived.by(() => data.daftarCatatan.map((item) => item.id));
	const bulkTargetCount = $derived.by(() => muridIds.length);
	const muridIdsPayload = $derived.by(() => JSON.stringify(muridIds));

	$effect(() => {
		if (searchTimer) return;
		const latestSearchTerm = data.page.search ?? '';
		if (searchTerm !== latestSearchTerm) {
			searchTerm = latestSearchTerm;
		}
	});

	$effect(() => {
		if (editingRowId === null) return;
		const row = data.daftarCatatan.find((item) => item.id === editingRowId);
		if (!row) {
			cancelEdit();
		}
	});

	$effect(() => {
		if (editingRowId !== null) {
			void tick().then(() => editingTextarea?.focus());
		}
	});

	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';

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

	async function gotoPerHalaman(jumlah: number) {
		const params = new SvelteURLSearchParams(page.url.search);
		params.set('per_page', String(jumlah));
		params.delete('page');
		const nextQuery = params.toString();
		await goto(`${page.url.pathname}${nextQuery ? `?${nextQuery}` : ''}`, {
			replaceState: true,
			keepFocus: true
		});
	}

	async function setStatusFilter(statusKey: string) {
		const params = new SvelteURLSearchParams(page.url.search);
		if (statusKey === 'all') {
			params.delete('status');
		} else {
			params.set('status', statusKey);
		}
		params.delete('page');
		const nextQuery = params.toString();
		await goto(`${page.url.pathname}${nextQuery ? `?${nextQuery}` : ''}`, {
			replaceState: true,
			keepFocus: true
		});
	}

	// Filter kelas lokal halaman ini memakai `?kelas=` (tanpa mengubah kelas
	// aktif global), agar daftar bisa dipersempit ke satu rombel.
	async function setKelasFilter(value: string) {
		const params = new SvelteURLSearchParams(page.url.search);
		if (value) {
			params.set('kelas', value);
		} else {
			params.delete('kelas');
		}
		params.delete('page');
		const nextQuery = params.toString();
		const nextUrl = `${page.url.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
		const currentUrl = `${page.url.pathname}${page.url.search}`;
		if (nextUrl === currentUrl) return;
		await goto(nextUrl, { replaceState: true, keepFocus: true });
	}

	function handlePageClick(pageNumber: number) {
		if (pageNumber === currentPage) return;
		void gotoPage(pageNumber);
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
			searchTimer = undefined;
		}
		void applySearch(searchTerm);
	}

	onDestroy(() => {
		if (searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = undefined;
		}
	});

	function startEdit(row: { id: number; catatan: string | null }) {
		if (editingRowId === row.id) return;
		editingRowId = row.id;
		editingOriginal = row.catatan ?? '';
		editingCatatan = editingOriginal;
		editingSubmitting = false;
	}

	function cancelEdit() {
		editingRowId = null;
		editingOriginal = '';
		editingCatatan = '';
		editingSubmitting = false;
	}

	async function handleSaveSuccess() {
		cancelEdit();
		await invalidate('app:catatan-wali-kelas');
	}

	function openBulkDialog() {
		if (!bulkTargetCount) {
			toast('Tidak ada murid pada daftar ini.', 'warning');
			return;
		}
		bulkCatatan = '';
		let actions: { submit: () => void };
		showModal({
			title: 'Isi Catatan Sekaligus',
			body: BulkFillModal,
			bodyProps: {
				formId: bulkFormId,
				muridIdsPayload,
				targetCount: bulkTargetCount,
				catatan: bulkCatatan,
				onCatatanChange: (value: string) => {
					bulkCatatan = value;
				},
				onSuccess: async () => {
					await handleBulkSuccess();
				},
				onAction: (a: { submit: () => void }) => {
					actions = a;
				}
			},
			onPositive: {
				label: 'Terapkan',
				action: () => actions.submit()
			},
			onNeutral: {
				label: 'Batal'
			},
			spreadActions: true,
			dismissible: true,
			onClose: handleBulkDialogClose
		});
	}

	function handleBulkDialogClose() {
		bulkCatatan = '';
	}

	async function handleBulkSuccess() {
		hideModal();
		await invalidate('app:catatan-wali-kelas');
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Rekapitulasi Catatan Wali Kelas
			</h1>
			{#if kelasAktifLabel}
				<p class="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">{kelasAktifLabel}</p>
			{/if}
		</div>
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 max-sm:w-full sm:self-center dark:bg-blue-500 dark:hover:bg-blue-600"
			onclick={openBulkDialog}
			disabled={!bulkTargetCount || editingRowId !== null || !canEdit}
			aria-disabled={!bulkTargetCount || editingRowId !== null || !canEdit}
			title={!canEdit
				? 'Anda tidak memiliki izin untuk mengedit'
				: 'Isi catatan yang sama untuk seluruh murid pada halaman ini'}
		>
			<Icon name="copy" class="h-4 w-4" />
			<span>Isi Sekaligus</span>
		</button>
	</div>

	<!-- Filter Status Catatan -->
	<div
		class="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-slate-200/75 bg-slate-50/80 p-1.5 dark:border-zinc-800 dark:bg-zinc-800/50"
	>
		{#each [{ key: 'all', label: 'Semua Murid', count: data.statusCounts?.all ?? 0, pill: 'bg-slate-200/80 text-slate-800 dark:bg-zinc-700 dark:text-zinc-200' }, { key: 'filled', label: 'Sudah Diisi', count: data.statusCounts?.filled ?? 0, pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' }, { key: 'empty', label: 'Belum Diisi', count: data.statusCounts?.empty ?? 0, pill: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' }] as tab (tab.key)}
			{@const isActive = (data.page.status ?? 'all') === tab.key}
			<button
				type="button"
				class="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:min-h-0 {isActive
					? 'bg-white text-blue-700 shadow-xs dark:bg-zinc-900 dark:text-blue-300'
					: 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800'}"
				onclick={() => setStatusFilter(tab.key)}
			>
				<span>{tab.label}</span>
				<span class="rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums {tab.pill}">
					{tab.count}
				</span>
			</button>
		{/each}
	</div>

	<form
		class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
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
				class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:h-9 sm:text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				value={searchTerm}
				spellcheck="false"
				placeholder="Cari nama murid..."
				autocomplete="name"
				oninput={handleSearchInput}
			/>
		</div>
		<div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
			<div class="relative flex items-center">
				<select
					class="h-11 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none sm:h-9 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					title="Filter kelas"
					aria-label="Filter kelas"
					onchange={(event) => setKelasFilter((event.currentTarget as HTMLSelectElement).value)}
				>
					<option value="" selected={(data.page.kelasId ?? '') === ''}>Semua kelas</option>
					{#each data.daftarKelas ?? [] as kelas (kelas.id)}
						<option value={kelas.id} selected={String(kelas.id) === (data.page.kelasId ?? '')}>
							{kelas.nama}{kelas.fase ? ` - ${kelas.fase}` : ''}
						</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
			<div class="relative flex items-center">
				<select
					class="h-11 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none sm:h-9 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					value={data.page.perPage}
					title="Baris per halaman"
					onchange={(event) =>
						gotoPerHalaman(Number((event.currentTarget as HTMLSelectElement).value))}
				>
					{#each OPSI_BARIS_PER_HALAMAN as jumlah (jumlah)}
						<option value={jumlah}>{jumlah} / hal</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</div>
	</form>

	<div
		class="mt-4 overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="hidden border-b border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold text-slate-600 md:grid md:grid-cols-[3.5rem_14rem_1fr_8.5rem] md:gap-3 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
		>
			<div>No</div>
			<div>Nama</div>
			<div>Catatan</div>
			<div class="text-right">Aksi</div>
		</div>

		<div class="divide-y divide-slate-100 dark:divide-zinc-800/80">
			{#each data.daftarCatatan as item (item.id)}
				{@const formId = `edit-catatan-form-${item.id}`}
				<div
					class="flex flex-col gap-2.5 p-3.5 transition-colors md:grid md:grid-cols-[3.5rem_14rem_1fr_8.5rem] md:items-start md:gap-3 md:px-3 md:py-2.5 {editingRowId ===
					item.id
						? 'bg-blue-50/50 dark:bg-blue-950/20'
						: 'hover:bg-slate-50/80 dark:hover:bg-zinc-800/40'}"
				>
					<div class="hidden text-xs text-slate-600 tabular-nums md:block dark:text-zinc-400">
						{item.no}
					</div>
					<div
						class="text-sm font-semibold text-slate-900 md:text-xs md:font-medium dark:text-zinc-100"
					>
						<span
							class="mr-1.5 text-xs font-semibold text-slate-400 tabular-nums md:hidden dark:text-zinc-500"
						>
							{item.no}.
						</span>
						{@html searchQueryMarker(data.page.search, item.nama)}
					</div>
					<div class="min-w-0 text-xs">
						{#if editingRowId === item.id}
							<FormEnhance
								id={formId}
								action="?/save"
								submitStateChange={(value) => (editingSubmitting = value)}
								onsuccess={() => {
									void handleSaveSuccess();
								}}
							>
								{#snippet children({ submitting, invalid })}
									<input name="muridId" value={item.id} hidden />
									<label class="flex flex-col gap-1.5" aria-busy={submitting}>
										<textarea
											bind:this={editingTextarea}
											class="w-full rounded-xl border border-[#7e8b9b] bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none md:p-2.5 md:text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
											name="catatan"
											rows="4"
											bind:value={editingCatatan}
											placeholder={`Tuliskan catatan untuk ${item.nama}`}
											spellcheck="false"
											aria-invalid={invalid}></textarea>
										<small class="text-[11px] text-slate-500 dark:text-zinc-400">
											Kosongkan catatan dan simpan untuk menghapus.
										</small>
									</label>
								{/snippet}
							</FormEnhance>
						{:else if item.catatan}
							<p class="leading-relaxed whitespace-pre-line text-slate-800 dark:text-zinc-200">
								{item.catatan}
							</p>
						{:else}
							<span class="italic text-slate-400 dark:text-zinc-500">Belum ada catatan</span>
						{/if}
					</div>
					<div class="flex items-center justify-end gap-2">
						{#if editingRowId === item.id}
							<button
								type="button"
								class="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 md:h-8 md:w-8 md:flex-none md:px-0 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
								onclick={cancelEdit}
								disabled={editingSubmitting}
								title="Batalkan edit catatan"
							>
								<Icon name="close" class="h-3.5 w-3.5" />
								<span class="md:hidden">Batal</span>
							</button>
							<button
								class="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 md:h-8 md:w-8 md:flex-none md:px-0 dark:bg-blue-500 dark:hover:bg-blue-600"
								form={formId}
								type="submit"
								disabled={editingSaveDisabled}
								title="Simpan catatan"
							>
								{#if editingSubmitting}
									<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
								{:else}
									<Icon name="save" class="h-3.5 w-3.5" />
								{/if}
								<span class="md:hidden">{editingSubmitting ? 'Menyimpan...' : 'Simpan'}</span>
							</button>
						{:else}
							<button
								type="button"
								class="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 max-md:w-full md:h-8 md:px-3 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
								onclick={() => startEdit(item)}
								disabled={editingRowId !== null || !canEdit}
								aria-disabled={editingRowId !== null || !canEdit}
								title={!canEdit ? 'Anda tidak memiliki izin untuk mengedit' : ''}
							>
								<Icon name="edit" class="h-3.5 w-3.5" />
								Edit
							</button>
						{/if}
					</div>
				</div>
			{:else}
				<div class="p-8 text-center text-xs italic text-slate-500 dark:text-zinc-400">
					Belum ada murid pada kelas ini
				</div>
			{/each}
		</div>
	</div>

	{#if totalPages > 1}
		<div class="mt-4 flex flex-wrap items-center justify-center gap-1">
			<button
				type="button"
				class="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-8 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
				disabled={currentPage <= 1}
				onclick={() => handlePageClick(currentPage - 1)}
			>
				&laquo;
			</button>
			{#each nomorHalaman as nomor, index (index)}
				{#if nomor === '…'}
					<span class="inline-flex h-10 items-center px-1.5 text-xs text-slate-400 sm:h-8">...</span
					>
				{:else}
					<button
						type="button"
						class="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-2.5 text-xs font-semibold tabular-nums transition-colors sm:h-8 sm:min-w-8 {nomor ===
						currentPage
							? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
							: 'border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
						onclick={() => handlePageClick(nomor)}
						aria-current={nomor === currentPage ? 'page' : undefined}
					>
						{nomor}
					</button>
				{/if}
			{/each}
			<button
				type="button"
				class="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-8 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
				disabled={currentPage >= totalPages}
				onclick={() => handlePageClick(currentPage + 1)}
			>
				&raquo;
			</button>
		</div>
	{/if}

	<p class="mt-3 text-center text-xs text-slate-500 tabular-nums dark:text-zinc-400">
		Menampilkan {data.daftarCatatan.length} dari {data.page.totalItems ?? 0} data
	</p>
</div>
