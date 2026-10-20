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
	const barisTampil = $derived(baris.length);

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

<div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
	<div>
		<div class="breadcrumbs mb-0.5 text-xs">
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
			<p class="text-base-content/60 mt-0.5 block text-sm">{entitas.deskripsi}</p>
		{/if}
	</div>
	{#if entitas}
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
			{#if terpilih.length}
				<FormEnhance action="?/hapusMassal" showToast={false} onsuccess={handleHapus}>
					{#snippet children({ submitting })}
						<input type="hidden" name="ids" value={JSON.stringify(terpilih)} />
						<button
							type="submit"
							class="btn btn-error btn-soft rounded-xl shadow-none"
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
					class="btn btn-primary max-sm:w-full rounded-xl shadow-sm shadow-primary/20"
					href={entitas.tambahPath ?? '/pengguna/form'}
				>
					<Icon name="plus" />
					Tambah Akun
				</a>
			{:else}
				<button
					type="button"
					class="btn btn-primary max-sm:w-full rounded-xl shadow-sm shadow-primary/20"
					onclick={bukaTambah}
				>
					<Icon name="plus" />
					Tambah
				</button>
			{/if}
			{#if entitas.key === 'mata_pelajaran'}
				<button
					type="button"
					class="btn btn-ghost max-sm:w-full rounded-xl"
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
					class="btn btn-ghost max-sm:w-full rounded-xl"
					onclick={() => (pindahMuridTerbuka = true)}
				>
					<Icon name="move" />
					Pindah Murid
				</button>
			{/if}
		</div>
	{/if}
</div>

<div class="mb-4 grid gap-3 sm:grid-cols-3">
	<div class="rounded-2xl border border-base-200/60 bg-base-100 p-4">
		<p class="text-base-content/50 text-xs font-medium tracking-wide uppercase">Total Data</p>
		<p class="mt-1 text-2xl font-bold tracking-tight">{total}</p>
		<p class="text-base-content/50 text-xs">
			baris {entitas?.judul.toLowerCase() ?? 'master data'}
		</p>
	</div>
	<div class="rounded-2xl border border-base-200/60 bg-base-100 p-4">
		<p class="text-base-content/50 text-xs font-medium tracking-wide uppercase">Terpilih</p>
		<p class="mt-1 text-2xl font-bold tracking-tight">{terpilih.length}</p>
		<p class="text-base-content/50 text-xs">baris ditandai</p>
	</div>
	<div class="rounded-2xl border border-base-200/60 bg-base-100 p-4">
		<p class="text-base-content/50 text-xs font-medium tracking-wide uppercase">Halaman</p>
		<p class="mt-1 text-2xl font-bold tracking-tight">{halamanSekarang} / {totalHalaman}</p>
		<p class="text-base-content/50 text-xs">{perHalaman} baris per halaman</p>
	</div>
</div>

<form
	class="mt-4 flex flex-col gap-2 sm:flex-row"
	data-sveltekit-keepfocus
	data-sveltekit-replacestate
	onsubmit={(event) => event.preventDefault()}
>
	<label
		class="input bg-base-200/60 w-full max-w-sm rounded-xl border border-transparent transition focus:border-primary/40 focus:bg-base-100"
	>
		<Icon name="search" />
		<input
			type="search"
			name="q"
			bind:value={searchTerm}
			spellcheck="false"
			placeholder={`Cari ${entitas?.judul.toLowerCase() ?? 'data'}...`}
			autocomplete="off"
			onchange={(event) => applySearch((event.currentTarget as HTMLInputElement).value)}
		/>
	</label>
</form>

<div class="mt-4 overflow-x-auto rounded-2xl border border-base-200/60 bg-base-100 shadow-sm">
	<table class="border-base-200 table border dark:border-none">
		<thead>
			<tr
				class="bg-base-200/40 text-base-content/50 border-b border-base-200/60 text-left text-[11px] font-semibold tracking-wider uppercase"
			>
				<th style="width: 50px; min-width: 40px;" class="text-center">
					<input
						type="checkbox"
						class="checkbox checkbox-primary checkbox-sm rounded-md"
						checked={semuaTerpilih(idsHalaman, terpilih)}
						onchange={(event) =>
							(terpilih = selectAll(idsHalaman, (event.currentTarget as HTMLInputElement).checked))}
					/>
				</th>
				{#each entitas?.kolom ?? [] as kolom (kolom.key)}
					<th style="min-width: 140px;">{kolom.label}</th>
				{/each}
				<th class="text-center" style="width: 150px;">Aksi</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-base-200/60">
			{#each baris as row (row.id)}
				<tr
					class="hover:bg-base-200/30 transition-colors {terpilih.includes(Number(row.id))
						? 'bg-primary/5'
						: ''}"
				>
					<td class="text-center">
						<input
							type="checkbox"
							class="checkbox checkbox-primary checkbox-sm rounded-md"
							checked={terpilih.includes(Number(row.id))}
							onchange={(event) =>
								(terpilih = toggleId(
									terpilih,
									Number(row.id),
									(event.currentTarget as HTMLInputElement).checked
								))}
						/>
					</td>
					{#each entitas?.kolom ?? [] as kolom (kolom.key)}
						<td>{row[kolom.key] ?? '—'}</td>
					{/each}
					<td>
						<div class="flex items-center justify-center gap-1">
							{#if hapusId === row.id}
								<FormEnhance action="?/hapus" showToast={false} onsuccess={handleHapus}>
									{#snippet children({ submitting })}
										<input type="hidden" name="id" value={row.id} />
										<div class="flex items-center justify-center gap-1">
											<button
												type="submit"
												class="btn btn-ghost btn-sm rounded-lg text-error"
												disabled={submitting}
											>
												Ya
											</button>
											<button
												type="button"
												class="btn btn-ghost btn-sm rounded-lg"
												onclick={() => (hapusId = null)}
											>
												Batal
											</button>
										</div>
									{/snippet}
								</FormEnhance>
							{:else}
								{#if entitas?.formPengguna}
									<a class="btn btn-ghost btn-sm rounded-lg" href={`/pengguna/form/${row.id}`}>
										<Icon name="edit" />
										Ubah
									</a>
								{:else}
									<button
										type="button"
										class="btn btn-ghost btn-sm rounded-lg"
										onclick={() => bukaUbah(row)}
									>
										<Icon name="edit" />
										Ubah
									</button>
								{/if}
								<button
									type="button"
									class="btn btn-ghost btn-sm rounded-lg text-error"
									onclick={() => (hapusId = row.id)}
								>
									<Icon name="del" />
								</button>
							{/if}
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td class="p-10 text-center" colspan={(entitas?.kolom.length ?? 0) + 2}>
						<em class="opacity-60">Belum ada data untuk ditampilkan.</em>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<div class="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
	<label class="flex items-center gap-2 text-sm">
		Baris per halaman
		<select
			class="select select-bordered select-sm rounded-lg"
			value={perHalaman}
			onchange={(event) => gotoPerHalaman(Number((event.currentTarget as HTMLSelectElement).value))}
		>
			{#each OPSI_BARIS_PER_HALAMAN as jumlah (jumlah)}
				<option value={jumlah}>{jumlah}</option>
			{/each}
		</select>
	</label>

	{#if totalHalaman > 1}
		<div class="join mx-auto">
			<button
				type="button"
				class="join-item btn btn-sm"
				disabled={halamanSekarang <= 1}
				onclick={() => gotoPage(halamanSekarang - 1)}
			>
				«
			</button>
			{#each nomorHalaman as nomor, index (index)}
				{#if nomor === '…'}
					<button type="button" class="join-item btn btn-sm" disabled>…</button>
				{:else}
					<button
						type="button"
						class="join-item btn btn-sm"
						class:btn-active={nomor === halamanSekarang}
						onclick={() => gotoPage(nomor)}
					>
						{nomor}
					</button>
				{/if}
			{/each}
			<button
				type="button"
				class="join-item btn btn-sm"
				disabled={halamanSekarang >= totalHalaman}
				onclick={() => gotoPage(halamanSekarang + 1)}
			>
				»
			</button>
		</div>
	{/if}

	<p class="text-sm opacity-70">Menampilkan {barisTampil} dari {total} data</p>
</div>

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
									<select
										name={field.key}
										class="select select-bordered w-full rounded-xl"
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
							</label>
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
