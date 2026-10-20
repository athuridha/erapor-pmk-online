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

	export interface KelasTujuan {
		id: number;
		nama: string;
		fase?: string | null;
		semesterNama?: string;
		tahunAjaranNama?: string;
	}

	interface Props {
		isOpen?: boolean;
		/** Mode panel: daftar kelas lengkap dengan muridnya. */
		daftarKelas?: KelasMurid[];
		/** Mode sederhana: murid terpilih dipindahkan ke satu kelas tujuan. */
		muridTerpilih?: MuridKelas[];
		/** Kelas tujuan (mode sederhana). */
		kelasTujuan?: KelasTujuan[];
		/** Action server untuk menyimpan perpindahan. */
		action?: string;
		onSuccess?: () => void;
	}

	let {
		isOpen = $bindable(false),
		daftarKelas = [],
		muridTerpilih = [],
		kelasTujuan = [],
		action = '?/pindahMurid',
		onSuccess
	}: Props = $props();

	const modePanel = $derived(daftarKelas.length > 0);

	let kelasAsalId = $state<number | null>(null);
	let kelasTujuanId = $state<number | null>(null);
	let kelasTujuanSederhanaId = $state<number | null>(null);
	let cariKiri = $state('');
	let cariKanan = $state('');
	/** muridId -> kelas tujuan (perpindahan dari kelas asal). */
	let pindah = $state<Record<number, number>>({});
	/** muridId -> kelas asal (pembatalan pindah). */
	let kembali = $state<Record<number, number>>({});

	const grupKelasTujuan = $derived.by(() => {
		const groups = new Map<string, KelasTujuan[]>();
		for (const kelas of kelasTujuan) {
			const label = [kelas.tahunAjaranNama, kelas.semesterNama].filter(Boolean).join(' — ');
			const items = groups.get(label) ?? [];
			items.push(kelas);
			groups.set(label, items);
		}
		return [...groups.entries()];
	});

	/** Kelas asal otomatis dari murid pertama yang terpilih (mode sederhana). */
	const kelasAsalOtomatis = $derived.by(() => {
		if (!modePanel || !muridTerpilih.length) return null;
		for (const kelas of daftarKelas) {
			if (kelas.murid.some((murid) => murid.id === muridTerpilih[0].id)) return kelas;
		}
		return null;
	});

	const kelasAsal = $derived(
		modePanel ? (daftarKelas.find((k) => k.id === kelasAsalId) ?? kelasAsalOtomatis ?? null) : null
	);
	/** Kelas tujuan mode panel (dipilih dari daftarKelas). */
	const kelasTujuanPanel = $derived(
		daftarKelas.find((kelas) => kelas.id === kelasTujuanId) ?? null
	);
	/** Kelas tujuan mode sederhana (dipilih dari prop kelasTujuan). */
	const kelasTujuanSederhana = $derived(
		kelasTujuan.find((kelas) => kelas.id === kelasTujuanSederhanaId) ?? null
	);

	/** Perpindahan efektif: manual + murid terpilih (mode sederhana). */
	const pindahEfektif = $derived.by(() => {
		const hasil: Record<number, number> = { ...pindah };
		if (!modePanel && muridTerpilih.length && kelasTujuanSederhana) {
			for (const murid of muridTerpilih) hasil[murid.id] = kelasTujuanSederhana.id;
		}
		return hasil;
	});

	/** Daftar perpindahan yang akan disimpan: [{ muridId, kelasId }]. */
	const daftarPindah = $derived(
		Object.entries(pindahEfektif).map(([muridId, kelasId]) => ({
			muridId: Number(muridId),
			kelasId: Number(kelasId)
		}))
	);

	function kelasEfektif(muridId: number) {
		if (pindahEfektif[muridId]) return pindahEfektif[muridId];
		if (kembali[muridId]) return kembali[muridId];
		return null;
	}

	function listKiri() {
		if (!kelasAsal) return [];
		const keyword = cariKiri.trim().toLowerCase();
		return kelasAsal.murid.filter(
			(murid) =>
				kelasEfektif(murid.id) !== kelasTujuanPanel?.id &&
				(!keyword || murid.nama.toLowerCase().includes(keyword))
		);
	}

	function listKanan() {
		if (!kelasTujuanPanel) return [];
		const keyword = cariKanan.trim().toLowerCase();
		const asal = kelasTujuanPanel.murid.filter(
			(murid) => !pindahEfektif[murid.id] && !kembali[murid.id]
		);
		const dariKelasAsal = (kelasAsal?.murid ?? []).filter(
			(murid) => pindahEfektif[murid.id] === kelasTujuanPanel.id
		);
		return [...asal, ...dariKelasAsal].filter(
			(murid) => !keyword || murid.nama.toLowerCase().includes(keyword)
		);
	}

	function keKanan(muridId: number) {
		if (!kelasTujuanPanel) return;
		pindah = { ...pindah, [muridId]: kelasTujuanPanel.id };
		const { [muridId]: _buang, ...sisa } = kembali;
		kembali = sisa;
	}

	function keKiri(muridId: number) {
		if (!kelasAsal) return;
		kembali = { ...kembali, [muridId]: kelasAsal.id };
		const { [muridId]: _buang, ...sisa } = pindah;
		pindah = sisa;
	}

	function reset() {
		pindah = {};
		kembali = {};
		cariKiri = '';
		cariKanan = '';
		kelasTujuanId = null;
		kelasTujuanSederhanaId = null;
	}

	async function handleSuccess({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:master-data');
		reset();
		isOpen = false;
		onSuccess?.();
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Perpindahan disimpan.',
			type: 'success'
		});
	}
</script>

{#if isOpen}
	<dialog class="modal" open>
		<div class="modal-box" class:max-w-6xl={modePanel}>
			<h3 class="mb-1 text-lg font-bold">Pindahkan Murid</h3>

			{#if modePanel}
				<p class="mb-4 text-sm opacity-70">
					Pilih kelas asal dan kelas tujuan, lalu pindahkan murid memakai tombol + dan −.
				</p>

				<div class="grid gap-4 lg:grid-cols-2">
					<div class="border-base-300 rounded-lg border">
						<div class="bg-primary/10 flex items-center justify-between rounded-t-lg px-3 py-2">
							<select
								class="select select-sm w-full max-w-[70%] font-bold"
								value={kelasAsal?.id ?? ''}
								onchange={(event) => {
									kelasAsalId = Number((event.currentTarget as HTMLSelectElement).value) || null;
								}}
							>
								<option value="">-- Kelas asal --</option>
								{#each daftarKelas as kelas (kelas.id)}
									<option value={kelas.id}>
										{kelas.nama} ({kelas.semesterNama})
									</option>
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
											disabled={!kelasTujuanPanel || kelasTujuanPanel.id === kelasAsal?.id}
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

					<div class="border-base-300 rounded-lg border">
						<div class="bg-error/10 flex items-center justify-between rounded-t-lg px-3 py-2">
							<select
								class="select select-sm w-full max-w-[70%] font-bold"
								value={kelasTujuanPanel?.id ?? ''}
								onchange={(event) => {
									kelasTujuanId = Number((event.currentTarget as HTMLSelectElement).value) || null;
								}}
							>
								<option value="">-- Kelas tujuan --</option>
								{#each daftarKelas as kelas (kelas.id)}
									<option value={kelas.id}>
										{kelas.nama} ({kelas.semesterNama})
									</option>
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
											disabled={!pindahEfektif[murid.id]}
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
						Tutup
					</button>
					<FormEnhance {action} showToast={false} onsuccess={handleSuccess}>
						{#snippet children({ submitting, invalid })}
							<input type="hidden" name="pindah" value={JSON.stringify(daftarPindah)} />
							<button
								type="submit"
								class="btn btn-primary btn-soft shadow-none"
								disabled={submitting || invalid || !daftarPindah.length}
							>
								{#if submitting}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									<Icon name="save" />
								{/if}
								Simpan Data ({daftarPindah.length})
							</button>
						{/snippet}
					</FormEnhance>
				</div>
			{:else}
				<p class="mb-4 text-sm opacity-70">
					{muridTerpilih.length} murid akan dipindahkan. Pilih kelas tujuan pada semester yang sama.
				</p>

				<FormEnhance {action} showToast={false} onsuccess={handleSuccess}>
					{#snippet children({ submitting, invalid })}
						{#each muridTerpilih as item (item.id)}
							<input type="hidden" name="muridIds" value={item.id} />
						{/each}

						{#if kelasTujuan.length}
							<fieldset class="fieldset mb-4">
								<legend class="fieldset-legend">Kelas tujuan</legend>
								<select
									name="kelasId"
									class="select w-full"
									required
									disabled={submitting}
									bind:value={kelasTujuanSederhanaId}
								>
									<option value="" disabled>Pilih kelas tujuan</option>
									{#each grupKelasTujuan as [label, items] (label)}
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
								{#each muridTerpilih as item (item.id)}
									<li>{item.nama} <span class="opacity-60">({item.nis})</span></li>
								{/each}
							</ul>
						</div>

						<div class="modal-action">
							<button
								type="button"
								class="btn btn-soft shadow-none"
								onclick={() => {
									reset();
									isOpen = false;
								}}
								disabled={submitting}
							>
								<Icon name="close" />
								Batal
							</button>
							<button
								type="submit"
								class="btn btn-primary btn-soft shadow-none"
								disabled={submitting || invalid || !kelasTujuanSederhanaId}
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
			{/if}
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>
{/if}
