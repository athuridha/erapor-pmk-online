<script lang="ts">
	import { invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let {
		data
	}: {
		data: {
			ekstrakurikuler: Ekstrakurikuler;
			tujuan: EkstrakurikulerTujuan[];
			tujuanTableReady: boolean;
		};
	} = $props();

	let selectedIds = $state<number[]>([]);
	let selectAllCheckbox: HTMLInputElement | null = null;
	let formState = $state<{ mode: 'create' } | { mode: 'edit'; item: EkstrakurikulerTujuan } | null>(
		null
	);
	let deskripsiInput = $state('');
	let createFormSubmitting = $state(false);
	let editFormSubmitting = $state(false);
	let deleteDialogState = $state<
		| { source: 'bulk'; ids: number[] }
		| { source: 'single'; ids: number[]; item: EkstrakurikulerTujuan }
		| null
	>(null);

	const totalData = $derived.by(() => data.tujuan.length);
	const anySelected = $derived.by(() => selectedIds.length > 0);
	const allSelected = $derived.by(() => totalData > 0 && selectedIds.length === totalData);
	const canManage = $derived.by(() => data.tujuanTableReady);
	const formOpen = $derived.by(() => formState !== null);
	const isCreateMode = $derived.by(() => formState?.mode === 'create');
	const isEditMode = $derived.by(() => formState?.mode === 'edit');
	const isDeleteModalOpen = $derived.by(() => deleteDialogState !== null);
	const deleteModalIds = $derived.by(() => deleteDialogState?.ids ?? []);
	const deleteModalItem = $derived.by(() =>
		deleteDialogState?.source === 'single' ? deleteDialogState.item : null
	);
	const deleteModalTitle = $derived.by(() => {
		if (!deleteDialogState) return 'Hapus tujuan ekstrakurikuler';
		return deleteDialogState.source === 'bulk'
			? `Hapus ${deleteDialogState.ids.length} tujuan ekstrakurikuler?`
			: 'Hapus tujuan ekstrakurikuler?';
	});
	const deleteModalDisabled = $derived.by(() => deleteModalIds.length === 0 || !canManage);

	$effect(() => {
		if (selectAllCheckbox) {
			selectAllCheckbox.indeterminate = selectedIds.length > 0 && selectedIds.length < totalData;
		}
	});

	$effect(() => {
		if (!selectedIds.length) return;
		const existingIds = new Set(data.tujuan.map((item) => item.id));
		const filtered = selectedIds.filter((id) => existingIds.has(id));
		if (filtered.length !== selectedIds.length) {
			selectedIds = filtered;
		}
	});

	$effect(() => {
		if (data.tujuanTableReady) return;
		if (selectedIds.length) selectedIds = [];
		if (formState) formState = null;
		if (deskripsiInput) deskripsiInput = '';
		if (deleteDialogState) deleteDialogState = null;
	});

	function toggleRowSelection(id: number, checked: boolean) {
		selectedIds = checked
			? [...new Set([...selectedIds, id])]
			: selectedIds.filter((selectedId) => selectedId !== id);
	}

	function handleSelectAll(checked: boolean) {
		selectedIds = checked ? data.tujuan.map((item) => item.id) : [];
	}

	function openCreateForm() {
		if (!canManage || formOpen) return;
		deskripsiInput = '';
		createFormSubmitting = false;
		formState = { mode: 'create' };
	}

	function openEditForm(item: EkstrakurikulerTujuan) {
		if (!canManage || (formState && formState.mode === 'create')) return;
		deskripsiInput = item.deskripsi;
		editFormSubmitting = false;
		formState = { mode: 'edit', item };
	}

	function closeForm() {
		if (formState === null && !deskripsiInput) return;
		formState = null;
		deskripsiInput = '';
		createFormSubmitting = false;
		editFormSubmitting = false;
	}

	function openBulkDelete() {
		if (!canManage || !selectedIds.length) return;
		deleteDialogState = { source: 'bulk', ids: [...selectedIds] };
	}

	function openSingleDelete(item: EkstrakurikulerTujuan) {
		if (!canManage) return;
		deleteDialogState = { source: 'single', ids: [item.id], item };
	}

	function closeDeleteModal() {
		if (!deleteDialogState) return;
		deleteDialogState = null;
	}
</script>

<div
	class="w-full rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="mb-4 border-b border-slate-200 pb-3 dark:border-zinc-800">
		<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
			<span class="font-normal text-slate-500 dark:text-zinc-400">Ekstrakurikuler:</span>
			{data.ekstrakurikuler.nama}
		</h1>
	</div>

	<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div class="grid grid-cols-2 gap-2 sm:contents">
			<button
				class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				type="button"
				onclick={() => history.back()}
			>
				<Icon name="left" class="h-4 w-4" />
				Kembali
			</button>
			{#if anySelected}
				<button
					class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:w-auto dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/80"
					type="button"
					onclick={openBulkDelete}
					disabled={!anySelected || !canManage}
				>
					<Icon name="del" class="h-4 w-4" />
					Hapus TP
				</button>
			{:else}
				<button
					class={isCreateMode
						? 'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300'
						: 'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'}
					type="button"
					onclick={isCreateMode ? closeForm : openCreateForm}
					disabled={!canManage || isEditMode}
				>
					<Icon name={isCreateMode ? 'close' : 'plus'} class="h-4 w-4" />
					{isCreateMode ? 'Batal' : 'Tambah TP'}
				</button>
			{/if}
		</div>
	</div>

	{#if !data.tujuanTableReady}
		<div
			class="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
		>
			<Icon name="warning" class="h-4 w-4 shrink-0" />
			<span>
				Database tujuan ekstrakurikuler belum siap. Jalankan <code>pnpm db:push</code> untuk menerapkan
				migrasi terbaru.
			</span>
		</div>
	{/if}

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
							disabled={!data.tujuan.length || !canManage}
							checked={allSelected}
							onchange={(event) => handleSelectAll(event.currentTarget.checked)}
						/>
					</th>
					<th class="px-3 py-2.5" style="width: 56px; min-width: 40px;">No</th>
					<th class="w-full px-3 py-2.5">Tujuan Pembelajaran</th>
					<th class="px-3 py-2.5 text-right" style="width: 140px; min-width: 120px;">Aksi</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
				{#if formState?.mode === 'create'}
					{@const createFormId = 'tp-ekstra-create'}
					<tr class="bg-blue-50/40 dark:bg-blue-950/20">
						<td class="px-3 py-2.5 align-top">
							<input type="checkbox" class="checkbox checkbox-sm" disabled />
						</td>
						<td class="px-3 py-2.5 align-top text-slate-600 tabular-nums dark:text-zinc-400">1</td>
						<td class="px-3 py-2.5 align-top">
							<FormEnhance
								id={createFormId}
								action="?/create"
								onsuccess={({ form }) => {
									form.reset();
									deskripsiInput = '';
									formState = null;
									createFormSubmitting = false;
									invalidate('app:ekstrakurikuler:tp');
								}}
								submitStateChange={(value) => (createFormSubmitting = value)}
							>
								{#snippet children({ submitting, invalid })}
									<input name="ekstrakurikulerId" value={data.ekstrakurikuler.id} hidden />
									<textarea
										class="w-full rounded-xl border border-[#7e8b9b] bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
										placeholder="Tulis tujuan pembelajaran ekstrakurikuler"
										name="deskripsi"
										rows="3"
										bind:value={deskripsiInput}
										required
										disabled={!canManage}
										aria-invalid={invalid}
										aria-busy={submitting}></textarea>
								{/snippet}
							</FormEnhance>
						</td>
						<td class="px-3 py-2.5 align-top">
							<div class="flex justify-end gap-1.5">
								<button
									class="inline-flex h-8 items-center gap-1 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
									type="submit"
									form={createFormId}
									aria-disabled={createFormSubmitting || !deskripsiInput.trim()}
									disabled={createFormSubmitting || !deskripsiInput.trim()}
									title="Simpan tujuan"
								>
									{#if createFormSubmitting}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										<Icon name="save" class="h-3.5 w-3.5" />
									{/if}
									Simpan
								</button>
							</div>
						</td>
					</tr>
				{/if}

				{#if data.tujuan.length}
					{#each data.tujuan as item, index (item.id)}
						{@const rowNumber = index + 1 + (isCreateMode ? 1 : 0)}
						{#if formState?.mode === 'edit' && formState.item.id === item.id}
							{@const editFormId = `tp-ekstra-edit-${item.id}`}
							<tr class="bg-blue-50/40 dark:bg-blue-950/20">
								<td class="px-3 py-2.5 align-top">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										disabled
										checked={selectedIds.includes(item.id)}
									/>
								</td>
								<td class="px-3 py-2.5 align-top text-slate-600 tabular-nums dark:text-zinc-400"
									>{rowNumber}</td
								>
								<td class="px-3 py-2.5 align-top">
									<FormEnhance
										id={editFormId}
										action="?/update"
										onsuccess={({ form }) => {
											form.reset();
											deskripsiInput = '';
											formState = null;
											editFormSubmitting = false;
											invalidate('app:ekstrakurikuler:tp');
										}}
										submitStateChange={(value) => (editFormSubmitting = value)}
									>
										{#snippet children({ submitting, invalid })}
											<input name="ekstrakurikulerId" value={data.ekstrakurikuler.id} hidden />
											<input name="id" value={item.id} hidden />
											<textarea
												class="w-full rounded-xl border border-[#7e8b9b] bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
												placeholder="Tulis tujuan pembelajaran ekstrakurikuler"
												name="deskripsi"
												rows="3"
												bind:value={deskripsiInput}
												required
												disabled={!canManage}
												aria-invalid={invalid}
												aria-busy={submitting}></textarea>
										{/snippet}
									</FormEnhance>
								</td>
								<td class="px-3 py-2.5 align-top">
									<div class="flex justify-end gap-1.5">
										<button
											class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
											type="button"
											title="Batal"
											onclick={closeForm}
										>
											<Icon name="close" class="h-3.5 w-3.5" />
										</button>
										<button
											class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
											type="submit"
											form={editFormId}
											aria-disabled={editFormSubmitting || !deskripsiInput.trim()}
											disabled={editFormSubmitting || !deskripsiInput.trim()}
											title="Simpan perubahan"
										>
											{#if editFormSubmitting}
												<span class="loading loading-spinner loading-xs"></span>
											{:else}
												<Icon name="save" class="h-3.5 w-3.5" />
											{/if}
										</button>
									</div>
								</td>
							</tr>
						{:else}
							<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
								<td class="px-3 py-2.5 align-top">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										checked={selectedIds.includes(item.id)}
										disabled={!canManage}
										onchange={(event) => toggleRowSelection(item.id, event.currentTarget.checked)}
									/>
								</td>
								<td class="px-3 py-2.5 align-top text-slate-600 tabular-nums dark:text-zinc-400"
									>{rowNumber}</td
								>
								<td class="px-3 py-2.5 align-top text-slate-900 dark:text-zinc-100">
									{item.deskripsi}
								</td>
								<td class="px-3 py-2.5 align-top">
									<div class="flex justify-end gap-1.5">
										<button
											class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
											type="button"
											title="Edit tujuan"
											aria-disabled={!canManage}
											disabled={!canManage}
											onclick={() => openEditForm(item)}
										>
											<Icon name="edit" class="h-3.5 w-3.5" />
										</button>
										<button
											class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
											type="button"
											title="Hapus tujuan"
											aria-disabled={!canManage}
											disabled={!canManage}
											onclick={() => openSingleDelete(item)}
										>
											<Icon name="del" class="h-3.5 w-3.5" />
										</button>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				{:else}
					<tr>
						<td class="px-3 py-8 text-center text-slate-500 dark:text-zinc-400" colspan="4">
							Belum ada tujuan ekstrakurikuler
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>

{#if isDeleteModalOpen}
	<div
		class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		onkeydown={(event) => {
			if (event.key === 'Escape') closeDeleteModal();
		}}
	>
		<dialog
			class="modal-box relative z-10 max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
			open
			aria-modal="true"
		>
			<h3
				class="flex items-center gap-2 border-b border-slate-200 pb-3 text-base font-bold text-red-700 dark:border-zinc-800 dark:text-red-400"
			>
				<Icon name="warning" class="h-4 w-4" />
				{deleteModalTitle}
			</h3>
			{#if deleteDialogState?.source === 'single' && deleteModalItem}
				<p class="mt-3 text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
					Yakin ingin menghapus tujuan
					<span class="font-semibold text-slate-900 dark:text-zinc-100"
						>"{deleteModalItem.deskripsi.slice(0, 80)}"</span
					>?
				</p>
			{:else}
				<p class="mt-3 text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
					Yakin ingin menghapus {deleteModalIds.length} tujuan ekstrakurikuler terpilih?
				</p>
			{/if}

			<FormEnhance
				action="?/delete"
				onsuccess={() => {
					const ids = deleteDialogState?.ids ?? [];
					if (ids.length) {
						selectedIds = selectedIds.filter((selectedId) => !ids.includes(selectedId));
					}
					closeDeleteModal();
					invalidate('app:ekstrakurikuler:tp');
				}}
			>
				{#snippet children({ submitting })}
					{#each deleteModalIds as id (id)}
						<input name="ids" value={id} hidden />
					{/each}

					<div
						class="modal-action mt-5 flex gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800"
					>
						<button
							class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							type="button"
							onclick={closeDeleteModal}
						>
							<Icon name="close" class="h-3.5 w-3.5" />
							Batal
						</button>
						<button
							class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
							disabled={submitting || deleteModalDisabled}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<Icon name="del" class="h-3.5 w-3.5" />
							{/if}
							Hapus
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</dialog>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button
				type="submit"
				onclick={(event) => {
					event.preventDefault();
					closeDeleteModal();
				}}
			>
				tutup
			</button>
		</form>
	</div>
{/if}
