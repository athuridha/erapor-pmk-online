<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { searchQueryMarker } from '$lib/utils';
	import { onDestroy } from 'svelte';
	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';

	type KeputusanRow = {
		id: number;
		no: number;
		nama: string;
		naik: boolean;
	};

	type PageState = {
		search: string | null;
		currentPage: number;
		totalPages: number;
		totalItems: number;
	};

	type PageData = {
		daftarMurid: KeputusanRow[];
		isGraduating: boolean;
		page: PageState;
		tableReady: boolean;
		muridCount: number;
	};

	let { data }: { data: PageData } = $props();

	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return null;
		return kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
	});

	const canEdit = $derived.by(() => {
		const u = page.data.user as { type?: string; ownKelasIds?: number[] } | null | undefined;
		if (u?.type === 'wali_asuh') return false;
		// Guru merangkap wali kelas: boleh menyunting di kelas yang diwalikan.
		if (u?.type === 'user') {
			return kelasAktif?.id != null && (u.ownKelasIds ?? []).includes(kelasAktif.id);
		}
		return true;
	});

	const currentPage = $derived.by(() => data.page?.currentPage ?? 1);
	const totalPages = $derived.by(() => Math.max(1, data.page?.totalPages ?? 1));
	const pages = $derived.by(() => Array.from({ length: totalPages }, (_, index) => index + 1));

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

	onDestroy(() => {
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
		searchTimer = undefined;
	});

	let isEditing = $state(false);
	let editingSubmitting = $state(false);
	let editingValues = $state<Record<number, boolean>>({});

	function startEdit() {
		isEditing = true;
		editingValues = {};
		for (const murid of data.daftarMurid) {
			editingValues[murid.id] = murid.naik;
		}
	}

	function cancelEdit() {
		isEditing = false;
		editingValues = {};
	}

	function setNaik(muridId: number, value: boolean) {
		editingValues = { ...editingValues, [muridId]: value };
	}

	async function handleSaveSuccess() {
		isEditing = false;
		editingValues = {};
		await invalidate('app:keputusan');
	}

	const statusLabelNaik = $derived(data.isGraduating ? 'Lulus' : 'Naik Kelas');
	const statusLabelTidak = $derived(data.isGraduating ? 'Tidak Lulus' : 'Tidak Naik Kelas');

	const hasMurid = $derived(data.muridCount > 0);
	const hasFilteredMurid = $derived(data.page.totalItems > 0);
</script>

{#if !data.tableReady}
	<div
		class="mb-5 flex items-center gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
	>
		<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
		<span>
			Tabel keputusan belum tersedia. Jalankan <strong>pnpm db:push</strong> untuk menerapkan migrasi
			terbaru.
		</span>
	</div>
{/if}

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Keputusan Kenaikan Kelas
			</h1>
			{#if kelasAktifLabel}
				<p class="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">{kelasAktifLabel}</p>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if isEditing}
				<FormEnhance
					id="keputusan-form"
					action="?/save"
					submitStateChange={(value) => (editingSubmitting = value)}
					onsuccess={handleSaveSuccess}
					showToast
				>
					{#snippet children({ submitting })}
						{#each data.daftarMurid as murid (murid.id)}
							<input type="hidden" name="muridId" value={murid.id} />
							<input type="hidden" name="naik" value={String(editingValues[murid.id] ?? true)} />
						{/each}
						<button
							type="submit"
							class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
							disabled={submitting}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
							{:else}
								<Icon name="save" class="h-3.5 w-3.5" />
							{/if}
							Simpan
						</button>
					{/snippet}
				</FormEnhance>
				<button
					type="button"
					class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
					onclick={cancelEdit}
					disabled={editingSubmitting}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					Batal
				</button>
			{:else}
				<button
					type="button"
					class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={startEdit}
					disabled={!data.tableReady || !canEdit}
					aria-disabled={!data.tableReady || !canEdit}
					title={!canEdit ? 'Anda tidak memiliki izin untuk mengedit' : ''}
				>
					<Icon name="edit" class="h-3.5 w-3.5" />
					Edit
				</button>
			{/if}
		</div>
	</div>

	<form
		class="flex flex-col gap-2 sm:flex-row"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
		autocomplete="off"
		spellcheck="false"
		onsubmit={submitSearch}
	>
		<div class="relative w-full">
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
	</form>

	{#if !hasMurid}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Belum ada murid di kelas ini. Tambahkan murid terlebih dahulu.</span>
		</div>
	{:else if !hasFilteredMurid}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/80 px-4 py-3 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
			<span>Tidak ada murid yang cocok dengan pencarian.</span>
		</div>
	{:else}
		<div
			class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th style="width: 50px; min-width: 40px;" class="px-3 py-2.5">No</th>
						<th class="w-full px-3 py-2.5" style="min-width: 160px;">Nama</th>
						<th class="px-3 py-2.5 text-center" style="min-width: 200px;">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
					{#each data.daftarMurid as murid (murid.id)}
						<tr
							class={isEditing
								? 'bg-blue-50/35 dark:bg-blue-950/15'
								: 'transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40'}
						>
							<td class="px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-400">{murid.no}</td>
							<td class="px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
								{@html searchQueryMarker(data.page.search, murid.nama)}
							</td>
							<td class="px-3 py-2.5 text-center">
								{#if isEditing}
									<div class="flex items-center justify-center gap-4">
										<label class="flex cursor-pointer items-center gap-1.5">
											<input
												type="radio"
												name="naik-{murid.id}"
												class="radio radio-sm radio-success"
												checked={editingValues[murid.id] === true}
												onchange={() => setNaik(murid.id, true)}
											/>
											<span class="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
												{statusLabelNaik}
											</span>
										</label>
										<label class="flex cursor-pointer items-center gap-1.5">
											<input
												type="radio"
												name="naik-{murid.id}"
												class="radio radio-sm radio-error"
												checked={editingValues[murid.id] === false}
												onchange={() => setNaik(murid.id, false)}
											/>
											<span class="text-xs font-semibold text-red-700 dark:text-red-400">
												{statusLabelTidak}
											</span>
										</label>
									</div>
								{:else}
									<span
										class="inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold {murid.naik
											? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
											: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'}"
									>
										{murid.naik ? statusLabelNaik : statusLabelTidak}
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
							? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
							: 'border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
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

<style>
	:global(form#keputusan-form) {
		display: contents;
	}
</style>
