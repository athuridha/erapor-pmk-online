<script lang="ts">
	import { invalidate, goto } from '$app/navigation';
	import MuridPicker from '$lib/components/asesmen-sumatif/murid-picker.svelte';
	import CheatControls from '$lib/components/asesmen-sumatif/cheat-controls.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import LingkupSummaryCard from '$lib/components/asesmen-sumatif/lingkup-summary-card.svelte';
	import NilaiAkhirCard from '$lib/components/asesmen-sumatif/nilai-akhir-card.svelte';
	import SasInputTable from '$lib/components/asesmen-sumatif/sas-input-table.svelte';
	import SasSummaryCard from '$lib/components/asesmen-sumatif/sas-summary-card.svelte';
	import TujuanTable from '$lib/components/asesmen-sumatif/tujuan-table.svelte';
	import type {
		EntryDraft,
		LingkupSummary,
		NilaiAkhirCategory,
		TujuanEntry
	} from '$lib/components/asesmen-sumatif/types';
	import {
		formatScore,
		toInputText,
		toDraft,
		normalizeScoreText,
		isScoreValid
	} from '$lib/components/asesmen-sumatif/utils';

	type PageData = {
		murid: { id: number; nama: string };
		kelasId: number;
		mapelList: { id: number; nama: string }[];
		pickerMapelId: number;
		mapel: { id: number; kkm: number };
		terkunci: boolean;
		dikunciOleh: string | null;
		sumatifWeights: { lingkup: number; sts: number; sas: number };
		sumatifWeightsRts: { lingkup: number; sts: number };
		hasLingkupComplete: boolean;
		hasTujuan: boolean;
		entries: TujuanEntry[];
		initialScores: {
			stsTes: number | null;
			stsNonTes: number | null;
			sasTes: number | null;
			sasNonTes: number | null;
			nilaiAkhir: number | null;
		};
	};

	type SavePayload = {
		tujuanScores: { tujuanPembelajaranId: number; nilai: number | null }[];
		aggregates: {
			naLingkup: number | null;
			stsTes: number | null;
			stsNonTes: number | null;
			sts: number | null;
			sasTes: number | null;
			sasNonTes: number | null;
			sas: number | null;
			nilaiAkhir: number | null;
			nilaiAkhirRts: number | null;
		};
	};

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let entries = $state(data.entries.map(toDraft));
	// svelte-ignore state_referenced_locally
	let sasTesText = $state(
		data.initialScores.sasTes != null ? data.initialScores.sasTes.toFixed(2) : ''
	);
	// svelte-ignore state_referenced_locally
	let sasNonTesText = $state(
		data.initialScores.sasNonTes != null ? data.initialScores.sasNonTes.toFixed(2) : ''
	);
	// Sumatif Tengah Semester (STS) - new inputs, initially empty (backend doesn't persist yet)
	// svelte-ignore state_referenced_locally
	let stsTesText = $state(
		data.initialScores.stsTes != null ? data.initialScores.stsTes.toFixed(2) : ''
	);
	// svelte-ignore state_referenced_locally
	let stsNonTesText = $state(
		data.initialScores.stsNonTes != null ? data.initialScores.stsNonTes.toFixed(2) : ''
	);
	$effect(() => {
		entries = data.entries.map(toDraft);
		sasTesText = data.initialScores.sasTes != null ? data.initialScores.sasTes.toFixed(2) : '';
		sasNonTesText =
			data.initialScores.sasNonTes != null ? data.initialScores.sasNonTes.toFixed(2) : '';
		stsTesText = data.initialScores.stsTes != null ? data.initialScores.stsTes.toFixed(2) : '';
		stsNonTesText =
			data.initialScores.stsNonTes != null ? data.initialScores.stsNonTes.toFixed(2) : '';
	});

	// Pemilih murid & mapel — isDirty dipakai untuk konfirmasi sebelum pindah
	// agar nilai yang belum tersimpan tidak hilang.
	const isDirty = $derived.by(() => {
		if (
			normalizeScoreText(sasTesText) !== data.initialScores.sasTes ||
			normalizeScoreText(sasNonTesText) !== data.initialScores.sasNonTes ||
			normalizeScoreText(stsTesText) !== data.initialScores.stsTes ||
			normalizeScoreText(stsNonTesText) !== data.initialScores.stsNonTes
		) {
			return true;
		}
		return entries.some(
			(entry, i) => normalizeScoreText(entry.nilaiText) !== (data.entries[i]?.nilai ?? null)
		);
	});

	const lingkupSummaries = $derived.by((): LingkupSummary[] => {
		const grouped = new Map<
			string,
			{
				bobot: number | null;
				values: number[];
			}
		>();

		for (const entry of entries) {
			const key = entry.lingkupMateri;
			let group = grouped.get(key);
			if (!group) {
				group = { bobot: entry.bobot ?? null, values: [] };
				grouped.set(key, group);
			} else if (group.bobot == null && entry.bobot != null) {
				group.bobot = entry.bobot;
			}
			const score = normalizeScoreText(entry.nilaiText);
			if (score != null) {
				group.values.push(score);
			}
		}

		return Array.from(grouped.entries(), ([lingkupMateri, group]) => {
			const avg = group.values.length
				? Math.round(
						(group.values.reduce((sum, value) => sum + value, 0) / group.values.length) * 100
					) / 100
				: null;
			return { lingkupMateri, bobot: group.bobot, rataRata: avg } satisfies LingkupSummary;
		});
	});

	const naSumatifLingkup = $derived.by(() => {
		const summaries = lingkupSummaries;
		if (!summaries.length) return null;
		const weighted = summaries.reduce(
			(
				acc,
				item
			): {
				sum: number;
				weight: number;
				fallbackSum: number;
				fallbackCount: number;
			} => {
				if (item.rataRata == null) return acc;
				const bobot = item.bobot ?? 0;
				if (bobot > 0) {
					return {
						sum: acc.sum + item.rataRata * bobot,
						weight: acc.weight + bobot,
						fallbackSum: acc.fallbackSum,
						fallbackCount: acc.fallbackCount
					};
				}
				return {
					sum: acc.sum,
					weight: acc.weight,
					fallbackSum: acc.fallbackSum + item.rataRata,
					fallbackCount: acc.fallbackCount + 1
				};
			},
			{ sum: 0, weight: 0, fallbackSum: 0, fallbackCount: 0 }
		);

		if (weighted.weight > 0) {
			return Math.round((weighted.sum / weighted.weight) * 100) / 100;
		}
		if (weighted.fallbackCount > 0) {
			return Math.round((weighted.fallbackSum / weighted.fallbackCount) * 100) / 100;
		}
		return null;
	});

	const sasTesValue = $derived.by(() => normalizeScoreText(sasTesText));
	const sasNonTesValue = $derived.by(() => normalizeScoreText(sasNonTesText));

	const stsTesValue = $derived.by(() => normalizeScoreText(stsTesText));
	const stsNonTesValue = $derived.by(() => normalizeScoreText(stsNonTesText));

	const nilaiSas = $derived.by(() => {
		const values = [sasTesValue, sasNonTesValue].filter((value): value is number => value != null);
		if (!values.length) return null;
		return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
	});

	const nilaiSts = $derived.by(() => {
		const values = [stsTesValue, stsNonTesValue].filter((value): value is number => value != null);
		if (!values.length) return null;
		return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
	});

	const nilaiAkhir = $derived.by(() => {
		// Determine effective weights using rules:
		// - All present: base weights
		// - STS missing only: lingkup 70 / sas 30
		const base = {
			lingkup: data.sumatifWeights?.lingkup ?? 60,
			sts: data.sumatifWeights?.sts ?? 20,
			sas: data.sumatifWeights?.sas ?? 20
		};
		let eff = nilaiSts == null ? { lingkup: 70, sts: 0, sas: 30 } : base;
		let weighted = 0;
		let totalW = 0;
		if (naSumatifLingkup != null) {
			weighted += naSumatifLingkup * eff.lingkup;
			totalW += eff.lingkup;
		}
		if (nilaiSts != null) {
			weighted += nilaiSts * eff.sts;
			totalW += eff.sts;
		}
		if (nilaiSas != null) {
			weighted += nilaiSas * eff.sas;
			totalW += eff.sas;
		}
		if (totalW === 0) return null;
		return Math.round((weighted / totalW) * 100) / 100;
	});

	// Effective weights used by the UI: if STS not provided, use 70/0/30
	const effectiveSumatifWeights = $derived.by(() => {
		const base = {
			lingkup: data.sumatifWeights?.lingkup ?? 60,
			sts: data.sumatifWeights?.sts ?? 20,
			sas: data.sumatifWeights?.sas ?? 20
		};
		if (nilaiSts == null) return { lingkup: 70, sts: 0, sas: 30 };
		return base;
	});
	const kkm = $derived.by(() => Math.max(0, data.mapel.kkm ?? 0));

	async function pilihMapel(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const mapelId = Number(select.value);
		if (!Number.isInteger(mapelId) || mapelId === data.pickerMapelId) return;
		if (
			isDirty &&
			!confirm(
				'Masih ada perubahan nilai yang belum disimpan. Pindah mapel akan membuangnya. Lanjutkan?'
			)
		) {
			select.value = String(data.pickerMapelId);
			return;
		}
		await goto(`/asesmen-sumatif/formulir-asesmen?murid_id=${data.murid.id}&mapel_id=${mapelId}`, {
			keepFocus: true
		});
	}

	const nilaiAkhirRts = $derived.by(() => {
		const bobot = {
			lingkup: data.sumatifWeightsRts?.lingkup ?? 70,
			sts: data.sumatifWeightsRts?.sts ?? 30
		};
		let weighted = 0;
		let totalW = 0;
		if (naSumatifLingkup != null) {
			weighted += naSumatifLingkup * bobot.lingkup;
			totalW += bobot.lingkup;
		}
		if (nilaiSts != null) {
			weighted += nilaiSts * bobot.sts;
			totalW += bobot.sts;
		}
		if (totalW === 0) return null;
		return Math.round((weighted / totalW) * 100) / 100;
	});

	const nilaiAkhirCategory = $derived.by((): NilaiAkhirCategory | null => {
		const nilai = nilaiAkhir;
		if (nilai == null) return null;
		const baseKkm = Math.max(0, kkm);
		const thresholdCukup = baseKkm * 1.15;
		const thresholdBaik = baseKkm * 1.3;
		if (nilai < baseKkm) {
			return {
				key: 'perlu-bimbingan',
				label: 'Perlu Bimbingan',
				className: 'alert-error',
				icon: 'error',
				description: `Nilai akhir berada di bawah KKM (${formatScore(baseKkm)}).`
			};
		}
		if (nilai < thresholdCukup) {
			return {
				key: 'cukup',
				label: 'Cukup',
				className: 'alert-warning',
				icon: 'alert',
				description: `Nilai akhir berada pada rentang ≥ KKM (${formatScore(baseKkm)}) dan < ${formatScore(thresholdCukup)}.`
			};
		}
		if (nilai < thresholdBaik) {
			return {
				key: 'baik',
				label: 'Baik',
				className: 'alert-success',
				icon: 'check',
				description: `Nilai akhir berada pada rentang ≥ ${formatScore(thresholdCukup)} dan < ${formatScore(thresholdBaik)}.`
			};
		}
		return {
			key: 'sangat-baik',
			label: 'Sangat Baik',
			className: 'alert-info',
			icon: 'info',
			description: `Nilai akhir minimal ${formatScore(thresholdBaik)} (≥ 130% dari KKM).`
		};
	});

	const nilaiAkhirRtsCategory = $derived.by((): NilaiAkhirCategory | null => {
		const nilai = nilaiAkhirRts;
		if (nilai == null) return null;
		const baseKkm = Math.max(0, kkm);
		const thresholdCukup = baseKkm * 1.15;
		const thresholdBaik = baseKkm * 1.3;
		if (nilai < baseKkm) {
			return {
				key: 'perlu-bimbingan',
				label: 'Perlu Bimbingan',
				className: 'alert-error',
				icon: 'error',
				description: `Nilai akhir berada di bawah KKM (${formatScore(baseKkm)}).`
			};
		}
		if (nilai < thresholdCukup) {
			return {
				key: 'cukup',
				label: 'Cukup',
				className: 'alert-warning',
				icon: 'alert',
				description: `Nilai akhir berada pada rentang ≥ KKM (${formatScore(baseKkm)}) dan < ${formatScore(thresholdCukup)}.`
			};
		}
		if (nilai < thresholdBaik) {
			return {
				key: 'baik',
				label: 'Baik',
				className: 'alert-success',
				icon: 'check',
				description: `Nilai akhir berada pada rentang ≥ ${formatScore(thresholdCukup)} dan < ${formatScore(thresholdBaik)}.`
			};
		}
		return {
			key: 'sangat-baik',
			label: 'Sangat Baik',
			className: 'alert-info',
			icon: 'info',
			description: `Nilai akhir minimal ${formatScore(thresholdBaik)} (≥ 130% dari KKM).`
		};
	});

	const totalBobot = $derived.by(() =>
		lingkupSummaries.reduce((sum, item) => sum + (item.bobot ?? 0), 0)
	);

	// svelte-ignore state_referenced_locally
	const kembaliHref = `/asesmen-sumatif?mapel_id=${data.mapel.id}`;

	function getInputClass(value: string) {
		return isScoreValid(value)
			? 'h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'
			: 'h-9 w-full rounded-xl border border-red-400 bg-red-50/40 px-3 text-xs text-red-900 focus:border-red-600 focus:outline-none dark:border-red-700 dark:bg-red-950/30 dark:text-red-200';
	}

	function handleEntryNilaiChange(event: CustomEvent<{ index: number; value: string }>) {
		const { index, value } = event.detail;
		entries = entries.map((entry, idx) => (idx === index ? { ...entry, nilaiText: value } : entry));
	}

	function handleSasChange(
		event: CustomEvent<{ namePrefix?: string; target: 'tes' | 'nonTes'; value: string }>
	) {
		const { namePrefix, target, value } = event.detail;
		const prefix = namePrefix ?? 'sas';
		if (prefix === 'sts') {
			if (target === 'tes') {
				stsTesText = value;
				return;
			}
			stsNonTesText = value;
			return;
		}
		// default: sas (Akhir Semester)
		if (target === 'tes') {
			sasTesText = value;
			return;
		}
		sasNonTesText = value;
	}

	function handleCheatApply(
		event: CustomEvent<{
			entries: EntryDraft[];
			sasTesText: string;
			sasNonTesText: string;
			stsTesText: string;
			stsNonTesText: string;
		}>
	): void {
		const {
			entries: drafts,
			sasTesText: sasTes,
			sasNonTesText: sasNonTes,
			stsTesText: stsTes,
			stsNonTesText: stsNonTes
		} = event.detail;
		entries = drafts;
		sasTesText = sasTes;
		sasNonTesText = sasNonTes;
		stsTesText = stsTes;
		stsNonTesText = stsNonTes;
	}

	async function handleSuccess({ data: result }: { data?: Record<string, unknown> }) {
		const payload = (result?.payload ?? null) as SavePayload | null;
		if (payload) {
			const scoreMap = new Map(
				payload.tujuanScores.map((item) => [item.tujuanPembelajaranId, item.nilai])
			);
			entries = entries.map((entry) => {
				const nilai = scoreMap.has(entry.tujuanPembelajaranId)
					? (scoreMap.get(entry.tujuanPembelajaranId) ?? null)
					: normalizeScoreText(entry.nilaiText);
				return {
					...entry,
					nilai,
					nilaiText: toInputText(nilai)
				};
			});
			stsTesText = toInputText(payload.aggregates.stsTes);
			stsNonTesText = toInputText(payload.aggregates.stsNonTes);
			sasTesText = toInputText(payload.aggregates.sasTes);
			sasNonTesText = toInputText(payload.aggregates.sasNonTes);
		}
		await invalidate('app:asesmen-sumatif');
		await invalidate('app:asesmen-sumatif/formulir');
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<FormEnhance action="?/save" onsuccess={handleSuccess} showToast>
		{#snippet children({ submitting })}
			<input type="hidden" name="muridId" value={data.murid.id} />
			<input type="hidden" name="mapelId" value={data.mapel.id} />

			{#if data.terkunci}
				<div
					class="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200"
				>
					<Icon name="lock" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
					<span>
						Nilai mata pelajaran ini sudah dikunci operator{data.dikunciOleh
							? ` (${data.dikunciOleh})`
							: ''}. Hubungi operator sekolah untuk membuka kunci.
					</span>
				</div>
			{/if}

			<div
				class="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center dark:border-zinc-800"
			>
				<a
					href={kembaliHref}
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				>
					<Icon name="left" class="h-4 w-4" />
					Kembali
				</a>
				<CheatControls
					{entries}
					hasTujuan={data.hasTujuan}
					initialNilaiAkhir={data.initialScores.nilaiAkhir}
					{nilaiAkhir}
					disabled={submitting || data.terkunci}
					on:apply={handleCheatApply}
				/>
				<button
					type="submit"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
					disabled={!data.hasTujuan || !data.hasLingkupComplete || submitting || data.terkunci}
				>
					<Icon name="save" class="h-4 w-4" />
					{submitting ? 'Menyimpan...' : 'Simpan'}
				</button>
			</div>

			<div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
				<div class="relative flex items-center">
					<select
						class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						title="Pilih mata pelajaran"
						aria-label="Pilih mata pelajaran"
						value={data.pickerMapelId}
						onchange={pilihMapel}
					>
						{#each data.mapelList as opsi (opsi.id)}
							<option value={opsi.id}>{opsi.nama}</option>
						{/each}
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</div>
				<MuridPicker
					basePath="/asesmen-sumatif/formulir-asesmen"
					kelasId={data.kelasId}
					muridId={data.murid.id}
					mapelId={data.pickerMapelId}
					getDirty={() => isDirty}
					confirmMessage="Masih ada perubahan nilai yang belum disimpan. Pindah murid akan membuangnya. Lanjutkan?"
				/>
			</div>

			<!-- Bagian 1: Asesmen Sumatif Lingkup Materi -->
			<div class="mt-6 border-t border-slate-200 pt-4 dark:border-zinc-800">
				<div class="flex flex-col gap-1 pb-1 sm:flex-row sm:items-center sm:justify-between">
					<h2 class="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-zinc-100">
						<span>1. Nilai Harian / Sumatif Lingkup Materi</span>
					</h2>
					<span class="text-xs text-slate-600 dark:text-zinc-400">
						Murid: <strong class="text-slate-900 dark:text-zinc-100">{data.murid.nama}</strong>
					</span>
				</div>
				<p class="text-xs text-slate-500 dark:text-zinc-400">
					Isi nilai per Tujuan Pembelajaran (TP) yang dikategorikan berdasarkan teknik penilaian
					(Tes Tulis, Penugasan, Praktik, dll.).
				</p>

				{#if !data.hasTujuan}
					<div
						class="mt-4 flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200"
					>
						<Icon name="info" class="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
						<span>
							Belum ada tujuan pembelajaran untuk mata pelajaran ini. Tambahkan tujuan pembelajaran
							di menu <strong>Intrakurikuler</strong> terlebih dahulu.
						</span>
					</div>
				{:else if !data.hasLingkupComplete}
					<div
						class="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
					>
						<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
						<span>
							Semua kolom <strong>Lingkup Materi</strong> harus diisi sebelum menyimpan penilaian
							sumatif. Silakan lengkapi Lingkup Materi pada menu <strong>Intrakurikuler</strong>.
						</span>
					</div>
				{:else}
					<TujuanTable
						{entries}
						{formatScore}
						{getInputClass}
						on:nilaiChange={handleEntryNilaiChange}
					/>
				{/if}

				<LingkupSummaryCard {naSumatifLingkup} {lingkupSummaries} {totalBobot} {formatScore} />
			</div>

			<!-- Bagian 2: Sumatif Tengah Semester (STS) -->
			<div class="mt-8 border-t border-slate-200 pt-5 dark:border-zinc-800">
				<div class="flex flex-col gap-1 pb-1 sm:flex-row sm:items-center sm:justify-between">
					<h2 class="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-zinc-100">
						<span>2. Sumatif Tengah Semester (STS)</span>
						<span
							class="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
						>
							Opsional
						</span>
					</h2>
				</div>
				<p class="mb-3 text-xs text-slate-500 dark:text-zinc-400">
					Isi nilai ujian tengah semester (Tes & Non-Tes) jika sekolah menyelenggarakan STS.
				</p>
				<SasInputTable
					tesText={stsTesText}
					nonTesText={stsNonTesText}
					namePrefix="sts"
					tesLabel="Nilai Tes Sumatif Tengah Semester (STS)"
					nonTesLabel="Nilai Non Tes Sumatif Tengah Semester (STS)"
					{getInputClass}
					on:sasChange={handleSasChange}
				/>

				<SasSummaryCard
					nilaiSas={nilaiSts}
					{formatScore}
					title="NA Sumatif Tengah Semester"
					subtitle="Rata-rata dari nilai Tes dan Non Tes STS"
				/>
			</div>

			<!-- Bagian 3: Sumatif Akhir Semester (SAS) -->
			<div class="mt-8 border-t border-slate-200 pt-5 dark:border-zinc-800">
				<h2 class="pb-1 text-base font-bold text-slate-900 dark:text-zinc-100">
					3. Sumatif Akhir Semester (SAS)
				</h2>
				<p class="mb-3 text-xs text-slate-500 dark:text-zinc-400">
					Isi nilai tes dan non-tes asesmen sumatif akhir semester (SAS / PAS).
				</p>
				<SasInputTable
					tesText={sasTesText}
					nonTesText={sasNonTesText}
					{getInputClass}
					on:sasChange={handleSasChange}
				/>

				<SasSummaryCard {nilaiSas} {formatScore} />
			</div>

			<!-- Bagian 4: Rekapitulasi Nilai Rapor -->
			<div class="mt-8 border-t border-slate-200 pt-5 dark:border-zinc-800">
				<h2 class="pb-1 text-base font-bold text-slate-900 dark:text-zinc-100">
					4. Rekapitulasi Nilai Rapor
				</h2>
				<p class="mb-3 text-xs text-slate-500 dark:text-zinc-400">
					Akumulasi nilai akhir rapor berdasarkan pembobotan resmi sekolah.
				</p>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<NilaiAkhirCard
						title="Nilai Rapor Tengah Semester"
						nilaiAkhir={nilaiAkhirRts}
						nilaiAkhirCategory={nilaiAkhirRtsCategory}
						{kkm}
						{formatScore}
						sumatifWeights={{
							lingkup: data.sumatifWeightsRts?.lingkup ?? 70,
							sts: data.sumatifWeightsRts?.sts ?? 30
						}}
					/>

					<NilaiAkhirCard
						{nilaiAkhir}
						{nilaiAkhirCategory}
						{kkm}
						{formatScore}
						sumatifWeights={effectiveSumatifWeights}
					/>
				</div>
			</div>
		{/snippet}
	</FormEnhance>
</div>
