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
			coverLogoWidth: string;
			watermarkWidth: string;
			watermarkOpacity: number;
			cellPadding: string;
			coverSectionGap: string;
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
			kopBaris: Record<string, string[]>;
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
			kopBaris: barisKop()
		}
	});

	// Baris kop bawaan tiap dokumen (kementerian, republik, dinas, dst).
	function barisKop(): Record<string, string[]> {
		const custom = data.custom.teks.kopBaris ?? {};
		const bawaan = data.kopSekarang ?? {};
		const hasil: Record<string, string[]> = {};
		for (const item of DOKUMEN) {
			const tersimpan = Array.isArray(custom[item.value]) ? custom[item.value] : [];
			hasil[item.value] = tersimpan.length ? [...tersimpan] : [...(bawaan[item.value] ?? [])];
		}
		return hasil;
	}

	// Ukuran logo dalam px (slider 30-200). Nilai non-px jatuh ke 70.
	const logoPx = $derived.by(() => {
		const parsed = Number.parseFloat(String(form.layout.logoWidth).replace(',', '.'));
		if (!Number.isFinite(parsed)) return 70;
		return Math.min(200, Math.max(30, Math.round(parsed)));
	});

	function setLogoPx(value: number) {
		if (!Number.isFinite(value)) return;
		const clamped = Math.min(200, Math.max(30, Math.round(value)));
		form.layout.logoWidth = `${clamped}px`;
	}

	/** Konversi nilai ukuran (px/mm/pt) ke px untuk slider. */
	function ukuranKePx(value: string, fallback: number): number {
		const cocok = String(value)
			.trim()
			.match(/^([\d.,]+)\s*(px|mm|pt)?$/i);
		if (!cocok) return fallback;
		const angka = Number.parseFloat(cocok[1].replace(',', '.'));
		if (!Number.isFinite(angka)) return fallback;
		const satuan = (cocok[2] ?? 'px').toLowerCase();
		if (satuan === 'mm') return angka * 3.7795;
		if (satuan === 'pt') return angka * 1.3333;
		return angka;
	}

	// Ukuran logo cover (slider 40-260 px). 55mm bawaan template ≈ 208px.
	const coverLogoPx = $derived.by(() => {
		const px = ukuranKePx(String(form.layout.coverLogoWidth), 208);
		return Math.min(260, Math.max(40, Math.round(px)));
	});

	function setCoverLogoPx(value: number) {
		if (!Number.isFinite(value)) return;
		const clamped = Math.min(260, Math.max(40, Math.round(value)));
		form.layout.coverLogoWidth = `${clamped}px`;
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
						<div class="form-control sm:col-span-2">
							<span class="label-text mb-1 text-sm">Baris kop</span>
							<div class="space-y-1.5">
								{#each form.teks.kopBaris[dokumen] as baris, index (index)}
									<div class="flex items-center gap-1">
										<span class="w-4 shrink-0 text-right text-[11px] text-base-content/50">
											{index + 1}
										</span>
										<input
											class="input input-sm w-full"
											value={baris}
											oninput={(event) => {
												const next = [...form.teks.kopBaris[dokumen]];
												next[index] = event.currentTarget.value;
												form.teks.kopBaris[dokumen] = next;
											}}
											placeholder="Teks baris kop"
										/>
										<button
											type="button"
											class="btn btn-ghost btn-xs shrink-0"
											title="Hapus baris"
											onclick={() => {
												form.teks.kopBaris[dokumen] = form.teks.kopBaris[dokumen].filter(
													(_, i) => i !== index
												);
											}}
										>
											<Icon name="del" />
										</button>
									</div>
								{/each}
								{#if form.teks.kopBaris[dokumen].length === 0}
									<p class="text-[11px] italic text-base-content/60">Kosong = pakai kop bawaan.</p>
								{/if}
								<button
									type="button"
									class="btn btn-ghost btn-xs gap-1"
									onclick={() => {
										form.teks.kopBaris[dokumen] = [...form.teks.kopBaris[dokumen], ''];
									}}
								>
									<Icon name="plus" />
									Tambah baris
								</button>
							</div>
						</div>
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
						<div class="form-control">
							<span class="label-text mb-1 text-sm">Ukuran logo cover</span>
							<div class="flex items-center gap-2">
								<input
									type="range"
									class="range range-primary range-xs grow"
									min="40"
									max="260"
									step="1"
									value={coverLogoPx}
									oninput={(event) => setCoverLogoPx(Number(event.currentTarget.value))}
								/>
								<label class="input input-sm flex w-24 shrink-0 items-center gap-1">
									<input
										type="number"
										class="grow text-right"
										min="40"
										max="260"
										step="1"
										value={coverLogoPx}
										oninput={(event) => {
											const raw = event.currentTarget.value;
											if (raw === '') return;
											setCoverLogoPx(Number(raw));
										}}
									/>
									<span class="text-xs text-base-content/60">px</span>
								</label>
							</div>
							<div class="mt-1 flex flex-wrap gap-1">
								{#each [{ label: 'Kecil', px: 120 }, { label: 'Sedang', px: 160 }, { label: 'Besar', px: 208 }] as preset}
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										class:btn-active={coverLogoPx === preset.px}
										onclick={() => setCoverLogoPx(preset.px)}
									>
										{preset.label}
									</button>
								{/each}
							</div>
							<p class="mt-1 text-[11px] text-base-content/60">Khusus logo di halaman cover.</p>
						</div>
						<div class="form-control">
							<span class="label-text mb-1 text-sm">Ukuran logo kop</span>
							<div class="flex items-center gap-2">
								<input
									type="range"
									class="range range-primary range-xs grow"
									min="30"
									max="200"
									step="1"
									value={logoPx}
									oninput={(event) => setLogoPx(Number(event.currentTarget.value))}
								/>
								<label class="input input-sm flex w-24 shrink-0 items-center gap-1">
									<input
										type="number"
										class="grow text-right"
										min="30"
										max="200"
										step="1"
										value={logoPx}
										oninput={(event) => {
											const raw = event.currentTarget.value;
											if (raw === '') return;
											setLogoPx(Number(raw));
										}}
									/>
									<span class="text-xs text-base-content/60">px</span>
								</label>
							</div>
							<div class="mt-1 flex flex-wrap gap-1">
								{#each [{ label: 'Kecil', px: 50 }, { label: 'Sedang', px: 70 }, { label: 'Besar', px: 100 }] as preset}
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										class:btn-active={logoPx === preset.px}
										onclick={() => setLogoPx(preset.px)}
									>
										{preset.label}
									</button>
								{/each}
							</div>
							<p class="mt-1 text-[11px] text-base-content/60">
								Berlaku untuk kop piagam, rapor, dan SPPD.
							</p>
						</div>
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
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Jarak antar bagian cover</span>
							<input
								class="input input-sm w-full"
								bind:value={form.layout.coverSectionGap}
								placeholder="mis. 5mm (kosong = tanpa jarak)"
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
