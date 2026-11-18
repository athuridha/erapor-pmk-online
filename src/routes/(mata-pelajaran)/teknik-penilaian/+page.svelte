<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	type Teknik = {
		id: number;
		nama: string;
		singkatan: string;
		keterangan: string | null;
		urutan: number | null;
		totalTp: number;
	};

	let modalOpen = $state(false);
	let editMode = $state(false);
	let currentItem = $state<Teknik | null>(null);

	let formNama = $state('');
	let formSingkatan = $state('');
	let formKeterangan = $state('');
	let formUrutan = $state(1);

	let hapusItem = $state<Teknik | null>(null);

	function bukaTambah() {
		editMode = false;
		currentItem = null;
		formNama = '';
		formSingkatan = '';
		formKeterangan = '';
		formUrutan =
			(data.daftarTeknik.length ? Math.max(...data.daftarTeknik.map((t) => t.urutan ?? 0)) : 0) + 1;
		modalOpen = true;
	}

	function bukaUbah(item: Teknik) {
		editMode = true;
		currentItem = item;
		formNama = item.nama;
		formSingkatan = item.singkatan;
		formKeterangan = item.keterangan ?? '';
		formUrutan = item.urutan ?? 1;
		modalOpen = true;
	}
</script>

<svelte:head>
	<title>Teknik Penilaian - {data.sekolahNama}</title>
</svelte:head>

<div class="space-y-4">
	<!-- Header Card -->
	<div
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Teknik Penilaian
				</h1>
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Daftar metode / instrumen asesmen yang digunakan guru dalam menilai capaian Tujuan
					Pembelajaran (TP) pada penilaian formatif dan sumatif.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<FormEnhance
					action="?/resetDefault"
					onsuccess={() => {
						toast('Teknik penilaian standar berhasil dimuat ulang.', 'success');
					}}
				>
					{#snippet children({ submitting })}
						<button
							type="submit"
							class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							aria-disabled={submitting}
							disabled={submitting}
							title="Kembalikan atau tambahkan teknik standar Kurikulum Merdeka"
						>
							<Icon name="repeat" class="h-3.5 w-3.5" />
							Reset Standar
						</button>
					{/snippet}
				</FormEnhance>
				<button
					type="button"
					class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
					onclick={bukaTambah}
				>
					<Icon name="plus" class="h-4 w-4" />
					Tambah Teknik
				</button>
			</div>
		</div>
	</div>

	<!-- Tabel Teknik Penilaian -->
	<div
		class="overflow-hidden rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="overflow-x-auto">
			<table class="w-full border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th class="px-3 py-2.5" style="width: 50px;">No</th>
						<th class="px-3 py-2.5" style="min-width: 180px;">Nama Teknik Penilaian</th>
						<th class="px-3 py-2.5 text-center" style="width: 100px;">Singkatan</th>
						<th class="px-3 py-2.5" style="min-width: 250px;">Keterangan &amp; Instrumen</th>
						<th class="px-3 py-2.5 text-center" style="width: 120px;">Dipakai di TP</th>
						<th class="px-3 py-2.5 text-center" style="width: 130px;">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
					{#each data.daftarTeknik as item, index (item.id)}
						<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
							<td class="px-3 py-2.5 text-slate-600 tabular-nums dark:text-zinc-400">{index + 1}</td
							>
							<td class="px-3 py-2.5 font-semibold text-slate-900 dark:text-zinc-100"
								>{item.nama}</td
							>
							<td class="px-3 py-2.5 text-center">
								<span
									class="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/60"
									>{item.singkatan}</span
								>
							</td>
							<td class="px-3 py-2.5 text-slate-700 dark:text-zinc-300">
								{item.keterangan ?? '-'}
							</td>
							<td class="px-3 py-2.5 text-center">
								{#if item.totalTp > 0}
									<span
										class="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
										>{item.totalTp} TP</span
									>
								{:else}
									<span
										class="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
										>Belum dipakai</span
									>
								{/if}
							</td>
							<td class="px-3 py-2.5">
								<div class="flex items-center justify-center gap-1">
									<button
										type="button"
										class="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
										onclick={() => bukaUbah(item)}
										title="Ubah teknik penilaian"
									>
										<Icon name="edit" class="h-3.5 w-3.5" />
										Ubah
									</button>
									<button
										type="button"
										class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
										onclick={() => (hapusItem = item)}
										title="Hapus teknik penilaian"
									>
										<Icon name="del" class="h-3.5 w-3.5" />
									</button>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td class="px-3 py-8 text-center text-slate-500 dark:text-zinc-400" colspan="6">
								Belum ada teknik penilaian. Klik "Reset Standar" untuk memuat teknik bawaan.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Info Box -->
	<div
		class="flex items-start gap-2.5 rounded-2xl border border-blue-200/80 bg-blue-50/75 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
	>
		<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0" />
		<div class="space-y-0.5 leading-relaxed">
			<p class="font-bold">Keterkaitan dengan Penilaian:</p>
			<p>
				Teknik penilaian yang terdaftar di sini dapat langsung dipilih oleh guru saat merumuskan <strong
					>Tujuan Pembelajaran (TP)</strong
				>
				di menu <em>Kurikulum &amp; Mapel &gt; Intrakurikuler &gt; TP &amp; Lingkup Materi</em>.
				Pilihan teknik akan otomatis muncul di formulir asesmen sumatif dan formatif sebagai panduan
				instrumen penilaian murid.
			</p>
		</div>
	</div>
</div>

<!-- Modal Tambah / Ubah -->
{#if modalOpen}
	<dialog class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]">
		<div
			class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="border-b border-slate-200 pb-3 text-base font-bold dark:border-zinc-800">
				{editMode ? 'Ubah Teknik Penilaian' : 'Tambah Teknik Penilaian Baru'}
			</h3>

			<FormEnhance
				action={editMode ? '?/ubah' : '?/tambah'}
				onsuccess={() => {
					modalOpen = false;
					toast(
						editMode
							? 'Teknik penilaian berhasil diperbarui.'
							: 'Teknik penilaian berhasil ditambahkan.',
						'success'
					);
				}}
			>
				{#snippet children({ submitting })}
					{#if editMode && currentItem}
						<input type="hidden" name="id" value={currentItem.id} />
					{/if}

					<div class="mt-4 space-y-3">
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Nama Teknik Penilaian</span
							>
							<input
								type="text"
								name="nama"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Mis: Tes Tulis, Kinerja, Penugasan..."
								bind:value={formNama}
								required
							/>
						</label>

						<div class="grid grid-cols-2 gap-3">
							<label class="flex flex-col gap-1.5">
								<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
									>Singkatan</span
								>
								<input
									type="text"
									name="singkatan"
									class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 font-mono text-xs uppercase text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
									placeholder="Mis: TT, KJ"
									maxlength="8"
									bind:value={formSingkatan}
									required
								/>
							</label>

							<label class="flex flex-col gap-1.5">
								<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
									>Urutan Tampil</span
								>
								<input
									type="number"
									name="urutan"
									class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									min="0"
									bind:value={formUrutan}
								/>
							</label>
						</div>

						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Keterangan / Contoh Instrumen</span
							>
							<textarea
								name="keterangan"
								class="w-full rounded-xl border border-[#7e8b9b] bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								rows="2"
								placeholder="Mis: Ujian pilihan ganda, rubrik unjuk kerja, laporan tugas..."
								bind:value={formKeterangan}></textarea>
						</label>
					</div>

					<div class="modal-action mt-5 border-t border-slate-200 pt-3 dark:border-zinc-800">
						<button
							type="button"
							class="inline-flex h-9 items-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (modalOpen = false)}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
							disabled={submitting}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Simpan
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<button
			type="button"
			class="modal-backdrop bg-transparent"
			onclick={() => (modalOpen = false)}
			aria-label="Tutup"
		></button>
	</dialog>
{/if}

<!-- Modal Konfirmasi Hapus -->
{#if hapusItem}
	<dialog class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]">
		<div
			class="modal-box max-w-sm rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3
				class="flex items-center gap-2 border-b border-slate-200 pb-3 text-base font-bold text-red-700 dark:border-zinc-800 dark:text-red-400"
			>
				<Icon name="warning" class="h-4 w-4" />
				Hapus Teknik Penilaian
			</h3>
			<p class="py-3 text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
				Hapus teknik <strong class="text-slate-900 dark:text-zinc-100">{hapusItem.nama}</strong>
				({hapusItem.singkatan})?
				{#if hapusItem.totalTp > 0}
					<span
						class="mt-2 block rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
					>
						Teknik ini sedang digunakan pada {hapusItem.totalTp} Tujuan Pembelajaran. Kaitan pada TP tersebut
						akan dikosongkan.
					</span>
				{/if}
			</p>

			<FormEnhance
				action="?/hapus"
				onsuccess={() => {
					hapusItem = null;
					toast('Teknik penilaian berhasil dihapus.', 'success');
				}}
			>
				{#snippet children({ submitting })}
					<input type="hidden" name="id" value={hapusItem?.id} />

					<div class="modal-action border-t border-slate-200 pt-3 dark:border-zinc-800">
						<button
							type="button"
							class="inline-flex h-9 items-center rounded-lg border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (hapusItem = null)}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
							disabled={submitting}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Hapus
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<button
			type="button"
			class="modal-backdrop bg-transparent"
			onclick={() => (hapusItem = null)}
			aria-label="Tutup"
		></button>
	</dialog>
{/if}
