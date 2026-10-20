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

<dialog class="modal" open>
	<div class="modal-box max-w-4xl">
		<div class="mb-3">
			<h3 class="text-lg font-bold">Anggota {ekstra.nama}</h3>
			<p class="text-base-content/70 text-sm">
				Pilih murid di panel kiri, lalu tambahkan ke anggota ekstrakurikuler.
			</p>
		</div>

		<div class="mb-3 grid gap-2 sm:grid-cols-2">
			<label class="flex flex-col gap-1">
				<span class="label-text text-xs">Kelas</span>
				<select
					class="select select-sm bg-base-200 dark:bg-base-300 dark:border-none"
					bind:value={kelasFilter}
				>
					<option value="semua">Semua kelas</option>
					{#each kelas as item (item.id)}
						<option value={String(item.id)}>{item.nama}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1">
				<span class="label-text text-xs">Cari murid</span>
				<span class="input input-sm bg-base-200 dark:bg-base-300 w-full dark:border-none">
					<Icon name="search" />
					<input
						type="search"
						bind:value={cari}
						placeholder="Nama atau NIS..."
						autocomplete="off"
					/>
				</span>
			</label>
		</div>

		<div class="grid items-start gap-3 md:grid-cols-[1fr_auto_1fr]">
			<div class="border-base-200 overflow-hidden rounded-md border">
				<div class="bg-base-200 dark:bg-base-300 flex items-center justify-between gap-2 px-3 py-2">
					<span class="text-sm font-semibold">Belum terdaftar ({kandidat.length})</span>
					<label class="flex items-center gap-1 text-xs">
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							checked={semuaKiriTerpilih}
							onchange={(event) => pilihSemua('kiri', event.currentTarget.checked)}
						/>
						Pilih semua
					</label>
				</div>
				<ul class="divide-base-200 max-h-80 divide-y overflow-y-auto">
					{#each kandidat as item (item.id)}
						<li>
							<label class="hover:bg-base-200/60 flex cursor-pointer items-center gap-2 px-3 py-2">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={pilihKiri.includes(item.id)}
									onchange={(event) => togglePilihan('kiri', item.id, event.currentTarget.checked)}
								/>
								<span class="min-w-0 grow">
									<span class="block truncate text-sm font-medium">{item.nama}</span>
									<span class="text-base-content/60 block truncate text-xs">
										{item.nis} · {item.kelasNama}
									</span>
								</span>
							</label>
						</li>
					{:else}
						<li class="px-3 py-6 text-center text-sm italic opacity-60">
							Tidak ada murid yang cocok.
						</li>
					{/each}
				</ul>
			</div>

			<div class="flex flex-col justify-center gap-2 max-md:flex-row">
				<button
					type="button"
					class="btn btn-soft btn-sm shadow-none"
					disabled={!pilihKiri.length}
					onclick={tambahKeAnggota}
					title="Tambahkan murid terpilih ke anggota"
				>
					<Icon name="right" />
					Tambah
				</button>
				<button
					type="button"
					class="btn btn-soft btn-error btn-sm shadow-none"
					disabled={!pilihKanan.length}
					onclick={hapusDariAnggota}
					title="Keluarkan murid terpilih dari anggota"
				>
					<Icon name="left" />
					Hapus
				</button>
			</div>

			<div class="border-base-200 overflow-hidden rounded-md border">
				<div class="bg-base-200 dark:bg-base-300 flex items-center justify-between gap-2 px-3 py-2">
					<span class="text-sm font-semibold">Anggota ({anggota.length})</span>
					<label class="flex items-center gap-1 text-xs">
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							checked={semuaKananTerpilih}
							onchange={(event) => pilihSemua('kanan', event.currentTarget.checked)}
						/>
						Pilih semua
					</label>
				</div>
				<ul class="divide-base-200 max-h-80 divide-y overflow-y-auto">
					{#each daftarAnggota as item (item.id)}
						<li>
							<label class="hover:bg-base-200/60 flex cursor-pointer items-center gap-2 px-3 py-2">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={pilihKanan.includes(item.id)}
									onchange={(event) => togglePilihan('kanan', item.id, event.currentTarget.checked)}
								/>
								<span class="min-w-0 grow">
									<span class="block truncate text-sm font-medium">{item.nama}</span>
									<span class="text-base-content/60 block truncate text-xs">
										{item.nis} · {item.kelasNama}
									</span>
								</span>
							</label>
						</li>
					{:else}
						<li class="px-3 py-6 text-center text-sm italic opacity-60">Belum ada anggota.</li>
					{/each}
				</ul>
			</div>
		</div>

		<FormEnhance {action} showToast={false} onsuccess={handleSimpan}>
			{#snippet children({ submitting })}
				<input type="hidden" name="ekstrakurikulerId" value={ekstra.id} />
				<input type="hidden" name="anggota" value={JSON.stringify(anggota)} />
				<div class="modal-action">
					<button type="button" class="btn btn-ghost" onclick={tutup} disabled={submitting}>
						<Icon name="close" />
						Batal
					</button>
					<button type="submit" class="btn btn-primary btn-soft shadow-none" disabled={submitting}>
						{#if submitting}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<Icon name="save" />
						{/if}
						Simpan
					</button>
				</div>
			{/snippet}
		</FormEnhance>
	</div>
	<div class="modal-backdrop">
		<button type="button" onclick={tutup}>close</button>
	</div>
</dialog>
