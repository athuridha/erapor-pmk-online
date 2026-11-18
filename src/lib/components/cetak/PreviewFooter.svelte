<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import AturKriteriaModal from './AturKriteriaModal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { deletePiagamBg } from '$lib/components/piagam-bg.client';
	import PiagamBgUploadBody from '$lib/components/PiagamBgUploadBody.svelte';

	let {
		hasMurid = false,
		muridCount = 0,
		isPiagamSelected = false,
		selectedTemplate = '1',
		onBgRefresh,
		onSetKriteria = () => {},
		kritCukup = 85,
		kritBaik = 95,
		isRaporSelected = false,
		tpMode = 'compact',
		onToggleFullTP = () => {},
		kelasId = null,
		isBiodataSelected = false,
		showBgLogo = false,
		onToggleBgLogo = () => {},
		isJurnalMengajar = false,
		isBukuTamu = false,
		isPresensiGuru = false,
		isLaporanTpp = false
	}: {
		hasMurid: boolean;
		muridCount: number;
		isPiagamSelected: boolean;
		selectedTemplate: '1' | '2';
		onBgRefresh: () => void;
		isRaporSelected: boolean;
		tpMode: 'compact' | 'full-desc';
		onToggleFullTP: (value: 'compact' | 'full-desc') => void;
		onSetKriteria: (cukup: number | null, baik: number | null) => void;
		kritCukup: number;
		kritBaik: number;
		kelasId: string | number | null;
		isBiodataSelected?: boolean;
		showBgLogo?: boolean;
		onToggleBgLogo?: (value: boolean) => void;
		isJurnalMengajar?: boolean;
		isBukuTamu?: boolean;
		isPresensiGuru?: boolean;
		isLaporanTpp?: boolean;
	} = $props();

	async function handleDeleteBg() {
		showModal({
			title: 'Hapus Background Piagam',
			body: `Hapus background piagam template ${selectedTemplate}?<br />Ini akan mengembalikan background ke default.`,
			dismissible: true,
			onNegative: {
				label: 'Batal',
				action: ({ close }) => close()
			},
			onPositive: {
				label: 'Hapus',
				icon: 'del',
				action: async ({ close }) => {
					try {
						await deletePiagamBg(selectedTemplate);
						onBgRefresh();
						toast('Background piagam dikembalikan ke default.', 'success');
					} catch (err) {
						console.error(err);
						toast('Gagal menghapus background piagam.', 'error');
					} finally {
						close();
					}
				}
			}
		});
	}

	function handleUploadBg() {
		showModal({
			title: `Unggah Background Piagam: Template ${selectedTemplate}`,
			body: PiagamBgUploadBody,
			bodyProps: {
				template: selectedTemplate,
				onUploaded: onBgRefresh
			},
			dismissible: true
		});
	}

	let isDownloadingBA = $state(false);

	async function handleDownloadBA() {
		if (!kelasId) {
			toast('Kelas tidak ditemukan.', 'error');
			return;
		}

		isDownloadingBA = true;
		try {
			const response = await fetch('/api/cetak/ba', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ kelasId: Number(kelasId) })
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData?.error ?? 'Gagal membuat Berita Acara.');
			}

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `BA_Rapor_${new Date().toLocaleDateString('id-ID', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit'
			})}.xlsx`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast('Berita Acara berhasil diunduh.', 'success');
		} catch (err) {
			console.error('Error downloading BA:', err);
			toast(err instanceof Error ? err.message : 'Gagal mendownload Berita Acara.', 'error');
		} finally {
			isDownloadingBA = false;
		}
	}
</script>

<div class="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
	{#if isJurnalMengajar}
		<p class="text-slate-600 dark:text-zinc-400">
			Default preview satu semester dari tanggal masuk sekolah sampai tanggal bagi rapor.
		</p>
	{:else if isBukuTamu}
		<p class="text-slate-600 dark:text-zinc-400">
			Preview daftar buku tamu berdasarkan rentang tanggal yang dipilih.
		</p>
	{:else if isPresensiGuru}
		<p class="text-slate-600 dark:text-zinc-400">
			Preview daftar hadir guru (format bulanan) berdasarkan bulan dan tahun yang dipilih.
		</p>
	{:else if isLaporanTpp}
		<p class="text-slate-600 dark:text-zinc-400">
			Unduh Laporan TPP (format Excel) berdasarkan bulan, tahun, dan status kepegawaian yang
			dipilih.
		</p>
	{:else if hasMurid}
		<p class="text-slate-600 dark:text-zinc-400">
			Terdapat <strong class="font-semibold text-slate-900 dark:text-zinc-100">{muridCount}</strong> murid
			di kelas ini. Preview dokumen dalam bentuk PDF dapat dibuka per murid atau diunduh sekaligus.
		</p>
	{:else}
		<p class="font-medium text-amber-700 dark:text-amber-300">
			Belum ada data murid yang bisa di-preview. Tambahkan murid terlebih dahulu pada menu Sekolah
			&amp; Kelas &rsaquo; Murid.
		</p>
	{/if}
	<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
		{#if isPiagamSelected}
			<div class="max-sm:grid max-sm:grid-cols-2 max-sm:gap-2 sm:contents">
				<button
					class="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 max-sm:w-full dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/80"
					type="button"
					onclick={handleDeleteBg}
				>
					<Icon name="del" class="h-3.5 w-3.5" />
					Hapus BG
				</button>
				<button
					class="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 max-sm:w-full dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="button"
					onclick={handleUploadBg}
				>
					<Icon name="image" class="h-3.5 w-3.5" />
					Ganti BG
				</button>
			</div>
		{/if}

		{#if isRaporSelected}
			<div class="max-sm:grid max-sm:grid-cols-2 max-sm:gap-2 sm:contents">
				<button
					class="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 max-sm:w-full dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="button"
					title="Download Berita Acara"
					disabled={!kelasId || isDownloadingBA}
					aria-disabled={!kelasId || isDownloadingBA}
					onclick={handleDownloadBA}
				>
					<Icon name="download" class="h-3.5 w-3.5" />
					BA
				</button>
				<button
					class="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 max-sm:w-full dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="button"
					title="Atur Kriteria"
					onclick={() => {
						showModal({
							title: 'Atur Kriteria Penilaian Intrakurikuler',
							body: AturKriteriaModal,
							dismissible: true,
							onPositive: {
								label: 'Simpan',
								action: ({ close }: { close: () => void }) => {
									const clearEl = document.getElementById('krit-clear') as HTMLInputElement | null;
									if (clearEl?.checked) {
										onSetKriteria(null, null);
										close();
										return;
									}
									// read inputs from dialog DOM
									const cuk = document.getElementById('krit-cukup') as HTMLInputElement | null;
									const baik = document.getElementById('krit-baik') as HTMLInputElement | null;
									let cval = 85;
									let bval = 95;
									if (cuk) cval = Math.round(Number(cuk.value) || cval);
									if (baik) bval = Math.round(Number(baik.value) || bval);
									if (bval < cval) {
										const tmp = bval;
										bval = cval;
										cval = tmp;
									}
									onSetKriteria(cval, bval);
									close();
								}
							},
							bodyProps: { cukupUpper: kritCukup, baikUpper: kritBaik },
							// show cancel button too
							onNegative: { label: 'Batal' }
						});
					}}
				>
					<Icon name="gear" class="h-3.5 w-3.5" />
					Kriteria
				</button>
			</div>
		{/if}

		{#if isRaporSelected}
			<div class="flex flex-row items-center gap-2">
				<label class="sr-only" for="tp-mode-select">TP mode</label>
				<div class="relative flex flex-1 items-center sm:w-36">
					<select
						id="tp-mode-select"
						class="h-8 w-full appearance-none truncate rounded-lg border border-[#7e8b9b] bg-white pr-8 pl-2.5 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						value={tpMode}
						onchange={(e) => {
							const val = (e.target as HTMLSelectElement).value as 'compact' | 'full-desc';
							onToggleFullTP(val);
						}}
					>
						<option value="compact">Compact TP</option>
						<option value="full-desc">Full desc</option>
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2 flex items-center text-slate-500 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</div>
				{#if showBgLogo !== undefined}
					<button
						type="button"
						class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors {showBgLogo
							? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
							: 'border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
						aria-pressed={showBgLogo}
						title={showBgLogo ? 'Hapus watermark logo sekolah' : 'Tambahkan watermark logo sekolah'}
						onclick={() => onToggleBgLogo(!showBgLogo)}
					>
						{showBgLogo ? 'Watermark: Aktif' : 'Watermark: Mati'}
					</button>
				{/if}
			</div>
		{/if}

		{#if isBiodataSelected}
			<button
				type="button"
				class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors {showBgLogo
					? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
					: 'border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
				aria-pressed={showBgLogo}
				title={showBgLogo ? 'Hapus watermark logo sekolah' : 'Tambahkan watermark logo sekolah'}
				onclick={() => onToggleBgLogo(!showBgLogo)}
			>
				{showBgLogo ? 'Watermark: Aktif' : 'Watermark: Mati'}
			</button>
		{/if}
	</div>
</div>
