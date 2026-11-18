<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { hideModal, updateModal } from '$lib/components/global-modal.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { searchQueryMarker } from '$lib/utils';
	import { onMount } from 'svelte';

	type MuridItem = {
		id: number;
		nama: string;
		keterangan: string | null;
	};

	let {
		daftarMurid,
		kelasId = 0,
		tanggal,
		mataPelajaranId,
		namaMataPelajaran,
		perkiraanJam,
		simulasiHari,
		simulasiJam,
		tipePresensi = 'awal_mapel',
		jenisPresensi = 'wali_kelas_saja'
	}: {
		daftarMurid: MuridItem[];
		kelasId?: number;
		tanggal: string;
		mataPelajaranId?: number | null;
		namaMataPelajaran?: string;
		perkiraanJam?: string;
		simulasiHari?: string | null;
		simulasiJam?: string | null;
		tipePresensi?: string;
		jenisPresensi?: string;
	} = $props();

	let step = $state<'pilih-mode' | 'pilih-murid'>('pilih-mode');
	let searchTerm = $state('');
	let selectedIds = $state<number[]>([]);
	let keteranganMap = $state<Record<number, string>>({});
	let sessionType = $state<'awal' | 'akhir'>('awal');
	let presensiType = $state('masuk');

	const isAwalAkhir = $derived(tipePresensi === 'awal_akhir_mapel' && !!namaMataPelajaran);

	const isWaliKelasMasukPulang = $derived(
		jenisPresensi === 'wali_kelas_saja' && tipePresensi === 'masuk_pulang'
	);

	$effect(() => {
		if (step === 'pilih-murid') {
			const ids: number[] = [];
			const map: Record<number, string> = {};
			for (const m of daftarMurid) {
				if (m.keterangan) {
					ids.push(m.id);
					map[m.id] = m.keterangan;
				}
			}
			selectedIds = ids;
			keteranganMap = map;
		}
	});

	const filteredMurid = $derived.by(() => {
		if (!searchTerm.trim()) return daftarMurid;
		const q = searchTerm.trim().toLowerCase();
		return daftarMurid.filter((m) => m.nama.toLowerCase().includes(q));
	});

	const allFilteredSelected = $derived.by(() => {
		if (filteredMurid.length === 0) return false;
		return filteredMurid.every((m) => selectedIds.includes(m.id));
	});

	function toggleSelect(id: number) {
		const idx = selectedIds.indexOf(id);
		if (idx === -1) {
			selectedIds = [...selectedIds, id];
			if (!keteranganMap[id]) {
				keteranganMap = { ...keteranganMap, [id]: 'alfa' };
			}
		} else {
			selectedIds = selectedIds.filter((x) => x !== id);
			const { [id]: _, ...rest } = keteranganMap;
			keteranganMap = rest;
		}
	}

	function toggleSelectAll() {
		if (allFilteredSelected) {
			const filteredIds = new Set(filteredMurid.map((m) => m.id));
			selectedIds = selectedIds.filter((id) => !filteredIds.has(id));
			const next = { ...keteranganMap };
			for (const id of filteredIds) {
				delete next[id];
			}
			keteranganMap = next;
		} else {
			const newIds = filteredMurid.map((m) => m.id);
			const existing = new Set(selectedIds);
			const toAdd = newIds.filter((id) => !existing.has(id));
			const next = { ...keteranganMap };
			for (const id of toAdd) {
				if (!next[id]) next[id] = 'alfa';
			}
			selectedIds = [...selectedIds, ...toAdd];
			keteranganMap = next;
		}
	}

	function setKeterangan(id: number, value: string) {
		keteranganMap = { ...keteranganMap, [id]: value };
	}

	function pilihTidak() {
		step = 'pilih-murid';
		updateModal({
			onPositive: {
				label: 'Simpan',
				class:
					'flex-1 border-0 bg-blue-600 text-white hover:bg-blue-700 sm:flex-none dark:bg-blue-500 dark:hover:bg-blue-600',
				action: () => submitSelected()
			},
			onNegative: {
				label: 'Kembali',
				class:
					'flex-1 border border-[#7e8b9b] bg-white text-slate-800 hover:bg-slate-50 sm:mr-auto sm:flex-none dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
				action: () => goToStep1()
			},
			onNeutral: undefined
		});
	}

	function goToStep1() {
		step = 'pilih-mode';
		updateModal({
			onPositive: {
				label: 'Ya',
				class:
					'flex-1 border-0 bg-blue-600 text-white hover:bg-blue-700 sm:flex-none dark:bg-blue-500 dark:hover:bg-blue-600',
				action: () => submitHadirSemua()
			},
			onNegative: {
				label: 'Tidak',
				class:
					'flex-1 border border-[#7e8b9b] bg-white text-slate-800 hover:bg-slate-50 sm:mr-auto sm:flex-none dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
				action: () => pilihTidak()
			},
			onNeutral: undefined
		});
	}

	async function submitHadirSemua() {
		try {
			const fd = new FormData();
			fd.set('mode', 'hadir_semua');
			fd.set('kelasId', String(kelasId));
			fd.set('tanggal', tanggal);
			if (mataPelajaranId != null) fd.set('mataPelajaranId', String(mataPelajaranId));
			if (simulasiHari) fd.set('simHari', simulasiHari);
			if (simulasiJam) fd.set('simJam', simulasiJam);
			if (isAwalAkhir) fd.set('sessionType', sessionType);
			if (isWaliKelasMasukPulang) fd.set('presensiType', presensiType);
			const res = await fetch('?/isiSekaligus', { method: 'POST', body: fd, redirect: 'error' });
			if (!res.ok) {
				const err = await res.json().catch(() => ({ fail: 'Gagal menyimpan' }));
				throw new Error(err.fail ?? `Error ${res.status}`);
			}
			hideModal();
			await invalidate('app:absen');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
		}
	}

	async function submitSelected() {
		if (selectedIds.length === 0) {
			toast('Tidak ada murid yang dipilih', 'warning');
			return;
		}
		try {
			const entries = selectedIds.map((id) => ({
				muridId: id,
				keterangan: keteranganMap[id] || 'alfa'
			}));
			const fd = new FormData();
			fd.set('mode', 'selected');
			fd.set('kelasId', String(kelasId));
			fd.set('tanggal', tanggal);
			if (mataPelajaranId != null) fd.set('mataPelajaranId', String(mataPelajaranId));
			if (simulasiHari) fd.set('simHari', simulasiHari);
			if (simulasiJam) fd.set('simJam', simulasiJam);
			if (isAwalAkhir) fd.set('sessionType', sessionType);
			if (isWaliKelasMasukPulang) fd.set('presensiType', presensiType);
			fd.set('entries', JSON.stringify(entries));
			const res = await fetch('?/isiSekaligus', { method: 'POST', body: fd, redirect: 'error' });
			if (!res.ok) {
				const err = await res.json().catch(() => ({ fail: 'Gagal menyimpan' }));
				throw new Error(err.fail ?? `Error ${res.status}`);
			}
			hideModal();
			await invalidate('app:absen');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
		}
	}

	onMount(() => {
		updateModal({
			onPositive: {
				label: 'Ya',
				class:
					'flex-1 border-0 bg-blue-600 text-white hover:bg-blue-700 sm:flex-none dark:bg-blue-500 dark:hover:bg-blue-600',
				action: () => submitHadirSemua()
			},
			onNegative: {
				label: 'Tidak',
				class:
					'flex-1 border border-[#7e8b9b] bg-white text-slate-800 hover:bg-slate-50 sm:mr-auto sm:flex-none dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
				action: () => pilihTidak()
			},
			onNeutral: undefined
		});
	});
</script>

{#if step === 'pilih-mode'}
	<div class="flex flex-col gap-4">
		{#if isAwalAkhir}
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={sessionType}
				>
					<option value="awal">Awal Mapel</option>
					<option value="akhir">Akhir Mapel</option>
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		{/if}
		{#if isWaliKelasMasukPulang}
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={presensiType}
				>
					<option value="masuk">Presensi Masuk</option>
					<option value="pulang">Presensi Pulang</option>
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		{/if}
		{#if namaMataPelajaran}
			<p class="text-sm font-medium text-slate-800 dark:text-zinc-100">
				Apakah hadir semua pada mata pelajaran {namaMataPelajaran}
				{perkiraanJam ? `- ${perkiraanJam}` : ''}?
			</p>
		{:else}
			<p class="text-sm font-medium text-slate-800 dark:text-zinc-100">
				Apakah hadir semua hari ini?
			</p>
		{/if}
	</div>
{:else}
	<div class="flex flex-col gap-3">
		<p class="text-sm font-semibold text-slate-900 dark:text-zinc-100">Siapa yang tidak hadir?</p>

		<div class="relative flex items-center">
			<span
				aria-hidden="true"
				class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
			>
				<Icon name="search" class="h-3.5 w-3.5" />
			</span>
			<input
				type="search"
				placeholder="Cari nama murid..."
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				bind:value={searchTerm}
				autocomplete="off"
			/>
		</div>

		<div
			class="max-h-80 overflow-y-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full border-collapse text-xs">
				<thead class="sticky top-0 z-10">
					<tr
						class="border-b border-slate-200/80 bg-slate-50 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
					>
						<th class="w-10 px-3 py-2.5 text-center">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={allFilteredSelected}
								onclick={toggleSelectAll}
							/>
						</th>
						<th class="px-3 py-2.5">Nama</th>
						<th class="min-w-28 px-3 py-2.5 text-center">Keterangan</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
					{#each filteredMurid as murid (murid.id)}
						{@const checked = selectedIds.includes(murid.id)}
						<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
							<td class="px-3 py-2 text-center">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									{checked}
									onclick={() => toggleSelect(murid.id)}
								/>
							</td>
							<td class="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100">
								{@html searchQueryMarker(searchTerm, murid.nama)}
							</td>
							<td class="px-3 py-2 text-center">
								{#if checked}
									<div class="relative flex items-center">
										<select
											class="h-8 w-full appearance-none truncate rounded-lg border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
											value={keteranganMap[murid.id] || 'alfa'}
											onchange={(e) =>
												setKeterangan(murid.id, (e.currentTarget as HTMLSelectElement).value)}
										>
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
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
