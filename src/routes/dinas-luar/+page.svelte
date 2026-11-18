<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import { searchQueryMarker } from '$lib/utils';
	import { toast } from '$lib/components/toast.svelte';
	import { onDestroy } from 'svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import DinasLuarFormModal from '$lib/components/dinas-luar/dinas-luar-form-modal.svelte';
	import DinasLuarDetailBody from '$lib/components/dinas-luar/dinas-luar-detail-body.svelte';
	import DinasLuarDetailDisetujuiBody from '$lib/components/dinas-luar/dinas-luar-detail-disetujui-body.svelte';
	import DinasLuarBuktiModal from '$lib/components/dinas-luar/dinas-luar-bukti-modal.svelte';
	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';

	import type { DinasLuarItem, DinasLuarPermohonanRow, SppdDisetujuiRow } from './+page.server';

	type PageState = {
		search: string | null;
		currentPage: number;
		totalPages: number;
		totalItems: number;
	};

	type PageData = {
		daftarItem: DinasLuarItem[];
		page: PageState;
		permohonanCount: number;
		disetujuiCount: number;
	};

	let { data }: { data: PageData } = $props();

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

	function formatTanggalShort(value: string | null | undefined): string {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function escapeHtml(value: string | null | undefined): string {
		if (!value) return '';
		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	function openTambahModal() {
		showModal({
			title: 'Permohonan Perjalanan Dinas',
			body: DinasLuarFormModal,
			dismissible: true
		});
	}

	function viewDetail(permohonan: DinasLuarPermohonanRow) {
		showModal({
			title: 'Detail Perjalanan Dinas',
			body: DinasLuarDetailBody,
			bodyProps: { permohonan },
			dismissible: true,
			onNeutral: { label: 'Tutup' }
		});
	}

	function viewDisetujui(sppd: SppdDisetujuiRow) {
		const hasBukti = sppd.bukti.length > 0;
		showModal({
			title: 'Detail Dinas Luar',
			body: DinasLuarDetailDisetujuiBody,
			bodyProps: { sppd },
			dismissible: true,
			spreadActions: true,
			onPositive: {
				label: hasBukti ? 'Edit Bukti' : 'Unggah Bukti',
				icon: 'download',
				class: 'btn-primary',
				action: () => openBuktiUpload(sppd)
			},
			...(hasBukti
				? {
						onExtra: {
							label: 'Cetak Gabungan',
							icon: 'print',
							class:
								'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300',
							href: `/api/dinas-luar/bukti/cetak?sppdId=${sppd.id}`
						}
					}
				: {}),
			onNeutral: { label: 'Tutup' }
		});
	}

	function openBuktiUpload(sppd: SppdDisetujuiRow) {
		showModal({
			title: 'Edit Bukti Perjalanan Dinas',
			body: DinasLuarBuktiModal,
			bodyProps: { sppdId: sppd.id, existing: sppd.bukti },
			dismissible: true
		});
	}

	async function handleDelete(permohonan: DinasLuarPermohonanRow) {
		showModal({
			title: 'Hapus Data Permohonan Perjalanan Dinas',
			body: `Hapus permohonan perjalanan dinas <strong>${escapeHtml(
				permohonan.maksud
			)}</strong>? Tindakan ini tidak dapat dibatalkan.`,
			dismissible: false,
			onPositive: {
				label: 'Hapus',
				class: 'btn-error',
				action: async ({ close }) => {
					try {
						const res = await fetch(`/api/dinas-luar?id=${permohonan.id}`, {
							method: 'DELETE'
						});
						if (res.ok) {
							toast('Permohonan perjalanan dinas berhasil dihapus', 'success');
							await invalidate('app:dinas-luar');
						} else {
							toast('Gagal menghapus data', 'error');
						}
					} catch {
						toast('Terjadi kesalahan', 'error');
					}
					close();
				}
			},
			onNegative: { label: 'Batal' }
		});
	}

	onDestroy(() => {
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
		searchTimer = undefined;
	});

	const hasData = $derived(data.permohonanCount > 0 || data.disetujuiCount > 0);
	const hasFiltered = $derived(data.page.totalItems > 0);
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Dinas Luar</h1>
			<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
				{data.permohonanCount} pengajuan, {data.disetujuiCount} perjalanan dinas disetujui
			</p>
		</div>
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
			onclick={openTambahModal}
			title="Tambah permohonan perjalanan dinas"
		>
			<Icon name="plus" class="h-3.5 w-3.5" />
			Tambah Permohonan Perjalanan Dinas
		</button>
	</div>

	<form
		class="flex flex-col gap-2 sm:flex-row"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
		autocomplete="off"
		spellcheck="false"
		onsubmit={submitSearch}
	>
		<div class="relative flex w-full items-center">
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
				placeholder="Cari maksud perjalanan dinas..."
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				oninput={handleSearchInput}
				autocomplete="off"
			/>
		</div>
	</form>

	{#if !hasData}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Belum ada data dinas luar.</span>
		</div>
	{:else if !hasFiltered}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
			<span>Tidak ada data yang cocok dengan pencarian.</span>
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
						<th class="w-12 px-3.5 py-2.5">No</th>
						<th class="min-w-28 px-3.5 py-2.5">Status</th>
						<th class="min-w-28 px-3.5 py-2.5">Tanggal</th>
						<th class="min-w-44 px-3.5 py-2.5">Nama Lengkap</th>
						<th class="min-w-18 px-3.5 py-2.5 text-center">Jumlah</th>
						<th class="min-w-48 px-3.5 py-2.5">Keterangan</th>
						<th class="w-24 px-3.5 py-2.5 text-center">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
					{#each data.daftarItem as item (item.status === 'pengajuan' ? `p-${item.permohonan.id}` : `s-${item.sppd.id}`)}
						<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
							<td class="px-3.5 py-2.5 text-slate-500 dark:text-zinc-400">{item.no}</td>
							<td class="px-3.5 py-2.5">
								{#if item.status === 'pengajuan'}
									<span
										class="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
									>
										Pengajuan
									</span>
								{:else}
									<span
										class="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
									>
										Disetujui
									</span>
								{/if}
							</td>
							<td class="px-3.5 py-2.5 whitespace-nowrap text-slate-600 dark:text-zinc-300">
								{formatTanggalShort(item.tanggal)}
							</td>
							<td
								class="px-3.5 py-2.5 font-medium whitespace-nowrap text-slate-900 dark:text-zinc-100"
							>
								{item.nama}
							</td>
							<td class="px-3.5 py-2.5 text-center text-slate-700 dark:text-zinc-300">
								{item.jumlah}
							</td>
							<td class="max-w-60 truncate px-3.5 py-2.5 text-slate-600 dark:text-zinc-300">
								{@html searchQueryMarker(data.page.search, item.maksud)}
							</td>
							<td class="px-3.5 py-2.5 text-center">
								<div class="flex items-center justify-center gap-1.5">
									{#if item.status === 'pengajuan'}
										<button
											type="button"
											class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200/80 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
											onclick={() => viewDetail(item.permohonan)}
											aria-label="Lihat detail"
											title="Lihat detail"
										>
											<Icon name="eye" class="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
											onclick={() => handleDelete(item.permohonan)}
											aria-label="Hapus"
											title="Hapus"
										>
											<Icon name="del" class="h-3.5 w-3.5" />
										</button>
									{:else}
										<button
											type="button"
											class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200/80 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
											onclick={() => viewDisetujui(item.sppd)}
											aria-label="Lihat detail dinas luar"
											title="Lihat detail dinas luar"
										>
											<Icon name="eye" class="h-3.5 w-3.5" />
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if pages.length > 1}
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
