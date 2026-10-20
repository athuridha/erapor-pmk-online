<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { buildPageNumbers, OPSI_BARIS_PER_HALAMAN } from '$lib/utils/pagination';
	import PindahMuridModal from '$lib/components/murid/pindah-murid-modal.svelte';
	import { selectAll, semuaTerpilih, toggleId } from '$lib/utils/bulk-select';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.filter?.q ?? '');
	let formTerbuka = $state(false);
	let bulkTerbuka = $state(false);
	let pindahMuridTerbuka = $state(false);
	let kelasTerpilihMassal = $state<number[]>([]);
	let barisEdit = $state<Record<string, string | number | null> | null>(null);
	let hapusId = $state<number | null>(null);
	let terpilih = $state<number[]>([]);

	const entitas = $derived(data.entitas ?? null);
	const baris = $derived(data.baris ?? []);
	const relasi = $derived(data.relasi ?? {});
	const total = $derived(data.total ?? 0);
	const totalHalaman = $derived(data.totalHalaman ?? 1);
	const perHalaman = $derived(data.perHalaman ?? 50);
	const halamanSekarang = $derived(data.filter?.page ?? 1);
	const nomorHalaman = $derived(buildPageNumbers(halamanSekarang, totalHalaman));
	const idsHalaman = $derived(baris.map((row) => Number(row.id ?? 0)).filter((id) => id > 0));

	function nilaiField(key: string): string {
		const sumber = barisEdit ?? baris[0] ?? {};
		const nilai = sumber[key];
		return nilai == null ? '' : String(nilai);
	}

	function bukaTambah() {
		barisEdit = null;
		formTerbuka = true;
	}

	function bukaUbah(row: Record<string, string | number | null>) {
		barisEdit = row;
		formTerbuka = true;
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
</script>

<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<div class="breadcrumbs mb-1 text-sm">
			<ul>
				<li><a href="/master-data">Master Data</a></li>
				{#if entitas}<li>{entitas.judul}</li>{/if}
			</ul>
		</div>
		<h2 class="flex items-center gap-2 text-xl font-bold">
			<Icon name={entitas?.ikon ?? 'database'} />
			{entitas?.judul ?? 'Master Data'}
		</h2>
		{#if entitas}
			<p class="text-base-content/80 block text-sm">{entitas.deskripsi}</p>
		{/if}
	</div>
	{#if entitas}
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
			{#if terpilih.length}
				<FormEnhance action="?/hapusMassal" showToast={false} onsuccess={handleHapus}>
					{#snippet children({ submitting })}
						<input type="hidden" name="ids" value={JSON.stringify(terpilih)} />
						<button type="submit" class="btn btn-error shadow-none" disabled={submitting}>
							<Icon name="del" />
							Hapus {terpilih.length} Terpilih
						</button>
					{/snippet}
				</FormEnhance>
			{/if}
			<button type="button" class="btn btn-primary shadow-none max-sm:w-full" onclick={bukaTambah}>
				<Icon name="plus" />
				Tambah
			</button>
			{#if entitas.key === 'mata_pelajaran'}
				<button
					type="button"
					class="btn btn-soft btn-primary shadow-none max-sm:w-full"
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
		</div>
	{/if}
</div>

<div
	class="bg-base-100 dark:bg-base-200 mb-4 flex flex-col gap-3 rounded-md p-4 shadow-md sm:flex-row sm:items-end sm:justify-between"
>
	<div>
		<h3 class="font-bold">{entitas?.judul}</h3>
		<p class="text-base-content/70 text-sm">{entitas?.deskripsi}</p>
	</div>

	<label class="form-control w-full max-w-sm">
		<span class="label-text mb-1 text-sm">Cari data</span>
		<label class="input input-bordered flex w-full items-center gap-2">
			<Icon name="search" />
			<input
				type="search"
				bind:value={searchTerm}
				spellcheck="false"
				placeholder="Cari data..."
				autocomplete="off"
				onchange={(event) => applySearch((event.currentTarget as HTMLInputElement).value)}
			/>
		</label>
	</label>
</div>

{#if entitas}
	<div class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none">
		<table class="border-base-200 table border dark:border-none">
			<thead>
				<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
					<th class="w-10 text-center">
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
					{#each entitas.kolom as kolom (kolom.key)}
						<th style="min-width: 130px;">{kolom.label}</th>
					{/each}
					<th class="text-center" style="min-width: 130px;">Aksi</th>
				</tr>
			</thead>
			<tbody>
				{#each baris as row (row.id)}
					<tr class={terpilih.includes(Number(row.id)) ? 'bg-primary/5' : ''}>
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
						{#each entitas.kolom as kolom (kolom.key)}
							<td>{row[kolom.key] ?? '—'}</td>
						{/each}
						<td class="text-center">
							{#if hapusId === row.id}
								<FormEnhance action="?/hapus" showToast={false} onsuccess={handleHapus}>
									{#snippet children({ submitting })}
										<input type="hidden" name="id" value={row.id} />
										<div class="flex items-center justify-center gap-1">
											<button
												type="submit"
												class="btn btn-error btn-xs shadow-none"
												disabled={submitting}
											>
												Ya
											</button>
											<button
												type="button"
												class="btn btn-ghost btn-xs shadow-none"
												onclick={() => (hapusId = null)}
											>
												Batal
											</button>
										</div>
									{/snippet}
								</FormEnhance>
							{:else}
								<div class="flex items-center justify-center gap-1">
									<button
										type="button"
										class="btn btn-ghost btn-xs shadow-none"
										onclick={() => bukaUbah(row)}
									>
										<Icon name="edit" />
										Ubah
									</button>
									<button
										type="button"
										class="btn btn-ghost btn-xs text-error shadow-none"
										onclick={() => (hapusId = row.id)}
									>
										<Icon name="del" />
									</button>
								</div>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan={entitas.kolom.length + 1} class="py-6 text-center opacity-70">
							Belum ada data {entitas.judul.toLowerCase()}.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
		<p class="text-base-content/60 text-xs">
			Menampilkan {baris.length} dari {total} data
		</p>

		<div class="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
			<label class="flex items-center gap-2 text-xs">
				Baris per halaman
				<select
					class="select select-bordered select-sm"
					value={perHalaman}
					onchange={(event) =>
						gotoPerHalaman(Number((event.currentTarget as HTMLSelectElement).value))}
				>
					{#each OPSI_BARIS_PER_HALAMAN as jumlah (jumlah)}
						<option value={jumlah}>{jumlah}</option>
					{/each}
				</select>
			</label>

			<div class="join">
				<button
					type="button"
					class="btn btn-sm join-item"
					disabled={halamanSekarang <= 1}
					onclick={() => gotoPage(halamanSekarang - 1)}
				>
					«
				</button>
				{#each nomorHalaman as nomor, index (index)}
					{#if nomor === '…'}
						<button type="button" class="btn btn-sm join-item pointer-events-none">…</button>
					{:else}
						<button
							type="button"
							class="btn btn-sm join-item"
							class:btn-active={nomor === halamanSekarang}
							onclick={() => gotoPage(nomor)}
						>
							{nomor}
						</button>
					{/if}
				{/each}
				<button
					type="button"
					class="btn btn-sm join-item"
					disabled={halamanSekarang >= totalHalaman}
					onclick={() => gotoPage(halamanSekarang + 1)}
				>
					»
				</button>
			</div>
		</div>
	</div>
{/if}

{#if entitas.key === 'kelas'}
	<PindahMuridModal bind:isOpen={pindahMuridTerbuka} daftarKelas={data.daftarKelasMurid ?? []} />
{/if}

{#if entitas && bulkTerbuka}
	<dialog class="modal" open>
		<div class="modal-box max-w-3xl">
			<h3 class="mb-1 text-lg font-bold">Tambah Mata Pelajaran Massal</h3>
			<p class="mb-4 text-sm opacity-70">
				Satu mata pelajaran ditambahkan ke beberapa kelas sekaligus. Kelas yang sudah punya mapel
				dengan nama sama otomatis dilewati.
			</p>

			<FormEnhance action="?/simpanMassal" showToast={false} onsuccess={handleSimpan}>
				{#snippet children({ submitting, invalid })}
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="form-control">
							<span class="label-text mb-1 text-sm">
								Nama Mata Pelajaran <span class="text-error">*</span>
							</span>
							<input
								name="nama"
								type="text"
								class="input input-bordered w-full"
								required
								placeholder="Matematika"
								disabled={submitting}
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Jenis</span>
							<select name="jenis" class="select select-bordered w-full" disabled={submitting}>
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
								class="input input-bordered w-full"
								disabled={submitting}
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">KKM</span>
							<input
								name="kkm"
								type="number"
								class="input input-bordered w-full"
								value="0"
								disabled={submitting}
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Guru Pengampu</span>
							<select
								name="pengampu_id"
								class="select select-bordered w-full"
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
								class="btn btn-ghost btn-xs shadow-none"
								onclick={() =>
									(kelasTerpilihMassal = (relasi.kelas ?? []).map((opsi) => opsi.value))}
							>
								Pilih semua
							</button>
						</div>
						<div class="bg-base-200 max-h-56 overflow-y-auto rounded-box p-2">
							{#each relasi.kelas ?? [] as opsi (opsi.value)}
								<label
									class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-base-300"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
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
							class="btn btn-soft shadow-none"
							onclick={() => (bulkTerbuka = false)}
							disabled={submitting}
						>
							<Icon name="close" />
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-primary btn-soft shadow-none"
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

{#if entitas && formTerbuka}
	<dialog class="modal" open>
		<div class="modal-box max-w-2xl">
			<h3 class="mb-4 text-lg font-bold">
				{barisEdit ? 'Ubah' : 'Tambah'}
				{entitas.judul}
			</h3>

			<FormEnhance action="?/simpan" showToast={false} onsuccess={handleSimpan}>
				{#snippet children({ submitting, invalid })}
					{#if barisEdit}
						<input type="hidden" name="id" value={barisEdit.id} />
						{#if barisEdit.alamat_id}
							<input type="hidden" name="alamat_id" value={barisEdit.alamat_id} />
						{/if}
					{/if}

					<div class="grid gap-3 sm:grid-cols-2">
						{#each entitas.fields as field (field.key)}
							<label class="form-control">
								<span class="label-text mb-1 text-sm">
									{field.label}
									{#if field.wajib}<span class="text-error">*</span>{/if}
								</span>
								{#if field.tipe === 'toggle'}
									<input
										type="checkbox"
										name={field.key}
										class="toggle toggle-primary"
										checked={nilaiField(field.key) === 'Ya' || nilaiField(field.key) === 'true'}
										disabled={submitting}
									/>
								{:else if field.tipe === 'pilihan'}
									<select
										name={field.key}
										class="select select-bordered w-full"
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
									<select
										name={field.key}
										class="select select-bordered w-full"
										required={field.wajib}
										disabled={submitting}
									>
										{#if !field.wajib}<option value="">—</option>{/if}
										{#each relasi[field.relasi ?? 'kelas'] ?? [] as opsi (opsi.value)}
											<option
												value={opsi.value}
												selected={nilaiField(field.key) === String(opsi.value)}
											>
												{opsi.label}
											</option>
										{/each}
									</select>
								{:else if field.tipe === 'textarea'}
									<textarea
										name={field.key}
										class="textarea textarea-bordered w-full"
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
										class="input input-bordered w-full"
										value={nilaiField(field.key)}
										required={field.wajib}
										placeholder={field.placeholder ?? ''}
										disabled={submitting}
									/>
								{/if}
								{#if field.bantu}
									<span class="label-text-alt mt-1 text-xs opacity-70">{field.bantu}</span>
								{/if}
							</label>
						{/each}
					</div>

					<div class="modal-action">
						<button
							type="button"
							class="btn btn-soft shadow-none"
							onclick={tutupForm}
							disabled={submitting}
						>
							<Icon name="close" />
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-primary btn-soft shadow-none"
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
