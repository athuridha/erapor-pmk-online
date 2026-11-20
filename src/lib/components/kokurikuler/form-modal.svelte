<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { DimensiProfilLulusanKey } from '$lib/statics';
	import type { KokurikulerRow } from './types';

	type DimensionOption = {
		key: DimensiProfilLulusanKey;
		label: string;
	};

	let {
		open,
		title,
		action,
		kelasId,
		kelasOptions,
		tableReady,
		canManage,
		isEditMode,
		modalItem,
		dimensionOptions,
		selectedDimensions,
		onToggleDimension,
		kodeInput,
		onKodeChange,
		tujuanInput,
		onTujuanChange,
		onClose,
		onSuccess
	} = $props<{
		open: boolean;
		title: string;
		action: string;
		kelasId: number | null;
		kelasOptions: Array<{ id: number; nama: string; fase: string | null }>;
		tableReady: boolean;
		canManage: boolean;
		isEditMode: boolean;
		modalItem: (KokurikulerRow & { dimensi: DimensiProfilLulusanKey[] }) | null;
		dimensionOptions: DimensionOption[];
		selectedDimensions: DimensiProfilLulusanKey[];
		onToggleDimension: (dimension: DimensiProfilLulusanKey, checked: boolean) => void;
		kodeInput: string;
		onKodeChange: (value: string) => void;
		tujuanInput: string;
		onTujuanChange: (value: string) => void;
		onClose: () => void;
		onSuccess: (payload: { form: HTMLFormElement }) => void;
	}>();

	let submitting = $state(false);
	let kelasDipilih = $state<number[]>([]);

	$effect(() => {
		if (open) kelasDipilih = [];
	});
</script>

{#if open}
	<div
		class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		onkeydown={(event) => {
			if (event.key === 'Escape') onClose();
		}}
	>
		<div
			class="modal-box flex max-h-[85vh] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:max-w-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<div class="flex shrink-0 items-center justify-between gap-3">
				<h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
					{title}
				</h3>
				<button
					type="button"
					class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
					onclick={onClose}
					aria-label="Tutup"
				>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto px-0.5 py-4">
				<FormEnhance
					id="form-kokurikuler"
					class="space-y-4"
					{action}
					onsuccess={onSuccess}
					submitStateChange={(v) => (submitting = v)}
				>
					{#if kelasId == null}
						<fieldset class="space-y-1.5">
							<legend class="block text-xs font-medium text-slate-700 dark:text-zinc-300">
								Kelas (bisa lebih dari satu)
							</legend>
							<div
								class="max-h-44 space-y-0.5 overflow-y-auto rounded-xl border border-[#7e8b9b] bg-white p-1.5 dark:border-zinc-600 dark:bg-zinc-900"
							>
								{#each kelasOptions as kelas (kelas.id)}
									<label
										class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
									>
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											name="kelasId"
											value={kelas.id}
											bind:group={kelasDipilih}
											disabled={!canManage}
										/>
										<span class="truncate">{kelas.nama}{kelas.fase ? ` - ${kelas.fase}` : ''}</span>
									</label>
								{/each}
							</div>
							{#if kelasDipilih.length > 1}
								<p class="text-[11px] text-slate-500 dark:text-zinc-400">
									Kode pada kelas berikutnya otomatis diberi akhiran -2, -3, dst.
								</p>
							{/if}
						</fieldset>
					{:else}
						<input name="kelasId" value={kelasId} hidden />
					{/if}
					{#if isEditMode && modalItem}
						<input name="id" value={modalItem.id} hidden />
					{/if}

					<div class="space-y-2">
						<p class="text-xs font-medium text-slate-700 dark:text-zinc-300">
							Pilih Dimensi Profil Lulusan
						</p>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{#each dimensionOptions as dimensi (dimensi.key)}
								<label
									class="flex cursor-pointer flex-row items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/65 px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-100/75 dark:border-zinc-800 dark:bg-zinc-800/45 dark:text-zinc-200 dark:hover:bg-zinc-800"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-sm rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
										value={dimensi.key}
										name="dimensi"
										checked={selectedDimensions.includes(dimensi.key)}
										onchange={(event) =>
											onToggleDimension(dimensi.key, event.currentTarget.checked)}
										aria-label={dimensi.label}
									/>
									<span>{dimensi.label}</span>
								</label>
							{/each}
						</div>
					</div>

					<label class="block space-y-1.5">
						<span class="block text-xs font-medium text-slate-700 dark:text-zinc-300">Kode</span>
						<input
							type="text"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
							placeholder="Masukkan kode (contoh: KK-BAKU)"
							name="kode"
							value={kodeInput}
							oninput={(event) => onKodeChange((event.currentTarget as HTMLInputElement).value)}
							required
							disabled={!canManage}
							maxlength={20}
						/>
					</label>

					<label class="block space-y-1.5">
						<span class="block text-xs font-medium text-slate-700 dark:text-zinc-300"
							>Kegiatan Kokurikuler</span
						>
						<textarea
							class="min-h-28 w-full rounded-xl border border-[#7e8b9b] bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
							placeholder="Ketik kegiatan atau tema kegiatan kokurikuler"
							name="kokurikuler"
							value={tujuanInput}
							oninput={(event) =>
								onTujuanChange((event.currentTarget as HTMLTextAreaElement).value)}
							required
							disabled={!canManage}></textarea>
					</label>
				</FormEnhance>
			</div>

			<div
				class="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-zinc-800"
			>
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="button"
					onclick={onClose}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					Batal
				</button>
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					type="submit"
					form="form-kokurikuler"
					disabled={submitting ||
						!selectedDimensions.length ||
						(!kelasId && !kelasDipilih.length) ||
						!tableReady ||
						!kodeInput.trim() ||
						!tujuanInput.trim()}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon name="save" class="h-3.5 w-3.5" />
					{/if}
					{isEditMode ? 'Simpan Perubahan' : 'Simpan'}
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button
				type="submit"
				onclick={(event) => {
					event.preventDefault();
					onClose();
				}}
			>
				tutup
			</button>
		</form>
	</div>
{/if}
