<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	interface CustomCetak {
		layout: {
			margin: string;
			fontSize: string;
			lineHeight: string;
			logoWidth: string;
			watermarkWidth: string;
			watermarkOpacity: number;
			cellPadding: string;
		};
		teks: {
			namaSekolah: string;
			npsn: string;
			alamat: string;
			email: string;
			kota: string;
			labelMengetahui: string;
			tanggal: string;
			judul: Record<string, string>;
			subjudul: Record<string, string>;
			kopBaris1: Record<string, string>;
			kopBaris2: Record<string, string>;
			catatan: Record<string, string>;
			tampilkanFoto: boolean;
			tampilkanLogo: boolean;
			tampilkanWatermark: boolean;
		};
		gambar: {
			logo: string | null;
			watermark: string | null;
		};
	}

	let { data } = $props();

	type Tab = 'teks' | 'gambar' | 'jarak';
	type Dokumen = 'cover' | 'biodata' | 'rapor' | 'piagam';

	const DOKUMEN: Array<{ value: Dokumen; label: string }> = [
		{ value: 'cover', label: 'Cover' },
		{ value: 'biodata', label: 'Biodata' },
		{ value: 'rapor', label: 'Rapor' },
		{ value: 'piagam', label: 'Piagam' }
	];

	let tab = $state<Tab>('teks');
	let dokumen = $state<Dokumen>('rapor');
	const sekolahSekarang = $derived(
		data.sekolahSekarang ?? {
			namaSekolah: '',
			npsn: '',
			alamat: '',
			email: '',
			kota: '',
			tanggal: ''
		}
	);
	// svelte-ignore state_referenced_locally
	let form = $state<CustomCetak>({
		...structuredClone(data.custom),
		teks: {
			...structuredClone(data.custom.teks),
			namaSekolah: data.custom.teks.namaSekolah || sekolahSekarang.namaSekolah,
			npsn: data.custom.teks.npsn || sekolahSekarang.npsn,
			alamat: data.custom.teks.alamat || sekolahSekarang.alamat,
			email: data.custom.teks.email || sekolahSekarang.email,
			kota: data.custom.teks.kota || sekolahSekarang.kota,
			tanggal: data.custom.teks.tanggal || sekolahSekarang.tanggal,
			kopBaris1: barisKop(1),
			kopBaris2: barisKop(2)
		}
	});

	// Baris kop bawaan tiap dokumen (kementerian, republic, dinas, dst).
	function barisKop(nomor: 1 | 2): Record<string, string> {
		const custom = data.custom.teks[`kopBaris${nomor}`] ?? {};
		const bawaan = data.kopSekarang ?? {};
		const hasil: Record<string, string> = {};
		for (const item of DOKUMEN) {
			hasil[item.value] = custom[item.value] || (bawaan[item.value]?.[nomor - 1] ?? '');
		}
		return hasil;
	}
	let previewHtml = $state('');
	let previewLoading = $state(false);
	let previewError = $state('');
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;

	const daftarMurid = $derived(data.daftarMurid ?? []);
	// svelte-ignore state_referenced_locally
	let muridId = $state<number>(data.daftarMurid?.[0]?.id ?? 0);
	let templatePiagam = $state<'1' | '2'>('1');

	// Sinkronkan gambar dari server setiap kali unggahan/hapus selesai.
	$effect(() => {
		const gambar = data.custom?.gambar;
		if (!gambar) return;
		if (gambar.logo !== form.gambar.logo || gambar.watermark !== form.gambar.watermark) {
			form.gambar.logo = gambar.logo;
			form.gambar.watermark = gambar.watermark;
		}
	});

	function jadwalRefresh() {
		if (refreshTimer) clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => void refreshPreview(), 350);
	}

	async function refreshPreview() {
		if (!muridId) return;
		previewLoading = true;
		previewError = '';
		try {
			const res = await fetch('/cetak/kustomisasi/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					doc: dokumen,
					muridId,
					template: templatePiagam,
					custom: form
				})
			});
			if (!res.ok) {
				previewError = 'Preview gagal dimuat.';
				return;
			}
			const payload = await res.json();
			previewHtml = payload.html ?? '';
		} catch (error) {
			console.error('Preview kustomisasi gagal', error);
			previewError = 'Preview gagal dimuat.';
		} finally {
			previewLoading = false;
		}
	}

	$effect(() => {
		// dependensi: dokumen, muridId, template, serta isi form
		void JSON.stringify(form);
		void dokumen;
		void muridId;
		void templatePiagam;
		jadwalRefresh();
	});

	function handleSimpan({ data: hasil }: { data?: Record<string, unknown> }) {
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Kustomisasi disimpan.',
			type: 'success'
		});
	}

	async function handleGambarSelesai() {
		await invalidateAll();
		toast({ message: 'Gambar kustomisasi diperbarui.', type: 'success' });
	}
</script>

<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
	<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
		<div class="mb-4">
			<h2 class="text-xl font-bold">Kustomisasi Cetak</h2>
			<p class="text-base-content/80 text-sm">
				Ubah teks, gambar, dan jarak/layout dokumen cetak. Perubahan langsung terlihat di preview
				sebelah kanan.
			</p>
		</div>

		<div role="tablist" class="tabs tabs-box bg-base-200 dark:bg-base-300 mb-4 w-fit">
			<button
				role="tab"
				class="tab"
				class:tab-active={tab === 'teks'}
				onclick={() => (tab = 'teks')}
			>
				Teks
			</button>
			<button
				role="tab"
				class="tab"
				class:tab-active={tab === 'gambar'}
				onclick={() => (tab = 'gambar')}
			>
				Gambar
			</button>
			<button
				role="tab"
				class="tab"
				class:tab-active={tab === 'jarak'}
				onclick={() => (tab = 'jarak')}
			>
				Jarak &amp; Layout
			</button>
		</div>

		<FormEnhance action="?/simpan" showToast={false} onsuccess={handleSimpan}>
			{#snippet children({ submitting })}
				<input type="hidden" name="custom" value={JSON.stringify(form)} />

				{#if tab === 'teks'}
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Nama sekolah di kop</span>
							<div class="flex items-center gap-1">
								<input
									class="input input-sm w-full"
									value={form.teks.namaSekolah}
									oninput={(event) => (form.teks.namaSekolah = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="btn btn-ghost btn-xs shrink-0"
									title="Kembalikan ke data sekolah"
									onclick={() => (form.teks.namaSekolah = '')}
								>
									<Icon name="close" />
								</button>
							</div>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">NPSN</span>
							<div class="flex items-center gap-1">
								<input
									class="input input-sm w-full"
									value={form.teks.npsn}
									oninput={(event) => (form.teks.npsn = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="btn btn-ghost btn-xs shrink-0"
									title="Kembalikan ke data sekolah"
									onclick={() => (form.teks.npsn = '')}
								>
									<Icon name="close" />
								</button>
							</div>
						</label>
						<label class="form-control sm:col-span-2">
							<span class="label-text mb-1 text-sm">Alamat sekolah di kop</span>
							<div class="flex items-center gap-1">
								<input
									class="input input-sm w-full"
									value={form.teks.alamat}
									oninput={(event) => (form.teks.alamat = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="btn btn-ghost btn-xs shrink-0"
									title="Kembalikan ke data sekolah"
									onclick={() => (form.teks.alamat = '')}
								>
									<Icon name="close" />
								</button>
							</div>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Email sekolah</span>
							<div class="flex items-center gap-1">
								<input
									class="input input-sm w-full"
									value={form.teks.email}
									oninput={(event) => (form.teks.email = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="btn btn-ghost btn-xs shrink-0"
									title="Kembalikan ke data sekolah"
									onclick={() => (form.teks.email = '')}
								>
									<Icon name="close" />
								</button>
							</div>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Kota penutup</span>
							<div class="flex items-center gap-1">
								<input
									class="input input-sm w-full"
									value={form.teks.kota}
									oninput={(event) => (form.teks.kota = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="btn btn-ghost btn-xs shrink-0"
									title="Kembalikan ke data sekolah"
									onclick={() => (form.teks.kota = '')}
								>
									<Icon name="close" />
								</button>
							</div>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Label penutup</span>
							<input class="input input-sm w-full" bind:value={form.teks.labelMengetahui} />
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Tanggal penutup</span>
							<div class="flex items-center gap-1">
								<input
									class="input input-sm w-full"
									value={form.teks.tanggal}
									oninput={(event) => (form.teks.tanggal = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="btn btn-ghost btn-xs shrink-0"
									title="Kembalikan ke tanggal rapor"
									onclick={() => (form.teks.tanggal = '')}
								>
									<Icon name="close" />
								</button>
							</div>
						</label>
					</div>

					<div class="divider my-4"></div>

					<div class="mb-3 flex flex-wrap items-center gap-2">
						<span class="label-text text-sm font-semibold">Teks dokumen</span>
						<div class="join">
							{#each DOKUMEN as item (item.value)}
								<button
									type="button"
									class="btn btn-sm join-item"
									class:btn-active={dokumen === item.value}
									onclick={() => (dokumen = item.value)}
								>
									{item.label}
								</button>
							{/each}
						</div>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Judul</span>
							<input
								class="input input-sm w-full"
								value={form.teks.judul[dokumen]}
								oninput={(event) => (form.teks.judul[dokumen] = event.currentTarget.value)}
								placeholder="Kosong = bawaan"
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Subjudul</span>
							<input
								class="input input-sm w-full"
								value={form.teks.subjudul[dokumen]}
								oninput={(event) => (form.teks.subjudul[dokumen] = event.currentTarget.value)}
								placeholder="Kosong = bawaan"
							/>
						</label>
						<label class="form-control sm:col-span-2">
							<span class="label-text mb-1 text-sm">Baris kop 1</span>
							<div class="flex items-center gap-1">
								<input
									class="input input-sm w-full"
									value={form.teks.kopBaris1[dokumen]}
									oninput={(event) => (form.teks.kopBaris1[dokumen] = event.currentTarget.value)}
									placeholder="Kosong = bawaan (mis. nama Kementerian)"
								/>
								<button
									type="button"
									class="btn btn-ghost btn-xs shrink-0"
									title="Kembalikan ke bawaan"
									onclick={() => (form.teks.kopBaris1[dokumen] = '')}
								>
									<Icon name="close" />
								</button>
							</div>
						</label>
						<label class="form-control sm:col-span-2">
							<span class="label-text mb-1 text-sm">Baris kop 2</span>
							<div class="flex items-center gap-1">
								<input
									class="input input-sm w-full"
									value={form.teks.kopBaris2[dokumen]}
									oninput={(event) => (form.teks.kopBaris2[dokumen] = event.currentTarget.value)}
									placeholder="Kosong = bawaan (mis. REPUBLIK INDONESIA)"
								/>
								<button
									type="button"
									class="btn btn-ghost btn-xs shrink-0"
									title="Kembalikan ke bawaan"
									onclick={() => (form.teks.kopBaris2[dokumen] = '')}
								>
									<Icon name="close" />
								</button>
							</div>
						</label>
						<label class="form-control sm:col-span-2">
							<span class="label-text mb-1 text-sm">Catatan kaki</span>
							<input
								class="input input-sm w-full"
								value={form.teks.catatan[dokumen]}
								oninput={(event) => (form.teks.catatan[dokumen] = event.currentTarget.value)}
								placeholder="Contoh: Dokumen asli disimpan otomatis oleh sekolah"
							/>
						</label>
					</div>
				{:else if tab === 'gambar'}
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="border-base-200 rounded-md border p-3">
							<h3 class="mb-2 text-sm font-semibold">Logo kop</h3>
							<div
								class="bg-base-200 flex h-32 items-center justify-center overflow-hidden rounded-md"
							>
								{#if form.gambar.logo}
									<img src={form.gambar.logo} alt="Logo kop" class="max-h-full max-w-full" />
								{:else}
									<span class="text-base-content/60 text-xs">
										Belum ada logo custom (pakai logo sekolah)
									</span>
								{/if}
							</div>
							<FormEnhance
								action="?/uploadGambar"
								showToast={false}
								onsuccess={handleGambarSelesai}
							>
								{#snippet children({ submitting })}
									<input type="hidden" name="jenis" value="logo" />
									<input
										type="file"
										name="file"
										accept="image/png,image/jpeg,image/webp"
										class="file-input file-input-sm mt-2 w-full"
										disabled={submitting}
									/>
									<button
										type="submit"
										class="btn btn-primary btn-soft btn-sm mt-2 shadow-none"
										disabled={submitting}
									>
										<Icon name="save" />
										Unggah Logo
									</button>
								{/snippet}
							</FormEnhance>
							{#if form.gambar.logo}
								<FormEnhance
									action="?/hapusGambar"
									showToast={false}
									onsuccess={handleGambarSelesai}
								>
									{#snippet children({ submitting })}
										<input type="hidden" name="jenis" value="logo" />
										<button
											type="submit"
											class="btn btn-error btn-soft btn-sm mt-2 shadow-none"
											disabled={submitting}
										>
											<Icon name="del" />
											Hapus Logo
										</button>
									{/snippet}
								</FormEnhance>
							{/if}
						</div>

						<div class="border-base-200 rounded-md border p-3">
							<h3 class="mb-2 text-sm font-semibold">Gambar watermark</h3>
							<div
								class="bg-base-200 flex h-32 items-center justify-center overflow-hidden rounded-md"
							>
								{#if form.gambar.watermark}
									<img src={form.gambar.watermark} alt="Watermark" class="max-h-full max-w-full" />
								{:else}
									<span class="text-base-content/60 text-xs">
										Kosong = pakai logo sekolah sebagai watermark
									</span>
								{/if}
							</div>
							<FormEnhance
								action="?/uploadGambar"
								showToast={false}
								onsuccess={handleGambarSelesai}
							>
								{#snippet children({ submitting })}
									<input type="hidden" name="jenis" value="watermark" />
									<input
										type="file"
										name="file"
										accept="image/png,image/jpeg,image/webp"
										class="file-input file-input-sm mt-2 w-full"
										disabled={submitting}
									/>
									<button
										type="submit"
										class="btn btn-primary btn-soft btn-sm mt-2 shadow-none"
										disabled={submitting}
									>
										<Icon name="save" />
										Unggah Watermark
									</button>
								{/snippet}
							</FormEnhance>
							{#if form.gambar.watermark}
								<FormEnhance
									action="?/hapusGambar"
									showToast={false}
									onsuccess={handleGambarSelesai}
								>
									{#snippet children({ submitting })}
										<input type="hidden" name="jenis" value="watermark" />
										<button
											type="submit"
											class="btn btn-error btn-soft btn-sm mt-2 shadow-none"
											disabled={submitting}
										>
											<Icon name="del" />
											Hapus Watermark
										</button>
									{/snippet}
								</FormEnhance>
							{/if}
						</div>
					</div>

					<div class="mt-4 grid gap-2 sm:grid-cols-3">
						<label class="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								class="toggle toggle-primary toggle-sm"
								bind:checked={form.teks.tampilkanLogo}
							/>
							<span class="text-sm">Tampilkan logo di kop</span>
						</label>
						<label class="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								class="toggle toggle-primary toggle-sm"
								bind:checked={form.teks.tampilkanWatermark}
							/>
							<span class="text-sm">Tampilkan watermark</span>
						</label>
						<label class="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								class="toggle toggle-primary toggle-sm"
								bind:checked={form.teks.tampilkanFoto}
							/>
							<span class="text-sm">Tampilkan foto murid</span>
						</label>
					</div>
				{:else}
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Margin halaman</span>
							<input
								class="input input-sm w-full"
								bind:value={form.layout.margin}
								placeholder="20mm"
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Ukuran font dasar</span>
							<input
								class="input input-sm w-full"
								bind:value={form.layout.fontSize}
								placeholder="11pt"
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Jarak antar baris</span>
							<input
								class="input input-sm w-full"
								bind:value={form.layout.lineHeight}
								placeholder="1.4"
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Lebar logo kop</span>
							<input
								class="input input-sm w-full"
								bind:value={form.layout.logoWidth}
								placeholder="70px"
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Lebar watermark</span>
							<input
								class="input input-sm w-full"
								bind:value={form.layout.watermarkWidth}
								placeholder="45%"
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Opasitas watermark</span>
							<input
								type="number"
								min="0"
								max="1"
								step="0.01"
								class="input input-sm w-full"
								bind:value={form.layout.watermarkOpacity}
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Padding sel tabel</span>
							<input
								class="input input-sm w-full"
								bind:value={form.layout.cellPadding}
								placeholder="Kosong = bawaan template"
							/>
						</label>
					</div>
				{/if}

				<div class="mt-5 flex justify-end">
					<button type="submit" class="btn btn-primary btn-soft shadow-none" disabled={submitting}>
						{#if submitting}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<Icon name="save" />
						{/if}
						Simpan Kustomisasi
					</button>
				</div>
			{/snippet}
		</FormEnhance>
	</div>

	<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
			<div>
				<h2 class="text-lg font-bold">Live Preview</h2>
				<p class="text-base-content/70 text-sm">Perubahan langsung terlihat di bawah.</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<select
					class="select select-sm bg-base-200 dark:bg-base-300 w-auto dark:border-none"
					bind:value={dokumen}
				>
					{#each DOKUMEN as item (item.value)}
						<option value={item.value}>{item.label}</option>
					{/each}
				</select>
				{#if dokumen === 'piagam'}
					<select
						class="select select-sm bg-base-200 dark:bg-base-300 w-auto dark:border-none"
						bind:value={templatePiagam}
					>
						<option value="1">Template 1</option>
						<option value="2">Template 2</option>
					</select>
				{/if}
				<select
					class="select select-sm bg-base-200 dark:bg-base-300 max-w-56 dark:border-none"
					bind:value={muridId}
				>
					{#each daftarMurid as murid (murid.id)}
						<option value={murid.id}>{murid.nama}</option>
					{/each}
				</select>
			</div>
		</div>

		{#if previewError}
			<div class="alert alert-error text-sm">
				<Icon name="warning" />
				<span>{previewError}</span>
			</div>
		{/if}

		<div class="bg-base-200 relative h-[70vh] overflow-hidden rounded-md">
			{#if previewLoading}
				<div class="absolute inset-0 flex items-center justify-center">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{/if}
			<iframe title="Preview dokumen cetak" class="h-full w-full bg-white" srcdoc={previewHtml}
			></iframe>
		</div>
	</div>
</div>
