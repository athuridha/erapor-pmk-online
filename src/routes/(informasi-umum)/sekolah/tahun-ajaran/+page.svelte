<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { PageData } from './$types';

	type TahunAjaranRow = typeof import('$lib/server/db/schema').tableTahunAjaran.$inferSelect;
	type SemesterRow = typeof import('$lib/server/db/schema').tableSemester.$inferSelect;
	type TahunAjaranItem = TahunAjaranRow & { semester: SemesterRow[]; rombel: number };
	type SekolahSelected = Pick<Sekolah, 'id' | 'nama' | 'npsn' | 'jenjangPendidikan'>;

	const { data } = $props<{ data: PageData }>();
	// svelte-ignore state_referenced_locally
	const selectedSekolahId = data.selectedSekolahId ? String(data.selectedSekolahId) : '';
	// svelte-ignore state_referenced_locally
	const selectedSekolah = (data.selectedSekolah ?? null) as SekolahSelected | null;
	// svelte-ignore state_referenced_locally
	let tahunAjaranState = $state((data.tahunAjaran ?? []) as TahunAjaranItem[]);
	let selectedIdsSet = $state<Set<number>>(new Set());
	let editingId = $state<number | 'new' | null>(null);
	let masterCheckbox: HTMLInputElement | undefined;
	let createFormState = $state({ submitting: false, invalid: true });
	let editFormState = $state({ submitting: false, invalid: true });

	const syncCreateFormState = (submitting: boolean, invalid: boolean) => {
		queueMicrotask(() => {
			if (createFormState.submitting !== submitting || createFormState.invalid !== invalid) {
				createFormState = { submitting, invalid };
			}
		});
		return '';
	};

	const syncEditFormState = (submitting: boolean, invalid: boolean) => {
		queueMicrotask(() => {
			if (editFormState.submitting !== submitting || editFormState.invalid !== invalid) {
				editFormState = { submitting, invalid };
			}
		});
		return '';
	};

	const selectedIds = $derived([...selectedIdsSet]);
	const allSelected = $derived(
		selectedIds.length > 0 && selectedIds.length === tahunAjaranState.length
	);
	const hasSelection = $derived(selectedIds.length > 0);
	const isIndeterminate = $derived(
		selectedIds.length > 0 && selectedIds.length < tahunAjaranState.length
	);

	$effect(() => {
		if (masterCheckbox) masterCheckbox.indeterminate = isIndeterminate;
	});

	const toggleSelect = (id: number) => {
		const next = new Set(selectedIdsSet);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedIdsSet = next;
	};

	const toggleSelectAll = () => {
		if (allSelected) {
			selectedIdsSet = new Set();
		} else {
			selectedIdsSet = new Set(tahunAjaranState.map((item) => item.id));
		}
	};

	const tahunAjaranInit = (item?: TahunAjaranItem | null) => ({
		id: item?.id,
		nama: item?.nama ?? '',
		sekolahId: selectedSekolahId
	});

	type TahunAjaranActionPayload = { tahunAjaran?: TahunAjaranItem[] };

	const applyLatestList = (payload?: TahunAjaranActionPayload) => {
		const next = payload?.tahunAjaran;
		if (next) tahunAjaranState = next;
	};

	const handleCreateRow = () => {
		selectedIdsSet = new Set();
		createFormState = { submitting: false, invalid: true };
		editingId = 'new';
	};

	const handleEditRow = (id: number) => {
		selectedIdsSet = new Set();
		editFormState = { submitting: false, invalid: false };
		editingId = id;
	};

	const cancelInline = () => {
		createFormState = { submitting: false, invalid: true };
		editFormState = { submitting: false, invalid: true };
		editingId = null;
	};

	const handleUpdateSuccess = ({ data }: { data?: TahunAjaranActionPayload }) => {
		applyLatestList(data);
		selectedIdsSet = new Set();
		editFormState = { submitting: false, invalid: true };
		editingId = null;
	};

	const handleCreateSuccess = ({ data }: { data?: TahunAjaranActionPayload }) => {
		applyLatestList(data);
		selectedIdsSet = new Set();
		createFormState = { submitting: false, invalid: true };
		editingId = null;
	};

	const handleDeleteSuccess = ({ data }: { data?: TahunAjaranActionPayload }) => {
		applyLatestList(data);
		selectedIdsSet = new Set();
		createFormState = { submitting: false, invalid: true };
		editFormState = { submitting: false, invalid: true };
		editingId = null;
	};
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="flex flex-col gap-1 border-b border-slate-200 pb-4 dark:border-zinc-800">
		<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
			Daftar Tahun Ajaran
		</h1>
		{#if selectedSekolah}
			<p class="text-xs text-slate-600 dark:text-zinc-400">
				Sekolah: <span class="font-semibold text-slate-900 dark:text-zinc-100"
					>{selectedSekolah.nama}</span
				>
			</p>
		{/if}
	</div>

	<div class="mt-4 flex flex-wrap items-center justify-between gap-2">
		<button
			class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			type="button"
			onclick={() => history.back()}
		>
			<Icon name="left" class="h-4 w-4" />
			Kembali
		</button>
		<div class="flex flex-col gap-2 sm:ml-auto sm:flex-row">
			<FormEnhance action="?/delete" onsuccess={handleDeleteSuccess}>
				{#snippet children({ submitting })}
					{#if hasSelection}
						{#each selectedIds as id (id)}
							<input type="hidden" name="ids" value={id} />
						{/each}
						<input type="hidden" name="sekolahId" value={selectedSekolahId} />
					{/if}
					<button
						class={hasSelection
							? 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/80'
							: 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'}
						type={hasSelection ? 'submit' : 'button'}
						onclick={!hasSelection ? handleCreateRow : undefined}
						disabled={hasSelection
							? !selectedSekolahId || editingId !== null || submitting
							: !selectedSekolahId || editingId !== null}
					>
						<Icon name={hasSelection ? 'del' : 'plus'} class="h-4 w-4" />
						{hasSelection ? (submitting ? 'Menghapus…' : 'Hapus TA') : 'Tambah TA'}
					</button>
				{/snippet}
			</FormEnhance>
		</div>
	</div>

	<div
		class="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th class="px-3 py-2.5" style="width: 40px;">
						<input
							class="checkbox checkbox-sm"
							type="checkbox"
							bind:this={masterCheckbox}
							checked={allSelected}
							onchange={toggleSelectAll}
						/>
					</th>
					<th class="px-3 py-2.5" style="width: 50px; min-width: 40px;">No</th>
					<th class="w-full px-3 py-2.5" style="min-width: 140px;">Tahun Ajaran</th>
					<th class="px-3 py-2.5" style="width: 120px;">Rombel</th>
					<th class="px-3 py-2.5 text-right" style="width: 160px;">Aksi</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
				{#if !selectedSekolahId}
					<tr>
						<td colspan="5" class="px-3 py-8 text-center text-slate-500 dark:text-zinc-400"
							>Pilih sekolah terlebih dahulu.</td
						>
					</tr>
				{:else}
					{#if editingId === 'new'}
						{@const createFormId = 'ta-create-form'}
						<tr class="bg-blue-50/40 dark:bg-blue-950/20">
							<td class="px-3 py-2.5">
								<input class="checkbox checkbox-sm" type="checkbox" disabled />
							</td>
							<td class="px-3 py-2.5 text-slate-500 dark:text-zinc-400">-</td>
							<td class="px-3 py-2.5">
								<FormEnhance
									id={createFormId}
									action="?/create"
									init={tahunAjaranInit(null)}
									onsuccess={handleCreateSuccess}
								>
									{#snippet children({ submitting, invalid })}
										{syncCreateFormState(submitting, invalid)}
										<input type="hidden" name="sekolahId" value={selectedSekolahId} />
										<input
											class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
											name="nama"
											placeholder="2025/2026"
											required
										/>
									{/snippet}
								</FormEnhance>
							</td>
							<td class="px-3 py-2.5 text-slate-500 dark:text-zinc-400">-</td>
							<td class="px-3 py-2.5">
								<div class="flex justify-end gap-1.5">
									<button
										class="inline-flex h-8 items-center rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
										type="button"
										onclick={cancelInline}
									>
										Batal
									</button>
									<button
										class="inline-flex h-8 items-center rounded-xl bg-blue-600 px-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
										type="submit"
										form={createFormId}
										disabled={createFormState.invalid || createFormState.submitting}
									>
										{createFormState.submitting ? 'Menyimpan…' : 'Simpan'}
									</button>
								</div>
							</td>
						</tr>
					{/if}

					{#if !tahunAjaranState.length && editingId !== 'new'}
						<tr>
							<td colspan="5" class="px-3 py-8 text-center text-slate-500 dark:text-zinc-400">
								Belum ada tahun ajaran yang tercatat untuk sekolah ini.
							</td>
						</tr>
					{:else}
						{#each tahunAjaranState as item, index (item.id)}
							{#if editingId === item.id}
								{@const editFormId = `ta-edit-form-${item.id}`}
								<tr class="bg-blue-50/40 dark:bg-blue-950/20">
									<td class="px-3 py-2.5">
										<input class="checkbox checkbox-sm" type="checkbox" disabled />
									</td>
									<td class="px-3 py-2.5 text-slate-600 tabular-nums dark:text-zinc-400"
										>{index + 1}</td
									>
									<td class="px-3 py-2.5">
										<FormEnhance
											id={editFormId}
											action="?/update"
											init={tahunAjaranInit(item)}
											onsuccess={handleUpdateSuccess}
										>
											{#snippet children({ submitting, invalid })}
												{syncEditFormState(submitting, invalid)}
												<input type="hidden" name="id" />
												<input type="hidden" name="sekolahId" value={selectedSekolahId} />
												<input
													class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
													name="nama"
													required
												/>
											{/snippet}
										</FormEnhance>
									</td>
									<td class="px-3 py-2.5 text-slate-700 tabular-nums dark:text-zinc-300"
										>{item.rombel ?? 0}</td
									>
									<td class="px-3 py-2.5">
										<div class="flex justify-end gap-1.5">
											<button
												class="inline-flex h-8 items-center rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
												type="button"
												onclick={cancelInline}
											>
												Batal
											</button>
											<button
												class="inline-flex h-8 items-center rounded-xl bg-blue-600 px-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
												type="submit"
												form={editFormId}
												disabled={editFormState.invalid || editFormState.submitting}
											>
												{editFormState.submitting ? 'Menyimpan…' : 'Simpan'}
											</button>
										</div>
									</td>
								</tr>
							{:else}
								<tr
									class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 {item.isAktif
										? 'bg-emerald-50/50 dark:bg-emerald-950/25'
										: ''}"
								>
									<td class="px-3 py-2.5">
										<input
											class="checkbox checkbox-sm"
											type="checkbox"
											checked={selectedIdsSet.has(item.id)}
											onchange={() => toggleSelect(item.id)}
										/>
									</td>
									<td class="px-3 py-2.5 text-slate-600 tabular-nums dark:text-zinc-400"
										>{index + 1}</td
									>
									<td class="px-3 py-2.5">
										<div class="flex items-center gap-2">
											<span class="font-semibold text-slate-900 dark:text-zinc-100"
												>{item.nama}</span
											>
											{#if item.isAktif}
												<span
													class="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
													>Aktif</span
												>
											{/if}
										</div>
									</td>
									<td class="px-3 py-2.5 text-slate-700 tabular-nums dark:text-zinc-300"
										>{item.rombel ?? 0}</td
									>
									<td class="px-3 py-2.5 text-right">
										<button
											class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
											type="button"
											onclick={() => handleEditRow(item.id)}
										>
											<Icon name="edit" class="h-3.5 w-3.5" />
											Edit
										</button>
									</td>
								</tr>
							{/if}
						{/each}
					{/if}
				{/if}
			</tbody>
		</table>
	</div>
</div>
