<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { NilaiKategori } from '$lib/kokurikuler';
	import type { DimensiProfilLulusanKey } from '$lib/statics';

	type MuridRow = {
		id: number;
		nama: string;
		nilaiByDimensi: Record<DimensiProfilLulusanKey, NilaiKategori | null>;
	};

	type KokurikulerDetail = {
		id: number;
		kode: string;
		tujuan: string;
		dimensi: Array<{ key: DimensiProfilLulusanKey; label: string }>;
	};

	let { open, murid, kokurikuler, kategoriOptions, action, onClose, onSuccess } = $props<{
		open: boolean;
		murid: MuridRow | null;
		kokurikuler: KokurikulerDetail | null;
		kategoriOptions: Array<{ value: NilaiKategori; label: string }>;
		action: string;
		onClose: () => void;
		onSuccess: () => void | Promise<void>;
	}>();

	const initValue = $derived.by(() => {
		if (!murid || !kokurikuler) return undefined;
		const nilai: Record<string, NilaiKategori> = {};
		for (const [key, value] of Object.entries(murid.nilaiByDimensi) as Array<
			[DimensiProfilLulusanKey, NilaiKategori | null]
		>) {
			if (value) {
				nilai[key] = value;
			}
		}
		return {
			muridId: murid.id,
			kokurikulerId: kokurikuler.id,
			nilai
		};
	});

	function handleSuccess() {
		onSuccess?.();
	}

	let submitting = $state(false);

	function capitalizeSentence(value: string | null | undefined) {
		if (!value) return '';
		const trimmed = value.trimStart();
		if (!trimmed) return '';
		return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
	}
</script>

{#if open && murid && kokurikuler}
	<div
		class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={(event) => {
			if (event.key === 'Escape') onClose();
		}}
	>
		<div
			class="modal-box max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<div class="border-b border-slate-100 pb-3 dark:border-zinc-800">
				<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">Nilai Kokurikuler</h3>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Ananda <span class="font-semibold text-slate-800 dark:text-zinc-200">{murid.nama}</span>
				</p>
			</div>

			<div class="mt-4 overflow-hidden">
				<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
					Kegiatan Kokurikuler
				</span>
				<select
					class="h-9 w-full truncate rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
					disabled
				>
					<option>{capitalizeSentence(kokurikuler.tujuan)}</option>
				</select>
			</div>

			<FormEnhance
				id="form-nilai-kokurikuler"
				{action}
				init={initValue}
				onsuccess={handleSuccess}
				submitStateChange={(v) => (submitting = v)}
			>
				<input type="hidden" name="muridId" value={murid.id} />
				<input type="hidden" name="kokurikulerId" value={kokurikuler.id} />

				<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
					{#each kokurikuler.dimensi as dim (dim.key)}
						<div>
							<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								{dim.label}
							</span>
							<div class="relative flex items-center">
								<select
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
									name={`nilai.${dim.key}`}
									aria-label={`Nilai ${dim.label}`}
								>
									<option value="">Belum dinilai</option>
									{#each kategoriOptions as option (option.value)}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3.5 w-3.5" />
								</span>
							</div>
						</div>
					{/each}
				</div>
			</FormEnhance>

			<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={onClose}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					Batal
				</button>
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
					type="submit"
					form="form-nilai-kokurikuler"
					disabled={submitting}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
					{:else}
						<Icon name="save" class="h-3.5 w-3.5" />
					{/if}
					Simpan
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
				Tutup
			</button>
		</form>
	</div>
{/if}
