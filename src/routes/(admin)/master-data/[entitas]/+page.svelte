<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { buildPageNumbers, OPSI_BARIS_PER_HALAMAN } from '$lib/utils/pagination';
	import PindahMuridModal from '$lib/components/murid/pindah-murid-modal.svelte';
	import AnggotaEkstrakurikulerModal from '$lib/components/ekstrakurikuler/anggota-modal.svelte';
	import { selectAll, semuaTerpilih, toggleId } from '$lib/utils/bulk-select';
	import { jenjangPendidikanSederajat } from '$lib/statics';
	import type { FieldMaster } from '$lib/admin/master-data';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.filter?.q ?? '');
	let formTerbuka = $state(false);
	let bulkTerbuka = $state(false);
	let pindahMuridTerbuka = $state(false);
	let anggotaEkstra = $state<{ id: number; nama: string } | null>(null);
	let kelasTerpilihMassal = $state<number[]>([]);
	let barisEdit = $state<Record<string, string | number | null> | null>(null);
	let hapusId = $state<number | null>(null);
	let terpilih = $state<number[]>([]);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const entitas = $derived(data.entitas ?? null);
	/** Entitas dengan halaman editor khusus: tampilkan ringkasan baca-saja. */
	const ringkas = $derived(Boolean(entitas?.readOnly));
	const baris = $derived(data.baris ?? []);
	const relasi = $derived(data.relasi ?? {});
	const total = $derived(data.total ?? 0);
	const totalHalaman = $derived(data.totalHalaman ?? 1);
	const perHalaman = $derived(data.perHalaman ?? 50);
	const halamanSekarang = $derived(data.filter?.page ?? 1);
	const nomorHalaman = $derived(buildPageNumbers(halamanSekarang, totalHalaman));
	const idsHalaman = $derived(baris.map((row) => Number(row.id ?? 0)).filter((id) => id > 0));
	const barisTampil = $derived(baris.length);

	function nilaiField(key: string): string {
		// Mode tambah: form kosong. Isi field dari baris yang sedang diubah.
		if (!barisEdit) return '';
		const nilai = barisEdit[key];
		if (nilai == null) return '';
		// Nilai lama bisa "F" / "Fase F" — samakan ke opsi dropdown yang ada.
		if (key === 'fase') return normalisasiFase(String(nilai));
		return String(nilai);
	}

	/** Samakan nilai fase lama ("F", "fase f") ke bentuk baku "Fase F". */
	function normalisasiFase(nilai: string | null | undefined): string {
		const teks = (nilai ?? '').trim();
		if (!teks) return '';
		return `Fase ${teks.replace(/^fase\s+/i, '').toUpperCase()}`;
	}

	/** Label lengkap varian jenjang (mis. "smk" → "Sekolah Menengah Kejuruan (SMK)"). */
	function labelVarianJenjang(key: string | null | undefined): string | null {
		if (!key) return null;
		for (const grup of Object.values(jenjangPendidikanSederajat)) {
			const ketemu = grup.find((varian) => varian.key === key);
			if (ketemu) return ketemu.label;
		}
		return key.toUpperCase();
	}

	/** Nilai field untuk ringkasan baca-saja (label pilihan, bukan nilai mentah). */
	function formatField(field: FieldMaster, nilai: string | number | null | undefined): string {
		if (nilai == null || nilai === '') return '-';
		if (field.key === 'jenjang_pendidikan') {
			// Data menyimpan base "sma" + varian "smk" → tampilkan label varian.
			const varian = labelVarianJenjang(String(baris[0]?.jenjang_variant ?? ''));
			return varian ?? String(nilai).toUpperCase();
		}
		if (field.tipe === 'pilihan') {
			const opsi = field.opsi?.find((item) => item.value === String(nilai));
			return opsi?.label ?? String(nilai);
		}
		if (field.key === 'jenjang_variant') return labelVarianJenjang(String(nilai)) ?? String(nilai);
		if (field.key === 'fase') return normalisasiFase(String(nilai));
		return String(nilai);
	}

	/** Nilai kolom tabel generik (kolom bisa bukan field, mis. nama/gabungan). */
	function formatNilai(kolomKey: string, nilai: string | number | null | undefined): string {
		if (nilai == null || nilai === '') return '-';
		if (kolomKey === 'fase') return normalisasiFase(String(nilai));
		if (kolomKey === 'jk')
			return nilai === 'L' ? 'Laki-laki' : nilai === 'P' ? 'Perempuan' : String(nilai);
		const field = entitas?.fields.find((item) => item.key === kolomKey);
		if (field) return formatField(field, nilai);
		return String(nilai);
	}

	let mapelKelasTerpilih = $state<number[]>([]);

	/**
	 * FormEnhance menyimpan status validitas internal dan hanya memperbaruinya
	 * saat ada event input/change. Aksi tombol (Pilih Semua/Kosongkan) dan
	 * pembukaan dialog mengubah nilai tanpa memicu event, sehingga tombol
	 * Simpan bisa tetap nonaktif padahal data valid. Picu ulang pemeriksaan.
	 */
	function sinkronValiditasForm() {
		queueMicrotask(() => {
			const form = document.querySelector<HTMLFormElement>('dialog[open] form');
			form?.dispatchEvent(new Event('change', { bubbles: true }));
		});
	}

	function bukaTambah() {
		barisEdit = null;
		mapelKelasTerpilih = (relasi.kelas ?? []).map((k) => Number(k.value));
		formTerbuka = true;
		sinkronValiditasForm();
	}

	function bukaUbah(row: Record<string, string | number | null>) {
		barisEdit = row;
		if (entitas?.key === 'mata_pelajaran') {
			const kelasStr = String(row.kelas ?? '');
			const isSemua = kelasStr.startsWith('Semua Kelas');
			if (isSemua) {
				mapelKelasTerpilih = (relasi.kelas ?? []).map((k) => Number(k.value));
			} else {
				const namaKelasList = kelasStr.split(',').map((s) => s.trim().toLowerCase());
				mapelKelasTerpilih = (relasi.kelas ?? [])
					.filter((k) => namaKelasList.includes(k.label.trim().toLowerCase()))
					.map((k) => Number(k.value));
			}
		}
		formTerbuka = true;
		sinkronValiditasForm();
	}

	function tutupForm() {
		formTerbuka = false;
		barisEdit = null;
	}

	async function applySearch(value: string) {
		const params = new URLSearchParams(page.url.search);
		if (value.trim()) params.set('q', value.trim());
		else params.delete('q');
		params.delete('page');
		const query = params.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, { keepFocus: true });
	}

	/** Filter saat mengetik (debounce) — Enter tetap bisa memaksa pencarian. */
	function onSearchInput(value: string) {
		searchTerm = value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => applySearch(value), 350);
	}

	function onSearchKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		if (searchTimer) clearTimeout(searchTimer);
		applySearch(searchTerm);
	}

	async function gotoPage(pageNumber: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('page', String(pageNumber));
		await goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	}

	async function gotoPerHalaman(jumlah: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('per_page', String(jumlah));
		params.delete('page');
		await goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	}

	function toggleKelasMassal(id: number, checked: boolean) {
		kelasTerpilihMassal = checked
			? [...new Set([...kelasTerpilihMassal, id])]
			: kelasTerpilihMassal.filter((value) => value !== id);
	}

	async function handleSimpan({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:master-data');
		tutupForm();
		bulkTerbuka = false;
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Tersimpan',
			type: 'success'
		});
	}

	async function handleHapus({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:master-data');
		hapusId = null;
		terpilih = [];
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Data dihapus',
			type: 'success'
		});
	}

	/** Penolakan hapus (masih berelasi) harus tampil sebagai pesan, bukan diam (B5/B6). */
	function handleGagalHapus({ data: hasil }: { data?: Record<string, unknown> }) {
		toast({
			message:
				typeof hasil?.fail === 'string'
					? hasil.fail
					: typeof hasil?.message === 'string'
						? hasil.message
						: 'Data gagal dihapus.',
			type: 'warning',
			persist: true
		});
	}

	/** Penolakan simpan (mis. semester duplikat / relasi belum dilepas) harus tampil (B3/B10). */
	function handleGagalSimpan({ data: hasil }: { data?: Record<string, unknown> }) {
		toast({
			message:
				typeof hasil?.fail === 'string'
					? hasil.fail
					: typeof hasil?.message === 'string'
						? hasil.message
						: 'Data gagal disimpan.',
			type: 'warning',
			persist: true
		});
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4 max-sm:flex-col sm:flex-row dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				{entitas?.judul ?? 'Master Data'}
			</h1>
			{#if entitas}
				<p class="mt-0.5 block text-xs text-slate-600 dark:text-zinc-400">{entitas.deskripsi}</p>
			{/if}
		</div>
		{#if entitas}
			<div class="flex flex-wrap items-center gap-2 max-sm:w-full">
				{#if ringkas && entitas.editorPath}
					<a
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 max-sm:w-full"
						href={entitas.editorPath}
					>
						<Icon name="edit" class="h-4 w-4" />
						Ubah di {entitas.editorPath}
					</a>
				{:else}
					{#if terpilih.length}
						<FormEnhance
							action="?/hapusMassal"
							showToast={false}
							onsuccess={handleHapus}
							onfailure={handleGagalHapus}
						>
							{#snippet children({ submitting })}
								<input type="hidden" name="ids" value={JSON.stringify(terpilih)} />
								<button
									type="submit"
									class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50"
									disabled={submitting}
								>
									<Icon name="del" class="h-4 w-4" />
									Hapus {terpilih.length} Terpilih
								</button>
							{/snippet}
						</FormEnhance>
					{/if}
					{#if entitas.formPengguna}
						<a
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 max-sm:w-full"
							href={entitas.tambahPath ?? '/pengguna/form'}
						>
							<Icon name="plus" class="h-4 w-4" />
							Tambah Akun
						</a>
					{:else}
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 max-sm:w-full"
							onclick={bukaTambah}
						>
							<Icon name="plus" class="h-4 w-4" />
							Tambah
						</button>
					{/if}
					{#if entitas.key === 'mata_pelajaran'}
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 max-sm:w-full dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => {
								kelasTerpilihMassal = [];
								bulkTerbuka = true;
							}}
						>
							<Icon name="layers" class="h-4 w-4" />
							Tambah Massal
						</button>
					{/if}
					{#if entitas.key === 'kelas'}
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 max-sm:w-full dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (pindahMuridTerbuka = true)}
						>
							<Icon name="move" class="h-4 w-4" />
							Pindah Murid
						</button>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	{#if ringkas && entitas?.editorPath}
		<div
			class="mb-4 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50/90 px-3.5 py-2.5 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200"
		>
			<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
			<span>
				Halaman ini hanya <strong>ringkasan baca-saja</strong> agar tidak ada dua editor untuk data
				yang sama. Semua penambahan, perubahan, dan penghapusan dilakukan di
				<a
					class="font-semibold text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
					href={entitas.editorPath}
				>
					{entitas.editorPath}
				</a>.
			</span>
		</div>
	{/if}

	{#if ringkas && entitas?.key === 'sekolah' && baris[0]}
		<div
			class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
		>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#each entitas.fields.filter((field) => field.key !== 'jenjang_variant') as field (field.key)}
					<div>
						<dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
							{field.label}
						</dt>
						<dd class="mt-0.5 text-xs font-medium text-slate-900 dark:text-zinc-100">
							{formatField(field, baris[0][field.key])}
						</dd>
					</div>
				{/each}
			</dl>
		</div>
	{:else}
		<form
			class="mb-4 flex flex-col gap-2 sm:flex-row"
			data-sveltekit-keepfocus
			data-sveltekit-replacestate
			onsubmit={(event) => event.preventDefault()}
		>
			<div class="flex w-full items-center gap-2 sm:max-w-md">
				<div class="relative flex-1">
					<span
						class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
					>
						<Icon name="search" class="h-4 w-4" />
					</span>
					<input
						type="search"
						name="q"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						bind:value={searchTerm}
						spellcheck="false"
						placeholder={`Cari ${entitas?.judul.toLowerCase() ?? 'data'}... (Enter untuk mencari)`}
						autocomplete="off"
						oninput={(event) => onSearchInput((event.currentTarget as HTMLInputElement).value)}
						onkeydown={onSearchKeydown}
					/>
				</div>
				<div class="relative flex shrink-0 items-center">
					<select
						class="h-9 appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						value={perHalaman}
						title="Baris per halaman"
						onchange={(event) =>
							gotoPerHalaman(Number((event.currentTarget as HTMLSelectElement).value))}
					>
						{#each OPSI_BARIS_PER_HALAMAN as jumlah (jumlah)}
							<option value={jumlah}>{jumlah} / hal</option>
						{/each}
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</div>
			</div>
		</form>

		<div
			class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						{#if !ringkas}
							<th style="width: 48px; min-width: 40px;" class="px-3 py-2.5 text-center">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={semuaTerpilih(idsHalaman, terpilih)}
									onchange={(event) =>
										(terpilih = selectAll(
											idsHalaman,
											(event.currentTarget as HTMLInputElement).checked
										))}
								/>
							</th>
						{/if}
						{#each entitas?.kolom ?? [] as kolom (kolom.key)}
							<th style="min-width: 140px;" class="px-3 py-2.5">{kolom.label}</th>
						{/each}
						{#if !ringkas}
							<th class="px-3 py-2.5 text-center" style="width: 150px;">Aksi</th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
					{#each baris as row (row.id)}
						<tr
							class={terpilih.includes(Number(row.id))
								? 'bg-blue-50/70 dark:bg-blue-950/30'
								: 'transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50'}
						>
							{#if !ringkas}
								<td class="px-3 py-2.5 text-center">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										checked={terpilih.includes(Number(row.id))}
										onchange={(event) =>
											(terpilih = toggleId(
												terpilih,
												Number(row.id),
												(event.currentTarget as HTMLInputElement).checked
											))}
									/>
								</td>
							{/if}
							{#each entitas?.kolom ?? [] as kolom (kolom.key)}
								<td class="px-3 py-2.5 text-slate-800 dark:text-zinc-200">
									{formatNilai(kolom.key, row[kolom.key])}
								</td>
							{/each}
							{#if !ringkas}
								<td class="px-3 py-2.5">
									<div class="flex items-center justify-center gap-1.5">
										{#if hapusId === row.id}
											<FormEnhance
												action="?/hapus"
												showToast={false}
												onsuccess={handleHapus}
												onfailure={handleGagalHapus}
											>
												{#snippet children({ submitting })}
													<input type="hidden" name="id" value={row.id} />
													<div class="flex items-center justify-center gap-1.5">
														<button
															type="submit"
															class="inline-flex h-7 items-center rounded-md bg-red-600 px-2.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
															disabled={submitting}
														>
															Ya
														</button>
														<button
															type="button"
															class="inline-flex h-7 items-center rounded-md border border-[#7e8b9b] bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
															onclick={() => (hapusId = null)}
														>
															Batal
														</button>
													</div>
												{/snippet}
											</FormEnhance>
										{:else}
											{#if entitas?.key === 'ekstrakurikuler'}
												<button
													type="button"
													class="inline-flex h-8 items-center gap-1 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium whitespace-nowrap text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
													title="Kelola anggota ekstrakurikuler"
													onclick={() =>
														(anggotaEkstra = { id: Number(row.id), nama: String(row.nama ?? '') })}
												>
													<Icon name="users" class="h-3.5 w-3.5" />
													Anggota
												</button>
												<a
													class="inline-flex h-8 items-center gap-1 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium whitespace-nowrap text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
													title="Atur Tujuan Pembelajaran ekstrakurikuler"
													href={`/ekstrakurikuler/tp-ekstra?ekstrakurikulerId=${row.id}`}
												>
													<Icon name="book" class="h-3.5 w-3.5" />
													Edit TP
												</a>
											{/if}
											{#if entitas?.formPengguna}
												<a
													class="inline-flex h-8 items-center gap-1 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium whitespace-nowrap text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
													href={`/pengguna/form/${row.id}`}
												>
													<Icon name="edit" class="h-3.5 w-3.5" />
													Ubah
												</a>
											{:else}
												<button
													type="button"
													class="inline-flex h-8 items-center gap-1 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium whitespace-nowrap text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
													onclick={() => bukaUbah(row)}
												>
													<Icon name="edit" class="h-3.5 w-3.5" />
													Ubah
												</button>
											{/if}
											<button
												type="button"
												class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50"
												title="Hapus data"
												onclick={() => (hapusId = row.id)}
											>
												<Icon name="del" class="h-3.5 w-3.5" />
											</button>
										{/if}
									</div>
								</td>
							{/if}
						</tr>
					{:else}
						<tr>
							<td
								class="p-8 text-center text-xs italic text-slate-500 dark:text-zinc-400"
								colspan={(entitas?.kolom.length ?? 0) + (ringkas ? 0 : 2)}
							>
								Belum ada data untuk ditampilkan.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if totalHalaman > 1}
			<div class="mt-4 flex flex-wrap items-center justify-center gap-1">
				<button
					type="button"
					class="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
					disabled={halamanSekarang <= 1}
					onclick={() => gotoPage(halamanSekarang - 1)}
				>
					&laquo;
				</button>
				{#each nomorHalaman as nomor, index (index)}
					{#if nomor === '…'}
						<span class="inline-flex h-8 items-center px-1.5 text-xs text-slate-500">...</span>
					{:else}
						<button
							type="button"
							class="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold tabular-nums transition-colors {nomor ===
							halamanSekarang
								? 'border-blue-600 bg-blue-600 text-white shadow-sm'
								: 'border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
							onclick={() => gotoPage(nomor)}
						>
							{nomor}
						</button>
					{/if}
				{/each}
				<button
					type="button"
					class="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
					disabled={halamanSekarang >= totalHalaman}
					onclick={() => gotoPage(halamanSekarang + 1)}
				>
					&raquo;
				</button>
			</div>
		{/if}

		<p class="mt-3 text-center text-xs text-slate-500 tabular-nums dark:text-zinc-400">
			Menampilkan {barisTampil} dari {total} data
		</p>
	{/if}
</div>

{#if entitas && formTerbuka}
	<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open>
		<div
			class="modal-box max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="mb-4 text-lg font-bold">
				{barisEdit ? 'Ubah' : 'Tambah'}
				{entitas.judul}
			</h3>

			<FormEnhance
				action="?/simpan"
				showToast={false}
				onsuccess={handleSimpan}
				onfailure={handleGagalSimpan}
			>
				{#snippet children({ submitting, invalid })}
					{#if barisEdit}
						<input type="hidden" name="id" value={barisEdit.id} />
					{/if}

					<div class="grid gap-3.5 sm:grid-cols-2">
						{#each entitas.fields as field (field.key)}
							<div
								class={entitas.key === 'mata_pelajaran' && field.key === 'kelas_id'
									? 'sm:col-span-2'
									: ''}
							>
								<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
									{field.label}
									{#if field.wajib}<span class="text-red-600 dark:text-red-400">*</span>{/if}
								</span>
								{#if field.tipe === 'toggle'}
									<input
										type="checkbox"
										name={field.key}
										class="toggle toggle-primary rounded-full"
										checked={nilaiField(field.key) === 'Ya' || nilaiField(field.key) === 'true'}
										disabled={submitting}
									/>
								{:else if field.tipe === 'pilihan'}
									<div class="relative flex items-center">
										<select
											name={field.key}
											class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
											required={field.wajib}
											disabled={submitting}
										>
											{#if !field.wajib}<option value="">Tidak dipilih</option>{/if}
											{#each field.opsi ?? [] as opsi (opsi.value)}
												<option value={opsi.value} selected={nilaiField(field.key) === opsi.value}>
													{opsi.label}
												</option>
											{/each}
										</select>
										<span
											aria-hidden="true"
											class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
										>
											<Icon name="down" class="h-3.5 w-3.5" />
										</span>
									</div>
								{:else if field.tipe === 'relasi'}
									{#if entitas.key === 'mata_pelajaran' && field.key === 'kelas_id'}
										{@const semuaOpsiKelas = relasi[field.relasi ?? 'kelas'] ?? []}
										<div
											class="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40"
										>
											<div
												class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-zinc-700"
											>
												<label class="flex cursor-pointer items-center gap-2 text-xs font-semibold">
													<input
														type="checkbox"
														name="semua_kelas"
														value="1"
														class="checkbox checkbox-xs checkbox-primary"
														checked={semuaOpsiKelas.length > 0 &&
															mapelKelasTerpilih.length === semuaOpsiKelas.length}
														onchange={(e) => {
															if ((e.currentTarget as HTMLInputElement).checked) {
																mapelKelasTerpilih = semuaOpsiKelas.map((k) => Number(k.value));
															} else {
																mapelKelasTerpilih = [];
															}
														}}
													/>
													<span>Pilih Semua Kelas ({semuaOpsiKelas.length} kelas)</span>
												</label>
												<div class="flex items-center gap-2">
													<button
														type="button"
														class="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
														onclick={() => {
															mapelKelasTerpilih = semuaOpsiKelas.map((k) => Number(k.value));
															sinkronValiditasForm();
														}}
													>
														Pilih Semua
													</button>
													<button
														type="button"
														class="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
														onclick={() => {
															mapelKelasTerpilih = [];
															sinkronValiditasForm();
														}}
													>
														Kosongkan
													</button>
												</div>
											</div>

											<!-- Daftar Pilihan Kelas Selalu Ditampilkan -->
											<div
												class="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-4 dark:border-zinc-700 dark:bg-zinc-900"
											>
												{#each semuaOpsiKelas as k (k.value)}
													<label
														class="flex cursor-pointer items-center gap-1.5 rounded-md p-1.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800"
													>
														<input
															type="checkbox"
															name="kelas_ids"
															value={k.value}
															class="checkbox checkbox-xs"
															checked={mapelKelasTerpilih.includes(Number(k.value))}
															onchange={(e) => {
																const val = Number(k.value);
																if ((e.currentTarget as HTMLInputElement).checked) {
																	mapelKelasTerpilih = [...mapelKelasTerpilih, val];
																} else {
																	mapelKelasTerpilih = mapelKelasTerpilih.filter(
																		(id) => id !== val
																	);
																}
															}}
														/>
														<span class="truncate">{k.label}</span>
													</label>
												{/each}
											</div>
											<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
												<span class="text-slate-600 tabular-nums dark:text-zinc-400">
													Terpilih: <strong class="text-slate-900 dark:text-zinc-100"
														>{mapelKelasTerpilih.length}</strong
													>
													dari {semuaOpsiKelas.length} kelas
												</span>
												{#if semuaOpsiKelas.length > 0 && mapelKelasTerpilih.length === semuaOpsiKelas.length}
													<span
														class="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
													>
														Semua Kelas Terpilih
													</span>
												{:else if mapelKelasTerpilih.length === 0}
													{#if barisEdit}
														<span
															class="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
														>
															Tanpa kelas: simpan untuk melepas mapel dari semua kelas
														</span>
													{:else}
														<span
															class="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
														>
															Pilih minimal 1 kelas tujuan
														</span>
													{/if}
												{/if}
											</div>
											{#if barisEdit}
												<p class="text-[11px] text-slate-500 dark:text-zinc-400">
													Menghapus centang semua kelas lalu menekan Simpan akan melepas mapel ini
													dari seluruh kelas. Baris mapel dihapus; bila kelas tersebut sudah punya
													nilai/relasi, penyimpanan dibatalkan dengan rincian alasannya.
												</p>
											{/if}
										</div>
									{:else}
										<div class="relative flex items-center">
											<select
												name={field.key}
												class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
												required={field.wajib}
												disabled={submitting}
											>
												{#if field.opsiTambahan}
													{#each field.opsiTambahan as opsi (opsi.value)}
														<option
															value={opsi.value}
															selected={nilaiField(field.key) === opsi.value}
														>
															{opsi.label}
														</option>
													{/each}
												{:else if !field.wajib}<option value="">Tidak dipilih</option>{/if}
												{#each relasi[field.relasi ?? 'kelas'] ?? [] as opsi (opsi.value)}
													<option
														value={opsi.value}
														selected={nilaiField(field.key) === String(opsi.value)}
													>
														{opsi.label}
													</option>
												{/each}
											</select>
											<span
												aria-hidden="true"
												class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
											>
												<Icon name="down" class="h-3.5 w-3.5" />
											</span>
										</div>
									{/if}
								{:else if field.tipe === 'textarea'}
									<textarea
										name={field.key}
										class="w-full rounded-xl border border-[#7e8b9b] bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
										rows="3"
										required={field.wajib}
										placeholder={field.placeholder ?? ''}
										disabled={submitting}>{nilaiField(field.key)}</textarea
									>
								{:else}
									<input
										name={field.key}
										type={field.tipe === 'tanggal'
											? 'date'
											: field.tipe === 'angka' || field.tipe === 'desimal'
												? 'number'
												: 'text'}
										class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
										value={nilaiField(field.key)}
										required={field.wajib}
										placeholder={field.placeholder ?? ''}
										disabled={submitting}
									/>
								{/if}
								{#if field.bantu}
									<span class="mt-1 block text-[11px] text-slate-500 dark:text-zinc-400">
										{field.bantu}
									</span>
								{/if}
							</div>
						{/each}
					</div>

					<div
						class="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800"
					>
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={tutupForm}
							disabled={submitting}
						>
							<Icon name="close" class="h-4 w-4" />
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={submitting || invalid}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								<Icon name="save" class="h-4 w-4" />
							{/if}
							Simpan
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button>close</button>
		</form>
	</dialog>
{/if}

{#if entitas && bulkTerbuka}
	<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open>
		<div
			class="modal-box max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="mb-1 text-lg font-bold">Tambah {entitas.judul} Massal</h3>
			<p class="mb-4 text-xs text-slate-600 dark:text-zinc-400">
				Satu mata pelajaran ditambahkan ke beberapa kelas sekaligus. Kelas yang sudah punya mapel
				dengan nama sama otomatis dilewati.
			</p>

			<FormEnhance
				action="?/simpanMassal"
				showToast={false}
				onsuccess={handleSimpan}
				onfailure={handleGagalSimpan}
			>
				{#snippet children({ submitting, invalid })}
					<div class="grid gap-3.5 sm:grid-cols-2">
						<label class="block">
							<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
								Nama Mata Pelajaran <span class="text-red-600 dark:text-red-400">*</span>
							</span>
							<input
								name="nama"
								type="text"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								required
								placeholder="Matematika"
								disabled={submitting}
							/>
						</label>
						<label class="block">
							<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
								Jenis
							</span>
							<div class="relative flex items-center">
								<select
									name="jenis"
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									disabled={submitting}
								>
									<option value="wajib">Wajib</option>
									<option value="pilihan">Pilihan</option>
									<option value="mulok">Mulok</option>
									<option value="kejuruan">Kejuruan</option>
									<option value="pemberdayaan">Pemberdayaan</option>
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3.5 w-3.5" />
								</span>
							</div>
						</label>
						<label class="block">
							<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
								Kode
							</span>
							<input
								name="kode"
								type="text"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								disabled={submitting}
							/>
						</label>
						<label class="block">
							<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
								KKM
							</span>
							<input
								name="kkm"
								type="number"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								value="0"
								disabled={submitting}
							/>
						</label>
						<label class="block sm:col-span-2">
							<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
								Guru Pengampu
							</span>
							<div class="relative flex items-center">
								<select
									name="pengampu_id"
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									disabled={submitting}
								>
									<option value="">Tidak ditentukan</option>
									{#each relasi.pegawai ?? [] as opsi (opsi.value)}
										<option value={opsi.value}>{opsi.label}</option>
									{/each}
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3.5 w-3.5" />
								</span>
							</div>
						</label>
					</div>

					<div class="mt-4">
						<div class="mb-1.5 flex items-center justify-between">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Pilih Kelas ({kelasTerpilihMassal.length} dipilih)
							</span>
							<button
								type="button"
								class="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
								onclick={() =>
									(kelasTerpilihMassal = (relasi.kelas ?? []).map((opsi) => opsi.value))}
							>
								Pilih semua
							</button>
						</div>
						<div
							class="max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/40"
						>
							{#each relasi.kelas ?? [] as opsi (opsi.value)}
								<label
									class="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-white dark:hover:bg-zinc-800"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-primary checkbox-sm rounded-md"
										checked={kelasTerpilihMassal.includes(opsi.value)}
										onchange={(event) =>
											toggleKelasMassal(
												opsi.value,
												(event.currentTarget as HTMLInputElement).checked
											)}
									/>
									<span>{opsi.label}</span>
								</label>
							{/each}
						</div>
					</div>

					<div
						class="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800"
					>
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (bulkTerbuka = false)}
							disabled={submitting}
						>
							<Icon name="close" class="h-4 w-4" />
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={submitting || invalid || kelasTerpilihMassal.length === 0}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								<Icon name="save" class="h-4 w-4" />
							{/if}
							Tambah ke {kelasTerpilihMassal.length} Kelas
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button>close</button>
		</form>
	</dialog>
{/if}

{#if entitas?.key === 'kelas'}
	<PindahMuridModal bind:isOpen={pindahMuridTerbuka} daftarKelas={data.daftarKelasMurid ?? []} />
{/if}

{#if anggotaEkstra && data.anggotaEkstrakurikuler}
	<AnggotaEkstrakurikulerModal
		ekstra={anggotaEkstra}
		murid={data.anggotaEkstrakurikuler.murid}
		kelas={data.anggotaEkstrakurikuler.kelas}
		anggotaAwal={data.anggotaEkstrakurikuler.anggota?.[anggotaEkstra.id] ?? []}
		onClose={() => (anggotaEkstra = null)}
	/>
{/if}
