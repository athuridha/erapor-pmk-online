<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { EntryDraft } from './types';

	interface Props {
		entries: EntryDraft[];
		formatScore: (value: number | null) => string;
		getInputClass: (value: string) => string;
	}

	let { entries, formatScore, getInputClass }: Props = $props();

	const dispatch = createEventDispatcher<{
		nilaiChange: { index: number; value: string };
	}>();

	function handleInput(index: number, event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		dispatch('nilaiChange', { index, value: target.value });
	}

	let selectedTeknikFilter = $state<number | 'semua'>('semua');
	let groupBy = $state<'teknik' | 'lingkup' | 'none'>('teknik');

	function getTeknikHint(singkatan: string, nama: string): string {
		const s = (singkatan || '').toUpperCase().trim();
		const n = (nama || '').toLowerCase();
		if (s === 'TT' || n.includes('tulis')) return 'Nilai Ulangan Harian / Kuis';
		if (s === 'TG' || n.includes('tugas')) return 'Nilai Tugas Mandiri / Kelompok';
		if (s === 'KJ' || n.includes('kinerja') || n.includes('praktik'))
			return 'Nilai Praktik / Unjuk Kerja';
		if (s === 'PR' || n.includes('proyek')) return 'Nilai Tugas Proyek';
		if (s === 'OB' || n.includes('observasi')) return 'Nilai Pengamatan Proses';
		if (s === 'PF' || n.includes('portofolio')) return 'Nilai Portofolio';
		if (s === 'TL' || n.includes('lisan')) return 'Nilai Tanya Jawab Lisan';
		return 'Nilai Asesmen';
	}

	function computeSectionAverage(items: Array<{ entry: EntryDraft }>): string {
		const scores: number[] = [];
		for (const { entry } of items) {
			const text = entry.nilaiText.trim().replace(',', '.');
			const num = Number.parseFloat(text);
			if (Number.isFinite(num) && num >= 0 && num <= 100) {
				scores.push(num);
			}
		}
		if (scores.length === 0) return '-';
		const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
		return avg.toFixed(2);
	}

	// Extract unique techniques for filter pills
	const availableTekniks = $derived.by(() => {
		const map = new Map<
			number | 'none',
			{ id: number | null; nama: string; singkatan: string; count: number }
		>();
		for (const entry of entries) {
			const tid = entry.teknikPenilaianId ?? 'none';
			if (!map.has(tid)) {
				map.set(tid, {
					id: entry.teknikPenilaianId ?? null,
					nama: entry.teknikPenilaian?.nama ?? 'Tanpa Teknik',
					singkatan: entry.teknikPenilaian?.singkatan ?? '-',
					count: 0
				});
			}
			map.get(tid)!.count += 1;
		}
		return Array.from(map.values());
	});

	// Sections grouped by technique
	const sectionsByTeknik = $derived.by(() => {
		const groups = new Map<
			string,
			{
				id: number | null;
				nama: string;
				singkatan: string;
				keterangan?: string | null;
				items: Array<{ entry: EntryDraft; originalIndex: number }>;
			}
		>();

		entries.forEach((entry, originalIndex) => {
			const key = entry.teknikPenilaianId != null ? String(entry.teknikPenilaianId) : 'unassigned';
			if (!groups.has(key)) {
				groups.set(key, {
					id: entry.teknikPenilaianId ?? null,
					nama: entry.teknikPenilaian?.nama ?? 'Lainnya / Belum Ditentukan',
					singkatan: entry.teknikPenilaian?.singkatan ?? '-',
					keterangan: entry.teknikPenilaian?.keterangan ?? null,
					items: []
				});
			}
			groups.get(key)!.items.push({ entry, originalIndex });
		});

		return Array.from(groups.values());
	});

	// Sections grouped by lingkup materi
	const sectionsByLingkup = $derived.by(() => {
		const groups = new Map<
			string,
			{
				nama: string;
				bobot: number | null;
				items: Array<{ entry: EntryDraft; originalIndex: number }>;
			}
		>();

		entries.forEach((entry, originalIndex) => {
			const key = entry.lingkupMateri;
			if (!groups.has(key)) {
				groups.set(key, {
					nama: entry.lingkupMateri,
					bobot: entry.bobot,
					items: []
				});
			}
			groups.get(key)!.items.push({ entry, originalIndex });
		});

		return Array.from(groups.values());
	});
</script>

<!-- Filter & Mode Switcher Toolbar -->
<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	{#if availableTekniks.length > 1}
		<div
			class="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
		>
			<span class="mr-0.5 shrink-0 text-xs font-semibold text-slate-600 dark:text-zinc-300"
				>Filter:</span
			>
			<button
				type="button"
				class="inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition-colors sm:h-7 sm:min-h-0 sm:px-2.5 sm:text-[11px] {selectedTeknikFilter ===
				'semua'
					? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
					: 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
				onclick={() => (selectedTeknikFilter = 'semua')}
			>
				Semua ({entries.length})
			</button>
			{#each availableTekniks as t (t.id ?? 'none')}
				<button
					type="button"
					class="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors sm:h-7 sm:min-h-0 sm:px-2.5 sm:text-[11px] {selectedTeknikFilter ===
					(t.id ?? -1)
						? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
						: 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
					onclick={() => (selectedTeknikFilter = t.id ?? -1)}
				>
					<span class="font-mono font-bold">{t.singkatan}</span>
					<span>{t.nama}</span>
					<span
						class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold {selectedTeknikFilter ===
						(t.id ?? -1)
							? 'bg-white/20 text-white'
							: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'}">{t.count}</span
					>
				</button>
			{/each}
		</div>
	{/if}

	<div class="flex flex-col gap-1.5 sm:ml-auto sm:flex-row sm:items-center">
		<span class="text-xs font-medium text-slate-500 dark:text-zinc-400">Tampilan:</span>
		<div
			class="grid w-full grid-cols-3 gap-0.5 rounded-xl border border-slate-200/80 bg-slate-50 p-0.5 sm:inline-flex sm:w-auto dark:border-zinc-700 dark:bg-zinc-800"
		>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition-colors sm:h-7 sm:text-[11px] {groupBy ===
				'teknik'
					? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
					: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
				onclick={() => (groupBy = 'teknik')}
				title="Kelompokkan berdasarkan Teknik Penilaian"
			>
				Per Teknik
			</button>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition-colors sm:h-7 sm:text-[11px] {groupBy ===
				'lingkup'
					? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
					: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
				onclick={() => (groupBy = 'lingkup')}
				title="Kelompokkan berdasarkan Lingkup Materi"
			>
				Per Materi
			</button>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition-colors sm:h-7 sm:text-[11px] {groupBy ===
				'none'
					? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
					: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
				onclick={() => (groupBy = 'none')}
				title="Daftar lurus tanpa kategori"
			>
				Daftar Lurus
			</button>
		</div>
	</div>
</div>

<!-- Tampilan Daftar Nilai -->
{#if groupBy === 'teknik'}
	<!-- Grouped by Teknik Penilaian in Section Cards -->
	<div class="mt-3 space-y-4">
		{#each sectionsByTeknik as section (section.nama)}
			{@const isSectionHidden =
				selectedTeknikFilter !== 'semua' && (section.id ?? -1) !== selectedTeknikFilter}
			{@const avg = computeSectionAverage(section.items)}
			<div
				class="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
				class:hidden={isSectionHidden}
			>
				<!-- Section Header -->
				<div
					class="flex flex-col gap-2 border-b border-slate-200/80 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-800/60"
				>
					<div class="flex flex-wrap items-center gap-2">
						<span
							class="inline-flex items-center rounded-md border border-blue-200/80 bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
						>
							{section.singkatan}
						</span>
						<h4 class="text-sm font-bold text-slate-900 dark:text-zinc-100">{section.nama}</h4>
						<span
							class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
						>
							{getTeknikHint(section.singkatan, section.nama)}
						</span>
						{#if section.keterangan}
							<span class="hidden text-xs font-normal text-slate-500 lg:inline dark:text-zinc-400">
								· {section.keterangan}
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							Rata-rata: <strong class="font-mono font-bold text-slate-900 dark:text-zinc-100"
								>{avg}</strong
							>
						</span>
						<span
							class="inline-flex items-center rounded-full border border-slate-200/80 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
						>
							{section.items.length} TP
						</span>
					</div>
				</div>

				<!-- Responsive single-DOM list -->
				<div
					class="hidden border-b border-slate-200/80 bg-slate-50/40 px-3 py-2 text-xs font-semibold text-slate-600 sm:grid sm:grid-cols-[3rem_1fr_8.5rem] sm:gap-2 dark:border-zinc-800 dark:bg-zinc-800/30 dark:text-zinc-300"
				>
					<div class="text-center">No</div>
					<div>Tujuan Pembelajaran</div>
					<div class="text-center">Nilai (0-100)</div>
				</div>
				<div class="divide-y divide-slate-100 dark:divide-zinc-800/80">
					{#each section.items as item (item.entry.tujuanPembelajaranId)}
						<div
							class="flex flex-col gap-2.5 p-3.5 transition-colors hover:bg-slate-50/70 sm:grid sm:grid-cols-[3rem_1fr_8.5rem] sm:items-start sm:gap-2 sm:px-3 sm:py-2.5 dark:hover:bg-zinc-800/40"
						>
							<div
								class="hidden pt-1 text-center text-xs font-semibold text-slate-500 tabular-nums sm:block dark:text-zinc-400"
							>
								{item.entry.index}
							</div>
							<div class="min-w-0">
								<p class="text-xs leading-relaxed font-medium text-slate-900 dark:text-zinc-100">
									<span
										class="mr-1.5 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 tabular-nums sm:hidden dark:bg-zinc-800 dark:text-zinc-300"
										>TP {item.entry.index}</span
									>
									{item.entry.deskripsi}
								</p>
								<div
									class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400"
								>
									<span class="font-semibold tracking-wider uppercase">
										{item.entry.lingkupMateri}
									</span>
									{#if item.entry.bobot != null}
										<span class="opacity-50">·</span>
										<span class="font-medium">Bobot {formatScore(item.entry.bobot)}%</span>
									{/if}
								</div>
								<input
									type="hidden"
									name={`entries.${item.originalIndex}.tujuanPembelajaranId`}
									value={item.entry.tujuanPembelajaranId}
								/>
							</div>
							<div
								class="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5 sm:block sm:border-0 sm:pt-0 sm:text-center dark:border-zinc-800/80"
							>
								<span class="text-xs font-semibold text-slate-600 sm:hidden dark:text-zinc-400">
									Nilai (0-100)
								</span>
								<input
									type="number"
									name={`entries.${item.originalIndex}.nilai`}
									class="{getInputClass(
										item.entry.nilaiText
									)} h-11 w-28 text-center font-mono text-base font-bold shadow-2xs sm:h-8 sm:w-28 sm:text-xs"
									value={item.entry.nilaiText}
									placeholder="Isi nilai"
									min="0"
									max="100"
									step="0.01"
									inputmode="decimal"
									aria-label={`Nilai TP ${item.entry.index}`}
									title="Rentang 0-100 dengan maksimal 2 angka desimal"
									spellcheck="false"
									oninput={(event) => handleInput(item.originalIndex, event)}
								/>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{:else if groupBy === 'lingkup'}
	<!-- Grouped by Lingkup Materi in Section Cards -->
	<div class="mt-3 space-y-4">
		{#each sectionsByLingkup as section (section.nama)}
			{@const matchingItems = section.items.filter(
				(it) =>
					selectedTeknikFilter === 'semua' ||
					(it.entry.teknikPenilaianId ?? -1) === selectedTeknikFilter
			)}
			{@const avg = computeSectionAverage(matchingItems)}
			<div
				class="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
				class:hidden={matchingItems.length === 0}
			>
				<!-- Section Header -->
				<div
					class="flex flex-col gap-2 border-b border-slate-200/80 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-800/60"
				>
					<div class="flex flex-wrap items-center gap-2">
						<h4
							class="text-sm font-bold tracking-wider text-slate-900 uppercase dark:text-zinc-100"
						>
							{section.nama}
						</h4>
						{#if section.bobot != null}
							<span
								class="inline-flex items-center rounded-full border border-slate-200/80 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
							>
								Bobot {formatScore(section.bobot)}%
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							Rata-rata: <strong class="font-mono font-bold text-slate-900 dark:text-zinc-100"
								>{avg}</strong
							>
						</span>
						<span
							class="inline-flex items-center rounded-full border border-slate-200/80 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
						>
							{matchingItems.length} TP
						</span>
					</div>
				</div>

				<!-- Responsive single-DOM list -->
				<div
					class="hidden border-b border-slate-200/80 bg-slate-50/40 px-3 py-2 text-xs font-semibold text-slate-600 sm:grid sm:grid-cols-[3rem_1fr_8.5rem] sm:gap-2 dark:border-zinc-800 dark:bg-zinc-800/30 dark:text-zinc-300"
				>
					<div class="text-center">No</div>
					<div>Tujuan Pembelajaran</div>
					<div class="text-center">Nilai (0-100)</div>
				</div>
				<div class="divide-y divide-slate-100 dark:divide-zinc-800/80">
					{#each section.items as item (item.entry.tujuanPembelajaranId)}
						{@const isHidden =
							selectedTeknikFilter !== 'semua' &&
							(item.entry.teknikPenilaianId ?? -1) !== selectedTeknikFilter}
						<div
							class="flex flex-col gap-2.5 p-3.5 transition-colors hover:bg-slate-50/70 sm:grid sm:grid-cols-[3rem_1fr_8.5rem] sm:items-start sm:gap-2 sm:px-3 sm:py-2.5 dark:hover:bg-zinc-800/40"
							class:hidden={isHidden}
						>
							<div
								class="hidden pt-1 text-center text-xs font-semibold text-slate-500 tabular-nums sm:block dark:text-zinc-400"
							>
								{item.entry.index}
							</div>
							<div class="min-w-0">
								<p class="text-xs leading-relaxed font-medium text-slate-900 dark:text-zinc-100">
									<span
										class="mr-1.5 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 tabular-nums sm:hidden dark:bg-zinc-800 dark:text-zinc-300"
										>TP {item.entry.index}</span
									>
									{item.entry.deskripsi}
								</p>
								<div
									class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400"
								>
									{#if item.entry.teknikPenilaian}
										<span
											class="inline-flex items-center gap-1 rounded-md border border-blue-200/80 bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
										>
											<span class="font-bold">{item.entry.teknikPenilaian.singkatan}</span>
											<span class="opacity-60">·</span>
											<span>{item.entry.teknikPenilaian.nama}</span>
										</span>
										<span class="font-medium text-slate-500 dark:text-zinc-400">
											({getTeknikHint(
												item.entry.teknikPenilaian.singkatan,
												item.entry.teknikPenilaian.nama
											)})
										</span>
									{/if}
								</div>
								<input
									type="hidden"
									name={`entries.${item.originalIndex}.tujuanPembelajaranId`}
									value={item.entry.tujuanPembelajaranId}
								/>
							</div>
							<div
								class="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5 sm:block sm:border-0 sm:pt-0 sm:text-center dark:border-zinc-800/80"
							>
								<span class="text-xs font-semibold text-slate-600 sm:hidden dark:text-zinc-400">
									Nilai (0-100)
								</span>
								<input
									type="number"
									name={`entries.${item.originalIndex}.nilai`}
									class="{getInputClass(
										item.entry.nilaiText
									)} h-11 w-28 text-center font-mono text-base font-bold shadow-2xs sm:h-8 sm:w-28 sm:text-xs"
									value={item.entry.nilaiText}
									placeholder="Isi nilai"
									min="0"
									max="100"
									step="0.01"
									inputmode="decimal"
									aria-label={`Nilai TP ${item.entry.index}`}
									title="Rentang 0-100 dengan maksimal 2 angka desimal"
									spellcheck="false"
									oninput={(event) => handleInput(item.originalIndex, event)}
								/>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<!-- Flat Responsive View -->
	<div
		class="mt-3 overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="hidden border-b border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold text-slate-600 sm:grid sm:grid-cols-[3rem_1fr_8.5rem] sm:gap-2 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
		>
			<div class="text-center">No</div>
			<div>Tujuan Pembelajaran</div>
			<div class="text-center">Nilai (0-100)</div>
		</div>
		<div class="divide-y divide-slate-100 dark:divide-zinc-800/80">
			{#each entries as entry, index (entry.tujuanPembelajaranId)}
				{@const isHidden =
					selectedTeknikFilter !== 'semua' &&
					(entry.teknikPenilaianId ?? -1) !== selectedTeknikFilter}
				<div
					class="flex flex-col gap-2.5 p-3.5 transition-colors hover:bg-slate-50/70 sm:grid sm:grid-cols-[3rem_1fr_8.5rem] sm:items-start sm:gap-2 sm:px-3 sm:py-2.5 dark:hover:bg-zinc-800/40"
					class:hidden={isHidden}
				>
					<div
						class="hidden pt-1 text-center text-xs font-semibold text-slate-500 tabular-nums sm:block dark:text-zinc-400"
					>
						{entry.index}
					</div>
					<div class="min-w-0">
						<p class="text-xs leading-relaxed font-medium text-slate-900 dark:text-zinc-100">
							<span
								class="mr-1.5 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 tabular-nums sm:hidden dark:bg-zinc-800 dark:text-zinc-300"
								>TP {entry.index}</span
							>
							{entry.deskripsi}
						</p>
						<div
							class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400"
						>
							<span class="font-semibold tracking-wider uppercase">
								{entry.lingkupMateri}
							</span>
							{#if entry.bobot != null}
								<span class="opacity-50">·</span>
								<span class="font-medium">Bobot {formatScore(entry.bobot)}%</span>
							{/if}
							{#if entry.teknikPenilaian}
								<span
									class="inline-flex items-center gap-1 rounded-md border border-blue-200/80 bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
								>
									<span class="font-bold">{entry.teknikPenilaian.singkatan}</span>
									<span class="opacity-60">·</span>
									<span>{entry.teknikPenilaian.nama}</span>
								</span>
								<span class="font-medium text-slate-500 dark:text-zinc-400">
									({getTeknikHint(entry.teknikPenilaian.singkatan, entry.teknikPenilaian.nama)})
								</span>
							{/if}
						</div>
						<input
							type="hidden"
							name={`entries.${index}.tujuanPembelajaranId`}
							value={entry.tujuanPembelajaranId}
						/>
					</div>
					<div
						class="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5 sm:block sm:border-0 sm:pt-0 sm:text-center dark:border-zinc-800/80"
					>
						<span class="text-xs font-semibold text-slate-600 sm:hidden dark:text-zinc-400">
							Nilai (0-100)
						</span>
						<input
							type="number"
							name={`entries.${index}.nilai`}
							class="{getInputClass(
								entry.nilaiText
							)} h-11 w-28 text-center font-mono text-base font-bold shadow-2xs sm:h-8 sm:w-28 sm:text-xs"
							value={entry.nilaiText}
							placeholder="Isi nilai"
							min="0"
							max="100"
							step="0.01"
							inputmode="decimal"
							aria-label={`Nilai TP ${entry.index}`}
							title="Rentang 0-100 dengan maksimal 2 angka desimal"
							spellcheck="false"
							oninput={(event) => handleInput(index, event)}
						/>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
