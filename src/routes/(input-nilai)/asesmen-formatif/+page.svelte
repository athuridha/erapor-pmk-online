<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import KelasKontenPicker from '$lib/components/kelas-konten-picker.svelte';
	import { autoSubmit, searchQueryMarker } from '$lib/utils';
	import { onDestroy } from 'svelte';

	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';

	type ProgressCategory = 'sangat-baik' | 'baik' | 'perlu-pendalaman' | 'perlu-bimbingan';
	type PaginationState = {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		perPage: number;
		search: string | null;
	};
	type PageData = {
		kelasKontenAktif?: { id: number; nama: string; fase: string | null } | null;
		mapelList: Array<{ value: string; nama: string }>;
		selectedMapelValue: string | null;
		daftarMurid: Array<{
			id: number;
			nama: string;
			agamaLabel?: string | null;
			no: number;
			/** mapelId efektif baris ini (varian agama/PKS sudah di-resolve server). */
			mapelId?: number | null;
			progressText: string | null;
			progressSummaryParts: Array<{
				kategori: ProgressCategory;
				kategoriLabel: string;
				lingkupMateri: string;
				tuntas: number;
				totalTujuan: number;
			}>;
			hasPenilaian: boolean;
			hasTujuan?: boolean;
			nilaiHref: string | null;
			canNilai?: boolean;
		}>;
		jumlahTujuan: number;
		/** Daftar lingkup materi untuk pengisian massal (semua varian mapel relevan). */
		bulkLingkupList?: string[];
		selectedMapel?: { id: number | null; nama: string } | null;
		search: string | null;
		page: PaginationState;
		allowedAgamaForUser?: string[];
	};

	let { data }: { data: PageData } = $props();

	const CATEGORY_TEXT_CLASS: Record<ProgressCategory, string> = {
		'sangat-baik': 'text-info',
		baik: 'text-primary',
		'perlu-pendalaman': 'text-warning',
		'perlu-bimbingan': 'text-error'
	};

	// svelte-ignore state_referenced_locally
	let selectedMapelValue = $state(data.selectedMapelValue ?? '');
	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.search ?? '');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	const currentPage = $derived.by(() => data.page?.currentPage ?? 1);
	const totalPages = $derived.by(() => Math.max(1, data.page?.totalPages ?? 1));
	const pages = $derived.by(() => Array.from({ length: totalPages }, (_, index) => index + 1));

	const kelasAktifLabel = $derived.by(() => {
		const kelas = data.kelasKontenAktif ?? page.data.kelasAktif ?? null;
		if (!kelas) return null;
		return kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama;
	});

	// Restrict editing for wali_asuh
	const canEdit = $derived.by(() => {
		const u = page.data.user as { type?: string } | null | undefined;
		return u?.type !== 'wali_asuh';
	});

	$effect(() => {
		selectedMapelValue = data.selectedMapelValue ?? '';
		searchTerm = data.search ?? '';
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

	function escapeHtml(value: string) {
		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function summaryWithHighlights(murid: (typeof data.daftarMurid)[number]) {
		if (!murid.progressSummaryParts.length || !murid.progressText) {
			return murid.progressText ?? '';
		}

		const source = escapeHtml(murid.progressText);
		let cursor = 0;
		let html = '';
		for (const part of murid.progressSummaryParts) {
			const token = `${part.tuntas}/${part.totalTujuan} TP`;
			const nextIndex = source.indexOf(token, cursor);
			if (nextIndex === -1) {
				continue;
			}
			html += source.slice(cursor, nextIndex);
			html += `<span class="${CATEGORY_TEXT_CLASS[part.kategori]} font-semibold">${token}</span>`;
			cursor = nextIndex + token.length;
		}
		html += source.slice(cursor);
		return html;
	}

	// ── Isi massal: centang beberapa murid lalu ceklis penguasaan satu lingkup ──
	let terpilihMurid = $state<number[]>([]);
	let massalTerbuka = $state(false);
	let massalLingkup = $state('');
	let massalStatus = $state<'ya' | 'tidak'>('ya');

	const bulkLingkupList = $derived(data.bulkLingkupList ?? []);

	// Hanya baris dengan mapelId efektif & boleh dinilai yang bisa dicentang.
	const muridBisaDipilih = $derived(
		data.daftarMurid.filter((murid) => murid.mapelId != null && murid.canNilai)
	);
	const muridTerpilih = $derived(
		muridBisaDipilih.filter((murid) => terpilihMurid.includes(murid.id))
	);
	const semuaTerpilih = $derived(
		muridBisaDipilih.length > 0 && muridTerpilih.length === muridBisaDipilih.length
	);
	const itemsMassal = $derived(
		JSON.stringify(muridTerpilih.map((murid) => ({ muridId: murid.id, mapelId: murid.mapelId })))
	);

	function togglePilihMurid(id: number, checked: boolean) {
		terpilihMurid = checked
			? [...new Set([...terpilihMurid, id])]
			: terpilihMurid.filter((value) => value !== id);
	}

	function togglePilihSemua(checked: boolean) {
		terpilihMurid = checked ? muridBisaDipilih.map((murid) => murid.id) : [];
	}

	function bukaMassal() {
		if (!muridTerpilih.length) return;
		massalLingkup = bulkLingkupList[0] ?? '';
		massalStatus = 'ya';
		massalTerbuka = true;
	}

	function selesaiMassal() {
		massalTerbuka = false;
		terpilihMurid = [];
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Daftar Nilai Formatif
				{#if data.selectedMapel}
					: {data.selectedMapel.nama}
				{/if}
			</h1>
			{#if kelasAktifLabel}
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Kelas aktif: <span class="font-medium text-slate-800 dark:text-zinc-200"
						>{kelasAktifLabel}</span
					>
				</p>
			{:else}
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Pilih kelas di navbar atau pemilih kelas untuk melihat mata pelajaran intrakurikuler.
				</p>
			{/if}
		</div>
	</div>

	<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
		<KelasKontenPicker currentId={data.kelasKontenAktif?.id ?? null} />
		<form class="w-full sm:w-64 md:w-72" method="get" use:autoSubmit>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					title="Pilih mata pelajaran"
					name="mapel_id"
					bind:value={selectedMapelValue}
					disabled={data.mapelList.length === 0}
				>
					{#if data.mapelList.length === 0}
						<option value="">Belum ada mata pelajaran</option>
					{:else}
						<option value="" disabled selected={selectedMapelValue === ''}>
							Pilih Mata Pelajaran
						</option>
						{#each data.mapelList as mapel (mapel.value)}
							<option value={mapel.value}>{mapel.nama}</option>
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
		</form>
		<form
			class="w-full flex-1"
			data-sveltekit-keepfocus
			data-sveltekit-replacestate
			autocomplete="off"
			onsubmit={submitSearch}
		>
			<!-- Cari nama murid -->
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
					spellcheck="false"
					autocomplete="name"
					placeholder="Cari nama murid..."
					oninput={handleSearchInput}
				/>
			</div>
		</form>
	</div>

	{#if data.daftarMurid.length > 0}
		<div
			class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40"
		>
			<p class="text-xs text-slate-600 dark:text-zinc-400">
				Centang murid pada tabel untuk menilai satu lingkup materi sekaligus.
			</p>
			<div class="flex items-center gap-2">
				{#if muridTerpilih.length}
					<button
						type="button"
						class="inline-flex h-8 items-center rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
						onclick={() => togglePilihSemua(false)}
					>
						Kosongkan
					</button>
				{/if}
				<button
					type="button"
					class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={bukaMassal}
					disabled={!canEdit || !muridTerpilih.length || !bulkLingkupList.length}
					aria-disabled={!canEdit || !muridTerpilih.length || !bulkLingkupList.length}
					title={!canEdit
						? 'Anda tidak memiliki izin untuk menilai'
						: !bulkLingkupList.length
							? 'Belum ada lingkup materi pada mata pelajaran ini'
							: 'Isi penguasaan untuk murid yang dicentang'}
				>
					<Icon name="edit" class="h-3.5 w-3.5" />
					Isi Sekaligus ({muridTerpilih.length})
				</button>
			</div>
		</div>
	{/if}

	{#if data.mapelList.length === 0}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
			<span>
				Belum ada mata pelajaran intrakurikuler di kelas ini. Tambahkan terlebih dahulu di menu
				<strong>Intrakurikuler</strong>.
			</span>
		</div>
	{:else if data.daftarMurid.length === 0}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>
				Belum ada data murid untuk kelas ini. Silakan tambah murid di menu <strong>Murid</strong>.
			</span>
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
						<th class="px-3 py-2.5 text-center" style="width: 44px;">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={semuaTerpilih}
								disabled={!canEdit || !muridBisaDipilih.length}
								onchange={(event) => togglePilihSemua(event.currentTarget.checked)}
								title="Pilih semua murid yang bisa dinilai"
								aria-label="Pilih semua murid yang bisa dinilai"
							/>
						</th>
						<th style="width: 50px; min-width: 40px;" class="px-3 py-2.5">No</th>
						<th class="min-w-40 px-3 py-2.5">Nama</th>
						<th class="px-3 py-2.5">Aksi</th>
						<th class="w-full px-3 py-2.5" style="min-width: 220px;">Progres</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
					{#each data.daftarMurid as murid (murid.id)}
						{@const bisaDipilih = murid.mapelId != null && murid.canNilai && canEdit}
						<tr class="transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50">
							<td class="px-3 py-2.5 align-top text-center">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={terpilihMurid.includes(murid.id)}
									disabled={!bisaDipilih}
									onchange={(event) => togglePilihMurid(murid.id, event.currentTarget.checked)}
									title={bisaDipilih
										? `Pilih ${murid.nama}`
										: 'Murid ini belum bisa dinilai pada mata pelajaran terpilih'}
									aria-label="Pilih {murid.nama}"
								/>
							</td>
							<td class="px-3 py-2.5 align-top tabular-nums text-slate-600 dark:text-zinc-400">
								{murid.no}
							</td>
							<td class="px-3 py-2.5 align-top font-medium text-slate-900 dark:text-zinc-100">
								{@html searchQueryMarker(data.search, murid.nama)}
								{#if murid.agamaLabel}
									<div class="mt-0.5 text-[11px] font-normal text-slate-500 dark:text-zinc-400">
										{murid.agamaLabel}
									</div>
								{/if}
							</td>
							<td class="px-3 py-2.5 align-top">
								{#if murid.nilaiHref && canEdit && murid.hasTujuan}
									<a
										class="inline-flex h-8 items-center gap-1 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
										href={murid.nilaiHref}
									>
										<Icon name="edit" class="h-3.5 w-3.5" />
										Nilai
									</a>
								{:else}
									<button
										type="button"
										class="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-400 cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
										disabled
										aria-disabled="true"
										title={!canEdit
											? 'Anda tidak memiliki izin untuk menilai'
											: murid.hasTujuan === false
												? 'Belum ada tujuan pembelajaran untuk mata pelajaran ini. Tambahkan dulu di Intrakurikuler'
												: data.allowedAgamaForUser
													? `Hanya untuk murid beragama ${data.allowedAgamaForUser.join(' / ')}`
													: 'Pilih mata pelajaran'}
									>
										<Icon name="edit" class="h-3.5 w-3.5" />
										Nilai
									</button>
								{/if}
							</td>
							<td class="px-3 py-2.5 align-top">
								{#if murid.progressText}
									<p
										class={murid.progressSummaryParts.length
											? 'text-xs text-slate-800 dark:text-zinc-200'
											: 'text-xs italic text-slate-500 dark:text-zinc-400'}
									>
										{@html summaryWithHighlights(murid)}
									</p>
								{:else}
									<span class="text-xs italic text-slate-500 dark:text-zinc-400">
										Pilih mata pelajaran untuk melihat progres
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

{#if massalTerbuka && muridTerpilih.length}
	<dialog
		class="modal bg-slate-950/45 backdrop-blur-[2px]"
		open
		onclose={() => (massalTerbuka = false)}
	>
		<div
			class="modal-box max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="mb-1 text-lg font-bold">Isi Penguasaan Sekaligus</h3>
			<p class="mb-3 text-xs text-slate-600 dark:text-zinc-400">
				{muridTerpilih.length} murid terpilih
				{#if data.selectedMapel}
					· {data.selectedMapel.nama}
				{/if}
				· semua TP pada lingkup materi terpilih akan dicentang sama.
			</p>
			<ul
				class="mb-4 max-h-24 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-800/50"
			>
				{#each muridTerpilih as murid (murid.id)}
					<li class="flex items-center gap-1.5 text-slate-800 dark:text-zinc-200">
						<Icon name="check" class="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
						<span class="truncate">{murid.nama}</span>
					</li>
				{/each}
			</ul>
			<FormEnhance
				id="form-nilai-massal-formatif"
				action="?/simpanMassal"
				onsuccess={() => selesaiMassal()}
			>
				{#snippet children({ submitting })}
					<input type="hidden" name="items" value={itemsMassal} />
					<div class="space-y-3.5">
						<div>
							<span class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Lingkup materi
							</span>
							<div class="relative flex items-center">
								<select
									name="lingkupMateri"
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									bind:value={massalLingkup}
									required
									disabled={submitting}
								>
									{#if !bulkLingkupList.length}
										<option value="">Belum ada lingkup materi</option>
									{:else}
										{#each bulkLingkupList as lingkup (lingkup)}
											<option value={lingkup}>{lingkup}</option>
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
						</div>
						<div>
							<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Penguasaan
							</span>
							<div class="flex flex-wrap gap-4">
								<label class="flex cursor-pointer items-center gap-2 text-xs">
									<input
										type="radio"
										name="status"
										class="radio radio-sm radio-success"
										value="ya"
										bind:group={massalStatus}
										disabled={submitting}
									/>
									<span>Tuntas (YA)</span>
								</label>
								<label class="flex cursor-pointer items-center gap-2 text-xs">
									<input
										type="radio"
										name="status"
										class="radio radio-sm radio-error"
										value="tidak"
										bind:group={massalStatus}
										disabled={submitting}
									/>
									<span>Belum tuntas (TIDAK)</span>
								</label>
							</div>
							<p class="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
								Mengubah penguasaan seluruh TP pada lingkup materi ini.
							</p>
						</div>
					</div>
					<div
						class="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800"
					>
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (massalTerbuka = false)}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={submitting}
						>
							<Icon name="save" class="h-4 w-4" />
							Simpan ({muridTerpilih.length})
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop bg-transparent"
			onclick={() => (massalTerbuka = false)}
		></button>
	</dialog>
{/if}
