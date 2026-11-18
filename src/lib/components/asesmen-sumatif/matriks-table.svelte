<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { invalidate } from '$app/navigation';

	export type MatriksTp = {
		id: number;
		no: number;
		mataPelajaranId: number;
		deskripsi: string;
		lingkupMateri: string;
		bobot: number;
		teknikPenilaianId: number | null;
		teknikNama: string | null;
		teknikSingkatan: string | null;
	};

	export type MatriksMurid = {
		id: number;
		no: number;
		nama: string;
		agamaLabel?: string | null;
		mapelId: number | null;
		nilaiAkhirRts: number | null;
		nilaiAkhir: number | null;
		naLingkup: number | null;
		sts: number | null;
		sas: number | null;
		canNilai: boolean;
		diisiUserLain?: boolean;
		tpScores?: Record<number, number | null>;
	};

	type Props = {
		muridList: MatriksMurid[];
		tujuanList: MatriksTp[];
		kelasId?: number | null;
		kkm?: number;
		isTerkunci?: boolean;
		canEdit?: boolean;
		sumatifWeights?: { lingkup: number; sts: number; sas: number };
		mapelNama?: string;
	};

	let {
		muridList = [],
		tujuanList = [],
		kelasId = null,
		kkm = 75,
		isTerkunci = false,
		canEdit = true,
		sumatifWeights = { lingkup: 60, sts: 20, sas: 20 },
		mapelNama = 'Mata Pelajaran'
	}: Props = $props();

	// State for editable values: [muridId] -> { tp: { [tpId]: string }, sts: string, sas: string }
	type RowState = {
		id: number;
		no: number;
		nama: string;
		mapelId: number | null;
		canNilai: boolean;
		tp: Record<number, string>;
		sts: string;
		sas: string;
	};

	let searchFilter = $state('');
	let saving = $state(false);
	let bulkModalCol = $state<{ type: 'tp' | 'sts' | 'sas'; tpId?: number; label: string } | null>(
		null
	);
	let bulkValueInput = $state('');

	// Initial snapshot for dirty tracking
	let initialSnapshot = $state<string>('');

	// Initialize row states
	let rows = $state<RowState[]>([]);

	$effect(() => {
		// When muridList or tujuanList changes, initialize rows
		const newRows: RowState[] = muridList.map((m) => {
			const tpMap: Record<number, string> = {};
			for (const t of tujuanList) {
				const val = m.tpScores?.[t.id];
				tpMap[t.id] = val != null ? String(val) : '';
			}
			return {
				id: m.id,
				no: m.no,
				nama: m.nama,
				mapelId: m.mapelId,
				canNilai: m.canNilai && canEdit && !isTerkunci,
				tp: tpMap,
				sts: m.sts != null ? String(m.sts) : '',
				sas: m.sas != null ? String(m.sas) : ''
			};
		});
		rows = newRows;
		initialSnapshot = JSON.stringify(newRows);
	});

	// Check which rows are dirty
	const isDirty = $derived.by(() => {
		if (!initialSnapshot) return false;
		return JSON.stringify(rows) !== initialSnapshot;
	});

	const dirtyCount = $derived.by(() => {
		if (!initialSnapshot) return 0;
		try {
			const init: RowState[] = JSON.parse(initialSnapshot);
			const initMap = new Map(init.map((r) => [r.id, r]));
			let count = 0;
			for (const r of rows) {
				const o = initMap.get(r.id);
				if (!o) continue;
				if (r.sts !== o.sts) count++;
				if (r.sas !== o.sas) count++;
				for (const t of tujuanList) {
					if (r.tp[t.id] !== o.tp[t.id]) count++;
				}
			}
			return count;
		} catch {
			return 0;
		}
	});

	// Filtered rows for client search
	const filteredRows = $derived.by(() => {
		const q = searchFilter.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((r) => r.nama.toLowerCase().includes(q));
	});

	// Calculation helpers for real-time preview
	function calcNaLingkup(r: RowState): number | null {
		const validScores: number[] = [];
		for (const t of tujuanList) {
			const v = r.tp[t.id];
			if (v !== '' && v != null && !Number.isNaN(Number(v))) {
				validScores.push(Number(v));
			}
		}
		if (!validScores.length) return null;
		return Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 100) / 100;
	}

	function calcNilaiAkhir(r: RowState): number | null {
		const naLingkup = calcNaLingkup(r);
		const stsNum =
			r.sts !== '' && !Number.isNaN(Number(r.sts)) ? Math.round(Number(r.sts) * 100) / 100 : null;
		const sasNum =
			r.sas !== '' && !Number.isNaN(Number(r.sas)) ? Math.round(Number(r.sas) * 100) / 100 : null;

		const eff =
			stsNum == null
				? { lingkup: 70, sts: 0, sas: 30 }
				: {
						lingkup: sumatifWeights.lingkup,
						sts: sumatifWeights.sts,
						sas: sumatifWeights.sas
					};

		let weighted = 0;
		let totalW = 0;
		if (naLingkup != null) {
			weighted += naLingkup * eff.lingkup;
			totalW += eff.lingkup;
		}
		if (stsNum != null) {
			weighted += stsNum * eff.sts;
			totalW += eff.sts;
		}
		if (sasNum != null) {
			weighted += sasNum * eff.sas;
			totalW += eff.sas;
		}
		if (totalW === 0) return null;
		return Math.round((weighted / totalW) * 100) / 100;
	}

	function formatScore(val: number | null): string {
		if (val == null || Number.isNaN(val)) return '-';
		return val.toFixed(1);
	}

	// Keyboard Navigation (Excel-style)
	function handleKeyDown(event: KeyboardEvent) {
		// Global shortcut Ctrl+S or Cmd+S
		if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			if (isDirty && !saving && !isTerkunci) {
				saveAll();
			}
			return;
		}

		const target = event.target as HTMLInputElement | null;
		if (!target || !target.hasAttribute('data-row') || !target.hasAttribute('data-col')) {
			return;
		}

		const r = Number(target.getAttribute('data-row'));
		const c = Number(target.getAttribute('data-col'));
		const maxCol = tujuanList.length + 1; // TP cols + STS (idx maxCol-1) + SAS (idx maxCol)
		const maxRow = filteredRows.length - 1;

		let nextRow = r;
		let nextCol = c;

		if (event.key === 'Enter' || event.key === 'ArrowDown') {
			event.preventDefault();
			nextRow = Math.min(maxRow, r + 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			nextRow = Math.max(0, r - 1);
		} else if (event.key === 'Tab' && !event.shiftKey) {
			// Tab right
			if (c < maxCol) {
				event.preventDefault();
				nextCol = c + 1;
			} else if (r < maxRow) {
				event.preventDefault();
				nextRow = r + 1;
				nextCol = 0;
			}
		} else if (event.key === 'Tab' && event.shiftKey) {
			// Shift+Tab left
			if (c > 0) {
				event.preventDefault();
				nextCol = c - 1;
			} else if (r > 0) {
				event.preventDefault();
				nextRow = r - 1;
				nextCol = maxCol;
			}
		}

		if (nextRow !== r || nextCol !== c) {
			const selector = `input[data-row="${nextRow}"][data-col="${nextCol}"]`;
			const nextInput = document.querySelector<HTMLInputElement>(selector);
			if (nextInput) {
				nextInput.focus();
				nextInput.select();
			}
		}
	}

	// Auto-select text on focus like Excel
	function handleFocus(event: FocusEvent) {
		const target = event.target as HTMLInputElement | null;
		target?.select();
	}

	// Save all changes
	async function saveAll() {
		if (isTerkunci) {
			toast('Penilaian terkunci dan tidak dapat diubah.', 'error');
			return;
		}
		if (!rows.length) return;

		saving = true;

		try {
			const payload = rows.map((r) => {
				const tpScores: Record<number, number | null> = {};
				for (const t of tujuanList) {
					const str = r.tp[t.id];
					tpScores[t.id] =
						str !== '' && str != null && !Number.isNaN(Number(str))
							? Math.round(Number(str) * 100) / 100
							: null;
				}
				const stsNum =
					r.sts !== '' && !Number.isNaN(Number(r.sts))
						? Math.round(Number(r.sts) * 100) / 100
						: null;
				const sasNum =
					r.sas !== '' && !Number.isNaN(Number(r.sas))
						? Math.round(Number(r.sas) * 100) / 100
						: null;

				return {
					muridId: r.id,
					mapelId: r.mapelId,
					tpScores,
					sts: stsNum,
					sas: sasNum
				};
			});

			const formData = new FormData();
			formData.append('payload', JSON.stringify(payload));

			const res = await fetch('?/simpanMatriks', {
				method: 'POST',
				body: formData
			});

			const result = await res.json().catch(() => null);

			if (!res.ok || (result?.type && result.type !== 'success')) {
				const msg = result?.data?.fail || result?.message || 'Gagal menyimpan data nilai.';
				toast(msg, 'error');
				return;
			}

			initialSnapshot = JSON.stringify(rows);
			toast(`Berhasil menyimpan nilai untuk ${rows.length} murid!`, 'success');
			await invalidate('app:asesmen-sumatif');
		} catch (err) {
			toast('Terjadi kesalahan saat menyimpan: ' + String((err as Error)?.message ?? err), 'error');
		} finally {
			saving = false;
		}
	}

	// Reset changes
	function resetChanges() {
		if (!initialSnapshot) return;
		try {
			rows = JSON.parse(initialSnapshot);
			toast('Perubahan berhasil dibatalkan.', 'info');
		} catch {
			// ignore
		}
	}

	// Bulk fill a column
	function openBulkModal(type: 'tp' | 'sts' | 'sas', tpId?: number, label?: string) {
		bulkModalCol = {
			type,
			tpId,
			label: label ?? (type === 'sts' ? 'STS' : type === 'sas' ? 'SAS' : 'TP')
		};
		bulkValueInput = '';
	}

	function applyBulkValue() {
		if (!bulkModalCol) return;
		const val = bulkValueInput.trim();
		const num = Number(val);
		if (val !== '' && (Number.isNaN(num) || num < 0 || num > 100)) {
			toast('Nilai harus berupa angka antara 0 - 100.', 'error');
			return;
		}

		for (const r of rows) {
			if (!r.canNilai) continue;
			if (bulkModalCol.type === 'tp' && bulkModalCol.tpId) {
				r.tp[bulkModalCol.tpId] = val;
			} else if (bulkModalCol.type === 'sts') {
				r.sts = val;
			} else if (bulkModalCol.type === 'sas') {
				r.sas = val;
			}
		}

		toast(`Nilai ${bulkModalCol.label} berhasil diisi untuk semua murid yang aktif!`, 'success');
		bulkModalCol = null;
	}

	function getTeknikBadge(singkatan: string | null, nama: string | null) {
		const s = (singkatan || nama || '').toLowerCase();
		if (s.includes('tulis') || s.includes('uh')) {
			return {
				label: 'UH/Tulis',
				cls: 'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300'
			};
		}
		if (s.includes('tugas')) {
			return {
				label: 'Tugas',
				cls: 'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-300'
			};
		}
		if (s.includes('kinerja') || s.includes('praktik')) {
			return {
				label: 'Praktik',
				cls: 'border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/50 dark:text-indigo-300'
			};
		}
		if (s.includes('proyek') || s.includes('produk')) {
			return {
				label: 'Proyek',
				cls: 'border-violet-200/80 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/50 dark:text-violet-300'
			};
		}
		return {
			label: singkatan || 'TP',
			cls: 'border-slate-200/80 bg-slate-100 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
		};
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="space-y-3"
	onkeydown={handleKeyDown}
	role="region"
	aria-label="Matriks Penilaian Sumatif"
>
	<!-- Action / Status Toolbar -->
	<div
		class="sticky top-14 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-xs backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95"
	>
		<!-- Left: Status & Search -->
		<div class="flex flex-wrap items-center gap-3">
			<div class="relative flex w-56 items-center">
				<span
					aria-hidden="true"
					class="pointer-events-none absolute left-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="search" class="h-3.5 w-3.5" />
				</span>
				<input
					type="text"
					placeholder="Cari nama murid..."
					bind:value={searchFilter}
					class="h-8 w-full rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				/>
				{#if searchFilter}
					<button
						type="button"
						class="absolute right-2 flex items-center text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
						onclick={() => (searchFilter = '')}
						aria-label="Bersihkan pencarian"
					>
						<Icon name="close" class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>

			{#if isDirty}
				<div
					class="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
				>
					<span class="inline-block h-2 w-2 animate-ping rounded-full bg-amber-600"></span>
					{dirtyCount} nilai belum disimpan
				</div>
			{:else}
				<div
					class="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
				>
					<Icon name="check" class="h-3.5 w-3.5" />
					Semua tersimpan
				</div>
			{/if}

			{#if isTerkunci}
				<div
					class="inline-flex items-center gap-1 rounded-full border border-red-200/80 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
				>
					<Icon name="alert" class="h-3.5 w-3.5" />
					Nilai Terkunci
				</div>
			{/if}
		</div>

		<!-- Right: Action Buttons -->
		<div class="flex items-center gap-2">
			{#if isDirty}
				<button
					type="button"
					class="inline-flex h-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={resetChanges}
					disabled={saving}
				>
					Batal
				</button>
			{/if}

			<button
				type="button"
				class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
				onclick={saveAll}
				disabled={saving || !isDirty || isTerkunci || !canEdit}
				aria-disabled={saving || !isDirty || isTerkunci || !canEdit}
				title="Simpan perubahan (Tekan Ctrl + S)"
			>
				{#if saving}
					<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
					Menyimpan...
				{:else}
					<Icon name="save" class="h-3.5 w-3.5" />
					<span>Simpan Nilai</span>
					<span class="hidden text-[10px] text-white/75 sm:inline">(Ctrl+S)</span>
				{/if}
			</button>
		</div>
	</div>

	<!-- Instructions / Keyboard Hint Pill -->
	<div
		class="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 dark:text-zinc-400"
	>
		<div class="flex items-center gap-2">
			<span>
				<strong>Tips Cepat:</strong> Tekan
				<kbd
					class="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
					>Enter</kbd
				>
				atau
				<kbd
					class="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
					>↓</kbd
				>
				untuk pindah murid ke bawah,
				<kbd
					class="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
					>Tab</kbd
				>
				untuk geser TP, dan
				<kbd
					class="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
					>Ctrl + S</kbd
				> untuk simpan.
			</span>
		</div>
		<div>
			<span>
				<strong class="text-slate-700 dark:text-zinc-200">{mapelNama}</strong> · KKM:
				<strong class="text-slate-700 dark:text-zinc-200">{kkm}</strong> · Bobot:
				<strong class="text-slate-700 dark:text-zinc-200"
					>{sumatifWeights.lingkup}% Lingkup + {sumatifWeights.sts}% STS + {sumatifWeights.sas}% SAS</strong
				>
			</span>
		</div>
	</div>

	<!-- Main Spreadsheet Matrix Table Container -->
	<div
		class="max-h-[calc(100vh-250px)] overflow-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="min-w-full border-collapse text-center text-xs">
			<thead>
				<tr
					class="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
				>
					<!-- Sticky Col 1: No -->
					<th
						class="sticky top-0 left-0 z-30 w-10 min-w-10 border-b border-slate-200 bg-slate-50 py-2 text-center font-bold dark:border-zinc-700 dark:bg-zinc-800"
					>
						No
					</th>

					<!-- Sticky Col 2: Nama Murid -->
					<th
						class="sticky top-0 left-10 z-30 min-w-44 max-w-52 border-r border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-bold dark:border-zinc-700 dark:bg-zinc-800"
					>
						Nama Murid
					</th>

					<!-- Dynamic TP Columns -->
					{#each tujuanList as t, idx (t.id)}
						{@const badge = getTeknikBadge(t.teknikSingkatan, t.teknikNama)}
						<th
							class="sticky top-0 z-20 min-w-22 max-w-28 border-b border-slate-200 bg-slate-50 px-1.5 py-2 dark:border-zinc-700 dark:bg-zinc-800"
						>
							<div class="flex flex-col items-center gap-0.5">
								<div class="flex items-center gap-1">
									<span class="text-xs font-bold">TP {idx + 1}</span>
									<button
										type="button"
										class="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-blue-100 hover:text-blue-700 dark:text-zinc-400 dark:hover:bg-blue-950 dark:hover:text-blue-300"
										onclick={() => openBulkModal('tp', t.id, `TP ${idx + 1}`)}
										title="Isi seluruh kolom TP {idx + 1} sekaligus"
									>
										⚡
									</button>
								</div>
								<div
									class="tooltip tooltip-bottom max-w-xs text-left"
									data-tip="{t.lingkupMateri ? `[${t.lingkupMateri}] ` : ''}{t.deskripsi}"
								>
									<span
										class="inline-flex cursor-help items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold {badge.cls}"
									>
										{badge.label}
									</span>
								</div>
							</div>
						</th>
					{/each}

					<!-- Rata TP (NA Lingkup) Column -->
					<th
						class="sticky top-0 z-20 min-w-18 border-b border-slate-200 bg-slate-50 px-2 text-center text-xs font-bold dark:border-zinc-700 dark:bg-zinc-800"
					>
						<div class="flex flex-col items-center">
							<span>Rata TP</span>
							<span class="text-[10px] font-normal text-slate-400 dark:text-zinc-400"
								>({sumatifWeights.lingkup}%)</span
							>
						</div>
					</th>

					<!-- STS Column -->
					<th
						class="sticky top-0 z-20 min-w-20 border-b border-slate-200 bg-slate-50 px-1 text-center dark:border-zinc-700 dark:bg-zinc-800"
					>
						<div class="flex flex-col items-center">
							<div class="flex items-center gap-1">
								<span class="text-xs font-bold">STS</span>
								<button
									type="button"
									class="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-blue-100 hover:text-blue-700 dark:text-zinc-400 dark:hover:bg-blue-950 dark:hover:text-blue-300"
									onclick={() => openBulkModal('sts', undefined, 'STS')}
									title="Isi seluruh kolom STS sekaligus"
								>
									⚡
								</button>
							</div>
							<span class="text-[10px] font-normal text-slate-400 dark:text-zinc-400"
								>({sumatifWeights.sts}%)</span
							>
						</div>
					</th>

					<!-- SAS Column -->
					<th
						class="sticky top-0 z-20 min-w-20 border-b border-slate-200 bg-slate-50 px-1 text-center dark:border-zinc-700 dark:bg-zinc-800"
					>
						<div class="flex flex-col items-center">
							<div class="flex items-center gap-1">
								<span class="text-xs font-bold">SAS</span>
								<button
									type="button"
									class="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-blue-100 hover:text-blue-700 dark:text-zinc-400 dark:hover:bg-blue-950 dark:hover:text-blue-300"
									onclick={() => openBulkModal('sas', undefined, 'SAS')}
									title="Isi seluruh kolom SAS sekaligus"
								>
									⚡
								</button>
							</div>
							<span class="text-[10px] font-normal text-slate-400 dark:text-zinc-400"
								>({sumatifWeights.sas}%)</span
							>
						</div>
					</th>

					<!-- Nilai Akhir (NA) Column -->
					<th
						class="sticky top-0 z-20 min-w-22 border-b border-slate-200 bg-blue-50 px-2 text-center text-xs font-bold text-blue-800 dark:border-zinc-700 dark:bg-blue-950/70 dark:text-blue-200"
					>
						Nilai Akhir
					</th>

					<!-- Action Column -->
					<th
						class="sticky top-0 z-20 w-14 border-b border-slate-200 bg-slate-50 text-center dark:border-zinc-700 dark:bg-zinc-800"
					>
						Aksi
					</th>
				</tr>
			</thead>

			<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
				{#if filteredRows.length === 0}
					<tr>
						<td
							colspan={tujuanList.length + 6}
							class="py-8 text-center text-xs text-slate-500 dark:text-zinc-400"
						>
							{searchFilter
								? `Tidak ditemukan murid dengan nama "${searchFilter}".`
								: 'Belum ada data murid untuk kelas ini.'}
						</td>
					</tr>
				{:else}
					{#each filteredRows as r, rowIndex (r.id)}
						{@const naLingkup = calcNaLingkup(r)}
						{@const nilaiAkhir = calcNilaiAkhir(r)}
						{@const isLulus = nilaiAkhir != null && nilaiAkhir >= kkm}
						{@const isStsModified = (() => {
							try {
								const init: RowState[] = JSON.parse(initialSnapshot);
								return init.find((x) => x.id === r.id)?.sts !== r.sts;
							} catch {
								return false;
							}
						})()}
						{@const isSasModified = (() => {
							try {
								const init: RowState[] = JSON.parse(initialSnapshot);
								return init.find((x) => x.id === r.id)?.sas !== r.sas;
							} catch {
								return false;
							}
						})()}
						<tr class="group transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50">
							<!-- Col 1: No -->
							<td
								class="sticky left-0 z-10 w-10 min-w-10 bg-white py-1.5 text-center font-medium text-slate-500 group-hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-400 dark:group-hover:bg-zinc-800"
							>
								{r.no}
							</td>

							<!-- Col 2: Nama Murid -->
							<td
								class="sticky left-10 z-10 min-w-44 max-w-52 border-r border-slate-200 bg-white px-3 py-1.5 text-left font-semibold text-slate-900 group-hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:group-hover:bg-zinc-800"
							>
								<div class="max-w-48 truncate" title={r.nama}>
									{r.nama}
								</div>
							</td>

							<!-- Dynamic TP Input Cells -->
							{#each tujuanList as t, colIndex (t.id)}
								{@const val = r.tp[t.id]}
								{@const isCellModified = (() => {
									try {
										const init: RowState[] = JSON.parse(initialSnapshot);
										const orig = init.find((x) => x.id === r.id);
										return orig?.tp?.[t.id] !== val;
									} catch {
										return false;
									}
								})()}
								<td class="p-1">
									<input
										type="text"
										inputmode="decimal"
										data-row={rowIndex}
										data-col={colIndex}
										disabled={!r.canNilai || isTerkunci}
										bind:value={r.tp[t.id]}
										onfocus={handleFocus}
										placeholder="-"
										class="h-7 w-16 rounded-lg border text-center font-mono text-xs font-semibold transition-all focus:outline-none disabled:bg-slate-100 disabled:opacity-50 dark:disabled:bg-zinc-800 {isCellModified
											? 'border-amber-400 bg-amber-50/70 text-amber-900 ring-1 ring-amber-400/40 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200'
											: 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
									/>
								</td>
							{/each}

							<!-- Col: Rata TP (NA Lingkup) -->
							<td
								class="bg-slate-50/70 px-2 font-mono text-xs font-bold text-slate-700 dark:bg-zinc-800/40 dark:text-zinc-200"
							>
								{formatScore(naLingkup)}
							</td>

							<!-- Col: STS Input -->
							<td class="p-1">
								<input
									type="text"
									inputmode="decimal"
									data-row={rowIndex}
									data-col={tujuanList.length}
									disabled={!r.canNilai || isTerkunci}
									bind:value={r.sts}
									onfocus={handleFocus}
									placeholder="-"
									class="h-7 w-16 rounded-lg border text-center font-mono text-xs font-semibold transition-all focus:outline-none disabled:bg-slate-100 disabled:opacity-50 dark:disabled:bg-zinc-800 {isStsModified
										? 'border-amber-400 bg-amber-50/70 text-amber-900 ring-1 ring-amber-400/40 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200'
										: 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
								/>
							</td>

							<!-- Col: SAS Input -->
							<td class="p-1">
								<input
									type="text"
									inputmode="decimal"
									data-row={rowIndex}
									data-col={tujuanList.length + 1}
									disabled={!r.canNilai || isTerkunci}
									bind:value={r.sas}
									onfocus={handleFocus}
									placeholder="-"
									class="h-7 w-16 rounded-lg border text-center font-mono text-xs font-semibold transition-all focus:outline-none disabled:bg-slate-100 disabled:opacity-50 dark:disabled:bg-zinc-800 {isSasModified
										? 'border-amber-400 bg-amber-50/70 text-amber-900 ring-1 ring-amber-400/40 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200'
										: 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
								/>
							</td>

							<!-- Col: Nilai Akhir (NA) -->
							<td class="bg-blue-50/40 px-2 font-mono text-xs font-bold dark:bg-blue-950/20">
								{#if nilaiAkhir != null}
									<span
										class="inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold {isLulus
											? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
											: 'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'}"
									>
										{formatScore(nilaiAkhir)}
									</span>
								{:else}
									<span class="text-slate-300 dark:text-zinc-600">-</span>
								{/if}
							</td>

							<!-- Col: Action link to detail -->
							<td class="px-2 text-center">
								<a
									href={`/asesmen-sumatif/formulir-asesmen?kelas=${kelasId ?? r.mapelId}&murid_id=${r.id}&mapel_id=${r.mapelId}`}
									class="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-zinc-400 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
									title="Buka form rincian murid {r.nama}"
									target="_blank"
									rel="noreferrer"
								>
									<Icon name="edit" class="h-3.5 w-3.5" />
								</a>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>

<!-- Modal Quick Bulk Fill Column -->
{#if bulkModalCol}
	<div
		class="modal modal-open modal-bottom bg-slate-950/45 backdrop-blur-[2px] sm:modal-middle"
		role="dialog"
	>
		<div
			class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3
				class="flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold dark:border-zinc-800"
			>
				<span>⚡</span>
				<span>Isi Nilai Kolom {bulkModalCol.label} Sekaligus</span>
			</h3>
			<p class="mt-3 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
				Masukkan nilai angka (0 - 100) yang akan diterapkan ke
				<strong class="text-slate-800 dark:text-zinc-200">seluruh murid aktif</strong> pada kolom
				{bulkModalCol.label}. Anda masih dapat mengubahnya satuan sebelum disimpan.
			</p>

			<div class="mt-3">
				<label
					class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					for="bulk-input-field">Nilai (0 - 100):</label
				>
				<input
					id="bulk-input-field"
					type="text"
					inputmode="decimal"
					placeholder="Contoh: 85"
					bind:value={bulkValueInput}
					class="h-10 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-center font-mono text-base font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				/>
			</div>

			<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={() => (bulkModalCol = null)}
				>
					Batal
				</button>
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
					onclick={applyBulkValue}
				>
					Terapkan Nilai
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button type="button" onclick={() => (bulkModalCol = null)}>close</button>
		</form>
	</div>
{/if}
