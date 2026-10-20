<script lang="ts">
	import { invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	export interface MuridKelas {
		id: number;
		nama: string;
		nis: string;
	}

	export interface KelasMurid {
		id: number;
		nama: string;
		semesterId: number;
		semesterNama: string;
		murid: MuridKelas[];
	}

	interface Props {
		isOpen?: boolean;
		daftarKelas: KelasMurid[];
		onSuccess?: () => void;
	}

	let { isOpen = $bindable(false), daftarKelas, onSuccess }: Props = $props();

	let kelasAsalId = $state<number | null>(null);
	let kelasTujuanId = $state<number | null>(null);
	let cariKiri = $state('');
	let cariKanan = $state('');
	/** muridId -> kelas tujuan (perpindahan dari kelas asal). */
	let pindah = $state<Record<number, number>>({});
	/** muridId -> kelas asal (pembatalan回到 kelas asal). */
	let kembali = $state<Record<number, number>>({});

	const kelasAsal = $derived(daftarKelas.find((kelas) => kelas.id === kelasAsalId) ?? null);
	const kelasTujuan = $derived(daftarKelas.find((kelas) => kelas.id === kelasTujuanId) ?? null);

	function kelasEfektif(muridId: number) {
		if (pindah[muridId]) return pindah[muridId];
		if (kembali[muridId]) return kembali[muridId];
		return null;
	}

	function listKiri() {
		if (!kelasAsal) return [];
		const keyword = cariKiri.trim().toLowerCase();
		return kelasAsal.murid.filter(
			(murid) =>
				kelasEfektif(murid.id) !== kelasTujuan?.id &&
				(!keyword || murid.nama.toLowerCase().includes(keyword))
		);
	}

	function listKanan() {
		if (!kelasTujuan) return [];
		const keyword = cariKanan.trim().toLowerCase();
		// Murid asli kelas tujuan, kecuali yang sudah dipindahkan keluar.
		const asal = kelasTujuan.murid.filter((murid) => !pindah[murid.id] && !kembali[murid.id]);
		// Murid yang baru dipindahkan masuk ke kelas tujuan.
		const dariKelasAsal = (kelasAsal?.murid ?? []).filter(
			(murid) => pindah[murid.id] === kelasTujuan.id
		);
		return [...asal, ...dariKelasAsal].filter(
			(murid) => !keyword || murid.nama.toLowerCase().includes(keyword)
		);
	}

	function keKanan(muridId: number) {
		if (!kelasTujuan) return;
		pindah = { ...pindah, [muridId]: kelasTujuan.id };
		const { [muridId]: _buang, ...sisaKembali } = kembali;
		kembali = sisaKembali;
	}

	function keKiri(muridId: number) {
		if (!kelasAsal) return;
		kembali = { ...kembali, [muridId]: kelasAsal.id };
		const { [muridId]: _buang, ...sisaPindah } = pindah;
		pindah = sisaPindah;
	}

	const daftarPerubahan = $derived(
		Object.entries(pindah).map(([muridId, kelasTujuanId]) => ({
			muridId: Number(muridId),
			kelasId: Number(kelasTujuanId)
		}))
	);

	function reset() {
		pindah = {};
		kembali = {};
		cariKiri = '';
		cariKanan = '';
	}

	async function handleSuccess({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:master-data');
		reset();
		isOpen = false;
		onSuccess?.();
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Perpindahan disimpan',
			type: 'success'
		});
	}
</script>

{#if isOpen}
	<dialog class="modal" open>
		<div class="modal-box max-w-6xl">
			<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 class="text-lg font-bold">Pindah Murid Antar Kelas</h3>
					<p class="text-sm opacity-70">
						Pilih kelas asal dan kelas tujuan, lalu pindahkan murid memakai tombol + dan −.
					</p>
				</div>
				<FormEnhance action="?/pindahMurid" showToast={false} onsuccess={handleSuccess}>
					{#snippet children({ submitting, invalid })}
						<input type="hidden" name="pindah" value={JSON.stringify(daftarPerubahan)} />
						<button
							type="submit"
							class="btn btn-primary shadow-none"
							disabled={submitting || invalid || daftarPerubahan.length === 0}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<Icon name="save" />
							{/if}
							Simpan Data ({daftarPerubahan.length})
						</button>
					{/snippet}
				</FormEnhance>
			</div>

			<div class="grid gap-4 lg:grid-cols-2">
				<!-- Panel kelas asal -->
				<div class="border-base-300 rounded-lg border">
					<div class="bg-primary/10 flex items-center justify-between rounded-t-lg px-3 py-2">
						<select
							class="select select-sm w-full max-w-[70%] font-bold"
							value={kelasAsalId ?? ''}
							onchange={(event) => {
								kelasAsalId = Number((event.currentTarget as HTMLSelectElement).value) || null;
							}}
						>
							<option value="">-- Kelas asal --</option>
							{#each daftarKelas as kelas (kelas.id)}
								<option value={kelas.id}>{kelas.nama} ({kelas.semesterNama})</option>
							{/each}
						</select>
						<span class="text-xs opacity-70">{listKiri().length} murid</span>
					</div>
					<div class="p-2">
						<label class="input input-sm input-bordered mb-2 flex w-full items-center gap-2">
							<Icon name="search" />
							<input
								type="search"
								bind:value={cariKiri}
								placeholder="Search..."
								autocomplete="off"
							/>
						</label>
						<div class="max-h-80 overflow-y-auto">
							{#each listKiri() as murid (murid.id)}
								<div class="flex items-center justify-between gap-2 border-b px-2 py-1.5">
									<div class="min-w-0">
										<div class="truncate text-sm font-medium">{murid.nama}</div>
										<div class="text-xs opacity-60">{murid.nis}</div>
									</div>
									<button
										type="button"
										class="btn btn-success btn-xs shadow-none"
										disabled={!kelasTujuan || kelasTujuan.id === kelasAsal?.id}
										onclick={() => keKanan(murid.id)}
									>
										+
									</button>
								</div>
							{:else}
								<p class="py-6 text-center text-sm opacity-60">Tidak ada murid.</p>
							{/each}
						</div>
					</div>
				</div>

				<!-- Panel kelas tujuan -->
				<div class="border-base-300 rounded-lg border">
					<div class="bg-error/10 flex items-center justify-between rounded-t-lg px-3 py-2">
						<select
							class="select select-sm w-full max-w-[70%] font-bold"
							value={kelasTujuanId ?? ''}
							onchange={(event) => {
								kelasTujuanId = Number((event.currentTarget as HTMLSelectElement).value) || null;
							}}
						>
							<option value="">-- Kelas tujuan --</option>
							{#each daftarKelas as kelas (kelas.id)}
								<option value={kelas.id}>{kelas.nama} ({kelas.semesterNama})</option>
							{/each}
						</select>
						<span class="text-xs opacity-70">{listKanan().length} murid</span>
					</div>
					<div class="p-2">
						<label class="input input-sm input-bordered mb-2 flex w-full items-center gap-2">
							<Icon name="search" />
							<input
								type="search"
								bind:value={cariKanan}
								placeholder="Search..."
								autocomplete="off"
							/>
						</label>
						<div class="max-h-80 overflow-y-auto">
							{#each listKanan() as murid (murid.id)}
								<div class="flex items-center justify-between gap-2 border-b px-2 py-1.5">
									<div class="min-w-0">
										<div class="truncate text-sm font-medium">{murid.nama}</div>
										<div class="text-xs opacity-60">{murid.nis}</div>
									</div>
									<button
										type="button"
										class="btn btn-error btn-xs shadow-none"
										disabled={!pindah[murid.id]}
										onclick={() => keKiri(murid.id)}
									>
										−
									</button>
								</div>
							{:else}
								<p class="py-6 text-center text-sm opacity-60">Belum ada murid.</p>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button
					type="button"
					class="btn btn-soft shadow-none"
					onclick={() => {
						reset();
						isOpen = false;
					}}
				>
					<Icon name="close" />
					Batal
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>
{/if}
