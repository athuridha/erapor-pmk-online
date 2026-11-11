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
	<dialog class="modal modal-open">
		<div class="modal-box max-w-lg rounded-2xl p-6">
			<div class="flex items-start justify-between gap-3 border-b border-base-200 pb-3">
				<div>
					<h3 class="text-lg font-bold text-base-content flex items-center gap-2">
						<Icon name="repeat" class="text-primary" />
						Sinkronkan TP ke Semua Kelas
					</h3>
					<p class="text-xs text-base-content/70 mt-1">
						Salin seluruh Tujuan Pembelajaran <strong>{mapelNama}</strong> dari kelas sumber ke kelas
						lain yang Anda ampu.
					</p>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-circle"
					onclick={onClose}
					disabled={submitting}
				>
					<Icon name="close" />
				</button>
			</div>

			<div class="mt-4 space-y-4">
				<!-- Info Sumber -->
				<div class="rounded-xl bg-base-200/60 p-3 text-xs flex items-center justify-between">
					<div>
						<span class="text-base-content/60">Kelas Sumber:</span>
						<strong class="ml-1 text-base-content">{mapelKelasNama}</strong>
					</div>
					<div class="badge badge-primary badge-sm font-semibold">
						{tpCount} Tujuan Pembelajaran
					</div>
				</div>

				{#if kelasDiampuLain.length === 0}
					<div class="alert alert-info alert-soft text-xs">
						<Icon name="info" />
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
								<span class="text-xs font-bold text-base-content">
									Pilih Kelas Tujuan ({selectedIds.length} dari {kelasDiampuLain.length} kelas):
								</span>
								<button
									type="button"
									class="btn btn-xs btn-ghost text-primary text-[11px]"
									onclick={() => toggleSelectAll(!allSelected)}
								>
									{allSelected ? 'Hapus Pilihan' : 'Pilih Semua'}
								</button>
							</div>

							<div
								class="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-base-200 p-2 bg-base-100"
							>
								{#each kelasDiampuLain as target (target.mapelId)}
									{@const isChecked = selectedIds.includes(target.mapelId)}
									<label
										class="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:bg-base-200/70 {isChecked
											? 'bg-primary/5 border border-primary/20'
											: ''}"
									>
										<div class="flex items-center gap-2.5">
											<input
												type="checkbox"
												name="targetMapelIds"
												value={target.mapelId}
												checked={isChecked}
												onchange={() => toggleId(target.mapelId)}
												class="checkbox checkbox-sm checkbox-primary"
											/>
											<span class="text-xs font-semibold text-base-content">
												{target.kelasNama}
											</span>
										</div>
										<span class="text-[11px] opacity-70">
											{#if target.tpCount > 0}
												<span class="text-success font-medium">{target.tpCount} TP ada</span>
											{:else}
												<span class="text-base-content/50">Belum ada TP</span>
											{/if}
										</span>
									</label>
								{/each}
							</div>
						</div>

						<!-- Opsi Mode Sinkronisasi -->
						<div class="space-y-2 pt-2 border-t border-base-200">
							<span class="text-xs font-bold text-base-content block">Metode Sinkronisasi:</span>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
								<label
									class="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer text-xs {mode ===
									'replace'
										? 'border-primary bg-primary/5 font-semibold text-primary'
										: 'border-base-200 text-base-content/80'}"
								>
									<input
										type="radio"
										name="mode"
										value="replace"
										checked={mode === 'replace'}
										onchange={() => (mode = 'replace')}
										class="radio radio-xs radio-primary mt-0.5"
									/>
									<div>
										<div class="font-bold">Timpa / Gantikan</div>
										<div class="text-[10px] opacity-70 font-normal mt-0.5 leading-snug">
											Ganti seluruh TP kelas tujuan agar identik dengan kelas ini.
										</div>
									</div>
								</label>

								<label
									class="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer text-xs {mode ===
									'merge'
										? 'border-primary bg-primary/5 font-semibold text-primary'
										: 'border-base-200 text-base-content/80'}"
								>
									<input
										type="radio"
										name="mode"
										value="merge"
										checked={mode === 'merge'}
										onchange={() => (mode = 'merge')}
										class="radio radio-xs radio-primary mt-0.5"
									/>
									<div>
										<div class="font-bold">Gabungkan</div>
										<div class="text-[10px] opacity-70 font-normal mt-0.5 leading-snug">
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
				class="modal-action mt-6 flex items-center justify-between border-t border-base-200 pt-3"
			>
				<button type="button" class="btn btn-sm btn-ghost" onclick={onClose} disabled={submitting}>
					Batal
				</button>
				<button
					type="submit"
					form="form-sync-tp"
					class="btn btn-sm btn-primary shadow-xs gap-1.5"
					disabled={submitting || selectedIds.length === 0 || tpCount === 0}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
						<span>Menyinkronkan…</span>
					{:else}
						<Icon name="repeat" class="text-sm" />
						<span>Sinkronkan ke {selectedIds.length} Kelas</span>
					{/if}
				</button>
			</div>
		</div>
		<button type="button" class="modal-backdrop" onclick={onClose} aria-label="Tutup modal"
		></button>
	</dialog>
{/if}
