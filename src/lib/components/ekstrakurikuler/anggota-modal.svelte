<script lang="ts">
	import { invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	export interface MuridAnggota {
		id: number;
		nama: string;
		nis: string;
		kelasId: number;
		kelasNama: string;
	}

	interface Props {
		ekstra: { id: number; nama: string };
		murid?: MuridAnggota[];
		kelas?: Array<{ id: number; nama: string }>;
		anggotaAwal?: number[];
		action?: string;
		onClose?: () => void;
		onSuccess?: () => void;
	}

	let {
		ekstra,
		murid = [],
		kelas = [],
		anggotaAwal = [],
		action = '?/simpanAnggota',
		onClose,
		onSuccess
	}: Props = $props();

	let kelasFilter = $state('semua');
	let cari = $state('');
	// svelte-ignore state_referenced_locally
	let anggota = $state<number[]>([...anggotaAwal]);
	let pilihKiri = $state<number[]>([]);
	let pilihKanan = $state<number[]>([]);

	const kataKunci = $derived(cari.trim().toLowerCase());

	function cocokCari(item: MuridAnggota) {
		if (!kataKunci) return true;
		return (
			item.nama.toLowerCase().includes(kataKunci) || item.nis.toLowerCase().includes(kataKunci)
		);
	}

	const kandidat = $derived.by(() =>
		murid
			.filter((item) => !anggota.includes(item.id))
			.filter((item) => kelasFilter === 'semua' || String(item.kelasId) === kelasFilter)
			.filter(cocokCari)
			.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
	);

	const daftarAnggota = $derived.by(() =>
		murid
			.filter((item) => anggota.includes(item.id))
			.filter(cocokCari)
			.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
	);

	const semuaKiriTerpilih = $derived(
		kandidat.length > 0 && kandidat.every((item) => pilihKiri.includes(item.id))
	);
	const semuaKananTerpilih = $derived(
		daftarAnggota.length > 0 && daftarAnggota.every((item) => pilihKanan.includes(item.id))
	);

	function togglePilihan(sisi: 'kiri' | 'kanan', id: number, checked: boolean) {
		if (sisi === 'kiri') {
			pilihKiri = checked ? [...pilihKiri, id] : pilihKiri.filter((nilai) => nilai !== id);
		} else {
			pilihKanan = checked ? [...pilihKanan, id] : pilihKanan.filter((nilai) => nilai !== id);
		}
	}

	function pilihSemua(sisi: 'kiri' | 'kanan', checked: boolean) {
		if (sisi === 'kiri') {
			pilihKiri = checked ? kandidat.map((item) => item.id) : [];
		} else {
			pilihKanan = checked ? daftarAnggota.map((item) => item.id) : [];
		}
	}

	function tambahKeAnggota() {
		if (!pilihKiri.length) return;
		anggota = [...new Set([...anggota, ...pilihKiri])];
		pilihKiri = [];
	}

	function hapusDariAnggota() {
		if (!pilihKanan.length) return;
		anggota = anggota.filter((id) => !pilihKanan.includes(id));
		pilihKanan = [];
	}

	function tutup() {
		onClose?.();
	}

	function handleSimpan() {
		toast({ message: `Anggota ${ekstra.nama} disimpan.`, type: 'success' });
		invalidate('app:master-data');
		onSuccess?.();
		onClose?.();
	}
</script>

<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open>
	<div
		class="modal-box max-w-4xl rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<div class="mb-4 flex items-start justify-between gap-3">
			<div>
				<h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
					Anggota {ekstra.nama}
				</h3>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Pilih murid di panel kiri, lalu tambahkan ke anggota ekstrakurikuler.
				</p>
			</div>
			<button
				type="button"
				class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
				onclick={tutup}
				aria-label="Tutup"
			>
				<Icon name="close" class="h-4 w-4" />
			</button>
		</div>

		<div class="mb-4 grid gap-3 sm:grid-cols-2">
			<label class="flex flex-col gap-1">
				<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Kelas</span>
				<div class="relative flex items-center">
					<select
						class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={kelasFilter}
					>
						<option value="semua">Semua kelas</option>
						{#each kelas as item (item.id)}
							<option value={String(item.id)}>{item.nama}</option>
						{/each}
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</div>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Cari murid</span>
				<div class="relative flex items-center">
					<span
						aria-hidden="true"
						class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
					>
						<Icon name="search" class="h-3.5 w-3.5" />
					</span>
					<input
						type="search"
						bind:value={cari}
						placeholder="Nama atau NIS..."
						autocomplete="off"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
					/>
				</div>
			</label>
		</div>

		<div class="grid items-start gap-3 md:grid-cols-[1fr_auto_1fr]">
			<div
				class="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div
					class="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/75 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60"
				>
					<span class="text-xs font-semibold text-slate-800 dark:text-zinc-200"
						>Belum terdaftar ({kandidat.length})</span
					>
					<label
						class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300"
					>
						<input
							type="checkbox"
							class="checkbox checkbox-xs rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
							checked={semuaKiriTerpilih}
							onchange={(event) => pilihSemua('kiri', event.currentTarget.checked)}
						/>
						Pilih semua
					</label>
				</div>
				<ul class="max-h-80 divide-y divide-slate-200/70 overflow-y-auto dark:divide-zinc-800">
					{#each kandidat as item (item.id)}
						<li>
							<label
								class="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/60"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-sm rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
									checked={pilihKiri.includes(item.id)}
									onchange={(event) => togglePilihan('kiri', item.id, event.currentTarget.checked)}
								/>
								<span class="min-w-0 grow">
									<span class="block truncate text-xs font-medium text-slate-800 dark:text-zinc-100"
										>{item.nama}</span
									>
									<span class="block truncate text-[11px] text-slate-500 dark:text-zinc-400">
										{item.nis} · {item.kelasNama}
									</span>
								</span>
							</label>
						</li>
					{:else}
						<li class="px-3 py-8 text-center text-xs text-slate-400 italic dark:text-zinc-500">
							Tidak ada murid yang cocok.
						</li>
					{/each}
				</ul>
			</div>

			<div class="flex flex-col justify-center gap-2 self-center max-md:flex-row">
				<button
					type="button"
					class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					disabled={!pilihKiri.length}
					aria-disabled={!pilihKiri.length}
					onclick={tambahKeAnggota}
					title="Tambahkan murid terpilih ke anggota"
				>
					<Icon name="right" class="h-3.5 w-3.5" />
					Tambah
				</button>
				<button
					type="button"
					class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
					disabled={!pilihKanan.length}
					aria-disabled={!pilihKanan.length}
					onclick={hapusDariAnggota}
					title="Keluarkan murid terpilih dari anggota"
				>
					<Icon name="left" class="h-3.5 w-3.5" />
					Hapus
				</button>
			</div>

			<div
				class="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div
					class="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/75 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60"
				>
					<span class="text-xs font-semibold text-slate-800 dark:text-zinc-200"
						>Anggota ({anggota.length})</span
					>
					<label
						class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300"
					>
						<input
							type="checkbox"
							class="checkbox checkbox-xs rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
							checked={semuaKananTerpilih}
							onchange={(event) => pilihSemua('kanan', event.currentTarget.checked)}
						/>
						Pilih semua
					</label>
				</div>
				<ul class="max-h-80 divide-y divide-slate-200/70 overflow-y-auto dark:divide-zinc-800">
					{#each daftarAnggota as item (item.id)}
						<li>
							<label
								class="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/60"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-sm rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
									checked={pilihKanan.includes(item.id)}
									onchange={(event) => togglePilihan('kanan', item.id, event.currentTarget.checked)}
								/>
								<span class="min-w-0 grow">
									<span class="block truncate text-xs font-medium text-slate-800 dark:text-zinc-100"
										>{item.nama}</span
									>
									<span class="block truncate text-[11px] text-slate-500 dark:text-zinc-400">
										{item.nis} · {item.kelasNama}
									</span>
								</span>
							</label>
						</li>
					{:else}
						<li class="px-3 py-8 text-center text-xs text-slate-400 italic dark:text-zinc-500">
							Belum ada anggota.
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<FormEnhance {action} showToast={false} onsuccess={handleSimpan}>
			{#snippet children({ submitting })}
				<input type="hidden" name="ekstrakurikulerId" value={ekstra.id} />
				<input type="hidden" name="anggota" value={JSON.stringify(anggota)} />
				<div
					class="mt-5 flex items-center justify-end gap-2 border-t border-slate-200/70 pt-4 dark:border-zinc-800"
				>
					<button
						type="button"
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						onclick={tutup}
						disabled={submitting}
					>
						<Icon name="close" class="h-3.5 w-3.5" />
						Batal
					</button>
					<button
						type="submit"
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={submitting}
					>
						{#if submitting}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<Icon name="save" class="h-3.5 w-3.5" />
						{/if}
						Simpan
					</button>
				</div>
			{/snippet}
		</FormEnhance>
	</div>
	<div class="modal-backdrop bg-transparent">
		<button type="button" onclick={tutup}>close</button>
	</div>
</dialog>
