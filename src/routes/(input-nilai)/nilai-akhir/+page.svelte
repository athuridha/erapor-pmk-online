<script lang="ts">
	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import { modalRoute, searchQueryMarker } from '$lib/utils';
	import { onDestroy } from 'svelte';
	import LegerDownload from '$lib/components/LegerDownload.svelte';
	import KirimDapodikPage from './kirim-dapodik/+page.svelte';
	import { isAdminUser } from '../../pengguna/permissions';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.page.search ?? '');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const daftarNilai = $derived(data.daftarNilai ?? []);
	const hasRows = $derived(daftarNilai.length > 0);
	const currentPage = $derived(data.page.currentPage ?? 1);
	const totalPages = $derived(Math.max(1, data.page.totalPages ?? 1));
	const pages = $derived.by(() => Array.from({ length: totalPages }, (_, index) => index + 1));
	const summary = $derived.by(() => {
		const s = (data.summary ?? {}) as Record<string, unknown>;
		const getNum = (k: string) => Number((s[k] ?? 0) as unknown) || 0;
		return {
			totalMurid: getNum('totalMurid'),
			totalMuridDinilai: getNum('totalMuridDinilai'),
			totalMapel: getNum('totalMapel'),
			totalEkstrakurikuler: getNum('totalEkstrakurikuler'),
			totalKokurikuler: getNum('totalKokurikuler')
		};
	});
	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const isAdmin = isAdminUser(
		page.data.user as { type?: string; operatorLevel?: string | null } | null | undefined
	);
	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return null;
		return kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
	});

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

	function formatScore(value: number | null) {
		if (value == null) return '&mdash;';
		return value.toLocaleString('id-ID', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	onDestroy(() => {
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
		searchTimer = undefined;
	});
</script>

{#if !kelasAktif}
	<div
		class="mb-5 flex items-center gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
	>
		<Icon name="warning" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
		<span>Pilih kelas aktif di bagian atas sebelum melihat rekapitulasi nilai akhir.</span>
	</div>
{/if}

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="mb-4 border-b border-slate-100 pb-4 dark:border-zinc-800">
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Rekapitulasi Nilai Akhir
			</h1>
			{#if kelasAktifLabel}
				<p class="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">{kelasAktifLabel}</p>
			{/if}
		</div>
		<div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<LegerDownload kelasId={kelasAktif?.id ?? null} />
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				{#if isAdmin}
					<a
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 max-sm:w-full dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						href="/nilai-akhir/impor-nilai"
					>
						<Icon name="import" class="h-4 w-4" />
						Impor Nilai
					</a>
				{/if}
				<a
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 max-sm:w-full dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					href="/nilai-akhir/rekap-keseluruhan"
				>
					<Icon name="chart" class="h-4 w-4" />
					Rekap Keseluruhan
				</a>
				{#if kelasAktif && isAdmin}
					<a
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 max-sm:w-full dark:bg-blue-500 dark:hover:bg-blue-600"
						href="/nilai-akhir/kirim-dapodik"
						use:modalRoute={'kirim-dapodik'}
					>
						<Icon name="dapodik" class="h-4 w-4" />
						Kirim ke Dapodik
					</a>
				{/if}
			</div>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div
			class="rounded-xl border border-slate-200/70 bg-slate-50/75 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Jumlah Murid</div>
			<div class="mt-0.5 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{summary.totalMurid}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
				{summary.totalMuridDinilai} sudah dinilai
			</div>
		</div>
		<div
			class="rounded-xl border border-slate-200/70 bg-slate-50/75 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Mapel Per Kelas</div>
			<div class="mt-0.5 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{summary.totalMapel}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
				Menghitung rata-rata per murid
			</div>
		</div>

		<div
			class="rounded-xl border border-slate-200/70 bg-slate-50/75 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Kokurikuler</div>
			<div class="mt-0.5 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{summary.totalKokurikuler}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
				Jumlah kegiatan kokurikuler
			</div>
		</div>

		<div
			class="rounded-xl border border-slate-200/70 bg-slate-50/75 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Ekstrakurikuler</div>
			<div class="mt-0.5 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{summary.totalEkstrakurikuler}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
				Jumlah kegiatan ekstrakurikuler
			</div>
		</div>
	</div>

	<form
		class="mt-4 flex flex-col gap-2 sm:flex-row"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
		onsubmit={submitSearch}
	>
		<!-- Cari nama murid -->
		<div class="relative w-full">
			<span
				class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
			>
				<Icon name="search" class="h-4 w-4" />
			</span>
			<input
				type="search"
				name="q"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
				value={searchTerm}
				spellcheck="false"
				placeholder="Cari nama murid..."
				autocomplete="name"
				oninput={handleSearchInput}
			/>
		</div>
	</form>

	<div
		class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th style="width: 56px; min-width: 44px;" class="px-3 py-2.5">Peringkat</th>
					<th class="w-full px-3 py-2.5" style="min-width: 140px;">Nama</th>
					<th style="min-width: 150px;" class="px-3 py-2.5">Rata-rata Intrakurikuler</th>
					<th style="min-width: 130px;" class="px-3 py-2.5">Rata-rata Kokurikuler</th>
					<th style="min-width: 130px;" class="px-3 py-2.5">Rata-rata Ekstrakurikuler</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
				{#if hasRows}
					{#each daftarNilai as murid (murid.id)}
						<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
							<td class="px-3 py-2.5 font-semibold tabular-nums text-slate-700 dark:text-zinc-300">
								{murid.peringkat}
							</td>
							<td class="px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
								{@html searchQueryMarker(data.page.search, murid.nama)}
							</td>
							<td class="px-3 py-2.5">
								<a
									class="inline-flex h-8 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-xs font-semibold whitespace-nowrap text-slate-800 transition-colors hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
									title={`Lihat nilai akhir ${murid.nama}`}
									href={murid.detailHref}
								>
									<Icon name="eye" class="h-3.5 w-3.5 shrink-0" />
									<span class="tabular-nums">{@html formatScore(murid.nilaiRataRata)}</span>
									<span class="font-normal text-slate-500 tabular-nums dark:text-zinc-400">
										{murid.jumlahMapelDinilai}{#if murid.totalMapelRelevan}&nbsp;/&nbsp;{murid.totalMapelRelevan}{/if}
									</span>
								</a>
							</td>
							<td class="px-3 py-2.5">
								<a
									class="inline-flex h-8 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-xs font-semibold whitespace-nowrap text-slate-800 transition-colors hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
									title={`Lihat nilai akhir kokurikuler ${murid.nama}`}
									href={murid.kokDetailHref ??
										`/nilai-akhir/nilai-kokurikuler?murid_id=${murid.id}`}
								>
									<Icon name="eye" class="h-3.5 w-3.5 shrink-0" />
									<span class="whitespace-nowrap">{murid.kriteriaKokurikuler ?? '-'}</span>
									<span class="font-normal text-slate-500 tabular-nums dark:text-zinc-400">
										{murid.jumlahKokurikulerDinilai}{#if murid.totalKokurikulerRelevan}&nbsp;/&nbsp;{murid.totalKokurikulerRelevan}{/if}
									</span>
								</a>
							</td>
							<td class="px-3 py-2.5">
								<a
									class="inline-flex h-8 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-xs font-semibold whitespace-nowrap text-slate-800 transition-colors hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
									title={`Lihat nilai akhir ekstrakurikuler ${murid.nama}`}
									href={murid.eksDetailHref ?? `/nilai-akhir/nilai-ekstra?murid_id=${murid.id}`}
								>
									<Icon name="eye" class="h-3.5 w-3.5 shrink-0" />
									<span class="whitespace-nowrap">{murid.kriteriaEkstrakurikuler ?? '-'}</span>
									<span class="font-normal text-slate-500 tabular-nums dark:text-zinc-400">
										{murid.jumlahEkstrakurikulerDinilai}{#if murid.totalEkstrakurikulerRelevan}&nbsp;/&nbsp;{murid.totalEkstrakurikulerRelevan}{/if}
									</span>
								</a>
							</td>
						</tr>
					{/each}
				{:else}
					<tr>
						<td
							class="p-8 text-center text-xs italic text-slate-500 dark:text-zinc-400"
							colspan="5"
						>
							Belum ada data nilai akhir untuk ditampilkan.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>

	{#if pages.length > 1}
		<div class="mt-4 flex flex-wrap items-center justify-center gap-1">
			{#each pages as pageNumber (pageNumber)}
				<button
					type="button"
					class="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border px-2.5 text-xs font-semibold tabular-nums transition-colors disabled:opacity-60 {pageNumber ===
					currentPage
						? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
						: 'border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
					disabled={pageNumber === currentPage && totalPages === 1}
					onclick={() => handlePageClick(pageNumber)}
				>
					{pageNumber}
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if page.state.modal?.name === 'kirim-dapodik'}
	<dialog
		class="modal bg-slate-950/45 backdrop-blur-[2px]"
		onclose={() => history.back()}
		onclick={(e) => {
			const rect = e.currentTarget.querySelector('.modal-box')?.getBoundingClientRect();
			if (
				rect &&
				(e.clientX < rect.left ||
					e.clientX > rect.right ||
					e.clientY < rect.top ||
					e.clientY > rect.bottom)
			) {
				e.currentTarget.close();
			}
		}}
		open
	>
		<div
			class="modal-box flex max-h-[90vh] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:w-full sm:max-w-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<KirimDapodikPage data={page.state.modal?.data} />
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button>close</button>
		</form>
	</dialog>
{/if}
