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
	let previewAbort: AbortController | null = null;

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
		previewAbort?.abort();
		const controller = new AbortController();
		previewAbort = controller;
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
				}),
				signal: controller.signal
			});
			if (controller.signal.aborted) return;
			if (!res.ok) {
				previewError = 'Preview gagal dimuat.';
				return;
			}
			const payload = await res.json();
			if (controller.signal.aborted) return;
			previewHtml = payload.html ?? '';
		} catch (error) {
			if (controller.signal.aborted) return;
			console.error('Preview kustomisasi gagal', error);
			previewError = 'Preview gagal dimuat.';
		} finally {
			if (previewAbort === controller) previewLoading = false;
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
	<div
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="mb-4 border-b border-slate-200 pb-3 dark:border-zinc-800">
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Kustomisasi Cetak
			</h1>
			<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
				Ubah teks, gambar, dan jarak/layout dokumen cetak. Perubahan langsung terlihat di preview
				sebelah kanan.
			</p>
		</div>

		<div
			role="tablist"
			class="mb-4 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-800/60"
		>
			{#each [{ key: 'teks', label: 'Teks' }, { key: 'gambar', label: 'Gambar' }, { key: 'jarak', label: 'Jarak & Layout' }] as item (item.key)}
				<button
					type="button"
					role="tab"
					class="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold transition-colors {tab ===
					item.key
						? 'bg-blue-600 text-white shadow-sm'
						: 'text-slate-700 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800'}"
					onclick={() => (tab = item.key as typeof tab)}
				>
					{item.label}
				</button>
			{/each}
		</div>

		<FormEnhance action="?/simpan" showToast={false} onsuccess={handleSimpan}>
			{#snippet children({ submitting })}
				<input type="hidden" name="custom" value={JSON.stringify(form)} />

				{#if tab === 'teks'}
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Nama sekolah di kop</span
							>
							<div class="flex items-center gap-1">
								<input
									class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									value={form.teks.namaSekolah}
									oninput={(event) => (form.teks.namaSekolah = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
									title="Kembalikan ke data sekolah"
									onclick={() => (form.teks.namaSekolah = '')}
								>
									<Icon name="close" class="h-3.5 w-3.5" />
								</button>
							</div>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NPSN</span>
							<div class="flex items-center gap-1">
								<input
									class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									value={form.teks.npsn}
									oninput={(event) => (form.teks.npsn = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
									title="Kembalikan ke data sekolah"
									onclick={() => (form.teks.npsn = '')}
								>
									<Icon name="close" class="h-3.5 w-3.5" />
								</button>
							</div>
						</label>
						<label class="flex flex-col gap-1 sm:col-span-2">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Alamat sekolah di kop</span
							>
							<div class="flex items-center gap-1">
								<input
									class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									value={form.teks.alamat}
									oninput={(event) => (form.teks.alamat = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
									title="Kembalikan ke data sekolah"
									onclick={() => (form.teks.alamat = '')}
								>
									<Icon name="close" class="h-3.5 w-3.5" />
								</button>
							</div>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Email sekolah</span
							>
							<div class="flex items-center gap-1">
								<input
									class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									value={form.teks.email}
									oninput={(event) => (form.teks.email = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
									title="Kembalikan ke data sekolah"
									onclick={() => (form.teks.email = '')}
								>
									<Icon name="close" class="h-3.5 w-3.5" />
								</button>
							</div>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Kota penutup</span
							>
							<div class="flex items-center gap-1">
								<input
									class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									value={form.teks.kota}
									oninput={(event) => (form.teks.kota = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
									title="Kembalikan ke data sekolah"
									onclick={() => (form.teks.kota = '')}
								>
									<Icon name="close" class="h-3.5 w-3.5" />
								</button>
							</div>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Label penutup</span
							>
							<input
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={form.teks.labelMengetahui}
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Tanggal penutup</span
							>
							<div class="flex items-center gap-1">
								<input
									class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									value={form.teks.tanggal}
									oninput={(event) => (form.teks.tanggal = event.currentTarget.value)}
								/>
								<button
									type="button"
									class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
									title="Kembalikan ke tanggal rapor"
									onclick={() => (form.teks.tanggal = '')}
								>
									<Icon name="close" class="h-3.5 w-3.5" />
								</button>
							</div>
						</label>
					</div>

					<div class="my-4 border-t border-slate-200 dark:border-zinc-800"></div>

					<div class="mb-3 flex flex-wrap items-center gap-2">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Teks dokumen</span
						>
						<div class="flex flex-wrap gap-1">
							{#each DOKUMEN as item (item.value)}
								<button
									type="button"
									class="inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-semibold transition-colors {dokumen ===
									item.value
										? 'border-blue-600 bg-blue-600 text-white shadow-sm'
										: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
									onclick={() => (dokumen = item.value)}
								>
									{item.label}
								</button>
							{/each}
						</div>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Judul</span>
							<input
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								value={form.teks.judul[dokumen]}
								oninput={(event) => (form.teks.judul[dokumen] = event.currentTarget.value)}
								placeholder="Kosong = bawaan"
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Subjudul</span>
							<input
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								value={form.teks.subjudul[dokumen]}
								oninput={(event) => (form.teks.subjudul[dokumen] = event.currentTarget.value)}
								placeholder="Kosong = bawaan"
							/>
						</label>
						<div class="flex flex-col gap-1 sm:col-span-2">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Baris kop</span>
							<div class="space-y-1.5">
								{#each form.teks.kopBaris[dokumen] as baris, index (index)}
									<div class="flex items-center gap-1">
										<span
											class="w-4 shrink-0 text-right text-[11px] text-slate-500 tabular-nums dark:text-zinc-400"
										>
											{index + 1}
										</span>
										<input
											class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
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
											class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
											title="Hapus baris"
											onclick={() => {
												form.teks.kopBaris[dokumen] = form.teks.kopBaris[dokumen].filter(
													(_, i) => i !== index
												);
											}}
										>
											<Icon name="del" class="h-3.5 w-3.5" />
										</button>
									</div>
								{/each}
								{#if form.teks.kopBaris[dokumen].length === 0}
									<p class="text-xs italic text-slate-500 dark:text-zinc-400">
										Kosong = pakai kop bawaan.
									</p>
								{/if}
								<button
									type="button"
									class="inline-flex h-7 items-center gap-1 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
									onclick={() => {
										form.teks.kopBaris[dokumen] = [...form.teks.kopBaris[dokumen], ''];
									}}
								>
									<Icon name="plus" class="h-3 w-3" />
									Tambah baris
								</button>
							</div>
						</div>
						<label class="flex flex-col gap-1 sm:col-span-2">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Catatan kaki</span
							>
							<input
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								value={form.teks.catatan[dokumen]}
								oninput={(event) => (form.teks.catatan[dokumen] = event.currentTarget.value)}
								placeholder="Contoh: Dokumen asli disimpan otomatis oleh sekolah"
							/>
						</label>
					</div>
				{:else if tab === 'gambar'}
					<div class="grid gap-4 sm:grid-cols-2">
						<div
							class="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30"
						>
							<h3 class="mb-2 text-xs font-semibold text-slate-900 dark:text-zinc-100">Logo kop</h3>
							<div
								class="flex h-32 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
							>
								{#if form.gambar.logo}
									<img src={form.gambar.logo} alt="Logo kop" class="max-h-full max-w-full" />
								{:else}
									<span class="px-3 text-center text-xs text-slate-500 dark:text-zinc-400">
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
										class="mt-2 block w-full text-xs text-slate-600 file:mr-2 file:h-8 file:cursor-pointer file:rounded-lg file:border file:border-[#7e8b9b] file:bg-white file:px-2.5 file:text-xs file:font-semibold file:text-slate-800 dark:text-zinc-400 dark:file:border-slate-500 dark:file:bg-zinc-900 dark:file:text-zinc-100"
										disabled={submitting}
									/>
									<button
										type="submit"
										class="mt-2 inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
										disabled={submitting}
									>
										<Icon name="save" class="h-3.5 w-3.5" />
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
											class="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
											disabled={submitting}
										>
											<Icon name="del" class="h-3.5 w-3.5" />
											Hapus Logo
										</button>
									{/snippet}
								</FormEnhance>
							{/if}
						</div>

						<div
							class="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30"
						>
							<h3 class="mb-2 text-xs font-semibold text-slate-900 dark:text-zinc-100">
								Gambar watermark
							</h3>
							<div
								class="flex h-32 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
							>
								{#if form.gambar.watermark}
									<img src={form.gambar.watermark} alt="Watermark" class="max-h-full max-w-full" />
								{:else}
									<span class="px-3 text-center text-xs text-slate-500 dark:text-zinc-400">
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
										class="mt-2 block w-full text-xs text-slate-600 file:mr-2 file:h-8 file:cursor-pointer file:rounded-lg file:border file:border-[#7e8b9b] file:bg-white file:px-2.5 file:text-xs file:font-semibold file:text-slate-800 dark:text-zinc-400 dark:file:border-slate-500 dark:file:bg-zinc-900 dark:file:text-zinc-100"
										disabled={submitting}
									/>
									<button
										type="submit"
										class="mt-2 inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
										disabled={submitting}
									>
										<Icon name="save" class="h-3.5 w-3.5" />
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
											class="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
											disabled={submitting}
										>
											<Icon name="del" class="h-3.5 w-3.5" />
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
							<span class="text-xs font-medium text-slate-700 dark:text-zinc-300"
								>Tampilkan logo di kop</span
							>
						</label>
						<label class="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								class="toggle toggle-primary toggle-sm"
								bind:checked={form.teks.tampilkanWatermark}
							/>
							<span class="text-xs font-medium text-slate-700 dark:text-zinc-300"
								>Tampilkan watermark</span
							>
						</label>
						<label class="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								class="toggle toggle-primary toggle-sm"
								bind:checked={form.teks.tampilkanFoto}
							/>
							<span class="text-xs font-medium text-slate-700 dark:text-zinc-300"
								>Tampilkan foto murid</span
							>
						</label>
					</div>
				{:else}
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Margin halaman</span
							>
							<input
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={form.layout.margin}
								placeholder="20mm"
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Ukuran font dasar</span
							>
							<input
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={form.layout.fontSize}
								placeholder="11pt"
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Jarak antar baris</span
							>
							<input
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={form.layout.lineHeight}
								placeholder="1.4"
							/>
						</label>
						<div class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Ukuran logo cover</span
							>
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
								<label
									class="flex h-8 w-24 shrink-0 items-center gap-1 rounded-lg border border-[#7e8b9b] bg-white px-2 dark:border-slate-500 dark:bg-zinc-900"
								>
									<input
										type="number"
										class="w-full bg-transparent text-right text-xs text-slate-900 focus:outline-none dark:text-zinc-100"
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
									<span class="text-xs text-slate-500 dark:text-zinc-400">px</span>
								</label>
							</div>
							<div class="mt-1 flex flex-wrap gap-1">
								{#each [{ label: 'Kecil', px: 120 }, { label: 'Sedang', px: 160 }, { label: 'Besar', px: 208 }] as preset (preset.px)}
									<button
										type="button"
										class="inline-flex h-6 items-center rounded border px-2 text-[11px] font-semibold transition-colors {coverLogoPx ===
										preset.px
											? 'border-blue-600 bg-blue-600 text-white'
											: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}"
										onclick={() => setCoverLogoPx(preset.px)}
									>
										{preset.label}
									</button>
								{/each}
							</div>
							<p class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
								Khusus logo di halaman cover.
							</p>
						</div>
						<div class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Ukuran logo kop</span
							>
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
								<label
									class="flex h-8 w-24 shrink-0 items-center gap-1 rounded-xl border border-[#7e8b9b] bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900"
								>
									<input
										type="number"
										class="w-full bg-transparent text-right text-xs text-slate-900 focus:outline-none dark:text-zinc-100"
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
									<span class="text-xs text-slate-500 dark:text-zinc-400">px</span>
								</label>
							</div>
							<div class="mt-1 flex flex-wrap gap-1">
								{#each [{ label: 'Kecil', px: 50 }, { label: 'Sedang', px: 70 }, { label: 'Besar', px: 100 }] as preset (preset.px)}
									<button
										type="button"
										class="inline-flex h-6 items-center rounded border px-2 text-[11px] font-semibold transition-colors {logoPx ===
										preset.px
											? 'border-blue-600 bg-blue-600 text-white'
											: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}"
										onclick={() => setLogoPx(preset.px)}
									>
										{preset.label}
									</button>
								{/each}
							</div>
							<p class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
								Berlaku untuk kop piagam, rapor, dan SPPD.
							</p>
						</div>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Lebar watermark</span
							>
							<input
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={form.layout.watermarkWidth}
								placeholder="45%"
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Opasitas watermark</span
							>
							<input
								type="number"
								min="0"
								max="1"
								step="0.01"
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={form.layout.watermarkOpacity}
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Padding sel tabel</span
							>
							<input
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={form.layout.cellPadding}
								placeholder="Kosong = bawaan template"
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Jarak antar bagian cover</span
							>
							<input
								class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={form.layout.coverSectionGap}
								placeholder="mis. 5mm (kosong = tanpa jarak)"
							/>
						</label>
					</div>
				{/if}

				<div class="mt-5 flex justify-end border-t border-slate-200 pt-4 dark:border-zinc-800">
					<button
						type="submit"
						class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={submitting}
					>
						{#if submitting}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<Icon name="save" class="h-4 w-4" />
						{/if}
						Simpan Kustomisasi
					</button>
				</div>
			{/snippet}
		</FormEnhance>
	</div>

	<div
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-zinc-800"
		>
			<div>
				<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Live Preview</h2>
				<p class="text-xs text-slate-600 dark:text-zinc-400">
					Perubahan langsung terlihat di bawah.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<div class="relative flex items-center">
					<select
						class="h-8 appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						bind:value={dokumen}
					>
						{#each DOKUMEN as item (item.value)}
							<option value={item.value}>{item.label}</option>
						{/each}
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2 flex items-center text-slate-500 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3 w-3" />
					</span>
				</div>
				{#if dokumen === 'piagam'}
					<div class="relative flex items-center">
						<select
							class="h-8 appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							bind:value={templatePiagam}
						>
							<option value="1">Template 1</option>
							<option value="2">Template 2</option>
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3 w-3" />
						</span>
					</div>
				{/if}
				<div class="relative flex items-center">
					<select
						class="h-8 max-w-56 appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						bind:value={muridId}
					>
						{#each daftarMurid as murid (murid.id)}
							<option value={murid.id}>{murid.nama}</option>
						{/each}
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2 flex items-center text-slate-500 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3 w-3" />
					</span>
				</div>
			</div>
		</div>

		{#if previewError}
			<div
				class="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
			>
				<Icon name="warning" class="h-4 w-4 shrink-0" />
				<span>{previewError}</span>
			</div>
		{/if}

		<div
			class="relative h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950"
		>
			{#if previewLoading}
				<div class="absolute inset-0 flex items-center justify-center">
					<span class="loading loading-spinner loading-lg text-blue-600 dark:text-blue-400"></span>
				</div>
			{/if}
			<iframe title="Preview dokumen cetak" class="h-full w-full bg-white" srcdoc={previewHtml}
			></iframe>
		</div>
	</div>
</div>
