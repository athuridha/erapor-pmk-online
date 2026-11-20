<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import EkstrakurikulerDeleteModal from '$lib/components/ekstrakurikuler/delete-modal.svelte';
	import ImportEkstraDialog from '$lib/components/ekstrakurikuler/import-ekstra-dialog.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';

	type EkstrakurikulerRow = Ekstrakurikuler & {
		pembinaLabel?: string | null;
	};
	type PembinaOption = { id: number; label: string };

	let {
		data
	}: {
		data: {
			kelasId: number | null;
			tableReady: boolean;
			lingkupUmum: boolean;
			pembinaMode?: boolean;
			pembinaOptions?: PembinaOption[];
			ekstrakurikuler: EkstrakurikulerRow[];
		};
	} = $props();

	let selectedIds = $state<number[]>([]);
	let selectAllCheckbox: HTMLInputElement | null = null;
	let lastTableReady = $state<boolean | null>(null);
	let deleteDialogState = $state<
		| { source: 'bulk'; ids: number[] }
		| { source: 'single'; ids: number[]; item: Ekstrakurikuler }
		| null
	>(null);
	let addRowVisible = $state(false);
	let addNamaInput = $state('');
	let addPembinaUserId = $state('');
	let addPembinaNama = $state('');
	let addInputRef = $state<HTMLInputElement | null>(null);
	let addSubmitting = $state(false);
	let editingRowId = $state<number | null>(null);
	let editingNamaInput = $state('');
	let editingPembinaUserId = $state('');
	let editingPembinaNama = $state('');
	let editingInputRef = $state<HTMLInputElement | null>(null);
	let editingSubmitting = $state(false);
	let addLingkup = $state<'kelas' | 'umum'>('kelas');

	const totalData = $derived.by(() => data.ekstrakurikuler.length);
	const pembinaMode = $derived(Boolean(data.pembinaMode));
	const pembinaOptions = $derived(data.pembinaOptions ?? []);

	const kelasAktifLabel = $derived.by(() => {
		const kelas = page.data.kelasAktif ?? null;
		if (!kelas) return null;
		return kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama;
	});
	const anySelected = $derived.by(() => selectedIds.length > 0);
	const allSelected = $derived.by(() => totalData > 0 && selectedIds.length === totalData);
	// Admin/kepala sekolah boleh mengelola ekstrakurikuler umum tanpa kelas aktif.
	const bolehUmum = $derived.by(() => {
		const t = (page.data.user as { type?: string } | null)?.type;
		return t === 'admin' || t === 'kepala_sekolah';
	});
	const canManage = $derived.by(
		() => !pembinaMode && data.tableReady && (!!data.kelasId || (data.lingkupUmum && bolehUmum))
	);
	// Restrict editing for wali_asuh dan guru mapel murni; guru merangkap wali
	// kelas boleh mengelola di kelas yang diwalikan.
	const canEdit = $derived.by(() => {
		if (pembinaMode) return false;
		const u = page.data.user as
			{ type?: string; kelasId?: number | null; ownKelasIds?: number[] | null } | null | undefined;
		// Mode Semua Kelas: hanya admin/kepala sekolah yang boleh mengubah data umum.
		if (data.lingkupUmum) return bolehUmum;
		if (u?.type === 'wali_asuh') return false;
		if (u?.type === 'user') {
			return data.kelasId != null && (u.ownKelasIds ?? []).includes(data.kelasId);
		}
		// Wali kelas di kelas bukan miliknya: turun ke level guru (tidak bisa menambah).
		if (u?.type === 'wali_kelas' && data.kelasId != null) {
			const ownIds = u.ownKelasIds?.length ? u.ownKelasIds : u.kelasId != null ? [u.kelasId] : [];
			if (ownIds.length > 0 && !ownIds.includes(data.kelasId)) return false;
		}
		return true;
	});
	const canEditTp = $derived(data.tableReady && (pembinaMode || (canManage && canEdit)));
	const addSaveDisabled = $derived.by(
		() =>
			addSubmitting ||
			!addNamaInput.trim() ||
			!canManage ||
			!canEdit ||
			(addLingkup === 'kelas' && !data.kelasId)
	);
	const editingSaveDisabled = $derived.by(
		() =>
			editingRowId === null ||
			editingSubmitting ||
			!editingNamaInput.trim() ||
			!canManage ||
			!canEdit
	);
	const bulkDeleteDisabled = $derived.by(() => !anySelected || !canManage);
	const isDeleteModalOpen = $derived.by(() => deleteDialogState !== null);
	const deleteModalTitle = $derived.by(() => {
		if (!deleteDialogState) return 'Hapus Ekstrakurikuler';
		return deleteDialogState.source === 'bulk'
			? `Hapus ${deleteDialogState.ids.length} Ekstrakurikuler`
			: 'Hapus Ekstrakurikuler';
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
		const existingIds = new Set(data.ekstrakurikuler.map((item) => item.id));
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
			if (deleteDialogState) deleteDialogState = null;
			if (addNamaInput) addNamaInput = '';
			if (addRowVisible) addRowVisible = false;
			addSubmitting = false;
			editingRowId = null;
			editingNamaInput = '';
			editingSubmitting = false;
		}
	});

	$effect(() => {
		if (!canManage && addRowVisible) {
			addRowVisible = false;
			addNamaInput = '';
			addSubmitting = false;
		}
	});

	$effect(() => {
		if (!canManage && editingRowId !== null) {
			editingRowId = null;
			editingNamaInput = '';
			editingSubmitting = false;
		}
	});

	$effect(() => {
		if (addRowVisible) {
			void tick().then(() => addInputRef?.focus());
		}
	});

	$effect(() => {
		if (editingRowId !== null) {
			void tick().then(() => editingInputRef?.focus());
		}
	});

	$effect(() => {
		if (editingRowId === null) return;
		const exists = data.ekstrakurikuler.some((item) => item.id === editingRowId);
		if (!exists) {
			editingRowId = null;
			editingNamaInput = '';
			editingSubmitting = false;
		}
	});

	function toggleRowSelection(id: number, checked: boolean) {
		selectedIds = checked
			? [...new Set([...selectedIds, id])]
			: selectedIds.filter((selectedId) => selectedId !== id);
	}

	function handleSelectAll(checked: boolean) {
		selectedIds = checked ? data.ekstrakurikuler.map((item) => item.id) : [];
	}

	function startEditRow(item: EkstrakurikulerRow) {
		if (!canManage) return;
		addRowVisible = false;
		addNamaInput = '';
		addPembinaUserId = '';
		addPembinaNama = '';
		addSubmitting = false;
		editingRowId = item.id;
		editingNamaInput = item.nama;
		editingPembinaUserId = item.pembinaUserId ? String(item.pembinaUserId) : '';
		editingPembinaNama = item.pembinaNama ?? '';
		editingSubmitting = false;
	}

	function openBulkDeleteModal() {
		if (!canManage) return;
		if (!selectedIds.length) return;
		deleteDialogState = { source: 'bulk', ids: [...selectedIds] };
	}

	function openSingleDeleteModal(item: Ekstrakurikuler) {
		if (!canManage) return;
		deleteDialogState = { source: 'single', ids: [item.id], item };
	}

	function closeDeleteModal() {
		if (!deleteDialogState) return;
		deleteDialogState = null;
	}

	function toggleAddRow() {
		if (!canManage) return;
		if (addRowVisible) {
			cancelAddRow();
			return;
		}
		cancelEditRow();
		addNamaInput = '';
		addPembinaUserId = '';
		addPembinaNama = '';
		addLingkup = data.lingkupUmum ? 'umum' : 'kelas';
		addRowVisible = true;
	}

	function cancelAddRow() {
		addRowVisible = false;
		addNamaInput = '';
		addPembinaUserId = '';
		addPembinaNama = '';
		addSubmitting = false;
		addLingkup = data.lingkupUmum ? 'umum' : 'kelas';
	}

	function cancelEditRow() {
		if (editingRowId === null && !editingNamaInput) return;
		editingRowId = null;
		editingNamaInput = '';
		editingPembinaUserId = '';
		editingPembinaNama = '';
		editingSubmitting = false;
	}
</script>

<EkstrakurikulerDeleteModal
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
		invalidate('app:ekstrakurikuler');
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
				Daftar Ekstrakurikuler
			</h1>
			{#if pembinaMode}
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Mode Pembina Eskul: kelola Tujuan Pembelajaran (TP) ekstrakurikuler binaan Anda.
				</p>
			{:else if data.lingkupUmum}
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Mode Semua Kelas: kelola ekstrakurikuler umum yang berlaku untuk semua kelas.
				</p>
			{:else if kelasAktifLabel}
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Kelas aktif: <span class="font-medium text-slate-800 dark:text-zinc-200"
						>{kelasAktifLabel}</span
					>
				</p>
			{:else}
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Pilih kelas pada pemilih kelas untuk melihat ekstrakurikuler.
				</p>
			{/if}
		</div>
		{#if !pembinaMode}
			<div class="flex flex-row max-sm:w-full">
				{#if anySelected}
					<button
						type="button"
						class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50"
						disabled={bulkDeleteDisabled || !canEdit}
						aria-disabled={bulkDeleteDisabled || !canEdit}
						onclick={openBulkDeleteModal}
						title={!canEdit ? 'Anda tidak memiliki izin untuk menghapus' : ''}
					>
						<Icon name="del" class="h-4 w-4" />
						Hapus
					</button>
				{:else}
					<div class="inline-flex max-sm:flex-1">
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-l-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 max-sm:flex-1"
							disabled={!canManage || !canEdit}
							aria-disabled={!canManage || !canEdit}
							onclick={toggleAddRow}
							title={!canEdit ? 'Anda tidak memiliki izin untuk menambah' : ''}
						>
							<Icon name="plus" class="h-4 w-4" />
							Tambah
						</button>

						<!-- dropdown untuk import dan export -->
						<div class="dropdown dropdown-end">
							<button
								title={!canEdit ? 'Anda tidak memiliki izin' : 'Export dan Import ekstrakurikuler'}
								type="button"
								tabindex="0"
								class="inline-flex h-9 items-center justify-center rounded-r-xl border-l border-blue-500 bg-blue-600 px-2.5 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
										class="w-full rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
										disabled={!canManage}
										aria-disabled={!canManage}
										onclick={() =>
											showModal({
												title: 'Impor Ekstrakurikuler',
												body: ImportEkstraDialog,
												bodyProps: { lingkupUmum: data.lingkupUmum },
												dismissible: true
											})}
									>
										<Icon name="import" class="h-4 w-4" />
										Impor Ekstrakurikuler
									</button>
								</li>
								<li>
									<button
										type="button"
										class="w-full rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
										disabled={!canManage}
										aria-disabled={!canManage}
										onclick={async () => {
											try {
												const resp = await fetch('/ekstrakurikuler/export_ekstra', {
													method: 'GET'
												});
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
												let filename = `ekstrakurikuler-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
										<Icon name="export" class="h-4 w-4" />
										Ekspor Ekstrakurikuler
									</button>
								</li>
							</ul>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if !pembinaMode && !data.kelasId && !data.lingkupUmum}
		<div
			class="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Silakan pilih kelas pada pemilih kelas sebelum menambah ekstrakurikuler.</span>
		</div>
	{/if}

	{#if !data.tableReady}
		<div
			class="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200"
		>
			<Icon name="warning" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
			<span>
				Database ekstrakurikuler belum siap. Jalankan <code>pnpm db:push</code> untuk menerapkan migrasi
				terbaru.
			</span>
		</div>
	{/if}

	<div
		class="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full min-w-[560px] border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th style="width: 48px; min-width: 40px;" class="px-3 py-2.5">
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							bind:this={selectAllCheckbox}
							disabled={!data.ekstrakurikuler.length || !data.tableReady}
							checked={allSelected}
							onchange={(event) => handleSelectAll(event.currentTarget.checked)}
						/>
					</th>
					<th style="width: 56px;" class="px-3 py-2.5">No</th>
					<th class="w-full px-3 py-2.5" style="min-width: 260px;">Ekstrakurikuler</th>
					<th class="px-3 py-2.5 whitespace-nowrap">Tujuan Pembelajaran</th>
					<th style="width: 140px; min-width: 120px;" class="px-3 py-2.5 text-right">Aksi</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
				{#if addRowVisible}
					<tr class="bg-blue-50/40 dark:bg-blue-950/20">
						<td class="px-3 py-3"></td>
						<td class="px-3 py-3 font-medium text-slate-700 tabular-nums dark:text-zinc-300">
							<span>1</span>
						</td>
						<td class="px-3 py-3" colspan="2">
							<FormEnhance
								id="add-ekstrakurikuler-form"
								action="?/add"
								submitStateChange={(value) => (addSubmitting = value)}
								onsuccess={({ form }) => {
									form.reset();
									addNamaInput = '';
									addRowVisible = false;
									invalidate('app:ekstrakurikuler');
								}}
							>
								{#snippet children({ submitting, invalid })}
									{#if !data.lingkupUmum}
										<input name="kelasId" value={data.kelasId ?? ''} hidden />
									{/if}
									{#if bolehUmum}
										<label
											class="mb-2 flex w-fit cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300"
											title="Ekstrakurikuler umum berlaku untuk semua kelas"
										>
											{#if data.lingkupUmum}
												<!-- Checkbox terkunci: kirim nilainya lewat hidden input
												karena input disabled tidak ikut terkirim. -->
												<input type="hidden" name="lingkup" value="umum" />
											{/if}
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												name={data.lingkupUmum ? undefined : 'lingkup'}
												value="umum"
												checked={data.lingkupUmum || addLingkup === 'umum'}
												onchange={(event) => {
													const el = event.currentTarget as HTMLInputElement;
													if (data.lingkupUmum) {
														el.checked = true;
														return;
													}
													addLingkup = el.checked ? 'umum' : 'kelas';
												}}
											/>
											<span>
												Berlaku untuk semua kelas
												{#if data.lingkupUmum}
													<span class="text-slate-500 dark:text-zinc-400">(mode Semua Kelas)</span>
												{/if}
											</span>
										</label>
									{/if}
									<div class="flex flex-col gap-2" aria-busy={submitting}>
										<input
											bind:this={addInputRef}
											class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
											placeholder="Masukkan nama ekstrakurikuler"
											name="nama"
											value={addNamaInput}
											oninput={(event) =>
												(addNamaInput = (event.currentTarget as HTMLInputElement).value)}
											autocomplete="off"
											required
											aria-invalid={invalid}
										/>
										<div class="grid gap-2 sm:grid-cols-2">
											<div class="relative flex items-center">
												<select
													name="pembinaUserId"
													class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
													bind:value={addPembinaUserId}
													disabled={submitting}
												>
													<option value="">Akun pembina (opsional)</option>
													{#each pembinaOptions as opt (opt.id)}
														<option value={String(opt.id)}>{opt.label}</option>
													{/each}
												</select>
												<span
													aria-hidden="true"
													class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
												>
													<Icon name="down" class="h-3.5 w-3.5" />
												</span>
											</div>
											<input
												type="text"
												name="pembinaNama"
												class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
												placeholder="Atau nama pembina eksternal"
												bind:value={addPembinaNama}
												disabled={submitting}
											/>
										</div>
									</div>
								{/snippet}
							</FormEnhance>
						</td>
						<td class="px-3 py-3 text-right">
							<div class="inline-flex items-center gap-1.5">
								<button
									type="button"
									class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
									onclick={cancelAddRow}
									disabled={addSubmitting}
									title="Batal"
								>
									<Icon name="close" class="h-3.5 w-3.5" />
								</button>
								<button
									class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
									form="add-ekstrakurikuler-form"
									type="submit"
									disabled={addSaveDisabled}
									title="Simpan"
								>
									{#if addSubmitting}
										<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
									{:else}
										<Icon name="save" class="h-3.5 w-3.5" />
									{/if}
								</button>
							</div>
						</td>
					</tr>
				{/if}
				{#each data.ekstrakurikuler as item, index (item.id)}
					{@const baseNumber = addRowVisible ? index + 2 : index + 1}
					{@const formId = `edit-ekstrakurikuler-form-${item.id}`}
					<tr
						class={editingRowId === item.id
							? 'bg-blue-50/40 dark:bg-blue-950/20'
							: 'transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50'}
					>
						<td class="px-3 py-2.5">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={selectedIds.includes(item.id)}
								disabled={!data.tableReady || editingRowId === item.id || item.semuaKelas === 1}
								onchange={(event) => toggleRowSelection(item.id, event.currentTarget.checked)}
							/>
						</td>
						<td class="px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-400">
							{#if editingRowId === item.id}
								<span
									class="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-blue-50 px-1.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/60"
								>
									1
								</span>
							{:else}
								{baseNumber}
							{/if}
						</td>
						<td class="px-3 py-2.5">
							{#if editingRowId === item.id}
								<FormEnhance
									id={formId}
									action="?/update"
									submitStateChange={(value) => (editingSubmitting = value)}
									onsuccess={({ form }) => {
										form.reset();
										editingNamaInput = '';
										cancelEditRow();
										invalidate('app:ekstrakurikuler');
									}}
								>
									{#snippet children({ submitting, invalid })}
										{#if !item.semuaKelas && !data.lingkupUmum}
											<input name="kelasId" value={data.kelasId ?? ''} hidden />
										{/if}
										<input name="id" value={item.id} hidden />
										<div class="flex flex-col gap-2" aria-busy={submitting}>
											<input
												bind:this={editingInputRef}
												class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
												placeholder="Masukkan nama ekstrakurikuler"
												name="nama"
												value={editingNamaInput}
												oninput={(event) =>
													(editingNamaInput = (event.currentTarget as HTMLInputElement).value)}
												autocomplete="off"
												required
												aria-invalid={invalid}
											/>
											<div class="grid gap-2 sm:grid-cols-2">
												<div class="relative flex items-center">
													<select
														name="pembinaUserId"
														class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
														bind:value={editingPembinaUserId}
														disabled={submitting}
													>
														<option value="">Tanpa akun login khusus</option>
														{#each pembinaOptions as opt (opt.id)}
															<option value={String(opt.id)}>{opt.label}</option>
														{/each}
													</select>
													<span
														aria-hidden="true"
														class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
													>
														<Icon name="down" class="h-3.5 w-3.5" />
													</span>
												</div>
												<input
													type="text"
													name="pembinaNama"
													class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
													placeholder="Nama pembina eksternal (opsional)"
													bind:value={editingPembinaNama}
													disabled={submitting}
												/>
											</div>
										</div>
									{/snippet}
								</FormEnhance>
							{:else}
								<div>
									<div class="font-medium text-slate-900 dark:text-zinc-100">
										{item.nama}
										{#if item.semuaKelas}
											<span
												class="ml-1.5 inline-flex items-center rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
											>
												Umum
											</span>
										{/if}
									</div>
									{#if item.pembinaLabel}
										<div class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
											Pembina: {item.pembinaLabel}
										</div>
									{/if}
								</div>
							{/if}
						</td>
						<td class="px-3 py-2.5">
							<a
								href={`ekstrakurikuler/tp-ekstra?ekstrakurikulerId=${item.id}`}
								class="inline-flex h-8 items-center gap-1 rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium whitespace-nowrap text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 {!canEditTp
									? 'pointer-events-none opacity-50'
									: ''}"
								title={!canEditTp
									? 'Anda tidak memiliki izin untuk mengedit'
									: 'Atur tujuan ekstrakurikuler'}
								aria-disabled={!canEditTp}
								tabindex={canEditTp ? undefined : -1}
							>
								<Icon name="book" class="h-3.5 w-3.5" />
								Edit TP
							</a>
						</td>
						<td class="px-3 py-2.5 text-right">
							<div class="inline-flex items-center gap-1.5">
								{#if editingRowId === item.id}
									<button
										class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
										type="button"
										title="Batalkan edit"
										onclick={cancelEditRow}
										disabled={editingSubmitting}
									>
										<Icon name="close" class="h-3.5 w-3.5" />
									</button>
									<button
										class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
										form={formId}
										type="submit"
										disabled={editingSaveDisabled}
										title="Simpan"
									>
										{#if editingSubmitting}
											<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
										{:else}
											<Icon name="save" class="h-3.5 w-3.5" />
										{/if}
									</button>
								{:else}
									<button
										class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
										type="button"
										title={!canEdit
											? 'Anda tidak memiliki izin untuk mengedit'
											: 'Edit ekstrakurikuler'}
										aria-label="Edit ekstrakurikuler"
										aria-disabled={!canManage || !canEdit}
										disabled={!canManage || !canEdit}
										onclick={() => startEditRow(item)}
									>
										<Icon name="edit" class="h-3.5 w-3.5" />
									</button>
									<button
										class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50"
										type="button"
										title={!canEdit
											? 'Anda tidak memiliki izin untuk menghapus'
											: item.semuaKelas
												? 'Ekstrakurikuler umum dihapus lewat Master Data'
												: 'Hapus ekstrakurikuler'}
										aria-label="Hapus ekstrakurikuler"
										aria-disabled={!canManage || !canEdit || item.semuaKelas === 1}
										disabled={!canManage || !canEdit || item.semuaKelas === 1}
										onclick={() => openSingleDeleteModal(item)}
									>
										<Icon name="del" class="h-3.5 w-3.5" />
									</button>
								{/if}
							</div>
						</td>
					</tr>
				{:else}
					{#if !addRowVisible}
						<tr>
							<td
								class="p-8 text-center text-xs italic text-slate-500 dark:text-zinc-400"
								colspan="5"
							>
								Belum ada data ekstrakurikuler
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>
