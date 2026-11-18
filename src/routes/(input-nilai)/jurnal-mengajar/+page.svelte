<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { hideModal, showModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import TambahJurnalModal from '$lib/components/jurnal-mengajar/tambah-jurnal-modal.svelte';
	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';

	let { data } = $props();

	const currentPage = $derived.by(() => data.page.currentPage ?? 1);
	const totalPages = $derived.by(() => Math.max(1, data.page.totalPages ?? 1));
	const pages = $derived.by(() => Array.from({ length: totalPages }, (_, index) => index + 1));

	const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
	const bulanList = [
		'Januari',
		'Februari',
		'Maret',
		'April',
		'Mei',
		'Juni',
		'Juli',
		'Agustus',
		'September',
		'Oktober',
		'November',
		'Desember'
	];

	const tanggalLabel = $derived.by(() => {
		if (!data.tanggal) return '';
		const d = new Date(data.tanggal + 'T00:00:00');
		return `${hariList[d.getDay()]}, ${d.getDate()} ${bulanList[d.getMonth()]} ${d.getFullYear()}`;
	});

	const userType = $derived(page.data.user?.type ?? '');

	const canEdit = $derived(userType !== 'wali_asuh');

	let selectedTanggal = $derived(data.tanggal ?? '');

	function applyNavigation(update: (params: SvelteURLSearchParams) => void) {
		const params = new SvelteURLSearchParams(page.url.search);
		update(params);
		params.delete('page');
		const nextQuery = params.toString();
		void goto(`${page.url.pathname}${nextQuery ? `?${nextQuery}` : ''}`, {
			replaceState: true,
			keepFocus: true
		});
	}

	function viewDate() {
		applyNavigation((params) => {
			if (selectedTanggal) {
				params.set('tanggal', selectedTanggal);
			} else {
				params.delete('tanggal');
			}
		});
	}

	function resetToToday() {
		applyNavigation((params) => {
			params.delete('tanggal');
		});
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
		if (nextUrl === currentUrl) return null;
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

	function openTambahModal(editData?: {
		id: number;
		kelasId: number;
		mataPelajaranId: number;
		lingkupMateri: string;
		tujuanPembelajaranId: number | null;
		catatan: string;
	}) {
		let actions: { submit: () => void };
		showModal({
			title: editData ? 'Edit Jurnal' : 'Tambah Jurnal',
			body: TambahJurnalModal,
			bodyProps: {
				editData: editData ?? null,
				kelasId: data.page.kelasId ? Number(data.page.kelasId) : undefined,
				tanggal: data.tanggal ?? undefined,
				mapelId: data.mapelId,
				mataPelajaranList: data.mataPelajaranList,
				tujuanPembelajaranList: data.tujuanPembelajaranList,
				lingkupMateriList: data.lingkupMateriList,
				userType: data.userType ?? '',
				onAction: (a: { submit: () => void }) => {
					actions = a;
				},
				onSuccess: async () => {
					hideModal();
				}
			},
			onPositive: {
				label: editData ? 'Simpan' : 'Tambah',
				action: () => actions!.submit()
			},
			onNeutral: {
				label: 'Batal'
			},
			spreadActions: true,
			dismissible: true
		});
	}

	function handleTambahClick() {
		if (!data.page.kelasId) {
			toast('Pilih kelas terlebih dahulu', 'warning');
			return;
		}
		if (!data.hasAnyMapel) {
			showModal({
				title: 'Belum Ada Mata Pelajaran',
				body: `<p class="text-base-content/70">Kelas ini belum punya mata pelajaran, jadi jurnal mengajar belum bisa diisi. Tambahkan mata pelajaran untuk kelas aktif dulu, lalu kembali ke halaman ini.</p>`,
				onPositive: {
					label: 'Tambah Mata Pelajaran',
					action: () => {
						hideModal();
						void goto('/intrakurikuler/form');
					}
				},
				onNegative: { label: 'Nanti' },
				dismissible: true
			});
			return;
		}
		openTambahModal();
	}

	function confirmDelete(id: number) {
		const formId = `delete-jurnal-form-${id}`;
		showModal({
			title: 'Hapus Jurnal',
			body: '<p class="text-base-content/70">Apakah Anda yakin ingin menghapus jurnal ini?</p>',
			onPositive: {
				label: 'Hapus',
				class: 'btn-error',
				action: () => {
					(document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
				}
			},
			onNegative: { label: 'Batal' },
			dismissible: true
		});
	}

	async function handleDeleteSuccess() {
		hideModal();
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
				Jurnal Mengajar
				{#if tanggalLabel}
					: <span class="text-blue-600 dark:text-blue-400">{tanggalLabel}</span>
				{/if}
			</h1>
		</div>
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 max-sm:w-full sm:self-center dark:bg-blue-500 dark:hover:bg-blue-600"
			onclick={handleTambahClick}
			disabled={!canEdit}
			aria-disabled={!canEdit}
			title={!canEdit
				? 'Anda tidak memiliki izin'
				: !data.page.kelasId
					? 'Pilih kelas terlebih dahulu'
					: !data.hasAnyMapel
						? 'Kelas ini belum punya mata pelajaran'
						: 'Tambah jurnal baru'}
		>
			<Icon name="plus" class="h-4 w-4" />
			<span>Tambah Jurnal</span>
		</button>
	</div>

	<div class="mb-4 flex flex-wrap items-center gap-1.5">
		<input
			type="date"
			class="h-9 w-full max-w-48 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
			bind:value={selectedTanggal}
		/>
		<button
			type="button"
			class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
			aria-label="Lihat jurnal"
			title="Lihat jurnal"
			onclick={viewDate}
		>
			<Icon name="eye" class="h-4 w-4" />
		</button>
		<button
			type="button"
			class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
			aria-label="Kembali ke hari ini"
			title="Kembali ke hari ini"
			onclick={resetToToday}
			disabled={!data.tanggal}
		>
			<Icon name="repeat" class="h-4 w-4" />
		</button>
	</div>

	<div
		class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th style="width: 50px;" class="px-3 py-2.5">No</th>
					<th style="min-width: 120px;" class="px-3 py-2.5">Mata Pelajaran</th>
					<th style="width: 80px;" class="px-3 py-2.5">Jam</th>
					<th style="min-width: 140px;" class="px-3 py-2.5">Materi</th>
					<th style="min-width: 140px;" class="px-3 py-2.5">Tujuan Pembelajaran</th>
					<th style="width: 100px;" class="px-3 py-2.5 text-right">Aksi</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
				{#each data.daftarJurnal as item (item.id)}
					<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
						<td class="px-3 py-2.5 align-top tabular-nums text-slate-600 dark:text-zinc-400">
							{item.no}
						</td>
						<td class="px-3 py-2.5 align-top font-medium text-slate-900 dark:text-zinc-100">
							{item.mapelNama}
						</td>
						<td class="px-3 py-2.5 align-top tabular-nums text-slate-700 dark:text-zinc-300">
							{item.jamPelajaran}
						</td>
						<td class="px-3 py-2.5 align-top text-slate-700 dark:text-zinc-300">
							{item.lingkupMateri}
						</td>
						<td
							class="max-w-[160px] truncate px-3 py-2.5 align-top text-slate-600 dark:text-zinc-400"
							title={item.tpDeskripsi}
						>
							{item.tpDeskripsi || '-'}
						</td>
						<td class="px-3 py-2.5 align-top">
							<div class="flex justify-end gap-1.5">
								<button
									type="button"
									class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
									onclick={() =>
										openTambahModal({
											id: item.id,
											kelasId: item.kelasId,
											mataPelajaranId: item.mataPelajaranId,
											lingkupMateri: item.lingkupMateri,
											tujuanPembelajaranId: item.tpId,
											catatan: item.catatan
										})}
									disabled={!canEdit}
									aria-disabled={!canEdit}
									title={!canEdit ? 'Anda tidak memiliki izin' : 'Edit jurnal'}
								>
									<Icon name="edit" class="h-3.5 w-3.5" />
								</button>
								<FormEnhance
									id={`delete-jurnal-form-${item.id}`}
									action="?/delete"
									onsuccess={handleDeleteSuccess}
								>
									<input type="hidden" name="id" value={item.id} />
								</FormEnhance>
								<button
									type="button"
									class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
									onclick={() => confirmDelete(item.id)}
									disabled={!canEdit}
									aria-disabled={!canEdit}
									title={!canEdit ? 'Anda tidak memiliki izin' : 'Hapus jurnal'}
								>
									<Icon name="del" class="h-3.5 w-3.5" />
								</button>
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td
							class="p-8 text-center text-xs italic text-slate-500 dark:text-zinc-400"
							colspan="6"
						>
							Belum ada jurnal mengajar
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
</div>
