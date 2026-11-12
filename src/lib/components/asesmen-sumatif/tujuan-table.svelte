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
		if (scores.length === 0) return '—';
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
					singkatan: entry.teknikPenilaian?.singkatan ?? '—',
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
					singkatan: entry.teknikPenilaian?.singkatan ?? '—',
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
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="text-xs font-semibold text-base-content/70 mr-0.5">Filter:</span>
			<button
				type="button"
				class="btn btn-xs rounded-full shadow-none transition-all {selectedTeknikFilter === 'semua'
					? 'btn-primary font-bold'
					: 'btn-soft'}"
				onclick={() => (selectedTeknikFilter = 'semua')}
			>
				Semua ({entries.length})
			</button>
			{#each availableTekniks as t (t.id ?? 'none')}
				<button
					type="button"
					class="btn btn-xs rounded-full shadow-none transition-all {selectedTeknikFilter ===
					(t.id ?? -1)
						? 'btn-primary font-bold'
						: 'btn-soft'}"
					onclick={() => (selectedTeknikFilter = t.id ?? -1)}
				>
					<span class="font-mono font-bold">{t.singkatan}</span>
					<span>{t.nama}</span>
					<span class="badge badge-xs badge-neutral/20 font-semibold">{t.count}</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="flex items-center gap-1.5 sm:ml-auto">
		<span class="text-xs text-base-content/60 font-medium">Tampilan:</span>
		<div class="join border border-base-200 dark:border-base-300 rounded-lg p-0.5 bg-base-200/50">
			<button
				type="button"
				class="join-item btn btn-xs border-none shadow-none {groupBy === 'teknik'
					? 'btn-primary font-bold'
					: 'btn-ghost'}"
				onclick={() => (groupBy = 'teknik')}
				title="Kelompokkan berdasarkan Teknik Penilaian"
			>
				Per Teknik
			</button>
			<button
				type="button"
				class="join-item btn btn-xs border-none shadow-none {groupBy === 'lingkup'
					? 'btn-primary font-bold'
					: 'btn-ghost'}"
				onclick={() => (groupBy = 'lingkup')}
				title="Kelompokkan berdasarkan Lingkup Materi"
			>
				Per Materi
			</button>
			<button
				type="button"
				class="join-item btn btn-xs border-none shadow-none {groupBy === 'none'
					? 'btn-primary font-bold'
					: 'btn-ghost'}"
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
	<!-- Grouped by Teknik Penilaian in Modern Section Cards -->
	<div class="mt-3 space-y-4">
		{#each sectionsByTeknik as section (section.nama)}
			{@const isSectionHidden =
				selectedTeknikFilter !== 'semua' && (section.id ?? -1) !== selectedTeknikFilter}
			{@const avg = computeSectionAverage(section.items)}
			<div
				class="rounded-xl border border-base-200 bg-base-100 shadow-sm overflow-hidden dark:border-base-300 dark:bg-base-200/40"
				class:hidden={isSectionHidden}
			>
				<!-- Section Header -->
				<div
					class="flex flex-col gap-2 bg-base-200/70 p-3 sm:flex-row sm:items-center sm:justify-between border-b border-base-200 dark:border-base-300 dark:bg-base-300/40"
				>
					<div class="flex flex-wrap items-center gap-2">
						<span class="badge badge-primary font-mono font-bold text-xs">
							{section.singkatan}
						</span>
						<h4 class="font-bold text-base text-base-content">{section.nama}</h4>
						<span class="badge badge-soft badge-info text-xs font-semibold">
							{getTeknikHint(section.singkatan, section.nama)}
						</span>
						{#if section.keterangan}
							<span class="text-xs text-base-content/60 font-normal hidden lg:inline">
								• {section.keterangan}
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<span class="text-xs text-base-content/70">
							Rata-rata: <strong class="text-base-content font-mono font-bold">{avg}</strong>
						</span>
						<span class="badge badge-neutral/20 badge-sm font-semibold">
							{section.items.length} TP
						</span>
					</div>
				</div>

				<!-- Section Table -->
				<div class="overflow-x-auto">
					<table class="table table-sm w-full">
						<thead>
							<tr class="bg-base-100/50 text-base-content/70 border-b border-base-200 text-xs">
								<th style="width: 48px;" class="text-center font-semibold">No</th>
								<th class="font-semibold">Tujuan Pembelajaran</th>
								<th style="width: 130px;" class="text-center font-semibold">Nilai (0-100)</th>
							</tr>
						</thead>
						<tbody>
							{#each section.items as item (item.entry.tujuanPembelajaranId)}
								<tr class="hover:bg-base-200/40 border-b border-base-200/60 last:border-b-0">
									<td class="align-top text-center font-semibold text-base-content/60 pt-3">
										{item.entry.index}
									</td>
									<td class="align-top py-2.5">
										<p class="font-medium text-sm text-base-content leading-relaxed">
											{item.entry.deskripsi}
										</p>
										<div
											class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-base-content/70"
										>
											<span class="font-semibold uppercase tracking-wider text-xs">
												{item.entry.lingkupMateri}
											</span>
											{#if item.entry.bobot != null}
												<span class="opacity-50">•</span>
												<span class="font-medium">Bobot {formatScore(item.entry.bobot)}%</span>
											{/if}
										</div>
										<input
											type="hidden"
											name={`entries.${item.originalIndex}.tujuanPembelajaranId`}
											value={item.entry.tujuanPembelajaranId}
										/>
									</td>
									<td class="align-top text-center py-2.5">
										<input
											type="number"
											name={`entries.${item.originalIndex}.nilai`}
											class="{getInputClass(
												item.entry.nilaiText
											)} input-sm input-bordered text-center font-mono font-bold text-sm w-28 shadow-2xs"
											value={item.entry.nilaiText}
											placeholder="Isi nilai"
											min="0"
											max="100"
											step="0.01"
											inputmode="decimal"
											title="Rentang 0-100 dengan maksimal 2 angka desimal"
											spellcheck="false"
											oninput={(event) => handleInput(item.originalIndex, event)}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
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
				class="rounded-xl border border-base-200 bg-base-100 shadow-sm overflow-hidden dark:border-base-300 dark:bg-base-200/40"
				class:hidden={matchingItems.length === 0}
			>
				<!-- Section Header -->
				<div
					class="flex flex-col gap-2 bg-base-200/70 p-3 sm:flex-row sm:items-center sm:justify-between border-b border-base-200 dark:border-base-300 dark:bg-base-300/40"
				>
					<div class="flex items-center gap-2">
						<h4 class="font-bold text-base text-base-content uppercase tracking-wider">
							{section.nama}
						</h4>
						{#if section.bobot != null}
							<span class="badge badge-soft badge-sm font-semibold">
								Bobot {formatScore(section.bobot)}%
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<span class="text-xs text-base-content/70">
							Rata-rata: <strong class="text-base-content font-mono font-bold">{avg}</strong>
						</span>
						<span class="badge badge-neutral/20 badge-sm font-semibold">
							{matchingItems.length} TP
						</span>
					</div>
				</div>

				<!-- Section Table -->
				<div class="overflow-x-auto">
					<table class="table table-sm w-full">
						<thead>
							<tr class="bg-base-100/50 text-base-content/70 border-b border-base-200 text-xs">
								<th style="width: 48px;" class="text-center font-semibold">No</th>
								<th class="font-semibold">Tujuan Pembelajaran</th>
								<th style="width: 130px;" class="text-center font-semibold">Nilai (0-100)</th>
							</tr>
						</thead>
						<tbody>
							{#each section.items as item (item.entry.tujuanPembelajaranId)}
								{@const isHidden =
									selectedTeknikFilter !== 'semua' &&
									(item.entry.teknikPenilaianId ?? -1) !== selectedTeknikFilter}
								<tr
									class="hover:bg-base-200/40 border-b border-base-200/60 last:border-b-0"
									class:hidden={isHidden}
								>
									<td class="align-top text-center font-semibold text-base-content/60 pt-3">
										{item.entry.index}
									</td>
									<td class="align-top py-2.5">
										<p class="font-medium text-sm text-base-content leading-relaxed">
											{item.entry.deskripsi}
										</p>
										<div
											class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-base-content/70"
										>
											{#if item.entry.teknikPenilaian}
												<span
													class="badge badge-xs badge-info badge-outline font-semibold gap-1 py-1"
												>
													<span class="font-bold">{item.entry.teknikPenilaian.singkatan}</span>
													<span class="opacity-60">•</span>
													<span>{item.entry.teknikPenilaian.nama}</span>
												</span>
												<span class="text-xs text-base-content/60 font-medium">
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
									</td>
									<td class="align-top text-center py-2.5">
										<input
											type="number"
											name={`entries.${item.originalIndex}.nilai`}
											class="{getInputClass(
												item.entry.nilaiText
											)} input-sm input-bordered text-center font-mono font-bold text-sm w-28 shadow-2xs"
											value={item.entry.nilaiText}
											placeholder="Isi nilai"
											min="0"
											max="100"
											step="0.01"
											inputmode="decimal"
											title="Rentang 0-100 dengan maksimal 2 angka desimal"
											spellcheck="false"
											oninput={(event) => handleInput(item.originalIndex, event)}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<!-- Flat Table View -->
	<div
		class="mt-3 rounded-xl border border-base-200 bg-base-100 shadow-sm overflow-hidden dark:border-base-300 dark:bg-base-200/40"
	>
		<div class="overflow-x-auto">
			<table class="table table-sm w-full">
				<thead>
					<tr class="bg-base-200/70 text-base-content border-b border-base-200 text-xs">
						<th style="width: 48px;" class="text-center font-bold">No</th>
						<th class="font-bold">Tujuan Pembelajaran</th>
						<th style="width: 130px;" class="text-center font-bold">Nilai (0-100)</th>
					</tr>
				</thead>
				<tbody>
					{#each entries as entry, index (entry.tujuanPembelajaranId)}
						{@const isHidden =
							selectedTeknikFilter !== 'semua' &&
							(entry.teknikPenilaianId ?? -1) !== selectedTeknikFilter}
						<tr
							class="hover:bg-base-200/40 border-b border-base-200/60 last:border-b-0"
							class:hidden={isHidden}
						>
							<td class="align-top text-center font-semibold text-base-content/60 pt-3">
								{entry.index}
							</td>
							<td class="align-top py-2.5">
								<p class="font-medium text-sm text-base-content leading-relaxed">
									{entry.deskripsi}
								</p>
								<div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-base-content/70">
									<span class="font-semibold uppercase tracking-wider text-xs">
										{entry.lingkupMateri}
									</span>
									{#if entry.bobot != null}
										<span class="opacity-50">•</span>
										<span class="font-medium">Bobot {formatScore(entry.bobot)}%</span>
									{/if}
									{#if entry.teknikPenilaian}
										<span class="badge badge-xs badge-info badge-outline font-semibold gap-1 py-1">
											<span class="font-bold">{entry.teknikPenilaian.singkatan}</span>
											<span class="opacity-60">•</span>
											<span>{entry.teknikPenilaian.nama}</span>
										</span>
										<span class="text-xs text-base-content/60 font-medium">
											({getTeknikHint(entry.teknikPenilaian.singkatan, entry.teknikPenilaian.nama)})
										</span>
									{/if}
								</div>
								<input
									type="hidden"
									name={`entries.${index}.tujuanPembelajaranId`}
									value={entry.tujuanPembelajaranId}
								/>
							</td>
							<td class="align-top text-center py-2.5">
								<input
									type="number"
									name={`entries.${index}.nilai`}
									class="{getInputClass(
										entry.nilaiText
									)} input-sm input-bordered text-center font-mono font-bold text-sm w-28 shadow-2xs"
									value={entry.nilaiText}
									placeholder="Isi nilai"
									min="0"
									max="100"
									step="0.01"
									inputmode="decimal"
									title="Rentang 0-100 dengan maksimal 2 angka desimal"
									spellcheck="false"
									oninput={(event) => handleInput(index, event)}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
