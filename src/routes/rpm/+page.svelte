<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import PdfPreviewModal from '$lib/components/cetak/PdfPreviewModal.svelte';
	import { isFullAdmin } from '../pengguna/permissions';
	import {
		profilPelajarPancasilaDimensions,
		profilPelajarPancasilaDimensionLabelByKey,
		type DimensiProfilLulusanKey
	} from '$lib/statics';

	type Generated = {
		karakteristik: string;
		model: string;
		lintasDisiplinIlmu: string;
		kemitraanPembelajaran: string;
		lingkunganPembelajaran: string;
		pemanfaatanDigital: string;
		kegiatanAwal: string;
		memahami: string;
		mengaplikasi: string;
		merefleksi: string;
		penutup: string;
		asesmen: string[];
		tujuanPembelajaran: string[];
	};

	type StringFieldKey = {
		[K in keyof Generated]: Generated[K] extends string ? K : never;
	}[keyof Generated];

	let { data } = $props();

	const DIMENSI_PROFIL_LULUSAN_OPTIONS = profilPelajarPancasilaDimensions.map((d) => ({
		key: d.key,
		label: profilPelajarPancasilaDimensionLabelByKey[d.key]
	}));

	let capaianPembelajaran = $state('');
	// svelte-ignore state_referenced_locally
	let mapelId = $state<number>(data.pickerMapelId ?? 0);
	let lingkupMateri = $state('');
	let tpIds = $state<number[]>([]);
	let inputCustom = $state('');
	let karakteristikInput = $state('');
	let profilLulusan = $state<DimensiProfilLulusanKey[]>([]);

	const profilLulusanLabels = $derived(
		profilLulusan.map((k) => profilPelajarPancasilaDimensionLabelByKey[k] ?? k)
	);
	const kelasLabelFase = $derived.by(() => {
		if (!kelasAktif) return '';
		const faseRaw = kelasAktif.fase ?? '';
		const fase = faseRaw ? ` Fase ${faseRaw.replace(/^Fase\s+/i, '').trim()}` : '';
		return `Siswa ${kelasAktif.nama}${fase} dengan karakteristik`;
	});

	let generated = $state<Generated | null>(null);
	let generating = $state(false);
	let printing = $state(false);
	let errorMessage = $state('');
	let aiStatus = $state<'checking' | 'ready' | 'unconfigured'>('checking');
	let isAdminUserState = $state(false);
	let pdfUrl = $state('');
	let pdfTitle = $state('');
	let pdfOpen = $state(false);
	let importOpen = $state(false);
	let importError = $state('');

	type RubrikRow = { aspek: string; indikator: string; skor: string; kriteria: string };
	type AsesmenLampiran = { uraian: string; instrumen: string; rubrik: RubrikRow[] };
	type Lampiran = { formatif: AsesmenLampiran; sumatif: AsesmenLampiran; lkpd: string };
	let lampiran = $state<Lampiran | null>(null);
	let lampiranGenerating = $state(false);
	let lampiranError = $state('');
	let combiningPdf = $state(false);
	let lampiranCustom = $state('');

	const kelasAktif = $derived(data.kelasAktif);
	const selectedMapel = $derived(data.mapelList.find((m) => m.id === mapelId));
	const isAgamaFamily = $derived(
		selectedMapel
			? /^pendidikan (agama|kepercayaan)/i.test(selectedMapel.nama) ||
					/^pendalaman kitab suci/i.test(selectedMapel.nama)
			: false
	);

	// Pemilih "agama" saat wali_kelas/admin memilih PABP (Pendidikan Agama dan
	// Budi Pekerti) — mapel efektif memakai varian agama yang dipilih.
	let agamaKey = $state('');
	const showAgamaSelect = $derived.by(() => {
		const u = data.user as { type?: string; ownKelasIds?: number[] } | undefined;
		const uType = u?.type ?? '';
		const isWaliOwnClass =
			uType === 'user' && kelasAktif?.id != null && (u?.ownKelasIds ?? []).includes(kelasAktif.id);
		if (!isWaliOwnClass && !['admin', 'kepala_sekolah', 'wali_kelas'].includes(uType)) {
			return false;
		}
		return (
			!!selectedMapel &&
			/^(pendidikan (agama|kepercayaan) dan budi pekerti)/i.test(selectedMapel.nama)
		);
	});
	const agamaOptions = $derived(
		(data.agamaOptions ?? []) as Array<{
			key: string;
			label: string;
			nama: string;
			mapelId: number;
		}>
	);
	const agamaChoice = $derived(agamaOptions.find((o) => o.key === agamaKey));
	const activeMapelId = $derived(showAgamaSelect && agamaChoice ? agamaChoice.mapelId : mapelId);
	const mapelNama = $derived(
		showAgamaSelect && agamaChoice ? agamaChoice.nama : (selectedMapel?.nama ?? '')
	);

	const kelasTps = $derived(
		data.tujuanPembelajaranList.filter((tp) => tp.mataPelajaranId === activeMapelId)
	);
	const lingkupOptions = $derived(
		[...new Set(kelasTps.map((tp) => tp.lingkupMateri).filter(Boolean))].sort()
	);
	const tpOptions = $derived(
		kelasTps.filter((tp) => !lingkupMateri || tp.lingkupMateri === lingkupMateri)
	);
	const selectedTps = $derived(data.tujuanPembelajaranList.filter((tp) => tpIds.includes(tp.id)));

	const canGenerate = $derived(
		aiStatus === 'ready' &&
			capaianPembelajaran.trim().length > 0 &&
			mapelId > 0 &&
			(!showAgamaSelect || !!agamaKey) &&
			lingkupMateri.trim().length > 0 &&
			profilLulusan.length > 0
	);
	const generateTitle = $derived.by(() => {
		if (aiStatus !== 'ready') return 'Fitur AI belum aktif. Setel kunci API di halaman Pengaturan.';
		if (!capaianPembelajaran.trim()) return 'Capaian Pembelajaran wajib diisi.';
		if (!mapelId) return 'Mata pelajaran wajib dipilih.';
		if (showAgamaSelect && !agamaKey)
			return 'Pilih agama terlebih dahulu agar menggunakan varian PABP yang sesuai.';
		if (!lingkupMateri.trim()) return 'Lingkup materi wajib dipilih.';
		if (profilLulusan.length === 0)
			return 'Pilih minimal satu Dimensi Profil Lulusan agar langkah pembelajaran selaras.';
		return undefined;
	});

	onMount(() => {
		(async () => {
			try {
				const response = await fetch('/api/ai/status');
				const body = await response.json().catch(() => ({}));
				aiStatus = response.ok && body?.configured ? 'ready' : 'unconfigured';
				isAdminUserState = Boolean(body?.isAdmin);
			} catch {
				aiStatus = 'unconfigured';
			}
		})();
	});

	function handleMapelChange(event: Event) {
		mapelId = Number((event.currentTarget as HTMLSelectElement).value) || 0;
		agamaKey = '';
		lingkupMateri = '';
		tpIds = [];
	}

	function handleLingkupChange(event: Event) {
		lingkupMateri = (event.currentTarget as HTMLSelectElement).value;
		tpIds = [];
	}

	function toggleTp(id: number, checked: boolean) {
		tpIds = checked ? [...tpIds, id] : tpIds.filter((x) => x !== id);
	}

	function toggleDimensi(key: DimensiProfilLulusanKey, checked: boolean) {
		profilLulusan = checked
			? [...new Set([...profilLulusan, key])]
			: profilLulusan.filter((x) => x !== key);
	}

	function resetError() {
		errorMessage = '';
	}

	async function handleGenerate() {
		resetError();
		if (!canGenerate) {
			errorMessage = generateTitle ?? 'Lengkapi data terlebih dahulu.';
			return;
		}
		generating = true;
		try {
			const response = await fetch('/api/ai/rpm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mapelId: activeMapelId,
					capaianPembelajaran: capaianPembelajaran.trim(),
					lingkupMateri: lingkupMateri.trim(),
					tujuanPembelajaranIds: tpIds,
					inputCustom: inputCustom.trim(),
					karakteristik: karakteristikInput.trim(),
					profilLulusan: profilLulusanLabels
				})
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				errorMessage = body?.message || 'Gagal generate RPM.';
				return;
			}
			generated = (body?.data?.generated ?? null) as Generated | null;
			if (!generated) {
				errorMessage = 'AI tidak menghasilkan konten RPM. Coba lagi.';
			}
		} catch {
			errorMessage = 'Terjadi kesalahan saat menghubungi layanan AI. Coba lagi.';
		} finally {
			generating = false;
		}
	}

	function updateGenerated<K extends keyof Generated>(key: K, value: Generated[K]) {
		if (!generated) return;
		generated = { ...generated, [key]: value };
	}

	function rpmPdfPayload() {
		if (!generated || !kelasAktif) return null;
		return {
			mapelNama,
			penyusun: isFullAdmin(data.user)
				? '-'
				: ((data.user as { pegawaiName?: string | null } | undefined)?.pegawaiName ?? '-'),
			kelasLabel: kelasAktif.nama,
			fase: kelasAktif.fase ?? null,
			karakteristik: generated.karakteristik,
			lingkupMateri: lingkupMateri.trim(),
			profilLulusan: profilLulusanLabels,
			capaianPembelajaran: capaianPembelajaran.trim(),
			lintasDisiplinIlmu: generated.lintasDisiplinIlmu,
			tujuanPembelajaran: generated.tujuanPembelajaran.length
				? generated.tujuanPembelajaran
				: selectedTps.map((tp) => tp.deskripsi),
			model: generated.model,
			kemitraanPembelajaran: generated.kemitraanPembelajaran,
			lingkunganPembelajaran: generated.lingkunganPembelajaran,
			pemanfaatanDigital: generated.pemanfaatanDigital,
			kegiatanAwal: generated.kegiatanAwal,
			memahami: generated.memahami,
			mengaplikasi: generated.mengaplikasi,
			merefleksi: generated.merefleksi,
			penutup: generated.penutup,
			asesmen: generated.asesmen
		};
	}

	function lampiranPdfPayload() {
		if (!generated || !kelasAktif || !lampiran) return null;
		return {
			mapelNama,
			kelasLabel: kelasAktif.nama,
			penyusun:
				data.user?.type === 'admin'
					? '-'
					: ((data.user as { pegawaiName?: string | null } | undefined)?.pegawaiName ?? '-'),
			formatif: lampiran.formatif,
			sumatif: lampiran.sumatif,
			lkpd: lampiran.lkpd
		};
	}

	async function handlePrintPdf() {
		const payload = rpmPdfPayload();
		if (!payload || !kelasAktif) return;
		printing = true;
		resetError();
		try {
			const response = await fetch('/api/pdf/rpm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				errorMessage = body?.message || 'Gagal membuat PDF.';
				return;
			}
			const blob = await response.blob();
			if (pdfUrl) URL.revokeObjectURL(pdfUrl);
			pdfUrl = URL.createObjectURL(blob);
			pdfTitle = `RPM - Kelas ${kelasAktif.nama}`;
			pdfOpen = true;
		} catch {
			errorMessage = 'Terjadi kesalahan saat membuat PDF.';
		} finally {
			printing = false;
		}
	}

	function handlePdfDownload() {
		if (!pdfUrl) return;
		const anchor = document.createElement('a');
		anchor.href = pdfUrl;
		anchor.download = 'rpm.pdf';
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		toast('PDF RPM diunduh.', 'success');
	}

	function handlePdfClose() {
		if (pdfUrl) URL.revokeObjectURL(pdfUrl);
		pdfUrl = '';
		pdfOpen = false;
	}

	function handleDownloadJson() {
		if (!generated || !kelasAktif) return;
		const payload = {
			mapelNama,
			kelas: kelasAktif.nama,
			fase: kelasAktif.fase ?? null,
			lingkupMateri: lingkupMateri.trim(),
			capaianPembelajaran: capaianPembelajaran.trim(),
			dimensiProfilLulusan: profilLulusanLabels,
			...generated,
			tujuanPembelajaran: generated.tujuanPembelajaran.length
				? generated.tujuanPembelajaran
				: selectedTps.map((tp) => tp.deskripsi)
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'rpm.json';
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
		toast('Data RPM berhasil diunduh.', 'success');
	}

	function handleBack() {
		generated = null;
		resetError();
	}

	function handleLampiranBack() {
		lampiran = null;
		lampiranError = '';
	}

	function lampiranPayload() {
		if (!generated || !kelasAktif) return null;
		return {
			mapelNama,
			kelasLabel: kelasAktif.nama,
			kelasId: kelasAktif.id,
			fase: kelasAktif.fase ?? null,
			lingkupMateri: lingkupMateri.trim(),
			capaianPembelajaran: capaianPembelajaran.trim(),
			tujuanPembelajaran: generated.tujuanPembelajaran.length
				? generated.tujuanPembelajaran
				: selectedTps.map((tp) => tp.deskripsi),
			asesmen: generated.asesmen,
			karakteristik: generated.karakteristik,
			profilLulusan: profilLulusanLabels,
			model: generated.model,
			inputCustom: lampiranCustom.trim(),
			kegiatanAwal: generated.kegiatanAwal,
			memahami: generated.memahami,
			mengaplikasi: generated.mengaplikasi,
			merefleksi: generated.merefleksi,
			penutup: generated.penutup
		};
	}

	function lampiranAsesmen(value: unknown): AsesmenLampiran {
		if (!value || typeof value !== 'object') {
			const flat = typeof value === 'string' ? value.trim() : '';
			return flat
				? { uraian: flat, instrumen: '', rubrik: [] }
				: { uraian: '', instrumen: '', rubrik: [] };
		}
		const o = value as Record<string, unknown>;
		const t = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');
		const rowOf = (r: unknown): RubrikRow => {
			if (r && typeof r === 'object') {
				const row = r as Record<string, unknown>;
				return {
					aspek: t(row?.aspek),
					indikator: t(row?.indikator),
					skor: t(row?.skor),
					kriteria: t(row?.kriteria)
				};
			}
			return { aspek: String(r ?? '').trim(), indikator: '', skor: '', kriteria: '' };
		};
		const rubrik = Array.isArray(o.rubrik)
			? (o.rubrik as unknown[])
					.map(rowOf)
					.filter((r) => r.aspek || r.kriteria || r.indikator || r.skor)
			: typeof o.rubrik === 'string'
				? o.rubrik
						.split(/\n+/)
						.map((line) => line.trim())
						.filter((line) => /^\d+\.|^[-*]/.test(line))
						.map((line) => rowOf(line.replace(/^(\d+\.|[-*])\s*/, '')))
						.filter((r) => r.aspek)
				: [];
		return { uraian: t(o.uraian), instrumen: t(o.instrumen), rubrik };
	}

	function handleLampiranImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json,.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const data = JSON.parse(await file.text()) as Record<string, unknown>;
				const formatif = lampiranAsesmen(data.formatif);
				const sumatif = lampiranAsesmen(data.sumatif);
				const lkpd = typeof data.lkpd === 'string' ? data.lkpd.trim() : '';
				if (
					(!formatif.uraian && !formatif.instrumen) ||
					(!sumatif.uraian && !sumatif.instrumen) ||
					!lkpd
				) {
					throw new Error('invalid');
				}
				lampiran = { formatif, sumatif, lkpd };
				lampiranError = '';
				toast('Lampiran RPM berhasil diimpor.', 'success');
			} catch {
				lampiranError = 'Berkas bukan JSON lampiran RPM yang valid.';
			}
		};
		input.click();
	}

	async function handleGenerateLampiran() {
		const payload = lampiranPayload();
		if (!payload || !generated) return;
		lampiranError = '';
		lampiranGenerating = true;
		try {
			const response = await fetch('/api/ai/lampiran', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				lampiranError = body?.message || 'Gagal generate lampiran.';
				return;
			}
			const g = body?.data?.generated as Lampiran | null;
			if (!g) {
				lampiranError = 'AI tidak menghasilkan lampiran. Coba lagi.';
				return;
			}
			lampiran = g;
		} catch {
			lampiranError = 'Terjadi kesalahan saat menghubungi layanan AI. Coba lagi.';
		} finally {
			lampiranGenerating = false;
		}
	}

	async function handleLampiranPdf() {
		const payload = lampiranPdfPayload();
		if (!payload) return;
		printing = true;
		resetError();
		try {
			const response = await fetch('/api/pdf/lampiran', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				errorMessage = body?.message || 'Gagal membuat PDF lampiran.';
				return;
			}
			const blob = await response.blob();
			if (pdfUrl) URL.revokeObjectURL(pdfUrl);
			pdfUrl = URL.createObjectURL(blob);
			pdfTitle = 'Lampiran RPM';
			pdfOpen = true;
		} catch {
			errorMessage = 'Terjadi kesalahan saat membuat PDF lampiran.';
		} finally {
			printing = false;
		}
	}

	async function handleCombinePdf() {
		const rpm = rpmPdfPayload();
		const lampiran = lampiranPdfPayload();
		if (!rpm || !lampiran) return;
		combiningPdf = true;
		resetError();
		try {
			const response = await fetch('/api/pdf/combine', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rpm, lampiran })
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				errorMessage = body?.message || 'Gagal menggabungkan PDF.';
				return;
			}
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = 'rpm-dan-lampiran.pdf';
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			window.setTimeout(() => URL.revokeObjectURL(url), 1000);
			toast('PDF RPM + Lampiran diunduh.', 'success');
		} catch {
			errorMessage = 'Terjadi kesalahan saat menggabungkan PDF.';
		} finally {
			combiningPdf = false;
		}
	}

	function handleLampiranJson() {
		if (!generated || !kelasAktif || !lampiran) return;
		const payload = {
			mapelNama,
			kelas: kelasAktif.nama,
			fase: kelasAktif.fase ?? null,
			lingkupMateri: lingkupMateri.trim(),
			tujuanPembelajaran: generated.tujuanPembelajaran.length
				? generated.tujuanPembelajaran
				: selectedTps.map((tp) => tp.deskripsi),
			formatif: lampiran.formatif,
			sumatif: lampiran.sumatif,
			lkpd: lampiran.lkpd
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'lampiran-rpm.json';
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
		toast('Lampiran RPM diunduh.', 'success');
	}

	function strOrEmpty(v: unknown): string {
		return typeof v === 'string' ? v : '';
	}

	async function handleImportFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		importError = '';
		let text: string;
		try {
			text = await file.text();
		} catch {
			importError = 'Gagal membaca file.';
			return;
		}
		restoreFromJson(text);
	}

	function restoreFromJson(text: string) {
		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(text) as Record<string, unknown>;
		} catch {
			importError = 'File bukan JSON yang valid.';
			return;
		}

		const g = payload;
		if (typeof g.model !== 'string' || typeof g.kegiatanAwal !== 'string') {
			importError = 'File bukan hasil generate RPM (format tidak sesuai).';
			return;
		}

		const next: Generated = {
			karakteristik: strOrEmpty(g.karakteristik),
			model: strOrEmpty(g.model),
			lintasDisiplinIlmu: strOrEmpty(g.lintasDisiplinIlmu),
			kemitraanPembelajaran: strOrEmpty(g.kemitraanPembelajaran),
			lingkunganPembelajaran: strOrEmpty(g.lingkunganPembelajaran),
			pemanfaatanDigital: strOrEmpty(g.pemanfaatanDigital),
			kegiatanAwal: strOrEmpty(g.kegiatanAwal),
			memahami: strOrEmpty(g.memahami),
			mengaplikasi: strOrEmpty(g.mengaplikasi),
			merefleksi: strOrEmpty(g.merefleksi),
			penutup: strOrEmpty(g.penutup),
			asesmen: Array.isArray(g.asesmen) ? (g.asesmen as unknown[]).map(String).filter(Boolean) : [],
			tujuanPembelajaran: Array.isArray(g.tujuanPembelajaran)
				? (g.tujuanPembelajaran as unknown[]).map(String).filter(Boolean)
				: []
		};
		generated = next;

		// Pulihkan input terkait (agar preview & cetak konsisten).
		lingkupMateri = strOrEmpty(g.lingkupMateri);
		capaianPembelajaran = strOrEmpty(g.capaianPembelajaran);
		karakteristikInput = strOrEmpty(g.karakteristik);

		const mapelNama = strOrEmpty(g.mapelNama);
		if (mapelNama) {
			const match = data.mapelList.find((m) => m.nama === mapelNama);
			if (match) {
				mapelId = match.id;
				agamaKey = '';
			} else {
				// Varian agama (PABP) — cari di agamaOptions agar agamaKey ikut terisi.
				const agamaMatch = agamaOptions.find((o) => o.nama === mapelNama);
				if (agamaMatch) {
					mapelId = agamaMatch.mapelId;
					agamaKey = agamaMatch.key;
				}
			}
		}

		const labelToKey = new Map<string, string>();
		for (const [key, label] of Object.entries(profilPelajarPancasilaDimensionLabelByKey)) {
			labelToKey.set(label, key);
		}
		const dims = Array.isArray(g.dimensiProfilLulusan)
			? (g.dimensiProfilLulusan as unknown[]).map(String)
			: [];
		profilLulusan = dims
			.map((l) => (labelToKey.get(l) ?? '') as DimensiProfilLulusanKey)
			.filter(Boolean);

		const tps = Array.isArray(g.tujuanPembelajaran)
			? (g.tujuanPembelajaran as unknown[]).map(String)
			: [];
		tpIds = tps
			.map((d) => data.tujuanPembelajaranList.find((tp) => tp.deskripsi === d)?.id)
			.filter((id): id is number => typeof id === 'number');

		importOpen = false;
		importError = '';
		toast('Import berhasil. Periksa hasil, lalu cetak ke PDF.', 'success');
	}
</script>

<div class="space-y-5">
	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800"
		>
			<div>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Generate RPM (Rencana Pembelajaran Mendalam)
				</h1>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Buat RPM Kurikulum Merdeka terstruktur dengan bantuan AI, lalu periksa sebelum dicetak.
				</p>
			</div>
			<button
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				type="button"
				onclick={() => (importOpen = true)}
			>
				<Icon name="import" class="h-3.5 w-3.5" />
				Import JSON
			</button>
		</div>
		<p class="mb-4 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
			Buat Rencana Pembelajaran Mendalam (RPM) Kurikulum Merdeka berbasis Capaian Pembelajaran, mata
			pelajaran, lingkup materi, tujuan pembelajaran, karakteristik murid, dan Dimensi Profil
			Lulusan pilihan Anda. Teks dihasilkan AI dalam bahasa Indonesia sesuai EYD, terstruktur,
			ringkas, dan jelas, serta hasilnya dapat diperiksa dan disunting sebelum dicetak ke PDF.
		</p>

		{#if aiStatus === 'checking'}
			<div
				class="mb-4 flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
			>
				<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
				<span>Memeriksa ketersediaan fitur AI...</span>
			</div>
		{:else if aiStatus === 'unconfigured'}
			<div
				class="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
				role="alert"
			>
				<Icon name="warning" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
				<span>
					{#if isAdminUserState}
						Fitur AI belum aktif. Setel kunci API di
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- deep link to settings page AI key card -->
						<a
							class="font-semibold underline hover:text-amber-700 dark:hover:text-amber-100"
							href="/pengaturan#ai-key">Pengaturan</a
						>.
					{:else}
						Fitur AI belum aktif. Hubungi admin sekolah untuk mengaktifkannya.
					{/if}
				</span>
			</div>
		{/if}

		{#if !generated}
			<div class="flex flex-col gap-4">
				{#snippet mapel_and_agama()}
					<div>
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Mata Pelajaran di Kelas Aktif</span
						>
						{#if data.mapelList.length === 0}
							<p class="text-xs text-slate-500 dark:text-zinc-400">
								Belum ada mata pelajaran di kelas aktif ini.
							</p>
						{:else}
							<div class="relative flex items-center">
								<select
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
									value={mapelId}
									onchange={handleMapelChange}
								>
									<option value={0} disabled>Pilih mata pelajaran...</option>
									{#each data.mapelList as m (m.id)}
										<option value={m.id}>{m.nama}</option>
									{/each}
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3.5 w-3.5" />
								</span>
							</div>
						{/if}
					</div>

					{#if showAgamaSelect}
						<div>
							<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Agama</span
							>
							{#if !agamaOptions.length}
								<p class="text-xs text-slate-500 dark:text-zinc-400">
									Tidak ada varian agama untuk Pendidikan Agama dan Budi Pekerti di kelas ini.
								</p>
							{:else}
								<div class="relative flex items-center">
									<select
										class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
										bind:value={agamaKey}
										onchange={() => {
											lingkupMateri = '';
											tpIds = [];
										}}
									>
										<option value="">Pilih agama...</option>
										{#each agamaOptions as o (o.key)}
											<option value={o.key}>{o.label}</option>
										{/each}
									</select>
									<span
										aria-hidden="true"
										class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
									>
										<Icon name="down" class="h-3.5 w-3.5" />
									</span>
								</div>
							{/if}
						</div>
					{/if}
				{/snippet}

				{#if showAgamaSelect}
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{@render mapel_and_agama()}
					</div>
				{:else}
					{@render mapel_and_agama()}
				{/if}

				<div
					class="flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
					role="note"
				>
					<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
					<span>
						Khusus sekolah negeri, pastikan menggunakan Capaian Pembelajaran dari
						{#if isAgamaFamily}
							<a
								class="font-semibold underline hover:text-blue-700 dark:hover:text-blue-100"
								href="https://drive.google.com/file/d/1kZnNYVitjQQqHtqVHGhuiMTdNFDqF3v1/view"
								target="_blank"
								rel="noreferrer">Keputusan Kepala BKPDM Nomor 020 Tahun 2026</a
							>
						{:else}
							<a
								class="font-semibold underline hover:text-blue-700 dark:hover:text-blue-100"
								href="https://uploads.belajar.id/document/files/Kepka_BSKAP_No_01k17e8396ajn15j3hcw0k773b.pdf"
								target="_blank"
								rel="noreferrer">Keputusan Kepala BSKAP Nomor 046 tahun 2025</a
							>
						{/if}
						.
					</span>
				</div>

				<div>
					<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Capaian Pembelajaran</span
					>
					<textarea
						class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						bind:value={capaianPembelajaran}
						placeholder="Tempel atau tulis Capaian Pembelajaran (CP) yang akan dijadikan dasar penyusunan RPM"
						rows="6"></textarea>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Lingkup Materi</span
						>
						<div class="relative flex items-center">
							<select
								class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								value={lingkupMateri}
								onchange={handleLingkupChange}
								disabled={!selectedMapel || lingkupOptions.length === 0}
							>
								<option value="">Pilih lingkup materi...</option>
								{#each lingkupOptions as lm (lm)}
									<option value={lm}>{lm}</option>
								{/each}
							</select>
							<span
								aria-hidden="true"
								class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
							>
								<Icon name="down" class="h-3.5 w-3.5" />
							</span>
						</div>
					</div>

					<div>
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Karakteristik Murid (opsional)</span
						>
						<textarea
							class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
							bind:value={karakteristikInput}
							placeholder="Kosongkan untuk digenerate otomatis oleh AI, mis. siswa kelas aktif dengan latar belakang kemampuan beragam"
							rows="4"></textarea>
					</div>
				</div>

				<div>
					<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
						Tujuan Pembelajaran (bisa lebih dari satu)
					</span>
					{#if !selectedMapel}
						<p class="text-xs text-slate-500 dark:text-zinc-400">
							Pilih mata pelajaran terlebih dahulu.
						</p>
					{:else if tpOptions.length === 0}
						<p class="text-xs text-slate-500 dark:text-zinc-400">
							Belum ada tujuan pembelajaran pada lingkup materi ini.
						</p>
					{:else}
						<div
							class="flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
						>
							{#each tpOptions as tp (tp.id)}
								<label
									class="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700 dark:text-zinc-200"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-sm mt-0.5"
										checked={tpIds.includes(tp.id)}
										onchange={(event) =>
											toggleTp(tp.id, (event.currentTarget as HTMLInputElement).checked)}
									/>
									<span>{tp.deskripsi}</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>

				<div>
					<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
						Dimensi Profil Lulusan (pilih satu atau lebih)
					</span>
					<div
						class="flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
					>
						{#each DIMENSI_PROFIL_LULUSAN_OPTIONS as opt (opt.key)}
							<label
								class="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700 dark:text-zinc-200"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-sm mt-0.5"
									checked={profilLulusan.includes(opt.key)}
									onchange={(event) =>
										toggleDimensi(opt.key, (event.currentTarget as HTMLInputElement).checked)}
								/>
								<span>{opt.label}</span>
							</label>
						{/each}
					</div>
					<p class="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
						Pilih Dimensi Profil Lulusan yang relevan, sama seperti pada halaman Kokurikuler.
					</p>
				</div>

				<div>
					<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Prompt Tambahan untuk AI (opsional)</span
					>
					<textarea
						class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						bind:value={inputCustom}
						placeholder="contoh: aku ingin ada kemitraan pembelajaran dengan pihak puskesmas dengan kegiatan wawancara antara murid dan nakes"
						rows="3"></textarea>
					<p class="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
						Ketentuan/permintaan tambahan yang akan memengaruhi hasil generate, mis. "Saya ingin ada
						kegiatan ice breaking yang menyenangkan", "gunakan model pembelajaran Problem Based
						Learning", atau "perinci langkah pembelajarannya". Tidak dicetak langsung, hanya menjadi
						acuan AI.
					</p>
				</div>

				{#if errorMessage}
					<div
						class="flex items-center gap-2.5 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
						role="alert"
						aria-live="polite"
					>
						<Icon name="error" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
						<span>{errorMessage}</span>
					</div>
				{/if}

				<div class="flex justify-end gap-2">
					<button
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
						type="button"
						onclick={handleGenerate}
						disabled={generating || !canGenerate}
						aria-disabled={generating || !canGenerate}
						aria-busy={generating}
						title={canGenerate ? undefined : generateTitle}
					>
						{#if generating}
							<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
						{:else}
							<Icon name="sparkles" class="h-3.5 w-3.5" />
						{/if}
						Generate RPM
					</button>
				</div>
			</div>
		{:else}
			{@const g = generated}
			{#snippet field_item(label: string, key: StringFieldKey, rows = 4)}
				<div class="grid gap-1.5 sm:grid-cols-[11rem_1fr] sm:items-start">
					<span class="text-xs font-semibold text-slate-700 sm:pt-2 dark:text-zinc-300"
						>{label}</span
					>
					<textarea
						class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						{rows}
						value={g[key] as string}
						oninput={(event) =>
							updateGenerated(key, (event.currentTarget as HTMLTextAreaElement).value)}></textarea>
				</div>
			{/snippet}

			<p class="mb-3 text-xs text-slate-500 dark:text-zinc-400">
				Hasil generate sementara. Silakan periksa dan perbaiki bagian yang diinginkan sebelum
				mencetak PDF.
			</p>

			<div class="flex flex-col gap-4">
				<div
					class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
				>
					<h2 class="mb-3 text-sm font-bold text-slate-900 dark:text-zinc-100">Identifikasi</h2>
					<div class="flex flex-col gap-4">
						<div class="grid gap-1.5 sm:grid-cols-[11rem_1fr] sm:items-start">
							<span class="text-xs font-semibold text-slate-700 sm:pt-2 dark:text-zinc-300"
								>Peserta Didik</span
							>
							<div>
								<p class="text-xs font-medium text-slate-700 dark:text-zinc-200">
									{kelasLabelFase}
								</p>
								<textarea
									class="mt-2 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
									rows="2"
									value={g.karakteristik}
									oninput={(event) =>
										updateGenerated(
											'karakteristik',
											(event.currentTarget as HTMLTextAreaElement).value
										)}
									placeholder="Karakteristik peserta didik"></textarea>
							</div>
						</div>

						<div class="grid gap-1.5 sm:grid-cols-[11rem_1fr] sm:items-start">
							<span class="text-xs font-semibold text-slate-700 sm:pt-1 dark:text-zinc-300"
								>Materi Pelajaran</span
							>
							<div class="pt-1 text-xs text-slate-800 dark:text-zinc-200">{lingkupMateri}</div>
						</div>

						<div class="grid gap-1.5 sm:grid-cols-[11rem_1fr] sm:items-start">
							<span class="text-xs font-semibold text-slate-700 sm:pt-2 dark:text-zinc-300"
								>Dimensi Profil Lulusan</span
							>
							<div
								class="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
							>
								{#each DIMENSI_PROFIL_LULUSAN_OPTIONS as opt (opt.key)}
									<label
										class="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700 dark:text-zinc-200"
									>
										<input
											type="checkbox"
											class="checkbox checkbox-sm mt-0.5"
											checked={profilLulusan.includes(opt.key)}
											onchange={(event) =>
												toggleDimensi(opt.key, (event.currentTarget as HTMLInputElement).checked)}
										/>
										<span>{opt.label}</span>
									</label>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<div
					class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
				>
					<h2 class="mb-3 text-sm font-bold text-slate-900 dark:text-zinc-100">
						Desain Pembelajaran
					</h2>
					<div class="flex flex-col gap-4">
						<div class="grid gap-1.5 sm:grid-cols-[11rem_1fr] sm:items-start">
							<span class="text-xs font-semibold text-slate-700 sm:pt-2 dark:text-zinc-300"
								>Capaian Pembelajaran</span
							>
							<textarea
								class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								rows="4"
								value={capaianPembelajaran}
								oninput={(event) =>
									(capaianPembelajaran = (event.currentTarget as HTMLTextAreaElement).value)}
							></textarea>
						</div>

						<div class="grid gap-1.5 sm:grid-cols-[11rem_1fr] sm:items-start">
							<span class="text-xs font-semibold text-slate-700 sm:pt-1 dark:text-zinc-300"
								>Topik Pembelajaran</span
							>
							<div class="pt-1 text-xs text-slate-800 dark:text-zinc-200">{lingkupMateri}</div>
						</div>

						<div class="grid gap-1.5 sm:grid-cols-[11rem_1fr] sm:items-start">
							<span class="text-xs font-semibold text-slate-700 sm:pt-1 dark:text-zinc-300"
								>Tujuan Pembelajaran</span
							>
							<div class="flex flex-col gap-1 pt-1 text-xs text-slate-700 dark:text-zinc-200">
								{#if g.tujuanPembelajaran?.length}
									{#each g.tujuanPembelajaran as tp, idx (idx)}
										<span>{idx + 1}. {tp}</span>
									{/each}
								{:else}
									{#each selectedTps as tp, idx (tp.id)}
										<span>{idx + 1}. {tp.deskripsi}</span>
									{:else}
										<span class="text-slate-400 italic dark:text-zinc-500"
											>Belum ada tujuan pembelajaran dipilih.</span
										>
									{/each}
								{/if}
							</div>
						</div>

						{@render field_item('Lintas Disiplin Ilmu', 'lintasDisiplinIlmu')}
						{@render field_item('Praktis Pedagogis (Model/Strategi)', 'model', 5)}
						{@render field_item('Kemitraan Pembelajaran', 'kemitraanPembelajaran')}
						{@render field_item('Lingkungan Pembelajaran', 'lingkunganPembelajaran')}
						{@render field_item('Pemanfaatan Digital', 'pemanfaatanDigital')}
					</div>
				</div>

				<div
					class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
				>
					<h2 class="mb-3 text-sm font-bold text-slate-900 dark:text-zinc-100">
						Pengalaman Belajar
					</h2>
					<div class="flex flex-col gap-4">
						{@render field_item('Kegiatan Awal', 'kegiatanAwal', 5)}
						{@render field_item('Memahami (Berkesadaran, Bermakna)', 'memahami', 5)}
						{@render field_item('Mengaplikasi (Bermakna, Menyenangkan)', 'mengaplikasi', 5)}
						{@render field_item('Merefleksi (Berkesadaran, Bermakna)', 'merefleksi', 5)}
						{@render field_item('Penutup Bermakna, Menggembirakan', 'penutup', 5)}
					</div>
				</div>

				<div
					class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
				>
					<h2 class="mb-3 text-sm font-bold text-slate-900 dark:text-zinc-100">
						Asesmen Pembelajaran
					</h2>
					<div class="flex flex-col gap-4">
						{#if g.asesmen.length}
							{#each g.asesmen as a, i (i)}
								<div class="grid gap-1.5 sm:grid-cols-[11rem_1fr] sm:items-start">
									<span class="text-xs font-semibold text-slate-700 sm:pt-2 dark:text-zinc-300"
										>Assessment for Learning ({i + 1})</span
									>
									<textarea
										class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
										rows="5"
										value={a}
										oninput={(event) => {
											const next = [...g.asesmen];
											next[i] = (event.currentTarget as HTMLTextAreaElement).value;
											updateGenerated('asesmen', next);
										}}></textarea>
								</div>
							{/each}
						{:else}
							<p class="text-xs text-slate-400 italic dark:text-zinc-500">Belum ada assessment.</p>
						{/if}
					</div>
				</div>
			</div>

			{#if errorMessage}
				<div
					class="mt-4 flex items-center gap-2.5 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
					role="alert"
					aria-live="polite"
				>
					<Icon name="error" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
					<span>{errorMessage}</span>
				</div>
			{/if}

			<div
				class="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
			>
				<div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
					<button
						class="inline-flex h-9 w-full items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						type="button"
						onclick={handleBack}
					>
						Kembali ke Form
					</button>
					<button
						class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						type="button"
						onclick={handleDownloadJson}
					>
						<Icon name="download" class="h-3.5 w-3.5" />
						Unduh JSON
					</button>
				</div>
				<button
					class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:bg-blue-500 dark:hover:bg-blue-600"
					type="button"
					onclick={handlePrintPdf}
					disabled={printing}
					aria-busy={printing}
				>
					{#if printing}
						<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
					{:else}
						<Icon name="print" class="h-3.5 w-3.5" />
					{/if}
					Cetak PDF
				</button>
			</div>
		{/if}
	</section>

	{#if generated}
		{#if !lampiran}
			<section
				class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div
					class="mb-3 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-zinc-800"
				>
					<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
						Lampiran RPM
					</h2>
					<div class="flex flex-wrap gap-2 sm:justify-end">
						<button
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
							type="button"
							onclick={handleGenerateLampiran}
							disabled={lampiranGenerating}
							aria-busy={lampiranGenerating}
						>
							{#if lampiranGenerating}
								<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
							{:else}
								<Icon name="sparkles" class="h-3.5 w-3.5" />
							{/if}
							Generate Lampiran
						</button>
						<button
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							type="button"
							onclick={handleLampiranImport}
						>
							<Icon name="import" class="h-3.5 w-3.5" />
							Import JSON
						</button>
					</div>
				</div>
				<p class="mb-3 text-xs text-slate-500 dark:text-zinc-400">
					Penilaian Formatif &amp; Sumatif (beserta rubrik) serta Lembar Kerja Murid yang disusun
					terkait tujuan pembelajaran dan langkah kegiatan pada RPM.
				</p>

				{#if lampiranError}
					<div
						class="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
						role="alert"
					>
						<Icon name="error" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
						<span>{lampiranError}</span>
					</div>
				{/if}

				<div>
					<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Prompt Tambahan untuk AI (opsional)</span
					>
					<textarea
						class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						rows="2"
						placeholder="contoh: instrumen sumatif menggunakan soal jawaban ganda sebanyak 10 soal"
						value={lampiranCustom}
						oninput={(event) =>
							(lampiranCustom = (event.currentTarget as HTMLTextAreaElement).value)}></textarea>
				</div>
			</section>
		{/if}

		{#if lampiran}
			<section
				class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<h2 class="mb-1 text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Hasil Lampiran
				</h2>
				<p class="mb-4 text-xs text-slate-500 dark:text-zinc-400">
					Hasil lampiran dapat disunting sebelum dicetak. Rubrik otomatis menjadi tabel di PDF.
				</p>
				<div class="flex flex-col gap-4">
					<div
						class="space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
					>
						<h3 class="text-xs font-bold text-slate-900 dark:text-zinc-100">Penilaian Formatif</h3>
						<span class="block text-[11px] font-medium text-slate-500 dark:text-zinc-400"
							>Uraian Teknik &amp; Pelaksanaan</span
						>
						<textarea
							class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							rows="3"
							value={lampiran.formatif.uraian}
							oninput={(event) => {
								const cur = lampiran as Lampiran;
								lampiran = {
									...cur,
									formatif: {
										...cur.formatif,
										uraian: (event.currentTarget as HTMLTextAreaElement).value
									}
								};
							}}></textarea>
						<span class="block text-[11px] font-medium text-slate-500 dark:text-zinc-400"
							>Instrumen Asesmen</span
						>
						<textarea
							class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							rows="6"
							value={lampiran.formatif.instrumen}
							oninput={(event) => {
								const cur = lampiran as Lampiran;
								lampiran = {
									...cur,
									formatif: {
										...cur.formatif,
										instrumen: (event.currentTarget as HTMLTextAreaElement).value
									}
								};
							}}></textarea>
						{#if lampiran.formatif.rubrik.length}
							<p class="text-[11px] text-slate-500 dark:text-zinc-400">
								Rubrik ({lampiran.formatif.rubrik.length} aspek) ditampilkan sebagai tabel di PDF.
							</p>
						{/if}
					</div>
					<div
						class="space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
					>
						<h3 class="text-xs font-bold text-slate-900 dark:text-zinc-100">Penilaian Sumatif</h3>
						<span class="block text-[11px] font-medium text-slate-500 dark:text-zinc-400"
							>Uraian Teknik &amp; Pelaksanaan</span
						>
						<textarea
							class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							rows="3"
							value={lampiran.sumatif.uraian}
							oninput={(event) => {
								const cur = lampiran as Lampiran;
								lampiran = {
									...cur,
									sumatif: {
										...cur.sumatif,
										uraian: (event.currentTarget as HTMLTextAreaElement).value
									}
								};
							}}></textarea>
						<span class="block text-[11px] font-medium text-slate-500 dark:text-zinc-400"
							>Instrumen Asesmen</span
						>
						<textarea
							class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							rows="6"
							value={lampiran.sumatif.instrumen}
							oninput={(event) => {
								const cur = lampiran as Lampiran;
								lampiran = {
									...cur,
									sumatif: {
										...cur.sumatif,
										instrumen: (event.currentTarget as HTMLTextAreaElement).value
									}
								};
							}}></textarea>
						{#if lampiran.sumatif.rubrik.length}
							<p class="text-[11px] text-slate-500 dark:text-zinc-400">
								Rubrik ({lampiran.sumatif.rubrik.length} aspek) ditampilkan sebagai tabel di PDF.
							</p>
						{/if}
					</div>
					<div>
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Lembar Kerja Murid (LKPD)</span
						>
						<textarea
							class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							rows="8"
							value={lampiran.lkpd}
							oninput={(event) => {
								const cur = lampiran as Lampiran;
								lampiran = { ...cur, lkpd: (event.currentTarget as HTMLTextAreaElement).value };
							}}></textarea>
					</div>
				</div>
				<div
					class="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
				>
					<div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
						<button
							class="inline-flex h-9 w-full items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							type="button"
							onclick={handleLampiranBack}
						>
							Kembali ke Form
						</button>
						<button
							class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							type="button"
							onclick={handleLampiranJson}
						>
							<Icon name="download" class="h-3.5 w-3.5" />
							Unduh JSON
						</button>
					</div>
					<div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
						<button
							class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:bg-blue-500 dark:hover:bg-blue-600"
							type="button"
							onclick={handleLampiranPdf}
							disabled={printing}
							aria-busy={printing}
						>
							{#if printing}
								<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
							{:else}
								<Icon name="print" class="h-3.5 w-3.5" />
							{/if}
							Cetak PDF
						</button>
						<button
							class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							type="button"
							onclick={handleCombinePdf}
							disabled={combiningPdf}
							aria-busy={combiningPdf}
						>
							{#if combiningPdf}
								<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
							{:else}
								<Icon name="download" class="h-3.5 w-3.5" />
							{/if}
							Combine PDF
						</button>
					</div>
				</div>
			</section>
		{/if}
	{/if}
</div>

<dialog
	class="modal bg-slate-950/45 backdrop-blur-[2px]"
	open={importOpen}
	onclose={() => (importOpen = false)}
>
	<div
		class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<h3 class="mb-2 text-base font-bold text-slate-900 dark:text-zinc-100">
			Import Hasil Generate (JSON)
		</h3>
		<p class="mb-3 text-xs text-slate-500 dark:text-zinc-400">
			Pilih file <code class="font-mono font-semibold">.json</code> hasil unduhan untuk mengembalikan
			hasil generate, lalu periksa dan cetak ke PDF.
		</p>
		<input
			type="file"
			accept="application/json,.json"
			class="file-input file-input-bordered w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
			onchange={handleImportFile}
		/>
		{#if importError}
			<div
				class="mt-3 flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/80 px-3.5 py-2.5 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
				role="alert"
			>
				<Icon name="error" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
				<span>{importError}</span>
			</div>
		{/if}
		<div class="mt-5 flex justify-end border-t border-slate-100 pt-4 dark:border-zinc-800">
			<button
				class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				type="button"
				onclick={() => (importOpen = false)}
			>
				Batal
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop bg-transparent">
		<button aria-label="Tutup">close</button>
	</form>
</dialog>

<PdfPreviewModal
	{pdfUrl}
	{pdfTitle}
	bind:open={pdfOpen}
	onDownload={handlePdfDownload}
	onClose={handlePdfClose}
/>
