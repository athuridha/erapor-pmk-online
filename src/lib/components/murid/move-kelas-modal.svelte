<script lang="ts">
	import { invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	type KelasTujuan = {
		id: number;
		nama: string;
		fase: string | null;
		semesterId: number;
		semesterNama: string;
		tahunAjaranNama: string;
	};

	interface Props {
		isOpen?: boolean;
		murid: Array<{ id: number; nama: string; nis: string }>;
		kelasList: KelasTujuan[];
		currentKelasId?: number | null;
		onSuccess?: () => void;
	}

	let {
		isOpen = $bindable(false),
		murid,
		kelasList,
		currentKelasId = null,
		onSuccess
	}: Props = $props();

	// Kelas asal tidak perlu muncul sebagai tujuan.
	const daftarKelas = $derived(
		currentKelasId ? kelasList.filter((kelas) => kelas.id !== currentKelasId) : kelasList
	);

	const grupKelas = $derived.by(() => {
		const groups = new Map<string, KelasTujuan[]>();
		for (const kelas of daftarKelas) {
			const label = [kelas.tahunAjaranNama, kelas.semesterNama].filter(Boolean).join(' — ');
			const items = groups.get(label);
			if (items) {
				items.push(kelas);
			} else {
				groups.set(label, [kelas]);
			}
		}
		return [...groups.entries()];
	});

	async function handleSuccess({ data }: { data?: Record<string, unknown> }) {
		await invalidate('app:murid');
		toast({
			message: typeof data?.message === 'string' ? data.message : 'Murid berhasil dipindahkan',
			type: 'success'
		});
		isOpen = false;
		onSuccess?.();
	}

	function close() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<dialog class="modal" open>
		<div class="modal-box">
			<h3 class="mb-2 text-lg font-bold">Pindahkan Murid</h3>
			<p class="mb-4 text-sm opacity-70">
				{murid.length} murid akan dipindahkan. Pilih kelas tujuan pada semester yang sama.
			</p>

			<FormEnhance action="?/moveSelected" showToast={false} onsuccess={handleSuccess}>
				{#snippet children({ submitting, invalid })}
					{#each murid as item (item.id)}
						<input type="hidden" name="muridIds" value={item.id} />
					{/each}

					{#if daftarKelas.length}
						<fieldset class="fieldset mb-4">
							<legend class="fieldset-legend">Kelas tujuan</legend>
							<select name="kelasId" class="select w-full" required disabled={submitting}>
								<option value="" disabled selected>Pilih kelas tujuan</option>
								{#each grupKelas as [label, items] (label)}
									<optgroup {label}>
										{#each items as kelas (kelas.id)}
											<option value={kelas.id}>
												{kelas.nama}{kelas.fase ? ` (${kelas.fase})` : ''}
											</option>
										{/each}
									</optgroup>
								{/each}
							</select>
						</fieldset>
					{:else}
						<div class="alert alert-warning alert-soft mb-4">
							<Icon name="warning" />
							<span>Tidak ada kelas lain pada semester ini.</span>
						</div>
					{/if}

					<div class="bg-base-200 rounded-box mb-4 max-h-40 overflow-y-auto p-3 text-sm">
						<ul class="list-disc space-y-1 pl-4">
							{#each murid as item (item.id)}
								<li>{item.nama} <span class="opacity-60">({item.nis})</span></li>
							{/each}
						</ul>
					</div>

					<div class="modal-action">
						<button
							type="button"
							class="btn btn-soft shadow-none"
							onclick={close}
							disabled={submitting}
						>
							<Icon name="close" />
							Batal
						</button>
						<button
							class="btn btn-primary btn-soft shadow-none"
							type="submit"
							disabled={submitting || invalid || !daftarKelas.length}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<Icon name="move" />
							{/if}
							Pindahkan
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>
{/if}
