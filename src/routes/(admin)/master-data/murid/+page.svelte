<script lang="ts">
	import { goto, invalidate, pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { isAdminUser } from '../../../pengguna/permissions';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { modalRoute, searchQueryMarker } from '$lib/utils';
	import { onDestroy } from 'svelte';
	import MuridModals from '$lib/components/murid/modals.svelte';
	import PindahMuridModal from '$lib/components/murid/pindah-murid-modal.svelte';
	import { buildPageNumbers, OPSI_BARIS_PER_HALAMAN } from '$lib/utils/pagination';

	type BulkModalData = {
		type: 'bulk';
		selectedMurids: {
			id: number;
			nama: string;
			nis: string;
			nisn: string;
		}[];
	};

	let { data } = $props();

	// Tambah/ubah/hapus murid adalah wewenang operator/admin.
	const canEdit = $derived(isAdminUser(page.data.user));
	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.page.search ?? '');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	const currentPage = $derived.by(() => data.page.currentPage ?? 1);
	const totalPages = $derived.by(() => Math.max(1, data.page.totalPages ?? 1));
	const nomorHalaman = $derived(buildPageNumbers(currentPage, totalPages));

	let selectedIds = $state<Set<number>>(new Set());
	const hasSelection = $derived.by(() => selectedIds.size > 0);
	const semuaDipilih = $derived.by(
		() => data.daftarMurid.length > 0 && selectedIds.size === data.daftarMurid.length
	);
	const selectedMurids = $derived.by(() =>
		data.daftarMurid.filter((murid) => selectedIds.has(murid.id))
	);

	$effect(() => {
		if (searchTimer) return;
		const latestSearchTerm = data.page.search ?? '';
		if (searchTerm !== latestSearchTerm) {
			searchTerm = latestSearchTerm;
		}
	});

	let selectAllCheckbox = $state<HTMLInputElement | null>(null);
	let formSubmitting = $state(false);
	let isBulkPhotoUploadOpen = $state(false);
	let isMoveOpen = $state(false);
	let isNaikKelasOpen = $state(false);
	let naikKelasTujuanId = $state<number | string>('');
	let dropdownToggle: HTMLButtonElement | null = $state(null);

	type TargetMuridKeluarkan = {
		id: number;
		nama: string;
		nis?: string | null;
		nisn?: string | null;
	};

	let targetMuridKeluarkan = $state<TargetMuridKeluarkan | null>(null);
	let isKeluarkanBulkOpen = $state(false);
	let formTanggalKeluar = $state(new Date().toISOString().split('T')[0]);
	let formAlasanKeluar = $state('Dikeluarkan oleh pihak sekolah (Pelanggaran Tata Tertib)');
	let formAlasanKustom = $state('');

	function bukaKeluarkanModal(murid: {
		id: number;
		nama: string;
		nis?: string | null;
		nisn?: string | null;
	}) {
		targetMuridKeluarkan = murid;
		formTanggalKeluar = new Date().toISOString().split('T')[0];
		formAlasanKeluar = 'Dikeluarkan oleh pihak sekolah (Pelanggaran Tata Tertib)';
		formAlasanKustom = '';
	}

	const kelasFilter = $derived(
		((page.data as { daftarKelas?: Array<{ id: number; nama: string }> }).daftarKelas ?? []).map(
			(kelas) => ({ value: String(kelas.id), label: kelas.nama })
		)
	);

	function setKelasFilter(value: string) {
		const params = new URLSearchParams(page.url.search);
		if (value) params.set('kelas_id', value);
		else params.delete('kelas_id');
		params.delete('page');
		void goto(`/master-data/murid${params.size ? `?${params}` : ''}`, { invalidateAll: true });
	}

	function setJkFilter(value: string) {
		const params = new URLSearchParams(page.url.search);
		if (value) params.set('jk', value);
		else params.delete('jk');
		params.delete('page');
		void goto(`/master-data/murid${params.size ? `?${params}` : ''}`, { invalidateAll: true });
	}

	async function setStatusFilter(statusKey: string) {
		const params = new SvelteURLSearchParams(page.url.search);
		if (statusKey === 'aktif') {
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

	function handleSubmittingChange(value: boolean) {
		formSubmitting = value;
	}

	function openBulkPhotoUploadModal() {
		// Close dropdown first with small delay
		if (dropdownToggle) {
			dropdownToggle.blur();
		}
		// Open modal after dropdown closes
		setTimeout(() => {
			isBulkPhotoUploadOpen = true;
		}, 100);
	}

	function toggleSelect(id: number, checked: boolean) {
		const next = new Set(selectedIds);
		if (checked) {
			next.add(id);
		} else {
			next.delete(id);
		}
		selectedIds = next;
	}

	function toggleSelectAll(checked: boolean) {
		if (!data.daftarMurid.length) {
			selectedIds = new Set();
			return;
		}
		selectedIds = checked ? new Set(data.daftarMurid.map((murid) => murid.id)) : new Set<number>();
	}

	function openBulkDeleteModal() {
		if (!hasSelection) return;
		const modalData: BulkModalData = {
			type: 'bulk',
			selectedMurids: selectedMurids.map((murid) => ({
				id: murid.id,
				nama: murid.nama,
				nis: murid.nis,
				nisn: murid.nisn
			}))
		};
		pushState(`${page.url.pathname}${page.url.search}`, {
			modal: {
				name: 'delete-murid',
				data: modalData
			}
		});
	}

	function openBulkMoveModal() {
		if (!hasSelection) return;
		isMoveOpen = true;
	}

	/** Naik kelas: murid terpilih dipindah ke kelas fase berikutnya (pilihan). */
	function openNaikKelasModal() {
		if (!hasSelection) return;
		naikKelasTujuanId = '';
		isNaikKelasOpen = true;
	}

	async function handleNaikKelasSuccess({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:murid');
		selectedIds = new Set();
		isNaikKelasOpen = false;
		naikKelasTujuanId = '';
		toast({
			message:
				typeof hasil?.message === 'string' ? hasil.message : 'Kenaikan kelas berhasil disimpan.',
			type: 'success',
			persist: true
		});
	}

	const kelasTujuanNaik = $derived.by(() => {
		const groups = new Map<string, typeof data.kelasTujuan>();
		for (const kelas of data.kelasTujuan ?? []) {
			const label = [kelas.tahunAjaranNama, kelas.semesterNama].filter(Boolean).join(' - ');
			const items = groups.get(label) ?? [];
			items.push(kelas);
			groups.set(label, items);
		}
		return [...groups.entries()];
	});

	function handleBulkMoveSuccess() {
		selectedIds = new Set();
	}

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

	function submitBulkDelete(event: Event) {
		event.preventDefault();
		const form = document.getElementById('form-bulk-delete') as HTMLFormElement | null;
		if (!form || formSubmitting) return;
		form.requestSubmit();
	}

	async function handleBulkDeleteSuccess({ data }: { data?: Record<string, unknown> }) {
		const countBefore = selectedIds.size;
		await invalidate('app:murid');
		selectedIds = new Set();
		const message =
			typeof data?.message === 'string'
				? data.message
				: `${countBefore || 1} murid berhasil dihapus`;
		toast({ message, type: 'success', persist: true });
		if (page.state.modal?.name === 'delete-murid') {
			history.back();
		}
	}

	$effect(() => {
		const validIds = new Set(data.daftarMurid.map((murid) => murid.id));
		if (!validIds.size && selectedIds.size) {
			selectedIds = new Set();
			return;
		}
		let changed = false;
		for (const id of selectedIds) {
			if (!validIds.has(id)) {
				changed = true;
				break;
			}
		}
		if (changed) {
			selectedIds = new Set([...selectedIds].filter((id) => validIds.has(id)));
		}
	});

	$effect(() => {
		if (selectAllCheckbox) {
			selectAllCheckbox.indeterminate =
				selectedIds.size > 0 && selectedIds.size < data.daftarMurid.length;
		}
	});

	const academicContext = $derived(data.academicContext ?? null);
	const activeSemester = $derived.by(() => {
		const context = academicContext;
		if (!context?.activeSemesterId) return null;
		for (const tahun of context.tahunAjaranList ?? []) {
			const match = tahun.semester.find((item) => item.id === context.activeSemesterId);
			if (match) {
				return {
					...match,
					tahunAjaranNama: tahun.nama
				};
			}
		}
		return null;
	});

	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return null;
		return kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
	});

	// Calculate offset for pagination numbering
	const offset = $derived((currentPage - 1) * data.page.perPage);
</script>

{#if academicContext}
	{#if academicContext.activeSemesterId}
		<div
			class="mb-4 flex items-center gap-2.5 rounded-2xl border border-blue-200/80 bg-blue-50/75 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0" />
			<span>
				Menampilkan data murid untuk
				{#if activeSemester}
					<strong>{activeSemester.nama}</strong>
					({activeSemester.tahunAjaranNama})
				{:else}
					semester aktif
				{/if}.
			</span>
		</div>
	{:else}
		<div
			class="mb-4 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="warning" class="h-4 w-4 shrink-0" />
			<span>Setel semester aktif di menu Rapor untuk mulai mengelola data kelas per periode.</span>
		</div>
	{/if}
{/if}

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Daftar &amp; Data Murid
			</h1>
			{#if kelasAktifLabel}
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">{kelasAktifLabel}</p>
			{/if}
		</div>
		<!-- Tombol Aksi Massal atau Tambah Murid -->
		{#if hasSelection}
			<div class="flex flex-wrap gap-2">
				<button
					class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="button"
					aria-disabled={formSubmitting || !canEdit}
					disabled={formSubmitting || !canEdit}
					onclick={openBulkMoveModal}
					title={!canEdit
						? 'Anda tidak memiliki izin untuk memindahkan murid'
						: 'Pindahkan murid terpilih ke kelas lain'}
				>
					<Icon name="move" class="h-3.5 w-3.5" />
					Pindahkan
				</button>
				<button
					class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-950"
					type="button"
					aria-disabled={formSubmitting || !canEdit}
					disabled={formSubmitting || !canEdit}
					onclick={openNaikKelasModal}
					title={!canEdit
						? 'Anda tidak memiliki izin untuk menaikkan kelas'
						: 'Naikkan murid terpilih ke kelas fase berikutnya'}
				>
					<Icon name="up" class="h-3.5 w-3.5" />
					Naik Kelas
				</button>
				<button
					class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950/80"
					type="button"
					aria-disabled={formSubmitting || !canEdit}
					disabled={formSubmitting || !canEdit}
					onclick={() => {
						formTanggalKeluar = new Date().toISOString().split('T')[0];
						formAlasanKeluar = 'Dikeluarkan oleh pihak sekolah (Pelanggaran Tata Tertib)';
						formAlasanKustom = '';
						isKeluarkanBulkOpen = true;
					}}
					title={!canEdit ? 'Anda tidak memiliki izin' : 'Keluarkan murid terpilih dari sekolah'}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					Keluarkan
				</button>
				<button
					class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/80"
					type="button"
					aria-disabled={formSubmitting || !canEdit}
					disabled={formSubmitting || !canEdit}
					onclick={openBulkDeleteModal}
					title={!canEdit ? 'Anda tidak memiliki izin untuk menghapus' : 'Hapus murid terpilih'}
				>
					<Icon name="del" class="h-3.5 w-3.5" />
					Hapus
				</button>
			</div>
		{:else}
			<div class="flex max-sm:w-full">
				{#if canEdit}
					<a
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-l-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 max-sm:flex-1"
						href="/master-data/murid/form"
						use:modalRoute={'add-murid'}
					>
						<Icon name="plus" class="h-4 w-4" />
						Tambah Murid
					</a>
				{/if}
				<div class="dropdown dropdown-end">
					<button
						bind:this={dropdownToggle}
						type="button"
						tabindex="0"
						aria-label="Menu opsi murid lainnya"
						class="inline-flex h-9 items-center justify-center gap-1.5 {canEdit
							? 'rounded-r-xl border-l border-blue-500 bg-blue-600 px-2.5 text-white hover:bg-blue-700'
							: 'rounded-xl border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'} shadow-sm transition-colors"
					>
						{#if !canEdit}<span class="text-xs font-semibold">Opsi</span>{/if}
						<Icon name="down" class="h-3.5 w-3.5" />
					</button>
					<ul
						tabindex="-1"
						class="dropdown-content menu z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
					>
						<li><a href="/master-data/murid/photos">Lihat Semua Foto</a></li>
						{#if canEdit}
							<li>
								<button type="button" onclick={openBulkPhotoUploadModal} class="text-left">
									Unggah Semua Foto
								</button>
							</li>
						{/if}
						<li>
							<a href="/api/murid/download-excel" class="text-left">Unduh Murid</a>
						</li>
					</ul>
				</div>
			</div>
		{/if}
	</div>

	<!-- Filter Status Murid -->
	<div
		class="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50/90 p-1.5 dark:border-zinc-800 dark:bg-zinc-800/60"
	>
		{#each [{ key: 'aktif', label: 'Aktif', count: data.statusCounts?.aktif ?? 0 }, { key: 'keluar', label: 'Dikeluarkan / Keluar', count: data.statusCounts?.keluar ?? 0 }, { key: 'pindah', label: 'Pindah', count: data.statusCounts?.pindah ?? 0 }, { key: 'lulus', label: 'Lulus', count: data.statusCounts?.lulus ?? 0 }, { key: 'semua', label: 'Semua Status', count: data.statusCounts?.semua ?? 0 }] as tab (tab.key)}
			{@const isActiveTab = (data.page.status ?? 'aktif') === tab.key}
			<button
				type="button"
				class="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors {isActiveTab
					? 'bg-blue-600 text-white shadow-sm'
					: 'text-slate-700 hover:bg-white hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}"
				onclick={() => setStatusFilter(tab.key)}
			>
				<span>{tab.label}</span>
				<span
					class="rounded px-1.5 py-0.5 text-[11px] tabular-nums {isActiveTab
						? 'bg-blue-700/80 text-white'
						: 'bg-slate-200/80 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200'}"
					>{tab.count}</span
				>
			</button>
		{/each}
	</div>

	<form
		class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
		onsubmit={submitSearch}
	>
		<!-- Cari nama murid -->
		<div class="relative flex min-w-0 flex-1 items-center">
			<span
				aria-hidden="true"
				class="pointer-events-none absolute left-3 flex items-center text-slate-500 dark:text-zinc-400"
			>
				<Icon name="search" class="h-4 w-4" />
			</span>
			<input
				type="search"
				name="q"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
				value={searchTerm}
				spellcheck="false"
				placeholder="Cari nama murid..."
				autocomplete="name"
				oninput={handleSearchInput}
			/>
		</div>
		<div class="relative flex items-center sm:w-40">
			<select
				class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
				value={data.page.kelasId ?? ''}
				title="Filter kelas"
				onchange={(event) => setKelasFilter((event.currentTarget as HTMLSelectElement).value)}
			>
				<option value="">Semua kelas</option>
				{#each kelasFilter as kelas (kelas.value)}
					<option value={kelas.value}>{kelas.label}</option>
				{/each}
			</select>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
			>
				<Icon name="down" class="h-3.5 w-3.5" />
			</span>
		</div>
		<div class="relative flex items-center sm:w-36">
			<select
				class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
				value={data.page.jk ?? ''}
				title="Filter jenis kelamin"
				onchange={(event) => setJkFilter((event.currentTarget as HTMLSelectElement).value)}
			>
				<option value="">Semua JK</option>
				<option value="L">Laki-laki</option>
				<option value="P">Perempuan</option>
			</select>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
			>
				<Icon name="down" class="h-3.5 w-3.5" />
			</span>
		</div>
		<div class="relative flex items-center sm:w-32">
			<select
				class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
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
				class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
			>
				<Icon name="down" class="h-3.5 w-3.5" />
			</span>
		</div>
	</form>

	<FormEnhance
		id="form-bulk-delete"
		action="?/deleteSelected"
		submitStateChange={handleSubmittingChange}
		onsuccess={handleBulkDeleteSuccess}
		showToast={false}
	>
		{#snippet children({ submitting })}
			<div
				class="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<table class="w-full border-collapse text-xs">
					<thead>
						<tr
							class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
						>
							{#if canEdit}
								<th class="px-3 py-2.5">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										bind:this={selectAllCheckbox}
										checked={semuaDipilih}
										onchange={(event) => toggleSelectAll(event.currentTarget.checked)}
										aria-label="Pilih semua murid"
										disabled={submitting}
									/>
								</th>
							{/if}
							<th class="w-10 px-3 py-2.5">No</th>
							<th class="px-3 py-2.5 whitespace-nowrap">NIS</th>
							<th class="px-3 py-2.5 whitespace-nowrap">NISN</th>
							<th class="min-w-44 px-3 py-2.5">Nama</th>
							<th class="px-3 py-2.5 whitespace-nowrap">Kelas</th>
							<th class="min-w-28 px-3 py-2.5">Ayah</th>
							<th class="px-3 py-2.5">Agama</th>
							<th class="px-3 py-2.5">Tempat Lahir</th>
							<th class="px-3 py-2.5">Tanggal Lahir</th>
							<th class="px-3 py-2.5 text-center">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
						{#each data.daftarMurid as murid, index (murid)}
							<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
								{#if canEdit}
									<td class="px-3 py-2.5">
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											name="muridIds"
											value={murid.id}
											checked={selectedIds.has(murid.id)}
											onchange={(event) => toggleSelect(murid.id, event.currentTarget.checked)}
											aria-label={`Pilih ${murid.nama}`}
											disabled={submitting}
										/>
									</td>
								{/if}
								<td class="px-3 py-2.5 text-slate-600 tabular-nums dark:text-zinc-400"
									>{offset + index + 1}</td
								>
								<td class="px-3 py-2.5 font-mono text-xs text-slate-700 dark:text-zinc-300"
									>{murid.nis || '-'}</td
								>
								<td class="px-3 py-2.5 font-mono text-xs text-slate-700 dark:text-zinc-300"
									>{murid.nisn || '-'}</td
								>
								<td class="px-3 py-2.5">
									<div class="flex flex-wrap items-center gap-1.5">
										<span class="font-semibold text-slate-900 dark:text-zinc-100"
											>{@html searchQueryMarker(data.page.search, murid.nama)}</span
										>
										{#if murid.status === 'keluar'}
											<span
												class="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800 dark:bg-red-950/70 dark:text-red-300"
												title={`Dikeluarkan: ${murid.alasanKeluar ?? '-'} (${murid.tanggalKeluar ?? '-'})`}
											>
												Keluar
											</span>
										{:else if murid.status === 'pindah'}
											<span
												class="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
												>Pindah</span
											>
										{:else if murid.status === 'lulus'}
											<span
												class="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
												>Lulus</span
											>
										{/if}
									</div>
									{#if murid.status === 'keluar' && murid.alasanKeluar}
										<p class="mt-0.5 text-xs text-red-700 dark:text-red-300">
											Alasan: {murid.alasanKeluar}
											{murid.tanggalKeluar ? `(${murid.tanggalKeluar})` : ''}
										</p>
									{/if}
								</td>
								<td class="px-3 py-2.5 text-slate-700 dark:text-zinc-300">
									{murid.kelas?.nama ?? '-'}
									{#if murid.kelas?.fase}
										<span class="block text-[11px] text-slate-500 dark:text-zinc-400"
											>{murid.kelas.fase}</span
										>
									{/if}
								</td>
								<td class="px-3 py-2.5 text-slate-700 dark:text-zinc-300"
									>{murid.ayah?.nama ?? '-'}</td
								>
								<td class="px-3 py-2.5 text-slate-700 dark:text-zinc-300">{murid.agama}</td>
								<td class="px-3 py-2.5 text-slate-700 dark:text-zinc-300">{murid.tempatLahir}</td>
								<td class="px-3 py-2.5 text-slate-700 tabular-nums dark:text-zinc-300"
									>{murid.tanggalLahir}</td
								>
								<td class="px-3 py-2.5">
									<div class="flex flex-row justify-center">
										<a
											class="inline-flex h-8 w-8 items-center justify-center {canEdit
												? 'rounded-l-lg'
												: 'rounded-lg'} border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
											href="/master-data/murid/{murid.id}"
											use:modalRoute={'detail-murid'}
											title="Lihat detail murid"
										>
											<Icon name="eye" class="h-3.5 w-3.5" />
										</a>

										{#if canEdit}
											{#if murid.status === 'keluar'}
												<!-- Tombol Aktifkan Kembali -->
												<FormEnhance
													action="?/aktifkanMurid"
													onsuccess={() => {
														toast('Status murid berhasil diaktifkan kembali.', 'success');
													}}
												>
													{#snippet children({ submitting: subAktif })}
														<input type="hidden" name="muridId" value={murid.id} />
														<button
															type="submit"
															class="inline-flex h-8 w-8 items-center justify-center border-y border-r border-slate-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-zinc-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950"
															disabled={subAktif}
															title="Aktifkan kembali murid ini"
														>
															<Icon name="check" class="h-3.5 w-3.5" />
														</button>
													{/snippet}
												</FormEnhance>
											{:else}
												<!-- Tombol Keluarkan Murid -->
												<button
													type="button"
													class="inline-flex h-8 w-8 items-center justify-center border-y border-r border-slate-200 bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100 dark:border-zinc-700 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950"
													onclick={() => bukaKeluarkanModal(murid)}
													title="Keluarkan murid dari sekolah"
												>
													<Icon name="close" class="h-3.5 w-3.5" />
												</button>
											{/if}

											<button
												type="button"
												class="inline-flex h-8 w-8 items-center justify-center border-y border-r border-slate-200 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 dark:border-zinc-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
												onclick={() => {
													selectedIds = new Set([murid.id]);
													isMoveOpen = true;
												}}
												title="Pindah kelas {murid.nama}"
												aria-label="Pindah kelas {murid.nama}"
											>
												<Icon name="move" class="h-3.5 w-3.5" />
											</button>
											<a
												class="inline-flex h-8 w-8 items-center justify-center rounded-r-lg border-y border-r border-slate-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-zinc-700 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
												href="/master-data/murid/{murid.id}/delete"
												use:modalRoute={'delete-murid'}
												title="Hapus data murid permanen"
											>
												<Icon name="del" class="h-3.5 w-3.5" />
											</a>
										{:else}
											<button
												type="button"
												class="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-r-lg border-y border-r border-slate-200 bg-slate-100 text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
												disabled
												aria-disabled="true"
												title="Anda tidak memiliki izin mengelola murid"
											>
												<Icon name="del" class="h-3.5 w-3.5" />
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td class="px-3 py-8 text-center text-slate-500 dark:text-zinc-400" colspan="11">
									Belum ada data murid
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/snippet}
	</FormEnhance>
	<!-- pagination -->
	{#if totalPages > 1}
		<div class="mt-4 flex flex-wrap items-center justify-center gap-1">
			<button
				type="button"
				class="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
				disabled={currentPage <= 1}
				onclick={() => handlePageClick(currentPage - 1)}
			>
				&laquo;
			</button>
			{#each nomorHalaman as nomor, index (index)}
				{#if nomor === '…'}
					<span class="inline-flex h-8 min-w-8 items-center justify-center text-xs text-slate-400"
						>…</span
					>
				{:else}
					<button
						type="button"
						class="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border px-2 text-xs font-semibold tabular-nums transition-colors {nomor ===
						currentPage
							? 'border-blue-600 bg-blue-600 text-white shadow-sm'
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
			>
				&raquo;
			</button>
		</div>
	{/if}

	<p class="mt-3 text-center text-xs text-slate-500 dark:text-zinc-400">
		Menampilkan {data.daftarMurid.length} dari {data.page.totalItems ?? 0} data
	</p>
</div>

<MuridModals {formSubmitting} {submitBulkDelete} bind:isBulkPhotoUploadOpen />

<PindahMuridModal
	bind:isOpen={isMoveOpen}
	muridTerpilih={selectedMurids.map((murid) => ({
		id: murid.id,
		nama: murid.nama,
		nis: murid.nis
	}))}
	kelasTujuan={data.kelasTujuan ?? []}
	action="?/pindahMurid"
	onSuccess={handleBulkMoveSuccess}
/>

<!-- Modal Naik Kelas (massal) -->
{#if isNaikKelasOpen}
	<dialog class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]">
		<div
			class="modal-box max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3
				class="flex items-center gap-2 border-b border-slate-200 pb-3 text-base font-bold dark:border-zinc-800"
			>
				<Icon name="up" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
				Naik Kelas Massal
			</h3>
			<p class="pt-3 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
				<strong>{selectedMurids.length}</strong> murid terpilih akan dipindah ke kelas tujuan. Murid yang
				sudah di kelas tujuan atau tidak punya fase lebih rendah dilaporkan gagal tanpa membatalkan sisanya.
			</p>

			<FormEnhance action="?/naikKelas" onsuccess={handleNaikKelasSuccess} showToast={false}>
				{#snippet children({ submitting, invalid })}
					{#each selectedMurids as murid (murid.id)}
						<input type="hidden" name="muridIds" value={murid.id} />
					{/each}

					{#if kelasTujuanNaik.length}
						<label class="mt-3 flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Kelas tujuan (fase berikutnya)</span
							>
							<div class="relative flex items-center">
								<select
									name="kelasId"
									class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									required
									disabled={submitting}
									bind:value={naikKelasTujuanId}
								>
									<option value="" disabled>Pilih kelas tujuan</option>
									{#each kelasTujuanNaik as [label, items] (label)}
										<optgroup {label}>
											{#each items as kelas (kelas.id)}
												<option value={kelas.id}>
													{kelas.nama}{kelas.fase ? ` (${kelas.fase})` : ''}
												</option>
											{/each}
										</optgroup>
									{/each}
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3.5 w-3.5" />
								</span>
							</div>
							<span class="text-xs text-slate-500 dark:text-zinc-400">
								Kelas tujuan sebaiknya satu fase di atas kelas asal (mis. Fase E ke Fase F).
							</span>
						</label>
					{:else}
						<div
							class="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
						>
							<Icon name="warning" class="h-4 w-4 shrink-0" />
							<span>Belum ada kelas tujuan yang tersedia pada semester ini.</span>
						</div>
					{/if}

					<div
						class="mt-3 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-800/70"
					>
						<ul class="list-disc space-y-1 pl-4 text-slate-800 dark:text-zinc-200">
							{#each selectedMurids as murid (murid.id)}
								<li>
									{murid.nama}
									<span class="text-slate-500 dark:text-zinc-400">({murid.kelas?.nama ?? '-'})</span
									>
								</li>
							{/each}
						</ul>
					</div>

					<div class="modal-action mt-4 border-t border-slate-200 pt-3 dark:border-zinc-800">
						<button
							type="button"
							class="inline-flex h-9 items-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (isNaikKelasOpen = false)}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={submitting || invalid || !naikKelasTujuanId}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<Icon name="up" class="h-3.5 w-3.5" />
							{/if}
							Naikkan {selectedMurids.length} Murid
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button onclick={() => (isNaikKelasOpen = false)}>close</button>
		</form>
	</dialog>
{/if}

<!-- Modal Keluarkan Satuan -->
{#if targetMuridKeluarkan}
	<dialog class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]">
		<div
			class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3
				class="flex items-center gap-2 border-b border-slate-200 pb-3 text-base font-bold text-red-700 dark:border-zinc-800 dark:text-red-400"
			>
				<Icon name="warning" class="h-4 w-4" />
				Keluarkan Murid
			</h3>
			<p class="pt-3 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
				Anda akan mengeluarkan murid <strong>{targetMuridKeluarkan.nama}</strong>
				{targetMuridKeluarkan.nis ? `(NIS: ${targetMuridKeluarkan.nis})` : ''}. Status murid akan
				diubah menjadi <em>Keluar</em> dan tidak tampil di daftar murid aktif.
			</p>

			<FormEnhance
				action="?/keluarkanMurid"
				onsuccess={() => {
					targetMuridKeluarkan = null;
					toast('Murid berhasil dikeluarkan.', 'success');
				}}
			>
				{#snippet children({ submitting })}
					<input type="hidden" name="muridId" value={targetMuridKeluarkan?.id} />

					<label class="mt-3 flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Tanggal Keluar</span
						>
						<input
							type="date"
							name="tanggalKeluar"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							bind:value={formTanggalKeluar}
							required
						/>
					</label>

					<div class="mt-3 flex flex-col gap-1.5">
						<label
							class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							for="keluarkan-satuan-alasan">Alasan Keluar</label
						>
						<div class="relative flex items-center">
							<select
								id="keluarkan-satuan-alasan"
								class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={formAlasanKeluar}
								onchange={(e) => {
									const val = (e.currentTarget as HTMLSelectElement).value;
									if (val !== 'Lainnya') formAlasanKustom = '';
								}}
							>
								<option value="Dikeluarkan oleh pihak sekolah (Pelanggaran Tata Tertib)">
									Dikeluarkan oleh pihak sekolah (Pelanggaran Tata Tertib)
								</option>
								<option value="Drop Out (DO) / Putus Sekolah">Drop Out (DO) / Putus Sekolah</option>
								<option value="Mengundurkan Diri">Mengundurkan Diri</option>
								<option value="Pindah Sekolah">Pindah Sekolah</option>
								<option value="Bekerja">Bekerja</option>
								<option value="Lainnya">Lainnya...</option>
							</select>
							<span
								aria-hidden="true"
								class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
							>
								<Icon name="down" class="h-3.5 w-3.5" />
							</span>
						</div>
						{#if formAlasanKeluar === 'Lainnya'}
							<input
								type="text"
								class="mt-1.5 h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								placeholder="Tuliskan alasan keluar..."
								bind:value={formAlasanKustom}
								required
							/>
						{/if}
						<input
							type="hidden"
							name="alasanKeluar"
							value={formAlasanKeluar === 'Lainnya' ? formAlasanKustom : formAlasanKeluar}
						/>
					</div>

					<div class="modal-action mt-5 border-t border-slate-200 pt-3 dark:border-zinc-800">
						<button
							type="button"
							class="inline-flex h-9 items-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (targetMuridKeluarkan = null)}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={submitting || (formAlasanKeluar === 'Lainnya' && !formAlasanKustom.trim())}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Keluarkan Murid
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<button
			type="button"
			class="modal-backdrop bg-transparent"
			onclick={() => (targetMuridKeluarkan = null)}
			aria-label="Tutup"
		></button>
	</dialog>
{/if}

<!-- Modal Keluarkan Massal -->
{#if isKeluarkanBulkOpen}
	<dialog class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]">
		<div
			class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3
				class="flex items-center gap-2 border-b border-slate-200 pb-3 text-base font-bold text-red-700 dark:border-zinc-800 dark:text-red-400"
			>
				<Icon name="warning" class="h-4 w-4" />
				Keluarkan {selectedIds.size} Murid Terpilih
			</h3>
			<p class="pt-3 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
				Semua murid yang dipilih akan diubah statusnya menjadi <em>Keluar</em> dan dipindahkan ke arsip
				murid non-aktif.
			</p>

			<FormEnhance
				action="?/keluarkanBulk"
				onsuccess={() => {
					isKeluarkanBulkOpen = false;
					selectedIds = new Set();
					toast('Murid terpilih berhasil dikeluarkan.', 'success');
				}}
			>
				{#snippet children({ submitting })}
					{#each Array.from(selectedIds) as id (id)}
						<input type="hidden" name="muridIds" value={id} />
					{/each}

					<label class="mt-3 flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Tanggal Keluar</span
						>
						<input
							type="date"
							name="tanggalKeluar"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							bind:value={formTanggalKeluar}
							required
						/>
					</label>

					<div class="mt-3 flex flex-col gap-1.5">
						<label
							class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							for="keluarkan-bulk-alasan">Alasan Keluar</label
						>
						<div class="relative flex items-center">
							<select
								id="keluarkan-bulk-alasan"
								class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={formAlasanKeluar}
								onchange={(e) => {
									const val = (e.currentTarget as HTMLSelectElement).value;
									if (val !== 'Lainnya') formAlasanKustom = '';
								}}
							>
								<option value="Dikeluarkan oleh pihak sekolah (Pelanggaran Tata Tertib)">
									Dikeluarkan oleh pihak sekolah (Pelanggaran Tata Tertib)
								</option>
								<option value="Drop Out (DO) / Putus Sekolah">Drop Out (DO) / Putus Sekolah</option>
								<option value="Mengundurkan Diri">Mengundurkan Diri</option>
								<option value="Pindah Sekolah">Pindah Sekolah</option>
								<option value="Bekerja">Bekerja</option>
								<option value="Lainnya">Lainnya...</option>
							</select>
							<span
								aria-hidden="true"
								class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
							>
								<Icon name="down" class="h-3.5 w-3.5" />
							</span>
						</div>
						{#if formAlasanKeluar === 'Lainnya'}
							<input
								type="text"
								class="mt-1.5 h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								placeholder="Tuliskan alasan keluar..."
								bind:value={formAlasanKustom}
								required
							/>
						{/if}
						<input
							type="hidden"
							name="alasanKeluar"
							value={formAlasanKeluar === 'Lainnya' ? formAlasanKustom : formAlasanKeluar}
						/>
					</div>

					<div class="modal-action mt-5 border-t border-slate-200 pt-3 dark:border-zinc-800">
						<button
							type="button"
							class="inline-flex h-9 items-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (isKeluarkanBulkOpen = false)}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={submitting || (formAlasanKeluar === 'Lainnya' && !formAlasanKustom.trim())}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Keluarkan {selectedIds.size} Murid
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<button
			type="button"
			class="modal-backdrop bg-transparent"
			onclick={() => (isKeluarkanBulkOpen = false)}
			aria-label="Tutup"
		></button>
	</dialog>
{/if}
