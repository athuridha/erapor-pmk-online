<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { searchQueryMarker } from '$lib/utils';

	type KehadiranRow = {
		id: number;
		no: number;
		nama: string;
		hadir: boolean;
		keterangan: string | null;
		keteranganPulang: string | null;
		updatedAt: string | null;
	};

	let {
		rows,
		search,
		canEdit,
		tableReady,
		tanggal,
		kelasId,
		editingRowId,
		editingValues,
		editingSubmitting,
		onStartEdit,
		onCancelEdit,
		onEditValueChange,
		onUpdateSuccess,
		onSubmitStateChange,
		jenisPresensi = 'wali_kelas_saja',
		tipePresensi = 'masuk_saja',
		harianMapelId = null,
		selectable = false,
		selectedIds = [],
		onToggleSelect,
		onToggleAll
	}: {
		rows: KehadiranRow[];
		search: string | null;
		canEdit: boolean;
		tableReady: boolean;
		tanggal: string;
		kelasId: number | null;
		editingRowId: number | null;
		editingValues: { keterangan: string; keteranganPulang: string };
		editingSubmitting: boolean;
		onStartEdit: (row: KehadiranRow) => void;
		onCancelEdit: () => void;
		onEditValueChange: (value: { keterangan: string; keteranganPulang: string }) => void;
		onUpdateSuccess: () => void;
		onSubmitStateChange: (v: boolean) => void;
		jenisPresensi?: string;
		tipePresensi?: string;
		harianMapelId?: number | null;
		/** Tampilkan checkbox pemilihan massal (mode Harian). */
		selectable?: boolean;
		selectedIds?: number[];
		onToggleSelect?: (muridId: number, checked: boolean) => void;
		onToggleAll?: (checked: boolean) => void;
	} = $props();

	let editingSaveDisabled = $derived(editingRowId == null || editingSubmitting);

	let headerCheckbox = $state<HTMLInputElement | null>(null);
	const allSelected = $derived(
		rows.length > 0 && rows.every((row) => selectedIds.includes(row.id))
	);
	const someSelected = $derived(rows.some((row) => selectedIds.includes(row.id)));

	$effect(() => {
		if (headerCheckbox) {
			headerCheckbox.indeterminate = someSelected && !allSelected;
		}
	});

	const isWaliKelasMasukSaja = $derived(
		jenisPresensi === 'wali_kelas_saja' && tipePresensi === 'masuk_saja'
	);
	const isWaliKelasMasukPulang = $derived(
		jenisPresensi === 'wali_kelas_saja' && tipePresensi === 'masuk_pulang'
	);
	const isSingleColumnMode = $derived(
		isWaliKelasMasukSaja ||
			(jenisPresensi === 'tiap_mapel' &&
				(tipePresensi === 'awal_mapel' || tipePresensi === 'awal_akhir_mapel'))
	);

	function displayKeterangan(value: string | null | undefined) {
		if (value == null) return 'Hadir';
		if (value === '') return 'Hadir';
		const labels: Record<string, string> = {
			sakit: 'Sakit',
			izin: 'Izin',
			alfa: 'TK'
		};
		return labels[value] ?? value;
	}

	function keteranganColor(value: string | null | undefined) {
		if (value == null || value === '') {
			return 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300';
		}
		const colors: Record<string, string> = {
			sakit:
				'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
			izin: 'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300',
			alfa: 'border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'
		};
		return (
			colors[value] ??
			'border-slate-200/80 bg-slate-100 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
		);
	}
</script>

<div
	class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
>
	<table class="w-full border-collapse text-xs">
		<thead>
			<tr
				class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
			>
				{#if selectable}
					<th class="w-9 min-w-8 px-3 py-2.5 text-center">
						<input
							bind:this={headerCheckbox}
							type="checkbox"
							class="checkbox checkbox-sm"
							aria-label="Pilih semua murid di halaman ini"
							checked={allSelected}
							disabled={!tableReady || rows.length === 0}
							onchange={(event) => onToggleAll?.((event.currentTarget as HTMLInputElement).checked)}
						/>
					</th>
				{/if}
				<th class="w-12 min-w-10 px-3.5 py-2.5">No</th>
				<th class="w-full min-w-40 px-3.5 py-2.5">Nama</th>
				{#if isWaliKelasMasukPulang}
					<th class="min-w-28 px-3.5 py-2.5 text-center">Masuk</th>
					<th class="min-w-28 px-3.5 py-2.5 text-center">Pulang</th>
				{:else if isSingleColumnMode}
					<th class="min-w-28 px-3.5 py-2.5 text-center">Hadir</th>
				{:else}
					<th class="min-w-28 px-3.5 py-2.5 text-center">Hadir</th>
					<th class="min-w-32 px-3.5 py-2.5 text-center">Keterangan</th>
				{/if}
				<th class="min-w-28 px-3.5 py-2.5 text-center">Aksi</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
			{#each rows as murid (murid.id)}
				{@const isEditing = editingRowId === murid.id}
				{@const formId = `kehadiran-form-${murid.id}`}
				<tr
					class="transition-colors {isEditing
						? 'bg-blue-50/40 dark:bg-blue-950/20'
						: 'hover:bg-slate-50/70 dark:hover:bg-zinc-800/40'}"
				>
					{#if selectable}
						<td class="px-3 py-2.5 text-center">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								aria-label={`Pilih ${murid.nama}`}
								checked={selectedIds.includes(murid.id)}
								disabled={!tableReady || isEditing}
								onchange={(event) =>
									onToggleSelect?.(murid.id, (event.currentTarget as HTMLInputElement).checked)}
							/>
						</td>
					{/if}
					<td class="px-3.5 py-2.5 text-slate-500 dark:text-zinc-400">{murid.no}</td>
					<td class="px-3.5 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
						{@html searchQueryMarker(search, murid.nama)}
					</td>

					{#if isWaliKelasMasukPulang}
						<td class="px-3.5 py-2.5 text-center">
							{#if isEditing}
								<div class="relative flex items-center">
									<select
										class="h-8 w-full appearance-none truncate rounded-lg border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
										value={editingValues.keterangan}
										onchange={(event) =>
											onEditValueChange({
												...editingValues,
												keterangan: (event.currentTarget as HTMLSelectElement).value
											})}
									>
										<option value="">Hadir</option>
										<option value="sakit">Sakit</option>
										<option value="izin">Izin</option>
										<option value="alfa">TK</option>
									</select>
									<span
										aria-hidden="true"
										class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
									>
										<Icon name="down" class="h-3 w-3" />
									</span>
								</div>
							{:else if murid.updatedAt != null || murid.hadir}
								<span
									class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {keteranganColor(
										murid.keterangan
									)}"
								>
									{displayKeterangan(murid.keterangan)}
								</span>
							{:else}
								<span class="text-slate-300 dark:text-zinc-600">-</span>
							{/if}
						</td>
						<td class="px-3.5 py-2.5 text-center">
							{#if isEditing}
								<div class="relative flex items-center">
									<select
										class="h-8 w-full appearance-none truncate rounded-lg border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
										value={editingValues.keteranganPulang}
										onchange={(event) =>
											onEditValueChange({
												...editingValues,
												keteranganPulang: (event.currentTarget as HTMLSelectElement).value
											})}
									>
										<option value="">Hadir</option>
										<option value="sakit">Sakit</option>
										<option value="izin">Izin</option>
										<option value="alfa">TK</option>
									</select>
									<span
										aria-hidden="true"
										class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
									>
										<Icon name="down" class="h-3 w-3" />
									</span>
								</div>
							{:else if murid.keteranganPulang != null}
								<span
									class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {keteranganColor(
										murid.keteranganPulang
									)}"
								>
									{displayKeterangan(murid.keteranganPulang)}
								</span>
							{:else}
								<span class="text-slate-300 dark:text-zinc-600">-</span>
							{/if}
						</td>
					{:else if isSingleColumnMode}
						<td class="px-3.5 py-2.5 text-center">
							{#if isEditing}
								<div class="relative flex items-center">
									<select
										class="h-8 w-full appearance-none truncate rounded-lg border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
										value={editingValues.keterangan}
										onchange={(event) =>
											onEditValueChange({
												...editingValues,
												keterangan: (event.currentTarget as HTMLSelectElement).value
											})}
									>
										<option value="">Hadir</option>
										<option value="sakit">Sakit</option>
										<option value="izin">Izin</option>
										<option value="alfa">TK</option>
									</select>
									<span
										aria-hidden="true"
										class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
									>
										<Icon name="down" class="h-3 w-3" />
									</span>
								</div>
							{:else if murid.updatedAt != null || murid.hadir}
								<span
									class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {keteranganColor(
										murid.keterangan
									)}"
								>
									{displayKeterangan(murid.keterangan)}
								</span>
							{:else}
								<span class="text-slate-300 dark:text-zinc-600">-</span>
							{/if}
						</td>
					{:else}
						<td class="px-3.5 py-2.5 text-center">
							<span
								class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {murid.hadir
									? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
									: 'border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'}"
							>
								{murid.hadir ? 'Hadir' : 'Tidak hadir'}
							</span>
						</td>
						<td class="overflow-hidden px-3.5 py-2.5 text-center text-slate-700 dark:text-zinc-200">
							{#if isEditing}
								<div class="relative flex items-center">
									<select
										class="h-8 w-full appearance-none truncate rounded-lg border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
										value={editingValues.keterangan}
										onchange={(event) =>
											onEditValueChange({
												...editingValues,
												keterangan: (event.currentTarget as HTMLSelectElement).value
											})}
									>
										<option value="">-</option>
										<option value="sakit">Sakit</option>
										<option value="izin">Izin</option>
										<option value="alfa">TK</option>
									</select>
									<span
										aria-hidden="true"
										class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
									>
										<Icon name="down" class="h-3 w-3" />
									</span>
								</div>
							{:else if murid.keterangan}
								{displayKeterangan(murid.keterangan)}
							{:else}
								-
							{/if}
						</td>
					{/if}

					<td class="px-3.5 py-2.5">
						<div class="flex items-center justify-center gap-1.5">
							{#if isEditing}
								<FormEnhance
									id={formId}
									action="?/update"
									submitStateChange={onSubmitStateChange}
									onsuccess={onUpdateSuccess}
									showToast
								>
									{#snippet children({ submitting })}
										<input
											type="hidden"
											name="muridId"
											value={murid.id}
											data-submitting={submitting ? '1' : '0'}
										/>
										<input type="hidden" name="keterangan" value={editingValues.keterangan} />
										<input
											type="hidden"
											name="keteranganPulang"
											value={editingValues.keteranganPulang}
										/>
										<input type="hidden" name="tanggal" value={tanggal} />
										<input type="hidden" name="kelasId" value={kelasId ?? ''} />
										{#if harianMapelId != null}
											<input type="hidden" name="mataPelajaranId" value={harianMapelId} />
										{/if}
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
									form={formId}
									disabled={editingSaveDisabled}
								>
									{#if editingSubmitting}
										<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
									{:else}
										<Icon name="save" class="h-3.5 w-3.5" />
									{/if}
								</button>
							{:else}
								<button
									type="button"
									class="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
									onclick={() => onStartEdit(murid)}
									disabled={!tableReady || !canEdit}
									aria-disabled={!tableReady || !canEdit}
									title={!canEdit ? 'Anda tidak memiliki izin untuk mengedit' : ''}
								>
									<Icon name="edit" class="h-3.5 w-3.5" />
									Edit
								</button>
							{/if}
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	:global(form[id^='kehadiran-form-']) {
		display: contents;
	}
</style>
