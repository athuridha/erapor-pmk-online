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
		kkm?: number;
		isTerkunci?: boolean;
		canEdit?: boolean;
		sumatifWeights?: { lingkup: number; sts: number; sas: number };
		mapelNama?: string;
	};

	let {
		muridList = [],
		tujuanList = [],
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
			r.sts !== '' && !Number.isNaN(Number(r.sts))
				? Math.round(Number(r.sts) * 100) / 100
				: null;
		const sasNum =
			r.sas !== '' && !Number.isNaN(Number(r.sas))
				? Math.round(Number(r.sas) * 100) / 100
				: null;

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
		if (val == null || Number.isNaN(val)) return '—';
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
			toast(
				'Terjadi kesalahan saat menyimpan: ' + String((err as Error)?.message ?? err),
				'error'
			);
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
			return { label: 'UH/Tulis', cls: 'badge-primary' };
		}
		if (s.includes('tugas')) {
			return { label: 'Tugas', cls: 'badge-info' };
		}
		if (s.includes('kinerja') || s.includes('praktik')) {
			return { label: 'Praktik', cls: 'badge-secondary' };
		}
		if (s.includes('proyek') || s.includes('produk')) {
			return { label: 'Proyek', cls: 'badge-accent' };
		}
		return { label: singkatan || 'TP', cls: 'badge-ghost' };
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="space-y-3" onkeydown={handleKeyDown} role="region" aria-label="Matriks Penilaian Sumatif">
	<!-- Action / Status Toolbar -->
	<div
		class="bg-base-100 border-base-200 sticky top-14 z-30 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 shadow-sm backdrop-blur"
	>
		<!-- Left: Status & Search -->
		<div class="flex flex-wrap items-center gap-3">
			<div class="relative w-56">
				<input
					type="text"
					placeholder="Cari nama murid..."
					bind:value={searchFilter}
					class="input input-sm input-bordered w-full pr-8 text-xs"
				/>
				{#if searchFilter}
					<button
						type="button"
						class="text-base-content/40 hover:text-base-content absolute top-1/2 right-2 -translate-y-1/2"
						onclick={() => (searchFilter = '')}
						aria-label="Bersihkan pencarian"
					>
						<Icon name="close" />
					</button>
				{/if}
			</div>

			{#if isDirty}
				<div class="badge badge-warning gap-1.5 py-2.5 text-xs font-semibold shadow-xs">
					<span class="inline-block h-2 w-2 animate-ping rounded-full bg-amber-600"></span>
					{dirtyCount} nilai belum disimpan
				</div>
			{:else}
				<div class="badge badge-soft badge-success gap-1 text-xs text-emerald-700 dark:text-emerald-300">
					<Icon name="check" />
					Semua tersimpan
				</div>
			{/if}

			{#if isTerkunci}
				<div class="badge badge-error gap-1 text-xs">
					<Icon name="alert" />
					Nilai Terkunci
				</div>
			{/if}
		</div>

		<!-- Right: Action Buttons -->
		<div class="flex items-center gap-2">
			{#if isDirty}
				<button
					type="button"
					class="btn btn-ghost btn-sm text-xs"
					onclick={resetChanges}
					disabled={saving}
				>
					Batal
				</button>
			{/if}

			<button
				type="button"
				class="btn btn-primary btn-sm gap-1.5 shadow-sm"
				onclick={saveAll}
				disabled={saving || !isDirty || isTerkunci || !canEdit}
				title="Simpan perubahan (Tekan Ctrl + S)"
			>
				{#if saving}
					<span class="loading loading-spinner loading-xs"></span>
					Menyimpan...
				{:else}
					<Icon name="save" />
					<span>Simpan Nilai</span>
					<span class="text-primary-content/70 hidden text-[10px] sm:inline">(Ctrl+S)</span>
				{/if}
			</button>
		</div>
	</div>

	<!-- Instructions / Keyboard Hint Pill -->
	<div class="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-base-content/60">
		<div class="flex items-center gap-2">
			<span>💡 <strong>Tips Cepat:</strong> Tekan <kbd class="kbd kbd-xs">Enter</kbd> atau <kbd class="kbd kbd-xs">↓</kbd> untuk pindah murid ke bawah, <kbd class="kbd kbd-xs">Tab</kbd> untuk geser TP, dan <kbd class="kbd kbd-xs">Ctrl + S</kbd> untuk simpan.</span>
		</div>
		<div>
			<span><strong>{mapelNama}</strong> • KKM: <strong>{kkm}</strong> • Bobot: <strong>{sumatifWeights.lingkup}% Lingkup + {sumatifWeights.sts}% STS + {sumatifWeights.sas}% SAS</strong></span>
		</div>
	</div>

	<!-- Main Spreadsheet Matrix Table Container -->
	<div
		class="border-base-200 bg-base-100 max-h-[calc(100vh-250px)] overflow-auto rounded-lg border shadow-sm"
	>
		<table class="table-pin-rows table-pin-cols table table-xs min-w-full text-center">
			<thead>
				<tr class="bg-base-200/90 text-base-content border-b font-bold backdrop-blur">
					<!-- Sticky Col 1: No -->
					<th class="w-10 text-center font-bold">No</th>

					<!-- Sticky Col 2: Nama Murid -->
					<th class="min-w-48 max-w-56 text-left font-bold">Nama Murid</th>

					<!-- Dynamic TP Columns -->
					{#each tujuanList as t, idx (t.id)}
						{@const badge = getTeknikBadge(t.teknikSingkatan, t.teknikNama)}
						<th class="min-w-22 max-w-28 px-1.5 py-2">
							<div class="flex flex-col items-center gap-0.5">
								<div class="flex items-center gap-1">
									<span class="font-extrabold text-xs">TP {idx + 1}</span>
									<button
										type="button"
										class="btn btn-ghost btn-circle btn-xs h-4 w-4 p-0 opacity-40 hover:opacity-100"
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
									<span class="badge {badge.cls} badge-xs font-semibold cursor-help">
										{badge.label}
									</span>
								</div>
							</div>
						</th>
					{/each}

					<!-- Rata TP (NA Lingkup) Column -->
					<th class="bg-base-300/40 min-w-18 px-2 text-center text-xs font-bold">
						<div class="flex flex-col items-center">
							<span>Rata TP</span>
							<span class="text-[10px] font-normal text-base-content/60">({sumatifWeights.lingkup}%)</span>
						</div>
					</th>

					<!-- STS Column -->
					<th class="min-w-20 px-1 text-center">
						<div class="flex flex-col items-center">
							<div class="flex items-center gap-1">
								<span class="text-xs font-bold">STS</span>
								<button
									type="button"
									class="btn btn-ghost btn-circle btn-xs h-4 w-4 p-0 opacity-40 hover:opacity-100"
									onclick={() => openBulkModal('sts', undefined, 'STS')}
									title="Isi seluruh kolom STS sekaligus"
								>
									⚡
								</button>
							</div>
							<span class="text-[10px] font-normal text-base-content/60">({sumatifWeights.sts}%)</span>
						</div>
					</th>

					<!-- SAS Column -->
					<th class="min-w-20 px-1 text-center">
						<div class="flex flex-col items-center">
							<div class="flex items-center gap-1">
								<span class="text-xs font-bold">SAS</span>
								<button
									type="button"
									class="btn btn-ghost btn-circle btn-xs h-4 w-4 p-0 opacity-40 hover:opacity-100"
									onclick={() => openBulkModal('sas', undefined, 'SAS')}
									title="Isi seluruh kolom SAS sekaligus"
								>
									⚡
								</button>
							</div>
							<span class="text-[10px] font-normal text-base-content/60">({sumatifWeights.sas}%)</span>
						</div>
					</th>

					<!-- Nilai Akhir (NA) Column -->
					<th class="bg-primary/5 min-w-22 px-2 text-center text-xs font-extrabold text-primary">
						Nilai Akhir
					</th>

					<!-- Action Column -->
					<th class="w-14 text-center">Aksi</th>
				</tr>
			</thead>

			<tbody>
				{#if filteredRows.length === 0}
					<tr>
						<td colspan={tujuanList.length + 6} class="py-8 text-center text-base-content/60">
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
						<tr class="hover:bg-base-200/40 transition-colors">
							<!-- Col 1: No -->
							<td class="font-medium text-base-content/70 text-center">{r.no}</td>

							<!-- Col 2: Nama Murid -->
							<td class="text-left font-semibold">
								<div class="truncate max-w-52" title={r.nama}>
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
										placeholder="—"
										class="input input-xs h-7 w-16 text-center font-mono text-xs font-semibold transition-all {isCellModified
											? 'border-warning ring-1 ring-warning/50 bg-warning/5'
											: 'border-base-300 focus:border-primary focus:ring-1 focus:ring-primary'}"
									/>
								</td>
							{/each}

							<!-- Col: Rata TP (NA Lingkup) -->
							<td class="bg-base-200/30 font-mono text-xs font-bold text-base-content/80">
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
									placeholder="—"
									class="input input-xs h-7 w-16 text-center font-mono text-xs font-semibold transition-all {isStsModified
										? 'border-warning ring-1 ring-warning/50 bg-warning/5'
										: 'border-base-300 focus:border-primary focus:ring-1 focus:ring-primary'}"
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
									placeholder="—"
									class="input input-xs h-7 w-16 text-center font-mono text-xs font-semibold transition-all {isSasModified
										? 'border-warning ring-1 ring-warning/50 bg-warning/5'
										: 'border-base-300 focus:border-primary focus:ring-1 focus:ring-primary'}"
								/>
							</td>

							<!-- Col: Nilai Akhir (NA) -->
							<td class="bg-primary/5 font-mono text-xs font-extrabold">
								{#if nilaiAkhir != null}
									<span
										class="badge badge-sm font-mono font-bold {isLulus
											? 'badge-success text-success-content'
											: 'badge-warning text-warning-content'}"
									>
										{formatScore(nilaiAkhir)}
									</span>
								{:else}
									<span class="text-base-content/40">—</span>
								{/if}
							</td>

							<!-- Col: Action link to detail -->
							<td class="text-center">
								<a
									href={`/asesmen-sumatif/formulir-asesmen?kelas=${r.mapelId}&murid_id=${r.id}&mapel_id=${r.mapelId}`}
									class="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-primary"
									title="Buka form rincian murid {r.nama}"
									target="_blank"
									rel="noreferrer"
								>
									<Icon name="edit" />
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
	<div class="modal modal-open modal-bottom sm:modal-middle" role="dialog">
		<div class="modal-box">
			<h3 class="text-base font-bold flex items-center gap-2">
				<span>⚡</span>
				<span>Isi Nilai Kolom {bulkModalCol.label} Sekaligus</span>
			</h3>
			<p class="py-2 text-xs text-base-content/70">
				Masukkan nilai angka (0 - 100) yang akan diterapkan ke <strong>seluruh murid aktif</strong> pada kolom {bulkModalCol.label}. Anda masih dapat mengubahnya satuan sebelum disimpan.
			</p>

			<div class="py-3">
				<label class="block text-xs font-semibold mb-1" for="bulk-input-field">Nilai (0 - 100):</label>
				<input
					id="bulk-input-field"
					type="text"
					inputmode="decimal"
					placeholder="Contoh: 85"
					bind:value={bulkValueInput}
					class="input input-bordered w-full font-mono text-center font-bold text-lg"
				/>
			</div>

			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => (bulkModalCol = null)}
				>
					Batal
				</button>
				<button
					type="button"
					class="btn btn-primary btn-sm"
					onclick={applyBulkValue}
				>
					Terapkan Nilai
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => (bulkModalCol = null)}>close</button>
		</form>
	</div>
{/if}
