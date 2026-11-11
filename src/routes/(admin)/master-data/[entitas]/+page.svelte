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
		if (nilai == null || nilai === '') return '—';
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
		if (nilai == null || nilai === '') return '—';
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

<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
	<div class="mb-4 flex items-start justify-between gap-2 max-sm:flex-col sm:flex-row">
		<div>
			<h2 class="text-xl font-bold">{entitas?.judul ?? 'Master Data'}</h2>
			{#if entitas}
				<p class="text-base-content/80 block text-sm">{entitas.deskripsi}</p>
			{/if}
		</div>
		{#if entitas}
			<div class="flex flex-wrap items-center gap-2 max-sm:w-full">
				{#if ringkas && entitas.editorPath}
					<a class="btn btn-primary btn-soft shadow-none max-sm:w-full" href={entitas.editorPath}>
						<Icon name="edit" />
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
									class="btn btn-error btn-soft shadow-none"
									disabled={submitting}
								>
									<Icon name="del" />
									Hapus {terpilih.length} Terpilih
								</button>
							{/snippet}
						</FormEnhance>
					{/if}
					{#if entitas.formPengguna}
						<a
							class="btn btn-primary btn-soft shadow-none max-sm:w-full"
							href={entitas.tambahPath ?? '/pengguna/form'}
						>
							<Icon name="plus" />
							Tambah Akun
						</a>
					{:else}
						<button
							type="button"
							class="btn btn-primary btn-soft shadow-none max-sm:w-full"
							onclick={bukaTambah}
						>
							<Icon name="plus" />
							Tambah
						</button>
					{/if}
					{#if entitas.key === 'mata_pelajaran'}
						<button
							type="button"
							class="btn btn-soft shadow-none max-sm:w-full"
							onclick={() => {
								kelasTerpilihMassal = [];
								bulkTerbuka = true;
							}}
						>
							<Icon name="layers" />
							Tambah Massal
						</button>
					{/if}
					{#if entitas.key === 'kelas'}
						<button
							type="button"
							class="btn btn-soft shadow-none max-sm:w-full"
							onclick={() => (pindahMuridTerbuka = true)}
						>
							<Icon name="move" />
							Pindah Murid
						</button>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	{#if ringkas && entitas?.editorPath}
		<div class="alert alert-info alert-soft mb-4 text-sm">
			<Icon name="info" />
			<span>
				Halaman ini hanya <strong>ringkasan baca-saja</strong> agar tidak ada dua editor untuk data
				yang sama. Semua penambahan, perubahan, dan penghapusan dilakukan di
				<a class="link font-semibold" href={entitas.editorPath}>{entitas.editorPath}</a>.
			</span>
		</div>
	{/if}

	{#if ringkas && entitas?.key === 'sekolah' && baris[0]}
		<div class="border-base-300 bg-base-100 rounded-md border p-4">
			<dl class="grid gap-4 sm:grid-cols-2">
				{#each entitas.fields.filter((field) => field.key !== 'jenjang_variant') as field (field.key)}
					<div>
						<dt class="text-base-content/60 text-xs font-semibold">{field.label}</dt>
						<dd class="text-sm font-medium">{formatField(field, baris[0][field.key])}</dd>
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
			<div class="join w-full">
				<label class="input bg-base-200 dark:bg-base-300 join-item grow dark:border-none">
					<Icon name="search" />
					<input
						type="search"
						name="q"
						bind:value={searchTerm}
						spellcheck="false"
						placeholder={`Cari ${entitas?.judul.toLowerCase() ?? 'data'}... (Enter untuk mencari)`}
						autocomplete="off"
						oninput={(event) => onSearchInput((event.currentTarget as HTMLInputElement).value)}
						onkeydown={onSearchKeydown}
					/>
				</label>
				<select
					class="select bg-base-200 dark:bg-base-300 join-item w-auto shrink dark:border-none"
					value={perHalaman}
					title="Baris per halaman"
					onchange={(event) =>
						gotoPerHalaman(Number((event.currentTarget as HTMLSelectElement).value))}
				>
					{#each OPSI_BARIS_PER_HALAMAN as jumlah (jumlah)}
						<option value={jumlah}>{jumlah} / hal</option>
					{/each}
				</select>
			</div>
		</form>

		<div class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none">
			<table class="border-base-200 table border dark:border-none">
				<thead>
					<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
						{#if !ringkas}
							<th style="width: 50px; min-width: 40px;" class="text-center">
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
							<th style="min-width: 140px;">{kolom.label}</th>
						{/each}
						{#if !ringkas}
							<th class="text-center" style="width: 150px;">Aksi</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each baris as row (row.id)}
						<tr class={terpilih.includes(Number(row.id)) ? 'bg-base-200/40' : undefined}>
							{#if !ringkas}
								<td class="text-center">
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
								<td>{formatNilai(kolom.key, row[kolom.key])}</td>
							{/each}
							{#if !ringkas}
								<td>
									<div class="flex items-center justify-center gap-1">
										{#if hapusId === row.id}
											<FormEnhance
												action="?/hapus"
												showToast={false}
												onsuccess={handleHapus}
												onfailure={handleGagalHapus}
											>
												{#snippet children({ submitting })}
													<input type="hidden" name="id" value={row.id} />
													<div class="flex items-center justify-center gap-1">
														<button
															type="submit"
															class="btn btn-error btn-soft btn-sm shadow-none"
															disabled={submitting}
														>
															Ya
														</button>
														<button
															type="button"
															class="btn btn-soft btn-sm shadow-none"
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
													class="btn btn-soft btn-sm shadow-none"
													title="Kelola anggota ekstrakurikuler"
													onclick={() =>
														(anggotaEkstra = { id: Number(row.id), nama: String(row.nama ?? '') })}
												>
													<Icon name="users" />
													Anggota
												</button>
												<a
													class="btn btn-soft btn-sm shadow-none"
													title="Atur Tujuan Pembelajaran ekstrakurikuler"
													href={`/ekstrakurikuler/tp-ekstra?ekstrakurikulerId=${row.id}`}
												>
													<Icon name="book" />
													Edit TP
												</a>
											{/if}
											{#if entitas?.formPengguna}
												<a
													class="btn btn-soft btn-sm shadow-none"
													href={`/pengguna/form/${row.id}`}
												>
													<Icon name="edit" />
													Ubah
												</a>
											{:else}
												<button
													type="button"
													class="btn btn-soft btn-sm shadow-none"
													onclick={() => bukaUbah(row)}
												>
													<Icon name="edit" />
													Ubah
												</button>
											{/if}
											<button
												type="button"
												class="btn btn-soft btn-error btn-sm shadow-none"
												onclick={() => (hapusId = row.id)}
											>
												<Icon name="del" />
											</button>
										{/if}
									</div>
								</td>
							{/if}
						</tr>
					{:else}
						<tr>
							<td
								class="p-6 text-center"
								colspan={(entitas?.kolom.length ?? 0) + (ringkas ? 0 : 2)}
							>
								<em class="opacity-60">Belum ada data untuk ditampilkan.</em>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if totalHalaman > 1}
			<div class="mt-4 flex justify-center">
				<div class="join">
					<button
						type="button"
						class="join-item btn"
						disabled={halamanSekarang <= 1}
						onclick={() => gotoPage(halamanSekarang - 1)}
					>
						«
					</button>
					{#each nomorHalaman as nomor, index (index)}
						{#if nomor === '…'}
							<button type="button" class="join-item btn" disabled>…</button>
						{:else}
							<button
								type="button"
								class="join-item btn"
								class:btn-active={nomor === halamanSekarang}
								onclick={() => gotoPage(nomor)}
							>
								{nomor}
							</button>
						{/if}
					{/each}
					<button
						type="button"
						class="join-item btn"
						disabled={halamanSekarang >= totalHalaman}
						onclick={() => gotoPage(halamanSekarang + 1)}
					>
						»
					</button>
				</div>
			</div>
		{/if}

		<p class="mt-3 text-center text-sm opacity-70">
			Menampilkan {barisTampil} dari {total} data
		</p>
	{/if}
</div>

{#if entitas && formTerbuka}
	<dialog class="modal" open>
		<div class="modal-box max-w-2xl">
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

					<div class="grid gap-3 sm:grid-cols-2">
						{#each entitas.fields as field (field.key)}
							<div
								class="form-control {entitas.key === 'mata_pelajaran' && field.key === 'kelas_id'
									? 'sm:col-span-2'
									: ''}"
							>
								<span class="label-text mb-1 text-sm font-medium">
									{field.label}
									{#if field.wajib}<span class="text-error">*</span>{/if}
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
									<select
										name={field.key}
										class="select select-bordered w-full rounded-xl"
										required={field.wajib}
										disabled={submitting}
									>
										{#if !field.wajib}<option value="">—</option>{/if}
										{#each field.opsi ?? [] as opsi (opsi.value)}
											<option value={opsi.value} selected={nilaiField(field.key) === opsi.value}>
												{opsi.label}
											</option>
										{/each}
									</select>
								{:else if field.tipe === 'relasi'}
									{#if entitas.key === 'mata_pelajaran' && field.key === 'kelas_id'}
										{@const semuaOpsiKelas = relasi[field.relasi ?? 'kelas'] ?? []}
										<div
											class="border-base-300 dark:border-base-200 bg-base-200/50 space-y-2 rounded-xl border p-3"
										>
											<div class="flex items-center justify-between border-b pb-2">
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
												<div class="flex items-center gap-1.5">
													<button
														type="button"
														class="btn btn-ghost btn-xs text-primary text-xs"
														onclick={() => {
															mapelKelasTerpilih = semuaOpsiKelas.map((k) => Number(k.value));
															sinkronValiditasForm();
														}}
													>
														Pilih Semua
													</button>
													<span class="opacity-30">•</span>
													<button
														type="button"
														class="btn btn-ghost btn-xs text-xs text-error"
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
												class="border-base-300 bg-base-100 grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border p-2 sm:grid-cols-4"
											>
												{#each semuaOpsiKelas as k (k.value)}
													<label
														class="hover:bg-base-200 flex cursor-pointer items-center gap-1.5 rounded p-1 text-xs"
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
											<div class="flex items-center justify-between text-xs opacity-70">
												<span
													>Terpilih: <strong>{mapelKelasTerpilih.length}</strong> dari {semuaOpsiKelas.length}
													kelas</span
												>
												{#if semuaOpsiKelas.length > 0 && mapelKelasTerpilih.length === semuaOpsiKelas.length}
													<span class="badge badge-success badge-xs font-semibold"
														>Semua Kelas Terpilih</span
													>
												{:else if mapelKelasTerpilih.length === 0}
													{#if barisEdit}
														<span class="badge badge-warning badge-xs font-semibold"
															>Tanpa kelas — simpan untuk melepas mapel dari semua kelas</span
														>
													{:else}
														<span class="badge badge-warning badge-xs font-semibold"
															>Pilih minimal 1 kelas tujuan</span
														>
													{/if}
												{/if}
											</div>
											{#if barisEdit}
												<p class="text-base-content/60 text-xs">
													Menghapus centang semua kelas lalu menekan Simpan akan melepas mapel ini
													dari seluruh kelas. Baris mapel dihapus; bila kelas tersebut sudah punya
													nilai/relasi, penyimpanan dibatalkan dengan rincian alasannya.
												</p>
											{/if}
										</div>
									{:else}
										<select
											name={field.key}
											class="select select-bordered w-full rounded-xl"
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
											{:else if !field.wajib}<option value="">—</option>{/if}
											{#each relasi[field.relasi ?? 'kelas'] ?? [] as opsi (opsi.value)}
												<option
													value={opsi.value}
													selected={nilaiField(field.key) === String(opsi.value)}
												>
													{opsi.label}
												</option>
											{/each}
										</select>
									{/if}
								{:else if field.tipe === 'textarea'}
									<textarea
										name={field.key}
										class="textarea textarea-bordered w-full rounded-xl"
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
										class="input input-bordered w-full rounded-xl"
										value={nilaiField(field.key)}
										required={field.wajib}
										placeholder={field.placeholder ?? ''}
										disabled={submitting}
									/>
								{/if}
								{#if field.bantu}
									<span class="label-text-alt mt-1 text-xs opacity-70">{field.bantu}</span>
								{/if}
							</div>
						{/each}
					</div>

					<div class="modal-action">
						<button
							type="button"
							class="btn btn-ghost rounded-xl"
							onclick={tutupForm}
							disabled={submitting}
						>
							<Icon name="close" />
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-primary btn-soft rounded-xl shadow-none"
							disabled={submitting || invalid}
						>
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
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>
{/if}

{#if entitas && bulkTerbuka}
	<dialog class="modal" open>
		<div class="modal-box max-w-3xl">
			<h3 class="mb-1 text-lg font-bold">Tambah {entitas.judul} Massal</h3>
			<p class="mb-4 text-sm opacity-70">
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
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="form-control">
							<span class="label-text mb-1 text-sm">
								Nama Mata Pelajaran <span class="text-error">*</span>
							</span>
							<input
								name="nama"
								type="text"
								class="input input-bordered w-full rounded-xl"
								required
								placeholder="Matematika"
								disabled={submitting}
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Jenis</span>
							<select
								name="jenis"
								class="select select-bordered w-full rounded-xl"
								disabled={submitting}
							>
								<option value="wajib">Wajib</option>
								<option value="pilihan">Pilihan</option>
								<option value="mulok">Mulok</option>
								<option value="kejuruan">Kejuruan</option>
								<option value="pemberdayaan">Pemberdayaan</option>
							</select>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Kode</span>
							<input
								name="kode"
								type="text"
								class="input input-bordered w-full rounded-xl"
								disabled={submitting}
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">KKM</span>
							<input
								name="kkm"
								type="number"
								class="input input-bordered w-full rounded-xl"
								value="0"
								disabled={submitting}
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Guru Pengampu</span>
							<select
								name="pengampu_id"
								class="select select-bordered w-full rounded-xl"
								disabled={submitting}
							>
								<option value="">—</option>
								{#each relasi.pegawai ?? [] as opsi (opsi.value)}
									<option value={opsi.value}>{opsi.label}</option>
								{/each}
							</select>
						</label>
					</div>

					<div class="mt-4">
						<div class="mb-1 flex items-center justify-between">
							<span class="label-text text-sm">
								Pilih Kelas ({kelasTerpilihMassal.length} dipilih)
							</span>
							<button
								type="button"
								class="btn btn-ghost btn-xs rounded-lg"
								onclick={() =>
									(kelasTerpilihMassal = (relasi.kelas ?? []).map((opsi) => opsi.value))}
							>
								Pilih semua
							</button>
						</div>
						<div class="bg-base-200 max-h-56 overflow-y-auto rounded-box p-2">
							{#each relasi.kelas ?? [] as opsi (opsi.value)}
								<label
									class="hover:bg-base-300 flex cursor-pointer items-center gap-2 rounded px-2 py-1"
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
									<span class="text-sm">{opsi.label}</span>
								</label>
							{/each}
						</div>
					</div>

					<div class="modal-action">
						<button
							type="button"
							class="btn btn-ghost rounded-xl"
							onclick={() => (bulkTerbuka = false)}
							disabled={submitting}
						>
							<Icon name="close" />
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-primary btn-soft rounded-xl shadow-none"
							disabled={submitting || invalid || kelasTerpilihMassal.length === 0}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<Icon name="save" />
							{/if}
							Tambah ke {kelasTerpilihMassal.length} Kelas
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
