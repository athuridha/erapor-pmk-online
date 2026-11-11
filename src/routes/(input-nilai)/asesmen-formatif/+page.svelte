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

<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
		<div>
			<h2 class="text-xl font-bold">
				Daftar Nilai Formatif
				{#if data.selectedMapel}
					- {data.selectedMapel.nama}
				{/if}
			</h2>
			{#if kelasAktifLabel}
				<p class="text-base-content/70 text-sm">Kelas aktif: {kelasAktifLabel}</p>
			{:else}
				<p class="text-base-content/60 text-sm">
					Pilih kelas di navbar atau pemilih kelas untuk melihat mata pelajaran intrakurikuler.
				</p>
			{/if}
		</div>
	</div>

	<div class="flex flex-col items-center gap-2 sm:flex-row">
		<KelasKontenPicker currentId={data.kelasKontenAktif?.id ?? null} />
		<form class="w-full sm:w-64 md:w-72" method="get" use:autoSubmit>
			<select
				class="select bg-base-200 w-full truncate dark:border-none"
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
		</form>
		<form
			class="w-full flex-1"
			data-sveltekit-keepfocus
			data-sveltekit-replacestate
			autocomplete="off"
			onsubmit={submitSearch}
		>
			<!-- Cari nama murid -->
			<label class="input bg-base-200 dark:bg-base-300 w-full dark:border-none">
				<Icon name="search" />
				<input
					type="search"
					name="q"
					value={searchTerm}
					spellcheck="false"
					autocomplete="name"
					placeholder="Cari nama murid..."
					oninput={handleSearchInput}
				/>
			</label>
		</form>
	</div>

	{#if data.daftarMurid.length > 0}
		<div class="mt-3 flex flex-wrap items-center justify-between gap-2">
			<p class="text-base-content/70 text-sm">
				Centang murid pada tabel untuk menilai satu lingkup materi sekaligus.
			</p>
			<div class="flex items-center gap-2">
				{#if muridTerpilih.length}
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => togglePilihSemua(false)}
					>
						Kosongkan
					</button>
				{/if}
				<button
					type="button"
					class="btn btn-primary btn-soft btn-sm shadow-none"
					onclick={bukaMassal}
					disabled={!canEdit || !muridTerpilih.length || !bulkLingkupList.length}
					aria-disabled={!canEdit || !muridTerpilih.length || !bulkLingkupList.length}
					title={!canEdit
						? 'Anda tidak memiliki izin untuk menilai'
						: !bulkLingkupList.length
							? 'Belum ada lingkup materi pada mata pelajaran ini'
							: 'Isi penguasaan untuk murid yang dicentang'}
				>
					<Icon name="edit" />
					Isi Sekaligus ({muridTerpilih.length})
				</button>
			</div>
		</div>
	{/if}

	{#if data.mapelList.length === 0}
		<div class="alert alert-soft alert-info mt-6">
			<Icon name="info" />
			<span>
				Belum ada mata pelajaran intrakurikuler di kelas ini. Tambahkan terlebih dahulu di menu
				<strong>Intrakurikuler</strong>.
			</span>
		</div>
	{:else if data.daftarMurid.length === 0}
		<div class="alert alert-soft alert-warning mt-6">
			<Icon name="alert" />
			<span>
				Belum ada data murid untuk kelas ini. Silakan tambah murid di menu <strong>Murid</strong>.
			</span>
		</div>
	{:else}
		<div
			class="bg-base-100 dark:bg-base-200 mt-4 overflow-x-auto rounded-md shadow-md dark:shadow-none"
		>
			<table class="border-base-200 table min-w-150 border dark:border-none">
				<thead>
					<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
						<th class="text-center" style="width: 40px;">
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
						<th style="width: 50px; min-width: 40px;">No</th>
						<th class="min-w-40">Nama</th>
						<th>Aksi</th>
						<th class="w-full" style="min-width: 220px;">Progres</th>
					</tr>
				</thead>
				<tbody>
					{#each data.daftarMurid as murid (murid.id)}
						{@const bisaDipilih = murid.mapelId != null && murid.canNilai && canEdit}
						<tr>
							<td class="align-top">
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
							<td class="align-top">{murid.no}</td>
							<td class="align-top">
								{@html searchQueryMarker(data.search, murid.nama)}
								{#if murid.agamaLabel}
									<div class="text-[11px] font-normal opacity-70">{murid.agamaLabel}</div>
								{/if}
							</td>
							<td class="align-top">
								{#if murid.nilaiHref && canEdit && murid.hasTujuan}
									<a class="btn btn-sm btn-soft shadow-none" href={murid.nilaiHref}>
										<Icon name="edit" />
										Nilai
									</a>
								{:else}
									<button
										type="button"
										class="btn btn-sm btn-disabled shadow-none"
										disabled
										aria-disabled="true"
										title={!canEdit
											? 'Anda tidak memiliki izin untuk menilai'
											: murid.hasTujuan === false
												? 'Belum ada tujuan pembelajaran untuk mata pelajaran ini — tambahkan dulu di Intrakurikuler'
												: data.allowedAgamaForUser
													? `Hanya untuk murid beragama ${data.allowedAgamaForUser.join(' / ')}`
													: 'Pilih mata pelajaran'}
									>
										<Icon name="edit" />
										Nilai
									</button>
								{/if}
							</td>
							<td class="align-top">
								{#if murid.progressText}
									<p
										class={murid.progressSummaryParts.length
											? 'text-base-content text-sm'
											: 'text-base-content/70 text-sm italic'}
									>
										{@html summaryWithHighlights(murid)}
									</p>
								{:else}
									<span class="text-base-content/70 text-sm italic"
										>Pilih mata pelajaran untuk melihat progres</span
									>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="join mt-4 sm:mx-auto">
			{#each pages as pageNumber (pageNumber)}
				<button
					type="button"
					class="join-item btn"
					class:btn-active={pageNumber === currentPage}
					onclick={() => handlePageClick(pageNumber)}
					aria-current={pageNumber === currentPage ? 'page' : undefined}
				>
					{pageNumber}
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if massalTerbuka && muridTerpilih.length}
	<dialog class="modal" open onclose={() => (massalTerbuka = false)}>
		<div class="modal-box max-w-lg p-4">
			<h3 class="mb-1 text-lg font-bold">Isi Penguasaan Sekaligus</h3>
			<p class="text-base-content/70 mb-2 text-sm">
				{muridTerpilih.length} murid terpilih
				{#if data.selectedMapel}
					· {data.selectedMapel.nama}
				{/if}
				· semua TP pada lingkup materi terpilih akan dicentang sama.
			</p>
			<ul
				class="border-base-300 bg-base-200/60 mb-3 max-h-24 overflow-y-auto rounded-md border p-2 text-sm"
			>
				{#each muridTerpilih as murid (murid.id)}
					<li class="flex items-center gap-1.5">
						<Icon name="check" />
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
					<fieldset class="fieldset">
						<legend class="fieldset-legend font-semibold">Lingkup materi</legend>
						<select
							name="lingkupMateri"
							class="select bg-base-200 dark:bg-base-300 w-full dark:border-none"
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
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend font-semibold">Penguasaan</legend>
						<div class="flex flex-wrap gap-4">
							<label class="label cursor-pointer gap-2">
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
							<label class="label cursor-pointer gap-2">
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
						<p class="label text-base-content/60 text-xs">
							Mengubah penguasaan seluruh TP pada lingkup materi ini.
						</p>
					</fieldset>
					<div class="modal-action">
						<button
							type="button"
							class="btn btn-ghost"
							onclick={() => (massalTerbuka = false)}
							disabled={submitting}
						>
							Batal
						</button>
						<button type="submit" class="btn btn-primary" disabled={submitting}>
							<Icon name="save" />
							Simpan ({muridTerpilih.length})
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop"
			onclick={() => (massalTerbuka = false)}
		></button>
	</dialog>
{/if}
