<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { searchQueryMarker } from '$lib/utils';

	type RaporRow = {
		id: number;
		no: number;
		nama: string;
		hadir: number;
		sakit: number;
		izin: number;
		alfa: number;
		overridden: boolean;
	};

	let {
		rows,
		search,
		canEdit,
		tableReady,
		editingRowId,
		editingValues,
		editingSubmitting,
		editingSaveDisabled,
		totalHariBelajar,
		onStartEdit,
		onCancelEdit,
		onEditValueChange,
		onUpdateSuccess,
		onSubmitStateChange
	}: {
		rows: RaporRow[];
		search: string | null;
		canEdit: boolean;
		tableReady: boolean;
		editingRowId: number | null;
		editingValues: { sakit: number; izin: number; alfa: number };
		editingSubmitting: boolean;
		editingSaveDisabled: boolean;
		totalHariBelajar?: number;
		onStartEdit: (row: RaporRow) => void;
		onCancelEdit: () => void;
		onEditValueChange: (value: { sakit: number; izin: number; alfa: number }) => void;
		onUpdateSuccess: () => void;
		onSubmitStateChange: (v: boolean) => void;
	} = $props();
</script>

<div
	class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
>
	<table class="w-full border-collapse text-xs">
		<thead>
			<tr
				class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
			>
				<th class="w-12 min-w-10 px-3.5 py-2.5">No</th>
				<th class="w-full min-w-40 px-3.5 py-2.5">Nama</th>
				<th class="min-w-20 px-3.5 py-2.5 text-center">Hadir</th>
				<th class="min-w-20 px-3.5 py-2.5 text-center">Sakit</th>
				<th class="min-w-20 px-3.5 py-2.5 text-center">Izin</th>
				<th class="min-w-20 px-3.5 py-2.5 text-center">TK</th>
				<th class="min-w-40 px-3.5 py-2.5 text-center">
					Aksi
					{#if totalHariBelajar}
						<span class="block text-[11px] font-normal text-slate-400 dark:text-zinc-400">
							{totalHariBelajar} hari belajar
						</span>
					{/if}
				</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
			{#each rows as row (row.id)}
				{@const isEditing = editingRowId === row.id}
				{@const updateFormId = `rapor-update-form-${row.id}`}
				{@const resetFormId = `rapor-reset-form-${row.id}`}
				<tr
					class="transition-colors {isEditing
						? 'bg-blue-50/40 dark:bg-blue-950/20'
						: 'hover:bg-slate-50/70 dark:hover:bg-zinc-800/40'}"
				>
					<td class="px-3.5 py-2.5 text-slate-500 dark:text-zinc-400">{row.no}</td>
					<td class="px-3.5 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
						{@html searchQueryMarker(search, row.nama)}
					</td>
					<td class="px-3.5 py-2.5 text-center font-bold text-slate-900 dark:text-zinc-100">
						{row.hadir || ''}
					</td>
					<td class="px-3.5 py-2.5 text-center text-slate-700 dark:text-zinc-200">
						{#if isEditing}
							<input
								type="number"
								class="h-8 w-16 rounded-lg border border-[#7e8b9b] bg-white px-2 text-center text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								value={editingValues.sakit}
								onchange={(e) =>
									onEditValueChange({
										...editingValues,
										sakit: Number((e.currentTarget as HTMLInputElement).value)
									})}
								min="0"
							/>
						{:else}
							{row.sakit || ''}
						{/if}
					</td>
					<td class="px-3.5 py-2.5 text-center text-slate-700 dark:text-zinc-200">
						{#if isEditing}
							<input
								type="number"
								class="h-8 w-16 rounded-lg border border-[#7e8b9b] bg-white px-2 text-center text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								value={editingValues.izin}
								onchange={(e) =>
									onEditValueChange({
										...editingValues,
										izin: Number((e.currentTarget as HTMLInputElement).value)
									})}
								min="0"
							/>
						{:else}
							{row.izin || ''}
						{/if}
					</td>
					<td class="px-3.5 py-2.5 text-center text-slate-700 dark:text-zinc-200">
						{#if isEditing}
							<input
								type="number"
								class="h-8 w-16 rounded-lg border border-[#7e8b9b] bg-white px-2 text-center text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								value={editingValues.alfa}
								onchange={(e) =>
									onEditValueChange({
										...editingValues,
										alfa: Number((e.currentTarget as HTMLInputElement).value)
									})}
								min="0"
							/>
						{:else}
							{row.alfa || ''}
						{/if}
					</td>
					<td class="px-3.5 py-2.5">
						<div class="flex items-center justify-center gap-1.5">
							{#if isEditing}
								<FormEnhance
									id={updateFormId}
									action="?/updateRapor"
									submitStateChange={onSubmitStateChange}
									onsuccess={onUpdateSuccess}
									showToast
								>
									{#snippet children({ submitting })}
										<input type="hidden" name="muridId" value={row.id} />
										<input
											type="hidden"
											name="sakit"
											value={editingValues.sakit}
											data-submitting={submitting ? '1' : '0'}
										/>
										<input type="hidden" name="izin" value={editingValues.izin} />
										<input type="hidden" name="alfa" value={editingValues.alfa} />
									{/snippet}
								</FormEnhance>
								<button
									type="button"
									class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
									aria-label="Batalkan"
									title="Batalkan"
									onclick={onCancelEdit}
									disabled={editingSubmitting}
								>
									<Icon name="close" class="h-3.5 w-3.5" />
								</button>
								<button
									type="submit"
									class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
									aria-label="Simpan"
									title="Simpan"
									form={updateFormId}
									disabled={editingSaveDisabled}
								>
									{#if editingSubmitting}
										<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
									{:else}
										<Icon name="save" class="h-3.5 w-3.5" />
									{/if}
								</button>
							{:else}
								<div class="flex items-center gap-1.5">
									<button
										type="button"
										class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#7e8b9b] bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
										onclick={() => onStartEdit(row)}
										disabled={!tableReady || !canEdit}
										aria-disabled={!tableReady || !canEdit}
										aria-label="Edit nilai ketidakhadiran"
										title={!canEdit
											? 'Anda tidak memiliki izin untuk mengedit'
											: 'Edit nilai ketidakhadiran'}
									>
										<Icon name="edit" class="h-3.5 w-3.5" />
									</button>
									<FormEnhance
										id={resetFormId}
										action="?/resetRapor"
										onsuccess={onUpdateSuccess}
										showToast
									>
										<input type="hidden" name="muridId" value={row.id} />
									</FormEnhance>
									<button
										type="submit"
										class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200/80 bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950"
										aria-label="Reset ke nilai asli"
										title="Reset ke nilai asli"
										form={resetFormId}
										disabled={!tableReady || !canEdit || !row.overridden}
										aria-disabled={!tableReady || !canEdit || !row.overridden}
									>
										<Icon name="repeat" class="h-3.5 w-3.5" />
									</button>
								</div>
							{/if}
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	:global(form[id^='rapor-update-form-']),
	:global(form[id^='rapor-reset-form-']) {
		display: contents;
	}
</style>
