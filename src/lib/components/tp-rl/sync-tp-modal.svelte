<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { MapelKelasDiampu } from '$lib/server/mapel-tp';

	interface Props {
		isOpen: boolean;
		mapelNama: string;
		mapelKelasNama: string;
		tpCount: number;
		kelasDiampuLain: MapelKelasDiampu[];
		onClose: () => void;
		onSuccess: (result?: Record<string, unknown>) => void;
	}

	let {
		isOpen = false,
		mapelNama,
		mapelKelasNama,
		tpCount,
		kelasDiampuLain = [],
		onClose,
		onSuccess
	}: Props = $props();

	let selectedIds = $state<number[]>([]);
	let mode = $state<'replace' | 'merge'>('replace');
	let submitting = $state(false);

	// Inisialisasi: otomatis centang semua kelas diampu lain saat modal terbuka
	$effect(() => {
		if (isOpen) {
			selectedIds = kelasDiampuLain.map((k) => k.mapelId);
			submitting = false;
		}
	});

	const allSelected = $derived(
		kelasDiampuLain.length > 0 && selectedIds.length === kelasDiampuLain.length
	);

	function toggleSelectAll(checked: boolean) {
		if (checked) {
			selectedIds = kelasDiampuLain.map((k) => k.mapelId);
		} else {
			selectedIds = [];
		}
	}

	function toggleId(id: number) {
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((item) => item !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}
</script>

{#if isOpen}
	<dialog class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]">
		<div
			class="modal-box max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<div
				class="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-zinc-800"
			>
				<div>
					<h3
						class="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100"
					>
						<Icon name="repeat" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
						Sinkronkan TP ke Semua Kelas
					</h3>
					<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
						Salin seluruh Tujuan Pembelajaran <strong>{mapelNama}</strong> dari kelas sumber ke kelas
						lain yang Anda ampu.
					</p>
				</div>
				<button
					type="button"
					class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
					onclick={onClose}
					disabled={submitting}
					aria-label="Tutup"
				>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>

			<div class="mt-4 space-y-4">
				<!-- Info Sumber -->
				<div
					class="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-800/50"
				>
					<div>
						<span class="text-slate-500 dark:text-zinc-400">Kelas Sumber:</span>
						<strong class="ml-1 text-slate-900 dark:text-zinc-100">{mapelKelasNama}</strong>
					</div>
					<span
						class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300"
					>
						{tpCount} Tujuan Pembelajaran
					</span>
				</div>

				{#if kelasDiampuLain.length === 0}
					<div
						class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3.5 py-2.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
					>
						<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
						<span>Tidak ditemukan kelas lain yang Anda ampu untuk mata pelajaran ini.</span>
					</div>
				{:else}
					<FormEnhance
						id="form-sync-tp"
						action="?/sync_all"
						showToast={true}
						onsuccess={({ data }) => onSuccess(data)}
						submitStateChange={(val) => (submitting = val)}
					>
						<!-- Opsi Pilihan Kelas Tujuan -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold text-slate-800 dark:text-zinc-200">
									Pilih Kelas Tujuan ({selectedIds.length} dari {kelasDiampuLain.length} kelas):
								</span>
								<button
									type="button"
									class="rounded-lg px-2 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
									onclick={() => toggleSelectAll(!allSelected)}
								>
									{allSelected ? 'Hapus Pilihan' : 'Pilih Semua'}
								</button>
							</div>

							<div
								class="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/40 p-2 dark:border-zinc-800 dark:bg-zinc-900/50"
							>
								{#each kelasDiampuLain as target (target.mapelId)}
									{@const isChecked = selectedIds.includes(target.mapelId)}
									<label
										class="flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-colors {isChecked
											? 'border-blue-200 bg-blue-50/75 dark:border-blue-900/60 dark:bg-blue-950/35'
											: 'border-transparent hover:bg-slate-100/70 dark:hover:bg-zinc-800/60'}"
									>
										<div class="flex items-center gap-2.5">
											<input
												type="checkbox"
												name="targetMapelIds"
												value={target.mapelId}
												checked={isChecked}
												onchange={() => toggleId(target.mapelId)}
												class="checkbox checkbox-sm rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
											/>
											<span class="text-xs font-semibold text-slate-800 dark:text-zinc-100">
												{target.kelasNama}
											</span>
										</div>
										<span class="text-[11px]">
											{#if target.tpCount > 0}
												<span class="font-medium text-emerald-600 dark:text-emerald-400"
													>{target.tpCount} TP ada</span
												>
											{:else}
												<span class="text-slate-400 dark:text-zinc-500">Belum ada TP</span>
											{/if}
										</span>
									</label>
								{/each}
							</div>
						</div>

						<!-- Opsi Mode Sinkronisasi -->
						<div class="space-y-2 border-t border-slate-200/70 pt-3 dark:border-zinc-800">
							<span class="block text-xs font-semibold text-slate-800 dark:text-zinc-200"
								>Metode Sinkronisasi:</span
							>
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<label
									class="flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs transition-colors {mode ===
									'replace'
										? 'border-blue-500 bg-blue-50/75 text-blue-900 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-200'
										: 'border-slate-200/80 text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50'}"
								>
									<input
										type="radio"
										name="mode"
										value="replace"
										checked={mode === 'replace'}
										onchange={() => (mode = 'replace')}
										class="radio radio-xs mt-0.5 border-[#7e8b9b] text-blue-600 checked:border-blue-600 checked:bg-blue-600 dark:border-zinc-600"
									/>
									<div>
										<div class="font-semibold">Timpa / Gantikan</div>
										<div class="mt-0.5 text-[11px] leading-snug font-normal opacity-80">
											Ganti seluruh TP kelas tujuan agar identik dengan kelas ini.
										</div>
									</div>
								</label>

								<label
									class="flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs transition-colors {mode ===
									'merge'
										? 'border-blue-500 bg-blue-50/75 text-blue-900 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-200'
										: 'border-slate-200/80 text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50'}"
								>
									<input
										type="radio"
										name="mode"
										value="merge"
										checked={mode === 'merge'}
										onchange={() => (mode = 'merge')}
										class="radio radio-xs mt-0.5 border-[#7e8b9b] text-blue-600 checked:border-blue-600 checked:bg-blue-600 dark:border-zinc-600"
									/>
									<div>
										<div class="font-semibold">Gabungkan</div>
										<div class="mt-0.5 text-[11px] leading-snug font-normal opacity-80">
											Hanya tambahkan TP yang belum ada di kelas tujuan.
										</div>
									</div>
								</label>
							</div>
						</div>
					</FormEnhance>
				{/if}
			</div>

			<div
				class="mt-5 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-zinc-800"
			>
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={onClose}
					disabled={submitting}
				>
					Batal
				</button>
				<button
					type="submit"
					form="form-sync-tp"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={submitting || selectedIds.length === 0 || tpCount === 0}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
						<span>Menyinkronkan…</span>
					{:else}
						<Icon name="repeat" class="h-3.5 w-3.5" />
						<span>Sinkronkan ke {selectedIds.length} Kelas</span>
					{/if}
				</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop bg-transparent"
			onclick={onClose}
			aria-label="Tutup modal"
		></button>
	</dialog>
{/if}
