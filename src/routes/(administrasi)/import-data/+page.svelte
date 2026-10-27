<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import type { PageData } from './$types';

	type Aksi = 'baru' | 'ubah' | 'tetap' | 'gagal';
	type BarisPratinjau = {
		sheet: string;
		no: number;
		kunci: string;
		aksi: Aksi;
		ringkas: string;
		alasan?: string;
	};
	type RingkasanSheet = {
		key: string;
		nama: string;
		baru: number;
		ubah: number;
		tetap: number;
		gagal: number;
	};
	type FormData = {
		message?: string;
		fail?: string;
		token?: string;
		namaBerkas?: string;
		galatSheet?: string[];
		pratinjau?: { baris: BarisPratinjau[]; ringkasan: RingkasanSheet[]; akanDitulis: number };
		hasil?: { dibuat: number; diubah: number; gagal: number; pesan: string[] };
	};

	let { data, form }: { data: PageData; form: FormData | null } = $props();

	let namaBerkas = $state('');
	let saring = $state<'ditulis' | 'gagal' | 'semua'>('ditulis');

	const pratinjau = $derived(form?.pratinjau ?? null);
	const semuaBaris = $derived(pratinjau?.baris ?? []);
	const jumlah = $derived({
		ditulis: semuaBaris.filter((b) => b.aksi === 'baru' || b.aksi === 'ubah').length,
		gagal: semuaBaris.filter((b) => b.aksi === 'gagal').length,
		semua: semuaBaris.length
	});
	const tampil = $derived(
		semuaBaris.filter((b) => {
			if (saring === 'semua') return true;
			if (saring === 'gagal') return b.aksi === 'gagal';
			return b.aksi === 'baru' || b.aksi === 'ubah';
		})
	);
	const grup = $derived(
		data.sheets
			.map((sheet) => ({ sheet, baris: tampil.filter((b) => b.sheet === sheet.key) }))
			.filter((g) => g.baris.length > 0)
	);

	function lencana(aksi: Aksi) {
		if (aksi === 'baru') return 'badge-success';
		if (aksi === 'ubah') return 'badge-info';
		if (aksi === 'gagal') return 'badge-error';
		return 'badge-ghost';
	}

	function labelAksi(aksi: Aksi) {
		if (aksi === 'baru') return 'baru';
		if (aksi === 'ubah') return 'diubah';
		if (aksi === 'gagal') return 'gagal';
		return 'tetap';
	}
</script>

<div class="flex flex-col gap-5">
	<section class="card bg-base-100 rounded-box shadow-md">
		<div class="card-body gap-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<p class="text-base-content/80 text-sm">
					{#if data.semester}
						Menulis ke semester aktif: <strong>{data.semester.nama}</strong> ·
						{data.semester.tahunAjaran}
					{:else}
						Belum ada semester aktif. Atur dulu di halaman Akademik.
					{/if}
				</p>
				<a class="btn btn-soft btn-sm shadow-none" href="/import-data/template">
					<Icon name="download" />
					Template Excel
				</a>
			</div>

			<div class="flex flex-wrap gap-2">
				<span class="badge badge-lg badge-soft">
					{data.hitung?.pegawai ?? 0} pegawai
				</span>
				<span class="badge badge-lg badge-soft">{data.hitung?.kelas ?? 0} kelas</span>
				<span class="badge badge-lg badge-soft">{data.hitung?.murid ?? 0} murid</span>
			</div>

			<p class="text-base-content/80 text-sm">
				Jalur impor ini melengkapi sinkronisasi Dapodik: data pokok bisa dimasukkan atau diperbarui
				dari berkas Excel, tanpa harus lewat Dapodik.
			</p>
			<ol class="text-base-content/80 list-inside list-decimal space-y-1 text-sm">
				<li>Unduh template, isi sheet yang diperlukan (boleh satu sheet saja).</li>
				<li>Unggah berkas, lalu tekan Pratinjau.</li>
				<li>Periksa baris yang akan ditulis dan baris yang gagal, baru tekan Simpan.</li>
			</ol>
		</div>
	</section>

	{#if data.sheets.length}
		<section class="card bg-base-100 rounded-box shadow-md">
			<div class="card-body gap-3">
				<h2 class="card-title">Sheet yang Dikenali</h2>
				<div class="grid gap-3 lg:grid-cols-2">
					{#each data.sheets as sheet (sheet.key)}
						<div class="bg-base-200/50 flex flex-col gap-2 rounded-lg p-3">
							<div class="flex items-center gap-2">
								<Icon name="table" class="text-base-content/60 h-4 w-4" />
								<p class="font-semibold">Sheet {sheet.sheet}</p>
							</div>
							<p class="text-base-content/70 text-sm">
								{sheet.ringkas} Dicocokkan lewat {sheet.kunci}.
							</p>
							<p class="text-base-content/60 text-xs">
								{sheet.kolom.map((k) => (k.wajib ? `${k.label}*` : k.label)).join(' · ')}
							</p>
						</div>
					{/each}
				</div>
				<p class="text-base-content/60 text-xs">Tanda * berarti kolom wajib diisi.</p>
			</div>
		</section>
	{/if}

	<section class="card bg-base-100 rounded-box shadow-md">
		<div class="card-body gap-4">
			<h2 class="card-title">Unggah Berkas</h2>
			<FormEnhance
				id="import-data-pratinjau"
				action="?/pratinjau"
				enctype="multipart/form-data"
				showToast={true}
			>
				{#snippet children({ submitting })}
					<fieldset class="fieldset">
						<legend class="fieldset-legend font-semibold">Berkas Excel (.xlsx)</legend>
						<input
							id="import-data-file"
							class="file-input file-input-ghost"
							type="file"
							name="file"
							required
							accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
							onchange={(e) => {
								const berkas = (e.currentTarget as HTMLInputElement).files?.[0];
								namaBerkas = berkas?.name ?? '';
							}}
						/>
						<label class="label" for="import-data-file">
							<span class="label-text-alt text-base-content/60 text-xs">
								Maksimal 2MB. Data dicocokkan dengan yang sudah ada: cocok diperbarui, belum ada
								ditambahkan.
							</span>
							{#if namaBerkas}
								<span class="label-text-alt text-base-content/60 text-xs">
									Berkas dipilih: <strong>{namaBerkas}</strong>
								</span>
							{/if}
						</label>
					</fieldset>
					<div class="card-actions justify-end">
						<button
							class="btn btn-primary btn-sm shadow-none"
							type="submit"
							disabled={submitting || !namaBerkas}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<Icon name="eye" />
							{/if}
							Pratinjau
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
	</section>

	{#if form?.galatSheet?.length}
		<div role="alert" class="alert alert-warning alert-soft">
			<Icon name="warning" />
			<div class="flex flex-col gap-1 text-sm">
				{#each form.galatSheet as pesan, i (i)}
					<span>{pesan}</span>
				{/each}
			</div>
		</div>
	{/if}

	{#if form?.hasil}
		<div
			role="alert"
			class="alert alert-soft {form.hasil.gagal ? 'alert-warning' : 'alert-success'}"
		>
			<Icon name={form.hasil.gagal ? 'warning' : 'success'} />
			<div class="flex flex-col gap-1 text-sm">
				<span>
					{form.hasil.dibuat} data baru, {form.hasil.diubah} data diperbarui{form.hasil.gagal
						? `, ${form.hasil.gagal} baris gagal`
						: ''}.
				</span>
				{#each form.hasil.pesan as pesan, i (i)}
					<span>{pesan}</span>
				{/each}
			</div>
		</div>
	{/if}

	{#if pratinjau}
		<section class="card bg-base-100 rounded-box shadow-md">
			<div class="card-body gap-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex flex-col gap-1">
						<h2 class="card-title">Pratinjau</h2>
						{#if form?.namaBerkas}
							<p class="text-base-content/70 text-sm">Berkas: {form.namaBerkas}</p>
						{/if}
					</div>
					<div role="group" class="join" aria-label="Saring hasil pratinjau">
						<button
							type="button"
							class="btn btn-sm join-item shadow-none"
							class:btn-active={saring === 'ditulis'}
							onclick={() => (saring = 'ditulis')}
						>
							Akan ditulis ({jumlah.ditulis})
						</button>
						<button
							type="button"
							class="btn btn-sm join-item shadow-none"
							class:btn-active={saring === 'gagal'}
							onclick={() => (saring = 'gagal')}
						>
							Gagal ({jumlah.gagal})
						</button>
						<button
							type="button"
							class="btn btn-sm join-item shadow-none"
							class:btn-active={saring === 'semua'}
							onclick={() => (saring = 'semua')}
						>
							Semua ({jumlah.semua})
						</button>
					</div>
				</div>

				<div class="flex flex-wrap gap-2">
					{#each pratinjau.ringkasan as ringkas (ringkas.key)}
						<span class="badge badge-lg badge-soft">
							{ringkas.nama}: {ringkas.baru} baru · {ringkas.ubah} diubah · {ringkas.tetap} tetap
							{ringkas.gagal ? `· ${ringkas.gagal} gagal` : ''}
						</span>
					{/each}
				</div>

				{#if tampil.length === 0}
					<p class="text-base-content/70 text-sm">
						{saring === 'gagal'
							? 'Tidak ada baris yang gagal.'
							: 'Tidak ada baris yang perlu ditulis. Data di berkas sudah sama dengan data tersimpan.'}
					</p>
				{:else}
					{#each grup as g (g.sheet.key)}
						<div class="flex flex-col gap-2">
							<h3 class="font-semibold">
								Sheet {g.sheet.sheet}
								<span class="text-base-content/60 font-normal">({g.baris.length} baris)</span>
							</h3>
							<div class="overflow-x-auto rounded-lg">
								<table class="table-sm table-zebra table w-full">
									<thead>
										<tr>
											<th class="w-12">Baris</th>
											<th class="w-24">Hasil</th>
											<th>Data</th>
											<th>Keterangan</th>
										</tr>
									</thead>
									<tbody>
										{#each g.baris as baris (baris.no + baris.sheet + baris.kunci)}
											<tr>
												<td class="text-base-content/60 font-mono text-xs">{baris.no || '-'}</td>
												<td>
													<span class="badge badge-sm {lencana(baris.aksi)}">
														{labelAksi(baris.aksi)}
													</span>
												</td>
												<td class="font-medium">{baris.kunci}</td>
												<td class="text-base-content/70 text-sm">
													{baris.alasan ?? baris.ringkas}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/each}
				{/if}

				{#if form?.token}
					<FormEnhance id="import-data-simpan" action="?/simpan" showToast={true}>
						{#snippet children({ submitting })}
							<input type="hidden" name="token" value={form.token} />
							<div
								class="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
							>
								<p class="text-base-content/70 text-sm">
									Menulis {pratinjau.akanDitulis} baris ke semester aktif. Data yang cocok akan diperbarui.
								</p>
								<button
									class="btn btn-primary btn-sm shadow-none"
									type="submit"
									disabled={submitting || pratinjau.akanDitulis === 0}
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
				{/if}
			</div>
		</section>
	{/if}
</div>
