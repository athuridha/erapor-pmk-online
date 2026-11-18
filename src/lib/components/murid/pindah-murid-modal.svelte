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
			const label = [kelas.tahunAjaranNama, kelas.semesterNama].filter(Boolean).join(' - ');
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
	<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open>
		<div
			class="modal-box rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
			class:max-w-6xl={modePanel}
		>
			<div class="mb-3 flex items-start justify-between gap-3">
				<div>
					<h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
						Pindahkan Murid
					</h3>
					{#if modePanel}
						<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
							Pilih kelas asal dan kelas tujuan, lalu pindahkan murid memakai tombol + dan -.
						</p>
					{:else}
						<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
							{muridTerpilih.length} murid akan dipindahkan. Pilih kelas tujuan pada semester yang sama.
						</p>
					{/if}
				</div>
				<button
					type="button"
					class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
					onclick={() => {
						reset();
						isOpen = false;
					}}
					aria-label="Tutup"
				>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>

			{#if modePanel}
				<div class="grid gap-4 lg:grid-cols-2">
					<div
						class="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
					>
						<div
							class="flex items-center justify-between gap-2 border-b border-blue-200/70 bg-blue-50/75 px-3 py-2 dark:border-blue-900/50 dark:bg-blue-950/35"
						>
							<div class="relative flex max-w-[70%] flex-1 items-center">
								<select
									class="h-8 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
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
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3 w-3" />
								</span>
							</div>
							<span class="text-xs font-medium text-slate-600 dark:text-zinc-300"
								>{listKiri().length} murid</span
							>
						</div>
						<div class="p-2.5">
							<div class="relative mb-2 flex items-center">
								<span
									aria-hidden="true"
									class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
								>
									<Icon name="search" class="h-3.5 w-3.5" />
								</span>
								<input
									type="search"
									bind:value={cariKiri}
									placeholder="Cari murid..."
									autocomplete="off"
									class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								/>
							</div>
							<div
								class="max-h-80 divide-y divide-slate-200/70 overflow-y-auto dark:divide-zinc-800"
							>
								{#each listKiri() as murid (murid.id)}
									<div
										class="flex items-center justify-between gap-2 px-2 py-2 transition-colors hover:bg-slate-50/75 dark:hover:bg-zinc-800/40"
									>
										<div class="min-w-0">
											<div class="truncate text-xs font-medium text-slate-900 dark:text-zinc-100">
												{murid.nama}
											</div>
											<div class="text-[11px] text-slate-500 dark:text-zinc-400">{murid.nis}</div>
										</div>
										<button
											type="button"
											class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-blue-200/80 bg-blue-50 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
											disabled={!kelasTujuanPanel || kelasTujuanPanel.id === kelasAsal?.id}
											onclick={() => keKanan(murid.id)}
										>
											+
										</button>
									</div>
								{:else}
									<p class="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
										Tidak ada murid.
									</p>
								{/each}
							</div>
						</div>
					</div>

					<div
						class="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
					>
						<div
							class="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60"
						>
							<div class="relative flex max-w-[70%] flex-1 items-center">
								<select
									class="h-8 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
									value={kelasTujuanPanel?.id ?? ''}
									onchange={(event) => {
										kelasTujuanId =
											Number((event.currentTarget as HTMLSelectElement).value) || null;
									}}
								>
									<option value="">-- Kelas tujuan --</option>
									{#each daftarKelas as kelas (kelas.id)}
										<option value={kelas.id}>
											{kelas.nama} ({kelas.semesterNama})
										</option>
									{/each}
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3 w-3" />
								</span>
							</div>
							<span class="text-xs font-medium text-slate-600 dark:text-zinc-300"
								>{listKanan().length} murid</span
							>
						</div>
						<div class="p-2.5">
							<div class="relative mb-2 flex items-center">
								<span
									aria-hidden="true"
									class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
								>
									<Icon name="search" class="h-3.5 w-3.5" />
								</span>
								<input
									type="search"
									bind:value={cariKanan}
									placeholder="Cari murid..."
									autocomplete="off"
									class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								/>
							</div>
							<div
								class="max-h-80 divide-y divide-slate-200/70 overflow-y-auto dark:divide-zinc-800"
							>
								{#each listKanan() as murid (murid.id)}
									<div
										class="flex items-center justify-between gap-2 px-2 py-2 transition-colors hover:bg-slate-50/75 dark:hover:bg-zinc-800/40"
									>
										<div class="min-w-0">
											<div class="truncate text-xs font-medium text-slate-900 dark:text-zinc-100">
												{murid.nama}
											</div>
											<div class="text-[11px] text-slate-500 dark:text-zinc-400">{murid.nis}</div>
										</div>
										<button
											type="button"
											class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
											disabled={!pindahEfektif[murid.id]}
											onclick={() => keKiri(murid.id)}
										>
											-
										</button>
									</div>
								{:else}
									<p class="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
										Belum ada murid.
									</p>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<div
					class="mt-5 flex items-center justify-end gap-2 border-t border-slate-200/70 pt-4 dark:border-zinc-800"
				>
					<button
						type="button"
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						onclick={() => {
							reset();
							isOpen = false;
						}}
					>
						<Icon name="close" class="h-3.5 w-3.5" />
						Tutup
					</button>
					<FormEnhance {action} showToast={false} onsuccess={handleSuccess}>
						{#snippet children({ submitting, invalid })}
							<input type="hidden" name="pindah" value={JSON.stringify(daftarPindah)} />
							<button
								type="submit"
								class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
								disabled={submitting || invalid || !daftarPindah.length}
							>
								{#if submitting}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<Icon name="save" class="h-3.5 w-3.5" />
								{/if}
								Simpan Data ({daftarPindah.length})
							</button>
						{/snippet}
					</FormEnhance>
				</div>
			{:else}
				<FormEnhance {action} showToast={false} onsuccess={handleSuccess}>
					{#snippet children({ submitting, invalid })}
						{#each muridTerpilih as item (item.id)}
							<input type="hidden" name="muridIds" value={item.id} />
						{/each}

						{#if kelasTujuan.length}
							<fieldset class="mb-4 space-y-1.5">
								<label
									class="block text-xs font-medium text-slate-700 dark:text-zinc-300"
									for="pindah-kelas-tujuan">Kelas tujuan</label
								>
								<div class="relative flex items-center">
									<select
										id="pindah-kelas-tujuan"
										name="kelasId"
										class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
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
									<span
										aria-hidden="true"
										class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
									>
										<Icon name="down" class="h-3.5 w-3.5" />
									</span>
								</div>
							</fieldset>
						{:else}
							<div
								class="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
							>
								<Icon name="warning" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
								<span>Tidak ada kelas lain pada semester ini.</span>
							</div>
						{/if}

						<div
							class="mb-4 max-h-40 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/65 p-3 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/45 dark:text-zinc-300"
						>
							<ul class="list-disc space-y-1 pl-4">
								{#each muridTerpilih as item (item.id)}
									<li>
										<span class="font-medium text-slate-900 dark:text-zinc-100">{item.nama}</span>
										<span class="text-slate-500 dark:text-zinc-400">({item.nis})</span>
									</li>
								{/each}
							</ul>
						</div>

						<div
							class="flex items-center justify-end gap-2 border-t border-slate-200/70 pt-4 dark:border-zinc-800"
						>
							<button
								type="button"
								class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
								onclick={() => {
									reset();
									isOpen = false;
								}}
								disabled={submitting}
							>
								<Icon name="close" class="h-3.5 w-3.5" />
								Batal
							</button>
							<button
								type="submit"
								class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
								disabled={submitting || invalid || !kelasTujuanSederhanaId}
							>
								{#if submitting}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<Icon name="move" class="h-3.5 w-3.5" />
								{/if}
								Pindahkan
							</button>
						</div>
					{/snippet}
				</FormEnhance>
			{/if}
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button>close</button>
		</form>
	</dialog>
{/if}
