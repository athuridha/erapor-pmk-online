<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import KokurikulerFormModal from '$lib/components/kokurikuler/form-modal.svelte';
	import KokurikulerDeleteModal from '$lib/components/kokurikuler/delete-modal.svelte';
	import ImportKokurikulerDialog from '$lib/components/kokurikuler/import-kokurikuler-dialog.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import {
		profilPelajarPancasilaDimensionLabelByKey,
		profilPelajarPancasilaDimensions,
		type DimensiProfilLulusanKey
	} from '$lib/statics';

	let {
		data
	}: {
		data: {
			kelasId: number | null;
			semuaKelas: boolean;
			filterKelasIds: number[];
			kelasOptions: Array<{ id: number; nama: string; fase: string | null }>;
			bisaKelolaKelasIds: number[];
			mapelKokurikuler: Array<{
				id: number;
				nama: string | null;
				kode: string | null;
				jenis: string;
				pengampu: string | null;
			}>;
			kokurikuler: Array<
				Kokurikuler & {
					dimensi: DimensiProfilLulusanKey[];
					kelas?: { id: number; nama: string; fase: string | null } | null;
				}
			>;
			dimensiPilihan: typeof profilPelajarPancasilaDimensions;
			tableReady: boolean;
		};
	} = $props();

	let selectedIds = $state<number[]>([]);
	let selectedDimensions = $state<DimensiProfilLulusanKey[]>([]);
	let selectAllCheckbox: HTMLInputElement | null = null;
	let lastTableReady = $state<boolean | null>(null);
	let modalState = $state<
		| { mode: 'add' }
		| { mode: 'edit'; item: Kokurikuler & { dimensi: DimensiProfilLulusanKey[] } }
		| null
	>(null);
	let deleteDialogState = $state<
		| { source: 'bulk'; ids: number[] }
		| {
				source: 'single';
				ids: number[];
				item: Kokurikuler & { dimensi: DimensiProfilLulusanKey[] };
		  }
		| null
	>(null);
	let kodeInput = $state('');
	let tujuanInput = $state('');

	const labelByKey = profilPelajarPancasilaDimensionLabelByKey;

	const totalData = $derived.by(() => data.kokurikuler.length);
	const kelasAktifLabel = $derived.by(() => {
		const kelas = page.data.kelasAktif ?? null;
		if (!kelas) return null;
		return kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama;
	});
	const anySelected = $derived.by(() => selectedIds.length > 0);
	const allSelected = $derived.by(() => totalData > 0 && selectedIds.length === totalData);
	const canManage = $derived.by(() => data.tableReady);
	// Guru/wali hanya boleh mengelola kelas wali + kelas diampu (dari server).
	const canEdit = $derived.by(() => {
		const u = page.data.user as { type?: string } | null | undefined;
		if (u?.type === 'wali_asuh') return false;
		// Mode semua kelas: kelas dipilih di form, izin dicek server per kelas.
		if (data.semuaKelas) return true;
		return data.kelasId != null && data.bisaKelolaKelasIds.includes(data.kelasId);
	});
	const dimensionOptions = $derived.by(() => [...data.dimensiPilihan]);
	const isModalOpen = $derived.by(() => modalState !== null);
	const isEditMode = $derived.by(() => modalState?.mode === 'edit');
	const modalItem = $derived.by(() => (modalState?.mode === 'edit' ? modalState.item : null));
	const modalTitle = $derived.by(() => (isEditMode ? 'Edit Kokurikuler' : 'Tambah Kokurikuler'));
	const modalAction = $derived.by(() => (isEditMode ? '?/update' : '?/add'));
	const bulkDeleteDisabled = $derived.by(() => !anySelected || !canManage);
	const isDeleteModalOpen = $derived.by(() => deleteDialogState !== null);
	const deleteModalTitle = $derived.by(() => {
		if (!deleteDialogState) return 'Hapus Kokurikuler';
		return deleteDialogState.source === 'bulk'
			? `Hapus ${deleteDialogState.ids.length} Kokurikuler`
			: 'Hapus Kokurikuler';
	});
	const deleteModalItem = $derived.by(() =>
		deleteDialogState?.source === 'single' ? deleteDialogState.item : null
	);
	const deleteModalIds = $derived.by(() => deleteDialogState?.ids ?? []);
	const deleteModalDisabled = $derived.by(() => deleteModalIds.length === 0 || !canManage);
	const deleteModalMode = $derived.by(() =>
		deleteDialogState?.source === 'single' ? 'single' : 'bulk'
	);

	$effect(() => {
		if (selectAllCheckbox) {
			selectAllCheckbox.indeterminate = selectedIds.length > 0 && selectedIds.length < totalData;
		}
	});

	$effect(() => {
		if (selectedIds.length === 0) return;
		const existingIds = new Set(data.kokurikuler.map((item) => item.id));
		const filtered = selectedIds.filter((id) => existingIds.has(id));
		if (filtered.length !== selectedIds.length) {
			selectedIds = filtered;
		}
	});

	$effect(() => {
		const tableReady = data.tableReady ?? false;
		if (lastTableReady === tableReady) return;
		lastTableReady = tableReady;

		if (!tableReady) {
			if (selectedIds.length) selectedIds = [];
			if (selectedDimensions.length) selectedDimensions = [];
			if (kodeInput) kodeInput = '';
			if (tujuanInput) tujuanInput = '';
			if (modalState) modalState = null;
			if (deleteDialogState) deleteDialogState = null;
		}
	});

	function toggleRowSelection(id: number, checked: boolean) {
		selectedIds = checked
			? [...new Set([...selectedIds, id])]
			: selectedIds.filter((selectedId) => selectedId !== id);
	}

	function handleSelectAll(checked: boolean) {
		selectedIds = checked ? data.kokurikuler.map((item) => item.id) : [];
	}

	function openAddModal() {
		if (!canManage) return;
		if (selectedDimensions.length) selectedDimensions = [];
		kodeInput = '';
		tujuanInput = '';
		modalState = { mode: 'add' };
	}

	function openEditModal(item: Kokurikuler & { dimensi: DimensiProfilLulusanKey[] }) {
		if (!canManage) return;
		selectedDimensions = [...item.dimensi];
		kodeInput = item.kode;
		tujuanInput = item.tujuan;
		modalState = { mode: 'edit', item };
	}

	function openBulkDeleteModal() {
		if (!canManage) return;
		if (!selectedIds.length) return;
		deleteDialogState = { source: 'bulk', ids: [...selectedIds] };
	}

	function openSingleDeleteModal(item: Kokurikuler & { dimensi: DimensiProfilLulusanKey[] }) {
		if (!canManage) return;
		deleteDialogState = { source: 'single', ids: [item.id], item };
	}

	function toggleFilterKelas(id: number, checked: boolean) {
		const next = checked
			? [...new Set([...data.filterKelasIds, id])]
			: data.filterKelasIds.filter((existing) => existing !== id);
		const params = new URLSearchParams(page.url.search);
		if (next.length) params.set('kelas_ids', next.join(','));
		else params.delete('kelas_ids');
		const query = params.toString();
		void goto(`${page.url.pathname}${query ? `?${query}` : ''}`, {
			noScroll: true,
			keepFocus: true
		});
	}

	function resetFilterKelas() {
		const params = new URLSearchParams(page.url.search);
		params.delete('kelas_ids');
		const query = params.toString();
		void goto(`${page.url.pathname}${query ? `?${query}` : ''}`, {
			noScroll: true,
			keepFocus: true
		});
	}

	function closeModal() {
		if (modalState === null && !selectedDimensions.length && !kodeInput && !tujuanInput) return;
		modalState = null;
		if (selectedDimensions.length) selectedDimensions = [];
		if (kodeInput) kodeInput = '';
		if (tujuanInput) tujuanInput = '';
	}

	function closeDeleteModal() {
		if (!deleteDialogState) return;
		deleteDialogState = null;
	}

	function toggleDimension(dimension: DimensiProfilLulusanKey, checked: boolean) {
		selectedDimensions = checked
			? [...new Set([...selectedDimensions, dimension])]
			: selectedDimensions.filter((existing) => existing !== dimension);
	}

	function handleKodeChange(value: string) {
		kodeInput = value;
	}

	function handleTujuanChange(value: string) {
		tujuanInput = value;
	}
</script>

<KokurikulerFormModal
	open={isModalOpen}
	title={modalTitle}
	action={modalAction}
	kelasId={isEditMode ? (modalItem?.kelasId ?? data.kelasId) : data.kelasId}
	kelasOptions={data.kelasOptions}
	tableReady={data.tableReady}
	{canManage}
	{isEditMode}
	{modalItem}
	{dimensionOptions}
	{selectedDimensions}
	onToggleDimension={toggleDimension}
	{kodeInput}
	onKodeChange={handleKodeChange}
	{tujuanInput}
	onTujuanChange={handleTujuanChange}
	onClose={closeModal}
	onSuccess={({ form }) => {
		form.reset();
		selectedDimensions = [];
		kodeInput = '';
		tujuanInput = '';
		closeModal();
		invalidate('app:kokurikuler');
	}}
/>

<KokurikulerDeleteModal
	open={isDeleteModalOpen}
	title={deleteModalTitle}
	action="?/delete"
	ids={deleteModalIds}
	mode={deleteModalMode}
	item={deleteModalItem}
	{canManage}
	disabled={deleteModalDisabled}
	onClose={closeDeleteModal}
	onSuccess={() => {
		const ids = deleteDialogState?.ids ?? [];
		if (ids.length) {
			selectedIds = selectedIds.filter((selectedId) => !ids.includes(selectedId));
		}
		closeDeleteModal();
		invalidate('app:kokurikuler');
	}}
/>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Daftar Kokurikuler
			</h1>
			{#if kelasAktifLabel}
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Kelas aktif: {kelasAktifLabel}
				</p>
			{:else if data.semuaKelas}
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Menampilkan semua kelas. Pilih kelas pada form saat menambah.
				</p>
			{:else}
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Kelas belum ditentukan untuk akun ini.
				</p>
			{/if}
		</div>
		<div class="flex flex-row max-sm:w-full">
			{#if data.semuaKelas}
				<div class="dropdown dropdown-end mr-2">
					<button
						tabindex="0"
						type="button"
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						title="Pilih satu atau beberapa kelas"
					>
						<Icon name="users" class="h-3.5 w-3.5" />
						{data.filterKelasIds.length ? `${data.filterKelasIds.length} kelas` : 'Semua kelas'}
						<Icon name="down" class="h-3 w-3" />
					</button>
					<ul
						tabindex="-1"
						class="dropdown-content menu z-50 mt-2 max-h-80 w-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
					>
						{#each data.kelasOptions as kelas (kelas.id)}
							<li>
								<label
									class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 font-medium text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										checked={data.filterKelasIds.includes(kelas.id)}
										onchange={(event) => toggleFilterKelas(kelas.id, event.currentTarget.checked)}
									/>
									<span class="truncate">{kelas.nama}{kelas.fase ? ` - ${kelas.fase}` : ''}</span>
								</label>
							</li>
						{/each}
						{#if data.filterKelasIds.length}
							<li>
								<button
									type="button"
									class="w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
									onclick={resetFilterKelas}
								>
									Tampilkan semua kelas
								</button>
							</li>
						{/if}
					</ul>
				</div>
			{/if}
			{#if anySelected}
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 max-sm:flex-1 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/80"
					aria-disabled={bulkDeleteDisabled || !canEdit}
					disabled={bulkDeleteDisabled || !canEdit}
					onclick={openBulkDeleteModal}
					title={!canEdit ? 'Anda tidak memiliki izin untuk menghapus' : ''}
				>
					<Icon name="del" class="h-4 w-4" />
					Hapus
				</button>
			{:else}
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-l-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 max-sm:flex-1"
					aria-disabled={!canManage || !canEdit}
					disabled={!canManage || !canEdit}
					onclick={openAddModal}
					title={!canEdit ? 'Anda tidak memiliki izin untuk menambah' : ''}
				>
					<Icon name="plus" class="h-4 w-4" />
					Tambah
				</button>

				<!-- dropdown untuk import dan export -->
				<div class="dropdown dropdown-end">
					<button
						title={!canEdit ? 'Anda tidak memiliki izin' : 'Export dan Import kokurikuler'}
						type="button"
						tabindex="0"
						class="inline-flex h-9 items-center justify-center rounded-r-xl border-l border-blue-500 bg-blue-600 px-2.5 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
						disabled={!canManage || !canEdit}
						aria-disabled={!canManage || !canEdit}
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</button>

					<!-- menu dropdown -->
					<ul
						tabindex="-1"
						class="dropdown-content menu z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
					>
						<li>
							<button
								type="button"
								class={`w-full text-left ${!canManage ? 'pointer-events-none opacity-50' : ''}`}
								disabled={!canManage}
								aria-disabled={!canManage}
								onclick={() =>
									showModal({
										title: 'Impor Kokurikuler',
										body: ImportKokurikulerDialog,
										bodyProps: {
											kelasId: data.kelasId,
											kelasOptions: data.kelasOptions
										},
										dismissible: true
									})}
							>
								<Icon name="import" />
								Impor Kokurikuler
							</button>
						</li>
						<li>
							<button
								type="button"
								class={`w-full text-left ${!canManage || data.kelasId == null ? 'pointer-events-none opacity-50' : ''}`}
								disabled={!canManage || data.kelasId == null}
								aria-disabled={!canManage || data.kelasId == null}
								title={data.kelasId == null
									? 'Pilih satu kelas untuk mengekspor'
									: 'Ekspor kokurikuler'}
								onclick={async () => {
									try {
										const resp = await fetch(
											`/kokurikuler/export_kokurikuler?kelas_id=${data.kelasId ?? ''}`,
											{ method: 'GET' }
										);
										if (!resp.ok) {
											const body = await resp.json().catch(() => ({}));
											return toast({
												message: body?.fail || 'Gagal mengekspor data.',
												type: 'error'
											});
										}
										const blob = await resp.blob();
										const url = URL.createObjectURL(blob);
										// prefer filename from Content-Disposition header set by server
										let filename = `kokurikuler-${new Date().toISOString().slice(0, 10)}.xlsx`;
										try {
											const cd =
												resp.headers.get('content-disposition') ||
												resp.headers.get('Content-Disposition');
											if (cd) {
												// match filename*=UTF-8''encoded or filename="name"
												const mStar = cd.match(/filename\*=UTF-8''([^;\n\r]+)/i);
												const mBasic = cd.match(/filename="?([^";]+)"?/i);
												if (mStar && mStar[1]) filename = decodeURIComponent(mStar[1]);
												else if (mBasic && mBasic[1]) filename = mBasic[1];
											}
										} catch {
											/* ignore and fallback */
										}
										const a = document.createElement('a');
										a.href = url;
										a.download = filename;
										document.body.appendChild(a);
										a.click();
										document.body.removeChild(a);
										URL.revokeObjectURL(url);
										toast({ message: 'Ekspor berhasil.', type: 'success' });
									} catch (err) {
										console.error(err);
										toast({ message: 'Terjadi kesalahan saat mengekspor.', type: 'error' });
									}
								}}
							>
								<Icon name="export" />
								Ekspor Kokurikuler
							</button>
						</li>
					</ul>
				</div>
			{/if}
		</div>
	</div>

	{#if !data.kelasId && !data.semuaKelas}
		<div
			class="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0" />
			<span>Kelas belum ditentukan untuk akun ini.</span>
		</div>
	{/if}

	{#if !data.tableReady}
		<div
			class="mt-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
		>
			<Icon name="warning" class="h-4 w-4 shrink-0" />
			<span>
				Database kokurikuler belum siap. Jalankan <code>pnpm db:push</code> untuk menerapkan migrasi terbaru.
			</span>
		</div>
	{/if}

	{#if data.mapelKokurikuler.length > 0}
		<div class="mt-5">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">
					Mata Pelajaran Kokurikuler
				</h2>
				<a
					class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					href="/master-data/mata_pelajaran"
				>
					<Icon name="edit" class="h-3.5 w-3.5" />
					Kelola via Master Data
				</a>
			</div>
			<p class="mt-1 text-xs text-slate-600 dark:text-zinc-400">
				Mapel berkategori kokurikuler tidak tampil pada modul Intrakurikuler dan penilaian numerik.
				Ubah kembali lewat Master Data &rsaquo; Mata Pelajaran bila perlu.
			</p>
			<div
				class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<table class="w-full min-w-[600px] border-collapse text-xs">
					<thead>
						<tr
							class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
						>
							<th class="px-3 py-2.5" style="width: 60px;">No</th>
							<th class="px-3 py-2.5" style="width: 100px; min-width: 80px;">Kode</th>
							<th class="px-3 py-2.5" style="min-width: 200px;">Nama Mata Pelajaran</th>
							<th class="px-3 py-2.5" style="min-width: 150px;">Jenis</th>
							<th class="px-3 py-2.5" style="min-width: 150px;">Pengampu</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
						{#each data.mapelKokurikuler as item, index (item.id)}
							<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
								<td class="px-3 py-2.5 align-top text-slate-600 tabular-nums dark:text-zinc-400"
									>{index + 1}</td
								>
								<td
									class="px-3 py-2.5 align-top font-mono text-xs text-slate-700 dark:text-zinc-300"
									>{item.kode ?? '-'}</td
								>
								<td class="px-3 py-2.5 align-top font-medium text-slate-900 dark:text-zinc-100"
									>{item.nama}</td
								>
								<td class="px-3 py-2.5 align-top text-slate-700 dark:text-zinc-300">{item.jenis}</td
								>
								<td class="px-3 py-2.5 align-top text-slate-700 dark:text-zinc-300"
									>{item.pengampu ?? '-'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<h2 class="mt-6 mb-3 text-base font-bold text-slate-900 dark:text-zinc-100">
		Kegiatan Kokurikuler (8 DPL)
	</h2>

	<div
		class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full min-w-[720px] border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th class="px-3 py-2.5" style="width: 48px; min-width: 40px;">
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							bind:this={selectAllCheckbox}
							disabled={!data.kokurikuler.length || !data.tableReady}
							checked={allSelected}
							onchange={(event) => handleSelectAll(event.currentTarget.checked)}
						/>
					</th>
					<th class="px-3 py-2.5" style="width: 56px;">No</th>
					<th class="px-3 py-2.5" style="width: 100px; min-width: 80px;">Kode</th>
					{#if data.semuaKelas}
						<th class="px-3 py-2.5" style="min-width: 120px;">Kelas</th>
					{/if}
					<th class="px-3 py-2.5" style="min-width: 200px;">8 DPL</th>
					<th class="w-full px-3 py-2.5" style="min-width: 260px;">Kegiatan Kokurikuler</th>
					<th class="px-3 py-2.5 text-right" style="width: 120px;">Aksi</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
				{#each data.kokurikuler as item, index (item.id)}
					<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
						<td class="px-3 py-2.5 align-top">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={selectedIds.includes(item.id)}
								disabled={!data.tableReady}
								onchange={(event) => toggleRowSelection(item.id, event.currentTarget.checked)}
							/>
						</td>
						<td class="px-3 py-2.5 align-top text-slate-600 tabular-nums dark:text-zinc-400"
							>{index + 1}</td
						>
						<td class="px-3 py-2.5 align-top font-mono text-xs text-slate-700 dark:text-zinc-300"
							>{item.kode}</td
						>
						{#if data.semuaKelas}
							<td class="px-3 py-2.5 align-top text-slate-700 dark:text-zinc-300">
								{item.kelas?.nama ?? '-'}{#if item.kelas?.fase}
									<span class="block text-[11px] text-slate-500 dark:text-zinc-400"
										>{item.kelas.fase}</span
									>{/if}
							</td>
						{/if}
						<td class="px-3 py-2.5 align-top text-slate-700 dark:text-zinc-300">
							{#if item.dimensi.length}
								{item.dimensi
									.map((key) => labelByKey[key as DimensiProfilLulusanKey] ?? key)
									.join(', ')}
							{:else}
								<span class="text-slate-400 italic dark:text-zinc-500">Belum ada dimensi</span>
							{/if}
						</td>
						<td class="px-3 py-2.5 align-top text-slate-900 dark:text-zinc-100">{item.tujuan}</td>
						<td class="px-3 py-2.5">
							<div class="flex items-center justify-end">
								<button
									class="inline-flex h-8 w-8 items-center justify-center rounded-l-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
									type="button"
									title={!canEdit ? 'Anda tidak memiliki izin untuk mengedit' : 'Edit kokurikuler'}
									aria-label="Edit kokurikuler"
									aria-disabled={!canManage || !canEdit}
									disabled={!canManage || !canEdit}
									onclick={() => openEditModal(item)}
								>
									<Icon name="edit" class="h-3.5 w-3.5" />
								</button>
								<button
									class="inline-flex h-8 w-8 items-center justify-center rounded-r-lg border-y border-r border-slate-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
									type="button"
									title={!canEdit
										? 'Anda tidak memiliki izin untuk menghapus'
										: 'Hapus kokurikuler'}
									aria-label="Hapus kokurikuler"
									aria-disabled={!canManage || !canEdit}
									disabled={!canManage || !canEdit}
									onclick={() => openSingleDeleteModal(item)}
								>
									<Icon name="del" class="h-3.5 w-3.5" />
								</button>
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td
							class="px-3 py-8 text-center text-slate-500 dark:text-zinc-400"
							colspan={data.semuaKelas ? 7 : 6}
						>
							Belum ada data kokurikuler
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
