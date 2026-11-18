<script lang="ts">
	import { page } from '$app/state';
	import PreviewHeader from '$lib/components/cetak/PreviewHeader.svelte';
	import DocumentMuridSelector from '$lib/components/cetak/DocumentMuridSelector.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { DEFAULT_RAPOR_CRITERIA, type RaporPeriode } from '$lib/rapor-params';

	type DocumentType =
		| 'cover'
		| 'biodata'
		| 'rapor'
		| 'piagam'
		| 'jurnal-mengajar'
		| 'buku-tamu'
		| 'presensi-guru'
		| 'laporan-tpp';
	type MuridData = {
		id: number;
		nama: string;
		nis?: string | null;
		nisn?: string | null;
	};

	let { data } = $props();

	const userType = $derived((page.data.user as { type?: string } | null)?.type);
	const activeModul = $derived(
		(page.data as { activeModul?: 'admin' | 'wali_kelas' | 'guru' } | null)?.activeModul ??
			(userType === 'user' ? 'guru' : userType === 'wali_kelas' ? 'wali_kelas' : 'admin')
	);

	const presensiGuruEnabled = $derived(
		(page.data as { presensiGuruEnabled?: boolean } | null)?.presensiGuruEnabled ?? true
	);

	const documentOptions = $derived.by<Array<{ value: DocumentType; label: string }>>(() => {
		const all: Array<{ value: DocumentType; label: string }> = [
			{ value: 'cover', label: 'Cover' },
			{ value: 'biodata', label: 'Biodata' },
			{ value: 'rapor', label: 'Rapor' },
			{ value: 'piagam', label: 'Piagam' },
			{ value: 'jurnal-mengajar', label: 'Jurnal Mengajar' },
			{ value: 'buku-tamu', label: 'Buku Tamu' },
			{ value: 'presensi-guru', label: 'Presensi Guru' },
			{ value: 'laporan-tpp', label: 'Laporan TPP' }
		];
		const visible = all.filter(
			(o) => !((o.value === 'presensi-guru' || o.value === 'laporan-tpp') && !presensiGuruEnabled)
		);
		if (activeModul === 'guru' || (userType === 'user' && activeModul !== 'wali_kelas')) {
			return visible.filter((o) => o.value === 'jurnal-mengajar');
		}
		if (activeModul === 'wali_kelas' || (userType !== 'admin' && userType !== 'kepala_sekolah')) {
			return visible.filter(
				(o) => o.value !== 'presensi-guru' && o.value !== 'buku-tamu' && o.value !== 'laporan-tpp'
			);
		}
		return visible;
	});

	let selectedDocument = $state<DocumentType | ''>('');

	$effect(() => {
		if (selectedDocument && !documentOptions.some((option) => option.value === selectedDocument)) {
			selectedDocument = '';
		}
	});
	let selectedRaporPeriode = $state<RaporPeriode | ''>('');
	let selectedTemplate = $state<'1' | '2'>('1');
	let searchTerm = $state('');
	let showBgLogo = $state(true);
	let downloadLoading = $state(false);

	// show TP listing: 'compact' | 'full-desc'
	let fullTP = $state<'compact' | 'full-desc'>('compact');

	let kritCukup = $state<number>(DEFAULT_RAPOR_CRITERIA.kritCukup);
	let kritBaik = $state<number>(DEFAULT_RAPOR_CRITERIA.kritBaik);
	let kriteriaVersion = $state(0);

	const aktifKelasId = $derived(data.kelasId ? Number(data.kelasId) : null);

	$effect(() => {
		const kelasId = aktifKelasId;
		const version = kriteriaVersion;
		let cancelled = false;
		fetch(`/api/sekolah/rapor-kriteria${kelasId ? `?kelas_id=${kelasId}` : ''}`)
			.then(async (res) => {
				if (!res.ok) return null;
				return await res.json();
			})
			.then((json) => {
				if (cancelled || !json) return;
				if (version !== kriteriaVersion) return;
				const lc = json?.cukup;
				const lb = json?.baik;
				if (lc !== undefined && !Number.isNaN(Number(lc))) kritCukup = Number(lc);
				if (lb !== undefined && !Number.isNaN(Number(lb))) kritBaik = Number(lb);
			})
			.catch(() => {
				// ignore
			});
		return () => {
			cancelled = true;
		};
	});

	// Jurnal mengajar date range
	let jurnalTanggalMulai = $state('');
	let jurnalTanggalSelesai = $state('');

	// Buku tamu date range
	let bukuTamuTanggalMulai = $state('');
	let bukuTamuTanggalSelesai = $state('');

	// Presensi guru month/year
	let presensiBulan = $state(new Date().getMonth() + 1);
	let presensiTahun = $state(new Date().getFullYear());

	// Laporan TPP month/year/status
	let laporanBulan = $state(new Date().getMonth() + 1);
	let laporanTahun = $state(new Date().getFullYear());
	let statusKepegawaian = $state<'PNS' | 'PPPK'>('PNS');

	$effect(() => {
		jurnalTanggalMulai = data.tanggalMasuk || '';
		jurnalTanggalSelesai = data.tanggalBagiRaport || '';
		bukuTamuTanggalMulai = data.tanggalMasuk || '';
		bukuTamuTanggalSelesai = data.tanggalBagiRaport || '';
	});
	const isJurnalMengajar = $derived(selectedDocument === 'jurnal-mengajar');
	const isBukuTamu = $derived(selectedDocument === 'buku-tamu');
	const isPiagamSelected = $derived(selectedDocument === 'piagam');
	const isPresensiGuru = $derived(selectedDocument === 'presensi-guru');
	const isLaporanTpp = $derived(selectedDocument === 'laporan-tpp');

	const academicContext = $derived(data.academicContext ?? null);
	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return null;
		return kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
	});

	const piagamRankingOptions = $derived(data.piagamRankingOptions ?? []);
	const hasPiagamRankingOptions = $derived(piagamRankingOptions.length > 0);
	const daftarMurid = $derived(data.daftarMurid ?? []);
	const muridCount = $derived(daftarMurid.length);
	const hasMurid = $derived(muridCount > 0);

	const hasSelectionOptions = $derived(
		isJurnalMengajar
			? Boolean(jurnalTanggalMulai && jurnalTanggalSelesai)
			: isBukuTamu
				? Boolean(bukuTamuTanggalMulai && bukuTamuTanggalSelesai)
				: isPiagamSelected
					? hasPiagamRankingOptions
					: isPresensiGuru
						? Boolean(
								presensiBulan >= 1 &&
								presensiBulan <= 12 &&
								presensiTahun >= 2000 &&
								presensiTahun <= 2099
							)
						: isLaporanTpp
							? Boolean(
									laporanBulan >= 1 &&
									laporanBulan <= 12 &&
									laporanTahun >= 2000 &&
									laporanTahun <= 2099 &&
									statusKepegawaian
								)
							: hasMurid
	);

	const downloadDisabled = $derived(!selectedDocument || !hasSelectionOptions || downloadLoading);

	const selectedDocumentEntry = $derived(
		documentOptions.find((option) => option.value === selectedDocument) ?? null
	);

	const headingTitle = $derived.by(() => {
		const parts: string[] = ['Cetak'];
		const label = selectedDocumentEntry?.label?.trim();
		if (label) parts.push(label);
		return parts.join(' - ');
	});

	function handlePreviewJurnal() {
		if (!isJurnalMengajar) return;
		if (!jurnalTanggalMulai || !jurnalTanggalSelesai) {
			toast('Pilih rentang tanggal terlebih dahulu', 'warning');
			return;
		}
		const params = new URLSearchParams({
			tanggal_mulai: jurnalTanggalMulai,
			tanggal_selesai: jurnalTanggalSelesai
		});
		window.open(`/api/pdf/jurnal-mengajar?${params}`, '_blank', 'noopener,noreferrer');
	}

	function handlePreviewBukuTamu() {
		if (!isBukuTamu) return;
		if (!bukuTamuTanggalMulai || !bukuTamuTanggalSelesai) {
			toast('Pilih rentang tanggal terlebih dahulu', 'warning');
			return;
		}
		const params = new URLSearchParams({
			tanggal_mulai: bukuTamuTanggalMulai,
			tanggal_selesai: bukuTamuTanggalSelesai
		});
		window.open(`/api/pdf/buku-tamu?${params}`, '_blank', 'noopener,noreferrer');
	}

	async function handleDownloadLaporanTpp() {
		if (!isLaporanTpp) return;

		downloadLoading = true;
		try {
			const params = new URLSearchParams({
				bulan: String(laporanBulan),
				tahun: String(laporanTahun),
				status: statusKepegawaian
			});
			const res = await fetch(`/api/cetak/laporan-tpp?${params}`);
			if (!res.ok) {
				const errBody = await res.json().catch(() => ({}));
				throw new Error(errBody?.error || 'Gagal membuat Laporan TPP');
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `Laporan-TPP-${laporanTahun}-${String(laporanBulan).padStart(2, '0')}-${statusKepegawaian}.xlsx`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast('Laporan TPP berhasil diunduh.', 'success');
		} catch (err) {
			console.error('Laporan TPP download error:', err);
			toast(err instanceof Error ? err.message : 'Gagal mengunduh Laporan TPP.', 'error');
		} finally {
			downloadLoading = false;
		}
	}

	async function handleDownloadBulk() {
		const documentType = selectedDocument;
		if (!documentType) {
			toast('Pilih dokumen terlebih dahulu', 'warning');
			return;
		}

		let muridList: MuridData[];
		if (isPiagamSelected) {
			muridList = piagamRankingOptions.map((option) => ({
				id: option.muridId,
				nama: option.nama,
				nis: null,
				nisn: null
			}));
		} else {
			muridList = daftarMurid;
		}

		if (!muridList.length) {
			const message = isPiagamSelected
				? 'Tidak ada data peringkat piagam untuk kelas ini.'
				: 'Tidak ada murid di kelas ini.';
			toast(message, 'warning');
			return;
		}

		downloadLoading = true;
		try {
			const res = await fetch('/api/pdf/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					docType: documentType,
					muridIds: muridList.map((m) => m.id),
					kelasId: data.kelasId ? Number(data.kelasId) : undefined,
					tpMode: fullTP === 'full-desc' ? 'full-desc' : undefined,
					criteria: { kritCukup, kritBaik },
					template: documentType === 'piagam' ? selectedTemplate : undefined,
					docLabel: selectedDocumentEntry?.label ?? documentType,
					kelasLabel: kelasAktifLabel ? kelasAktifLabel.replace(/\s+/g, '') : 'Semua-Kelas',
					bgLogo: showBgLogo,
					raporPeriode:
						documentType === 'rapor' && selectedRaporPeriode ? selectedRaporPeriode : undefined
				})
			});

			if (!res.ok) {
				const errBody = await res.json().catch(() => ({}));
				throw new Error(errBody?.message || 'Gagal membuat PDF bulk');
			}

			const blob = await res.blob();
			const filename = `${selectedDocumentEntry?.label || documentType}-${kelasAktifLabel ? kelasAktifLabel.replace(/\s+/g, '') : 'Semua-Kelas'}-${muridList.length}murid.pdf`;
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);

			toast('PDF berhasil dibuat!', 'success');
		} catch (err) {
			console.error('Bulk download error:', err);
			const errorMsg = err instanceof Error ? err.message : 'Gagal membuat PDF';
			toast(errorMsg, 'error');
		} finally {
			downloadLoading = false;
		}
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<PreviewHeader {headingTitle} {kelasAktifLabel} {academicContext} />

	<DocumentMuridSelector
		bind:selectedDocument
		bind:selectedTemplate
		bind:selectedRaporPeriode
		bind:searchTerm
		{daftarMurid}
		{piagamRankingOptions}
		{documentOptions}
		onBulkDownload={handleDownloadBulk}
		{downloadDisabled}
		{downloadLoading}
		bind:jurnalTanggalMulai
		bind:jurnalTanggalSelesai
		bind:bukuTamuTanggalMulai
		bind:bukuTamuTanggalSelesai
		bind:presensiBulan
		bind:presensiTahun
		bind:laporanBulan
		bind:laporanTahun
		bind:statusKepegawaian
		onDownloadLaporanTpp={handleDownloadLaporanTpp}
		muridCount={daftarMurid.length}
		isRaporSelected={selectedDocument === 'rapor'}
		isBiodataSelected={selectedDocument === 'biodata'}
		{kritCukup}
		{kritBaik}
		tpMode={fullTP}
		kelasId={data.kelasId}
		{showBgLogo}
		onToggleBgLogo={(value: boolean) => {
			showBgLogo = value;
		}}
		onSetKriteria={(cukup: number | null, baik: number | null) => {
			if (cukup != null && baik != null) {
				kritCukup = cukup;
				kritBaik = baik;
			}
			fetch('/api/sekolah/rapor-kriteria', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cukup: cukup ?? null,
					baik: baik ?? null,
					kelas_id: aktifKelasId ?? undefined
				})
			})
				.then(async (res) => {
					if (res.ok) {
						const payload = await res.json().catch(() => ({}));
						kriteriaVersion++;
						toast(payload?.message ?? 'Kriteria rapor tersimpan di server.', 'success');
					} else {
						const payload = await res.json().catch(() => ({}));
						console.error('Gagal menyimpan kriteria rapor', payload);
						toast(payload?.error ?? 'Gagal menyimpan kriteria rapor.', 'error');
					}
				})
				.catch((err) => {
					console.error('Error saving kriteria rapor', err);
					toast('Gagal menyimpan kriteria rapor (jaringan).', 'error');
				});
		}}
		onToggleFullTP={(value: 'compact' | 'full-desc') => {
			fullTP = value;
		}}
		onBgRefresh={() => {}}
		onPreviewJurnal={handlePreviewJurnal}
		onPreviewBukuTamu={handlePreviewBukuTamu}
	/>
</div>
