<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { invalidate } from '$app/navigation';
	import { tick } from 'svelte';

	export type JenisAsesmen = 'formatif' | 'sumatif' | 'as';

	export type MatriksTp = {
		id: number;
		no: number;
		mataPelajaranId: number;
		deskripsi: string;
		lingkupMateri: string;
		bobot: number;
		jenisAsesmen: JenisAsesmen;
		teknikPenilaianId: number | null;
		teknikNama: string | null;
		teknikSingkatan: string | null;
	};

	export type MatriksTeknik = {
		id: number;
		nama: string;
		singkatan: string;
	};

	export type MatriksMurid = {
		id: number;
		no: number;
		nama: string;
		agamaLabel?: string | null;
		mapelId: number | null;
		nilaiAkhirRts: number | null;
		nilaiAkhirAsli?: number | null;
		nilaiRevisi?: number | null;
		nilaiAkhir: number | null;
		naLingkup: number | null;
		sts: number | null;
		sas: number | null;
		canNilai: boolean;
		diisiUserLain?: boolean;
		tpScores?: Record<number, number | null>;
	};

	export type SumatifWeightsInfo = {
		lingkup: number;
		sts: number;
		sas: number;
		isCustom?: boolean;
		sekolahDefault?: { lingkup: number; sts: number; sas: number };
		rts?: { lingkup: number; sts: number };
	};

	type Props = {
		muridList: MatriksMurid[];
		tujuanList: MatriksTp[];
		teknikList?: MatriksTeknik[];
		kelasFase?: string | null;
		mapelId?: number | null;
		relevantMapelIds?: number[];
		kkm?: number;
		isTerkunci?: boolean;
		canEdit?: boolean;
		sumatifWeights?: SumatifWeightsInfo;
		mapelNama?: string;
		bobotModalOpen?: boolean;
	};

	let {
		muridList = [],
		tujuanList = [],
		teknikList = [],
		kelasFase = null,
		mapelId = null,
		relevantMapelIds = [],
		kkm = 75,
		isTerkunci = false,
		canEdit = true,
		sumatifWeights = { lingkup: 60, sts: 20, sas: 20 },
		mapelNama = 'Mata Pelajaran',
		bobotModalOpen = $bindable(false)
	}: Props = $props();

	type RowState = {
		id: number;
		no: number;
		nama: string;
		agamaLabel: string | null;
		mapelId: number | null;
		canNilai: boolean;
		tp: Record<number, string>;
		legacyNaF: number | null;
		legacySts: string;
		legacySas: string;
		revisi: string;
	};

	const formatifCols = $derived(tujuanList.filter((t) => t.jenisAsesmen === 'formatif'));
	const sumatifCols = $derived(tujuanList.filter((t) => t.jenisAsesmen === 'sumatif'));
	const asCols = $derived(tujuanList.filter((t) => t.jenisAsesmen === 'as'));

	const usesLegacySts = $derived(sumatifCols.length === 0);
	const usesLegacySas = $derived(asCols.length === 0);

	const editableMapelId = $derived(
		mapelId ?? relevantMapelIds[0] ?? muridList.find((m) => m.mapelId != null)?.mapelId ?? null
	);
	const effectiveMapelIds = $derived(
		relevantMapelIds.length > 0
			? relevantMapelIds
			: editableMapelId != null
				? [editableMapelId]
				: []
	);

	const canManageStructure = $derived(canEdit && !isTerkunci && editableMapelId != null);

	let searchFilter = $state('');
	let saving = $state(false);
	let initialSnapshot = $state<string>('');
	let rows = $state<RowState[]>([]);

	$effect(() => {
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
				agamaLabel: m.agamaLabel ?? null,
				mapelId: m.mapelId,
				canNilai: m.canNilai && canEdit && !isTerkunci,
				tp: tpMap,
				legacyNaF: m.naLingkup ?? null,
				legacySts: m.sts != null ? String(m.sts) : '',
				legacySas: m.sas != null ? String(m.sas) : '',
				revisi: m.nilaiRevisi != null ? String(m.nilaiRevisi) : ''
			};
		});
		rows = newRows;
		initialSnapshot = JSON.stringify(newRows);
	});

	const initialRowMap = $derived.by(() => {
		const map = new Map<number, RowState>();
		if (!initialSnapshot) return map;
		try {
			const init: RowState[] = JSON.parse(initialSnapshot);
			for (const item of init) map.set(item.id, item);
		} catch {
			// ignore
		}
		return map;
	});

	const isDirty = $derived.by(() => {
		if (!initialSnapshot) return false;
		return JSON.stringify(rows) !== initialSnapshot;
	});

	const dirtyCount = $derived.by(() => {
		if (!initialSnapshot) return 0;
		let count = 0;
		for (const r of rows) {
			const o = initialRowMap.get(r.id);
			if (!o) continue;
			if (usesLegacySts && r.legacySts !== o.legacySts) count++;
			if (usesLegacySas && r.legacySas !== o.legacySas) count++;
			if (r.revisi !== o.revisi) count++;
			for (const t of tujuanList) {
				if (r.tp[t.id] !== o.tp[t.id]) count++;
			}
		}
		return count;
	});

	const filteredRows = $derived.by(() => {
		const q = searchFilter.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((r) => r.nama.toLowerCase().includes(q));
	});

	// ---- Helpers format & kalkulasi ----
	function parseNum(raw: string | null | undefined): number | null {
		if (raw == null) return null;
		const trimmed = String(raw).trim().replace(',', '.');
		if (trimmed === '') return null;
		const num = Number(trimmed);
		if (!Number.isFinite(num)) return null;
		return Math.round(num * 100) / 100;
	}

	function isSelInvalid(val: string | null | undefined): boolean {
		const trimmed = String(val ?? '')
			.trim()
			.replace(',', '.');
		if (trimmed === '') return false;
		const num = Number(trimmed);
		return Number.isNaN(num) || num < 0 || num > 100;
	}

	function colWeight(bobot: number | null | undefined): number {
		const n = Number(bobot ?? 0);
		return Number.isFinite(n) && n > 0 ? n : 1;
	}

	function formatBobot(bobot: number | null | undefined): string {
		const w = colWeight(bobot);
		return Number.isInteger(w) ? String(w) : w.toFixed(1).replace(/\.0$/, '');
	}

	function formatScore(val: number | null): string {
		if (val == null || Number.isNaN(val)) return '-';
		return Number.isInteger(val) ? String(val) : val.toFixed(2);
	}

	function canEditTpForRow(r: RowState, t: MatriksTp): boolean {
		if (!r.canNilai || isTerkunci) return false;
		if (r.mapelId != null && t.mataPelajaranId !== r.mapelId) return false;
		return true;
	}

	function calcGroupAverage(r: RowState, cols: MatriksTp[]): number | null {
		let weightedSum = 0;
		let totalWeight = 0;
		for (const c of cols) {
			if (r.mapelId != null && c.mataPelajaranId !== r.mapelId) continue;
			const num = parseNum(r.tp[c.id]);
			if (num == null || num < 0 || num > 100) continue;
			const w = colWeight(c.bobot);
			weightedSum += num * w;
			totalWeight += w;
		}
		if (totalWeight <= 0) return null;
		return Math.round((weightedSum / totalWeight) * 100) / 100;
	}

	function calcNaF(r: RowState): number | null {
		if (formatifCols.length > 0) return calcGroupAverage(r, formatifCols);
		return r.legacyNaF;
	}

	function calcNaS(r: RowState): number | null {
		if (!usesLegacySts) return calcGroupAverage(r, sumatifCols);
		const num = parseNum(r.legacySts);
		return num != null && num >= 0 && num <= 100 ? num : null;
	}

	function calcNaAs(r: RowState): number | null {
		if (!usesLegacySas) return calcGroupAverage(r, asCols);
		const num = parseNum(r.legacySas);
		return num != null && num >= 0 && num <= 100 ? num : null;
	}

	function calcNilaiAkhirAsli(r: RowState): number | null {
		const f = calcNaF(r);
		const s = calcNaS(r);
		const a = calcNaAs(r);
		let weighted = 0;
		let totalW = 0;
		if (f != null && sumatifWeights.lingkup > 0) {
			weighted += f * sumatifWeights.lingkup;
			totalW += sumatifWeights.lingkup;
		}
		if (s != null && sumatifWeights.sts > 0) {
			weighted += s * sumatifWeights.sts;
			totalW += sumatifWeights.sts;
		}
		if (a != null && sumatifWeights.sas > 0) {
			weighted += a * sumatifWeights.sas;
			totalW += sumatifWeights.sas;
		}
		if (totalW <= 0) return null;
		return Math.round((weighted / totalW) * 100) / 100;
	}

	function calcNilaiEfektif(r: RowState): number | null {
		const rev = parseNum(r.revisi);
		if (rev != null && rev >= 0 && rev <= 100) return rev;
		return calcNilaiAkhirAsli(r);
	}

	function prefixForJenis(jenis: JenisAsesmen): string {
		if (jenis === 'sumatif') return '(S)';
		if (jenis === 'as') return '(AS)';
		return '(F)';
	}

	function groupTitle(jenis: JenisAsesmen): string {
		if (jenis === 'sumatif') return 'Sumatif (S)';
		if (jenis === 'as') return 'Sumatif AS (AS)';
		return 'Formatif (F)';
	}

	function colShortLabel(col: MatriksTp, idx: number): string {
		const pref = prefixForJenis(col.jenisAsesmen);
		const raw = col.lingkupMateri?.trim();
		if (raw && raw.toLowerCase() !== 'tanpa lingkup materi') {
			return raw.startsWith(pref) ? raw : `${pref} ${raw}`;
		}
		if (col.jenisAsesmen === 'as') return '(AS)';
		if (kelasFase) return `${pref} Fase ${kelasFase}`;
		return `${pref} #${idx + 1}`;
	}

	// Sequential input column indexing for Excel-like keyboard navigation
	const inputColOrder = $derived.by(() => {
		const list: string[] = [];
		for (const c of formatifCols) list.push(`tp:${c.id}`);
		if (usesLegacySts) list.push('legacySts');
		else for (const c of sumatifCols) list.push(`tp:${c.id}`);
		if (usesLegacySas) list.push('legacySas');
		else for (const c of asCols) list.push(`tp:${c.id}`);
		list.push('revisi');
		return list;
	});

	function colNavIndex(key: string): number {
		return inputColOrder.indexOf(key);
	}

	// ---- Mobile column selector ----
	type KolomMobile = {
		key: string;
		kind: 'tp' | 'legacySts' | 'legacySas' | 'revisi';
		group: JenisAsesmen | 'revisi';
		col?: MatriksTp;
		label: string;
		sub: string;
		bobotLabel?: string;
		deskripsi?: string;
		lingkupMateri?: string;
	};

	const kolomMobile = $derived.by<KolomMobile[]>(() => {
		const cols: KolomMobile[] = [];
		formatifCols.forEach((c, idx) => {
			cols.push({
				key: `tp:${c.id}`,
				kind: 'tp',
				group: 'formatif',
				col: c,
				label: colShortLabel(c, idx),
				sub: `Bobot ${formatBobot(c.bobot)}`,
				bobotLabel: formatBobot(c.bobot),
				lingkupMateri: c.lingkupMateri,
				deskripsi: c.deskripsi
			});
		});
		if (usesLegacySts) {
			cols.push({
				key: 'legacySts',
				kind: 'legacySts',
				group: 'sumatif',
				label: kelasFase ? `(S) Fase ${kelasFase}` : '(S) Sumatif',
				sub: 'Bobot 1',
				bobotLabel: '1',
				deskripsi: 'Sumatif Tengah Semester / Lingkup Materi'
			});
		} else {
			sumatifCols.forEach((c, idx) => {
				cols.push({
					key: `tp:${c.id}`,
					kind: 'tp',
					group: 'sumatif',
					col: c,
					label: colShortLabel(c, idx),
					sub: `Bobot ${formatBobot(c.bobot)}`,
					bobotLabel: formatBobot(c.bobot),
					lingkupMateri: c.lingkupMateri,
					deskripsi: c.deskripsi
				});
			});
		}
		if (usesLegacySas) {
			cols.push({
				key: 'legacySas',
				kind: 'legacySas',
				group: 'as',
				label: '(AS)',
				sub: 'Bobot 1',
				bobotLabel: '1',
				deskripsi: 'Sumatif Akhir Semester'
			});
		} else {
			asCols.forEach((c, idx) => {
				cols.push({
					key: `tp:${c.id}`,
					kind: 'tp',
					group: 'as',
					col: c,
					label: colShortLabel(c, idx),
					sub: `Bobot ${formatBobot(c.bobot)}`,
					bobotLabel: formatBobot(c.bobot),
					lingkupMateri: c.lingkupMateri,
					deskripsi: c.deskripsi
				});
			});
		}
		cols.push({
			key: 'revisi',
			kind: 'revisi',
			group: 'revisi',
			label: 'REVISI',
			sub: 'Opsional',
			deskripsi:
				'Nilai perbaikan manual. Jika diisi, nilai ini menggantikan AKHIR pada rapor, legger, dan rekap.'
		});
		return cols;
	});

	let kolomAktifKey = $state('');
	const kolomAktif = $derived(
		kolomMobile.find((c) => c.key === kolomAktifKey) ?? kolomMobile[0] ?? null
	);

	function nilaiSel(r: RowState, kolom: KolomMobile | null): string {
		if (!kolom) return '';
		if (kolom.kind === 'tp' && kolom.col) return r.tp[kolom.col.id] ?? '';
		if (kolom.kind === 'legacySts') return r.legacySts;
		if (kolom.kind === 'legacySas') return r.legacySas;
		return r.revisi;
	}

	function ubahNilaiSel(r: RowState, kolom: KolomMobile | null, value: string) {
		if (!kolom) return;
		if (kolom.kind === 'tp' && kolom.col) r.tp[kolom.col.id] = value;
		else if (kolom.kind === 'legacySts') r.legacySts = value;
		else if (kolom.kind === 'legacySas') r.legacySas = value;
		else r.revisi = value;
	}

	function isSelModified(r: RowState, kolom: KolomMobile | null): boolean {
		if (!kolom) return false;
		const orig = initialRowMap.get(r.id);
		if (!orig) return false;
		if (kolom.kind === 'tp' && kolom.col) return orig.tp?.[kolom.col.id] !== r.tp[kolom.col.id];
		if (kolom.kind === 'legacySts') return orig.legacySts !== r.legacySts;
		if (kolom.kind === 'legacySas') return orig.legacySas !== r.legacySas;
		return orig.revisi !== r.revisi;
	}

	function isRowEditableForKolom(r: RowState, kolom: KolomMobile | null): boolean {
		if (!kolom || !r.canNilai || isTerkunci) return false;
		if (kolom.kind === 'tp' && kolom.col) return canEditTpForRow(r, kolom.col);
		return true;
	}

	const terisiAktif = $derived(
		kolomAktif
			? filteredRows.filter(
					(r) => isRowEditableForKolom(r, kolomAktif) && nilaiSel(r, kolomAktif).trim() !== ''
				).length
			: 0
	);

	function handleMobileInputKeyDown(event: KeyboardEvent, rowIdx: number) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		for (let next = rowIdx + 1; next < filteredRows.length; next++) {
			const nextInput = document.querySelector<HTMLInputElement>(
				`input[data-mobile-row="${next}"]:not(:disabled)`
			);
			if (nextInput) {
				nextInput.focus();
				nextInput.select();
				break;
			}
		}
	}

	// ---- Keyboard navigation (Excel-style) ----
	function handleKeyDown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			if (isDirty && !saving && !isTerkunci && canEdit) {
				void saveAll();
			}
			return;
		}

		const target = event.target as HTMLInputElement | null;
		if (!target || !target.hasAttribute('data-row') || !target.hasAttribute('data-col')) {
			return;
		}

		const r = Number(target.getAttribute('data-row'));
		const c = Number(target.getAttribute('data-col'));
		const maxCol = Math.max(0, inputColOrder.length - 1);
		const maxRow = Math.max(0, filteredRows.length - 1);

		let nextRow = r;
		let nextCol = c;

		if (event.key === 'Enter' || event.key === 'ArrowDown') {
			event.preventDefault();
			nextRow = Math.min(maxRow, r + 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			nextRow = Math.max(0, r - 1);
		} else if (event.key === 'Tab' && !event.shiftKey) {
			if (c < maxCol) {
				event.preventDefault();
				nextCol = c + 1;
			} else if (r < maxRow) {
				event.preventDefault();
				nextRow = r + 1;
				nextCol = 0;
			}
		} else if (event.key === 'Tab' && event.shiftKey) {
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
			const selector = `input[data-row="${nextRow}"][data-col="${nextCol}"]:not(:disabled)`;
			const nextInput = document.querySelector<HTMLInputElement>(selector);
			if (nextInput) {
				nextInput.focus();
				nextInput.select();
			}
		}
	}

	function handleFocus(event: FocusEvent) {
		const target = event.target as HTMLInputElement | null;
		target?.select();
	}

	// ---- Save matrix values ----
	async function saveAll() {
		if (isTerkunci) {
			toast('Penilaian terkunci dan tidak dapat diubah.', 'error');
			return;
		}
		if (!rows.length) return;

		for (const r of rows) {
			if (!r.canNilai) continue;
			for (const t of tujuanList) {
				if (isSelInvalid(r.tp[t.id])) {
					toast(
						`Nilai ${r.nama} pada ${t.lingkupMateri || 'kolom'} harus antara 0 - 100.`,
						'error'
					);
					return;
				}
			}
			if (usesLegacySts && isSelInvalid(r.legacySts)) {
				toast(`Nilai Sumatif (S) untuk ${r.nama} harus antara 0 - 100.`, 'error');
				return;
			}
			if (usesLegacySas && isSelInvalid(r.legacySas)) {
				toast(`Nilai Sumatif AS untuk ${r.nama} harus antara 0 - 100.`, 'error');
				return;
			}
			if (isSelInvalid(r.revisi)) {
				toast(`Nilai Revisi untuk ${r.nama} harus antara 0 - 100.`, 'error');
				return;
			}
		}

		saving = true;
		try {
			const payload = rows
				.filter((r) => r.canNilai && r.mapelId != null)
				.map((r) => {
					const tpScores: Record<number, number | null> = {};
					for (const t of tujuanList) {
						if (t.mataPelajaranId !== r.mapelId) continue;
						tpScores[t.id] = parseNum(r.tp[t.id]);
					}
					return {
						muridId: r.id,
						mapelId: r.mapelId,
						tpScores,
						legacySts: usesLegacySts ? parseNum(r.legacySts) : undefined,
						legacySas: usesLegacySas ? parseNum(r.legacySas) : undefined,
						nilaiRevisi: parseNum(r.revisi)
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
			toast(`Berhasil menyimpan nilai untuk ${payload.length} murid.`, 'success');
			await invalidate('app:asesmen-sumatif');
		} catch (err) {
			toast('Terjadi kesalahan saat menyimpan: ' + String((err as Error)?.message ?? err), 'error');
		} finally {
			saving = false;
		}
	}

	function resetChanges() {
		if (!initialSnapshot) return;
		try {
			rows = JSON.parse(initialSnapshot);
			toast('Perubahan nilai dibatalkan.', 'info');
		} catch {
			// ignore
		}
	}

	// ---- Modal 1: Bulk Fill ----
	let bulkModalCol = $state<{
		kind: 'tp' | 'legacySts' | 'legacySas' | 'revisi';
		tpId?: number;
		label: string;
	} | null>(null);
	let bulkValueInput = $state('');

	function openBulkModal(
		kind: 'tp' | 'legacySts' | 'legacySas' | 'revisi',
		label: string,
		tpId?: number
	) {
		bulkModalCol = { kind, tpId, label };
		bulkValueInput = '';
	}

	function applyBulkValue() {
		if (!bulkModalCol) return;
		const val = bulkValueInput.trim().replace(',', '.');
		const num = Number(val);
		if (val !== '' && (Number.isNaN(num) || num < 0 || num > 100)) {
			toast('Nilai harus berupa angka antara 0 - 100.', 'error');
			return;
		}
		const targetTp = bulkModalCol.tpId ? tujuanList.find((t) => t.id === bulkModalCol?.tpId) : null;

		for (const r of rows) {
			if (!r.canNilai) continue;
			if (bulkModalCol.kind === 'tp' && bulkModalCol.tpId) {
				if (targetTp && r.mapelId != null && targetTp.mataPelajaranId !== r.mapelId) continue;
				r.tp[bulkModalCol.tpId] = val;
			} else if (bulkModalCol.kind === 'legacySts') {
				r.legacySts = val;
			} else if (bulkModalCol.kind === 'legacySas') {
				r.legacySas = val;
			} else if (bulkModalCol.kind === 'revisi') {
				r.revisi = val;
			}
		}

		toast(
			val === ''
				? `Kolom ${bulkModalCol.label} dikosongkan. Klik Simpan Nilai untuk menerapkan.`
				: `Kolom ${bulkModalCol.label} diisi ${val}. Klik Simpan Nilai untuk menyimpan.`,
			'success'
		);
		bulkModalCol = null;
	}

	// ---- Modal 2: Detail Kolom (Eye icon) ----
	let detailModal = $state<{
		kind: 'tp' | 'legacySts' | 'legacySas';
		col?: MatriksTp;
		jenis: JenisAsesmen;
		label: string;
		deskripsi: string;
		bobot: number;
		teknikNama: string | null;
	} | null>(null);

	function openDetailCol(col: MatriksTp, idx: number) {
		detailModal = {
			kind: 'tp',
			col,
			jenis: col.jenisAsesmen,
			label: colShortLabel(col, idx),
			deskripsi: col.deskripsi,
			bobot: colWeight(col.bobot),
			teknikNama: col.teknikNama
		};
	}

	function openDetailLegacy(jenis: 'sumatif' | 'as') {
		detailModal = {
			kind: jenis === 'sumatif' ? 'legacySts' : 'legacySas',
			jenis,
			label: jenis === 'sumatif' ? (kelasFase ? `(S) Fase ${kelasFase}` : '(S) Sumatif') : '(AS)',
			deskripsi:
				jenis === 'sumatif'
					? 'Sumatif Tengah Semester / Lingkup Materi (kolom bawaan)'
					: 'Sumatif Akhir Semester (kolom bawaan)',
			bobot: 1,
			teknikNama: null
		};
	}

	function calcDetailStats(modal: NonNullable<typeof detailModal>) {
		const values: number[] = [];
		for (const r of rows) {
			if (!r.canNilai) continue;
			const raw =
				modal.kind === 'tp' && modal.col
					? r.tp[modal.col.id]
					: modal.kind === 'legacySts'
						? r.legacySts
						: r.legacySas;
			const n = parseNum(raw);
			if (n != null && n >= 0 && n <= 100) values.push(n);
		}
		const avg =
			values.length > 0
				? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
				: null;
		return { filled: values.length, total: rows.filter((r) => r.canNilai).length, avg };
	}

	// ---- Modal 3: Tambah / Edit Kolom & Bobot Kolom ----
	let colFormModal = $state<{
		mode: 'create' | 'edit' | 'materialize';
		id?: number;
		jenisAsesmen: JenisAsesmen;
		lingkupMateri: string;
		deskripsi: string;
		bobot: string;
		teknikPenilaianId: string;
		focusBobot?: boolean;
	} | null>(null);
	let colFormSaving = $state(false);

	$effect(() => {
		const modal = colFormModal;
		if (!modal) return;
		const targetId = modal.focusBobot ? 'col-bobot-input' : 'col-lingkup-input';
		void tick().then(() => {
			const el = document.getElementById(targetId) as HTMLInputElement | null;
			el?.focus();
			el?.select();
		});
	});

	function guardUnsavedBeforeStructure(): boolean {
		if (!isDirty) return true;
		toast('Simpan atau batalkan perubahan nilai terlebih dahulu sebelum mengubah kolom.', 'error');
		return false;
	}

	function openAddColModal(jenis: JenisAsesmen) {
		if (!canManageStructure) return;
		if (!guardUnsavedBeforeStructure()) return;
		const nextNo =
			jenis === 'formatif'
				? formatifCols.length + 1
				: jenis === 'sumatif'
					? sumatifCols.length + 1
					: asCols.length + 1;
		const defaultLabel =
			jenis === 'as'
				? nextNo > 1
					? `AS ${nextNo}`
					: 'AS'
				: kelasFase
					? `Fase ${kelasFase}`
					: jenis === 'sumatif'
						? `Sumatif ${nextNo}`
						: `Formatif ${nextNo}`;
		const defaultDesc =
			jenis === 'as'
				? 'Sumatif Akhir Semester'
				: jenis === 'sumatif'
					? `Sumatif ${kelasFase ? `Fase ${kelasFase}` : nextNo}`
					: '';
		colFormModal = {
			mode: 'create',
			jenisAsesmen: jenis,
			lingkupMateri: defaultLabel,
			deskripsi: defaultDesc,
			bobot: '1',
			teknikPenilaianId: ''
		};
	}

	function openEditColModal(col: MatriksTp, focusBobot = false) {
		if (!canManageStructure) return;
		if (!guardUnsavedBeforeStructure()) return;
		colFormModal = {
			mode: 'edit',
			id: col.id,
			jenisAsesmen: col.jenisAsesmen,
			lingkupMateri: col.lingkupMateri,
			deskripsi: col.deskripsi,
			bobot: formatBobot(col.bobot),
			teknikPenilaianId: col.teknikPenilaianId != null ? String(col.teknikPenilaianId) : '',
			focusBobot
		};
	}

	function openMaterializeLegacyModal(jenis: 'sumatif' | 'as', focusBobot = false) {
		if (!canManageStructure) return;
		if (!guardUnsavedBeforeStructure()) return;
		colFormModal = {
			mode: 'materialize',
			jenisAsesmen: jenis,
			lingkupMateri: jenis === 'sumatif' ? (kelasFase ? `Fase ${kelasFase}` : 'Sumatif 1') : 'AS',
			deskripsi: jenis === 'sumatif' ? 'Sumatif Tengah Semester' : 'Sumatif Akhir Semester',
			bobot: '1',
			teknikPenilaianId: '',
			focusBobot
		};
	}

	async function submitColForm(event: Event) {
		event.preventDefault();
		if (!colFormModal || colFormSaving) return;

		const bobotNum = Number(colFormModal.bobot.trim().replace(',', '.'));
		if (!Number.isFinite(bobotNum) || bobotNum <= 0 || bobotNum > 100) {
			toast('Bobot kolom harus angka lebih dari 0 (maksimal 100).', 'error');
			return;
		}
		if (!colFormModal.deskripsi.trim()) {
			toast('Deskripsi tujuan pembelajaran / keterangan wajib diisi.', 'error');
			return;
		}

		colFormSaving = true;
		try {
			const formData = new FormData();
			let actionUrl = '?/tambahKolom';

			if (colFormModal.mode === 'edit' && colFormModal.id) {
				actionUrl = '?/ubahKolom';
				formData.append('id', String(colFormModal.id));
			} else {
				formData.append('mapelId', String(editableMapelId));
				formData.append('jenisAsesmen', colFormModal.jenisAsesmen);
				if (colFormModal.mode === 'materialize') {
					formData.append('materializeLegacy', '1');
				}
			}

			formData.append('lingkupMateri', colFormModal.lingkupMateri.trim());
			formData.append('deskripsi', colFormModal.deskripsi.trim());
			formData.append('bobot', String(bobotNum));
			formData.append('teknikPenilaianId', colFormModal.teknikPenilaianId);

			const res = await fetch(actionUrl, { method: 'POST', body: formData });
			const result = await res.json().catch(() => null);
			if (!res.ok || (result?.type && result.type !== 'success')) {
				const msg = result?.data?.fail || result?.message || 'Gagal menyimpan kolom penilaian.';
				toast(msg, 'error');
				return;
			}

			toast(
				colFormModal.mode === 'edit'
					? 'Kolom penilaian berhasil diperbarui.'
					: 'Kolom penilaian berhasil ditambahkan.',
				'success'
			);
			colFormModal = null;
			await invalidate('app:asesmen-sumatif');
		} catch (err) {
			toast('Gagal menyimpan kolom: ' + String((err as Error)?.message ?? err), 'error');
		} finally {
			colFormSaving = false;
		}
	}

	// ---- Modal 4: Hapus Kolom ----
	let deleteModalCol = $state<{ col: MatriksTp; label: string } | null>(null);
	let deletingCol = $state(false);

	function openDeleteColModal(col: MatriksTp, idx: number) {
		if (!canManageStructure) return;
		if (!guardUnsavedBeforeStructure()) return;
		deleteModalCol = { col, label: colShortLabel(col, idx) };
	}

	async function confirmDeleteCol() {
		if (!deleteModalCol || deletingCol) return;
		deletingCol = true;
		try {
			const formData = new FormData();
			formData.append('id', String(deleteModalCol.col.id));
			const res = await fetch('?/hapusKolom', { method: 'POST', body: formData });
			const result = await res.json().catch(() => null);
			if (!res.ok || (result?.type && result.type !== 'success')) {
				const msg = result?.data?.fail || result?.message || 'Gagal menghapus kolom.';
				toast(msg, 'error');
				return;
			}
			toast(`Kolom ${deleteModalCol.label} dihapus.`, 'success');
			deleteModalCol = null;
			await invalidate('app:asesmen-sumatif');
		} catch (err) {
			toast('Gagal menghapus kolom: ' + String((err as Error)?.message ?? err), 'error');
		} finally {
			deletingCol = false;
		}
	}

	// ---- Modal 5: Bobot Kelompok per Mapel (F / S / AS) ----
	let bobotFInput = $state(60);
	let bobotSInput = $state(20);
	let bobotAsInput = $state(20);
	let bobotMapelSaving = $state(false);

	$effect(() => {
		if (bobotModalOpen) {
			bobotFInput = sumatifWeights.lingkup;
			bobotSInput = sumatifWeights.sts;
			bobotAsInput = sumatifWeights.sas;
		}
	});

	const totalBobotMapel = $derived(
		(Number(bobotFInput) || 0) + (Number(bobotSInput) || 0) + (Number(bobotAsInput) || 0)
	);

	function openBobotMapelModal() {
		if (!canManageStructure) return;
		if (!guardUnsavedBeforeStructure()) return;
		bobotModalOpen = true;
	}

	async function submitBobotMapel(resetToSchoolDefault = false) {
		if (bobotMapelSaving || !effectiveMapelIds.length) return;
		if (!resetToSchoolDefault && totalBobotMapel !== 100) {
			toast(`Total bobot F + S + AS harus 100% (saat ini ${totalBobotMapel}%).`, 'error');
			return;
		}

		bobotMapelSaving = true;
		try {
			const formData = new FormData();
			formData.append('mapelIds', JSON.stringify(effectiveMapelIds));
			if (resetToSchoolDefault) {
				formData.append('reset', '1');
			} else {
				formData.append('bobotFormatif', String(Math.round(Number(bobotFInput) || 0)));
				formData.append('bobotSumatif', String(Math.round(Number(bobotSInput) || 0)));
				formData.append('bobotAs', String(Math.round(Number(bobotAsInput) || 0)));
			}

			const res = await fetch('?/simpanBobotMapel', { method: 'POST', body: formData });
			const result = await res.json().catch(() => null);
			if (!res.ok || (result?.type && result.type !== 'success')) {
				const msg = result?.data?.fail || result?.message || 'Gagal menyimpan bobot mapel.';
				toast(msg, 'error');
				return;
			}

			toast(
				resetToSchoolDefault
					? 'Bobot mapel dikembalikan mengikuti default sekolah.'
					: `Bobot mapel disimpan (${bobotFInput}% F / ${bobotSInput}% S / ${bobotAsInput}% AS).`,
				'success'
			);
			bobotModalOpen = false;
			await invalidate('app:asesmen-sumatif');
		} catch (err) {
			toast('Gagal menyimpan bobot mapel: ' + String((err as Error)?.message ?? err), 'error');
		} finally {
			bobotMapelSaving = false;
		}
	}

	const totalDesktopCols = $derived(
		2 +
			Math.max(1, formatifCols.length) +
			1 +
			Math.max(1, sumatifCols.length) +
			1 +
			Math.max(1, asCols.length) +
			1 +
			2
	);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="space-y-3 pb-24 md:pb-0"
	onkeydown={handleKeyDown}
	role="region"
	aria-label="Matriks Penilaian Terpadu"
>
	<!-- Toolbar desktop -->
	<div
		class="sticky top-14 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-xs backdrop-blur-sm max-md:hidden dark:border-zinc-800 dark:bg-zinc-900/95"
	>
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
					placeholder="Cari nama peserta didik..."
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
					<Icon name="lock" class="h-3.5 w-3.5" />
					Nilai Terkunci
				</div>
			{/if}
		</div>

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

	<!-- Hint & Ringkasan Bobot (desktop) -->
	<div
		class="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 max-md:hidden dark:text-zinc-400"
	>
		<span>
			Navigasi:
			<kbd
				class="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
				>Enter</kbd
			>
			pindah baris,
			<kbd
				class="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
				>Tab</kbd
			>
			pindah kolom,
			<kbd
				class="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
				>Ctrl+S</kbd
			>
			simpan. Kolom <strong>REVISI</strong> menggantikan <strong>AKHIR</strong> di rapor bila diisi.
		</span>
		<span>
			<strong class="text-slate-700 dark:text-zinc-200">{mapelNama}</strong> · KKM
			<strong class="text-slate-700 dark:text-zinc-200">{kkm}</strong> · Bobot
			<strong class="text-slate-700 dark:text-zinc-200"
				>F {sumatifWeights.lingkup}% · S {sumatifWeights.sts}% · AS {sumatifWeights.sas}%</strong
			>
			{#if sumatifWeights.isCustom}
				<span
					class="ml-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
				>
					Kustom Mapel
				</span>
			{/if}
		</span>
	</div>

	<!-- ==================== MOBILE VIEW ==================== -->
	<div class="space-y-2.5 md:hidden">
		<div class="flex items-center gap-2">
			<div class="relative flex min-w-0 flex-1 items-center">
				<span
					aria-hidden="true"
					class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="search" class="h-4 w-4" />
				</span>
				<input
					type="text"
					placeholder="Cari nama peserta didik..."
					bind:value={searchFilter}
					aria-label="Cari nama peserta didik"
					class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white pr-10 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				/>
				{#if searchFilter}
					<button
						type="button"
						class="absolute right-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-400"
						onclick={() => (searchFilter = '')}
						aria-label="Bersihkan pencarian"
					>
						<Icon name="close" class="h-4 w-4" />
					</button>
				{/if}
			</div>
			{#if isDirty}
				<span
					class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
				>
					<span class="h-2 w-2 rounded-full bg-amber-500"></span>
					{dirtyCount}
				</span>
			{:else}
				<span
					class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
					aria-label="Semua nilai tersimpan"
				>
					<Icon name="check" class="h-4 w-4" />
				</span>
			{/if}
		</div>

		{#if isTerkunci}
			<div
				class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
			>
				<Icon name="lock" class="h-4 w-4 shrink-0" />
				Nilai sudah terkunci dan tidak dapat diubah.
			</div>
		{/if}

		<!-- Aksi cepat struktur kolom di HP -->
		{#if canManageStructure}
			<div class="grid grid-cols-3 gap-1.5">
				<button
					type="button"
					class="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-blue-200 bg-blue-50/70 px-2 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-100/70 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
					onclick={() => openAddColModal('formatif')}
				>
					<Icon name="plus" class="h-3.5 w-3.5 shrink-0" />
					Formatif
				</button>
				<button
					type="button"
					class="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50/70 px-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100/70 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
					onclick={() => openAddColModal('sumatif')}
				>
					<Icon name="plus" class="h-3.5 w-3.5 shrink-0" />
					Sumatif
				</button>
				<button
					type="button"
					class="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-sky-200 bg-sky-50/70 px-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100/70 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200"
					onclick={() => openAddColModal('as')}
				>
					<Icon name="plus" class="h-3.5 w-3.5 shrink-0" />
					AS
				</button>
			</div>
		{/if}

		<div>
			<p
				class="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-zinc-400"
			>
				<span>Pilih kolom yang diisi</span>
				<span class="tabular-nums">{terisiAktif}/{filteredRows.length} terisi</span>
			</p>
			<div class="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
				{#each kolomMobile as kolom (kolom.key)}
					<button
						type="button"
						class="min-h-11 shrink-0 snap-start rounded-xl border px-3 py-2 text-left transition-colors {kolomAktif?.key ===
						kolom.key
							? 'border-blue-600 bg-blue-600 text-white shadow-sm'
							: 'border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}"
						onclick={() => (kolomAktifKey = kolom.key)}
						aria-pressed={kolomAktif?.key === kolom.key}
					>
						<span class="block text-xs font-bold leading-tight">{kolom.label}</span>
						<span class="block text-[10px] font-medium leading-tight opacity-80">{kolom.sub}</span>
					</button>
				{/each}
			</div>

			{#if kolomAktif}
				<div
					class="mt-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/50"
				>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="text-xs font-bold text-slate-900 dark:text-zinc-100">
								{kolomAktif.label}
							</span>
							{#if kolomAktif.bobotLabel}
								<button
									type="button"
									class="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 disabled:opacity-60 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300"
									disabled={!canManageStructure}
									onclick={() => {
										if (kolomAktif.kind === 'tp' && kolomAktif.col) {
											openEditColModal(kolomAktif.col, true);
										} else if (kolomAktif.kind === 'legacySts') {
											openMaterializeLegacyModal('sumatif', true);
										} else if (kolomAktif.kind === 'legacySas') {
											openMaterializeLegacyModal('as', true);
										}
									}}
								>
									Bobot: {kolomAktif.bobotLabel}
								</button>
							{/if}
						</div>
						<div class="flex items-center gap-1">
							{#if canManageStructure && kolomAktif.kind === 'tp' && kolomAktif.col}
								{@const activeTp = kolomAktif.col}
								<button
									type="button"
									class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-emerald-400"
									onclick={() => openEditColModal(activeTp)}
									aria-label="Edit kolom {kolomAktif.label}"
								>
									<Icon name="edit" class="h-3.5 w-3.5" />
								</button>
								<button
									type="button"
									class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-red-400"
									onclick={() => openDeleteColModal(activeTp, 0)}
									aria-label="Hapus kolom {kolomAktif.label}"
								>
									<Icon name="del" class="h-3.5 w-3.5" />
								</button>
							{/if}
							<button
								type="button"
								class="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
								onclick={() => openBulkModal(kolomAktif.kind, kolomAktif.label, kolomAktif.col?.id)}
								disabled={isTerkunci || !canEdit}
							>
								<Icon name="copy" class="h-3.5 w-3.5" />
								Isi semua
							</button>
						</div>
					</div>
					{#if kolomAktif.deskripsi}
						<p class="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
							{kolomAktif.deskripsi}
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<div class="space-y-2">
			{#if filteredRows.length === 0}
				<p
					class="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500 dark:border-zinc-700 dark:text-zinc-400"
				>
					{searchFilter
						? `Tidak ditemukan peserta didik dengan nama "${searchFilter}".`
						: 'Belum ada data peserta didik untuk kelas ini.'}
				</p>
			{:else}
				{#each filteredRows as r, rowIdx (r.id)}
					{@const naF = calcNaF(r)}
					{@const naS = calcNaS(r)}
					{@const naAs = calcNaAs(r)}
					{@const naAsli = calcNilaiAkhirAsli(r)}
					{@const naEfektif = calcNilaiEfektif(r)}
					{@const hasRev = parseNum(r.revisi) != null}
					{@const lulus = naEfektif != null && naEfektif >= kkm}
					{@const selVal = nilaiSel(r, kolomAktif)}
					{@const selInvalid = isSelInvalid(selVal)}
					{@const selModified = isSelModified(r, kolomAktif)}
					{@const editable = isRowEditableForKolom(r, kolomAktif)}
					<div
						class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
					>
						<span
							class="w-5 shrink-0 text-center text-xs font-semibold text-slate-400 tabular-nums dark:text-zinc-500"
							>{r.no}</span
						>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
								{r.nama}
							</p>
							<p
								class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tabular-nums"
							>
								<span
									class="font-bold {naEfektif == null
										? 'text-slate-400 dark:text-zinc-500'
										: lulus
											? 'text-teal-700 dark:text-teal-400'
											: 'text-amber-600 dark:text-amber-400'}"
								>
									{hasRev ? 'Revisi' : 'Akhir'}
									{formatScore(naEfektif)}
								</span>
								{#if hasRev && naAsli != null}
									<span class="text-slate-400 line-through dark:text-zinc-500">
										{formatScore(naAsli)}
									</span>
								{/if}
								<span class="text-slate-300 dark:text-zinc-600">·</span>
								<span class="text-slate-500 dark:text-zinc-400">
									F {formatScore(naF)} · S {formatScore(naS)} · AS {formatScore(naAs)}
								</span>
							</p>
						</div>
						<input
							type="text"
							inputmode="decimal"
							enterkeyhint="next"
							maxlength="6"
							data-mobile-row={rowIdx}
							value={selVal}
							oninput={(event) => ubahNilaiSel(r, kolomAktif, event.currentTarget.value)}
							onfocus={(event) => event.currentTarget.select()}
							onkeydown={(event) => handleMobileInputKeyDown(event, rowIdx)}
							disabled={!editable}
							placeholder="-"
							aria-invalid={selInvalid}
							aria-label="{kolomAktif?.label ?? 'Nilai'} {r.nama}"
							class="h-11 w-18 shrink-0 rounded-xl border text-center font-mono text-base font-bold placeholder:text-slate-300 focus:outline-none disabled:bg-slate-100 disabled:opacity-50 dark:disabled:bg-zinc-800 {selInvalid
								? 'border-red-400 bg-red-50/60 text-red-900 focus:border-red-600 focus:ring-1 focus:ring-red-600 dark:border-red-700 dark:bg-red-950/30 dark:text-red-200'
								: selModified
									? 'border-amber-400 bg-amber-50/70 text-amber-900 ring-1 ring-amber-400/40 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200'
									: 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
						/>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- ==================== DESKTOP SPREADSHEET MATRIX ==================== -->
	<div
		class="max-h-[calc(100vh-240px)] overflow-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs max-md:hidden dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="min-w-full border-separate border-spacing-0 text-center text-xs">
			<thead class="sticky top-0 z-20">
				<!-- Row 1: Group Headers -->
				<tr>
					<th
						rowspan="2"
						class="sticky left-0 z-30 w-10 min-w-10 border-r border-b border-slate-200 bg-slate-100 px-2 py-2.5 text-center font-bold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
					>
						No
					</th>
					<th
						rowspan="2"
						class="sticky left-10 z-30 min-w-48 max-w-56 border-r border-b border-slate-200 bg-slate-100 px-3 py-2.5 text-left font-bold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
					>
						Nama Peserta Didik
					</th>

					<!-- Group 1: FORMATIF (F) -->
					<th
						colspan={Math.max(1, formatifCols.length) + 1}
						class="border-r border-b border-blue-200/90 bg-blue-50/90 px-2 py-2 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-100"
					>
						<div class="flex flex-col items-center gap-0.5">
							<div class="flex items-center gap-1.5">
								<span class="text-[11px] font-bold tracking-wide uppercase">Formatif (F)</span>
								{#if canManageStructure}
									<button
										type="button"
										onclick={() => openAddColModal('formatif')}
										title="Tambah kolom Formatif (F)"
										aria-label="Tambah kolom Formatif"
										class="inline-flex h-5 w-5 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
									>
										<Icon name="plus" class="h-3 w-3" />
									</button>
								{/if}
							</div>
							<button
								type="button"
								onclick={openBobotMapelModal}
								disabled={!canManageStructure}
								aria-disabled={!canManageStructure}
								title="Klik untuk mengubah bobot kelompok F / S / AS mapel ini"
								class="text-[11px] font-semibold text-blue-700 underline decoration-blue-400/80 underline-offset-2 transition-colors hover:text-blue-900 disabled:no-underline disabled:opacity-70 dark:text-blue-300 dark:hover:text-blue-100"
							>
								Bobot: {sumatifWeights.lingkup}
							</button>
						</div>
					</th>

					<!-- Group 2: SUMATIF (S) -->
					<th
						colspan={Math.max(1, sumatifCols.length) + 1}
						class="border-r border-b border-amber-200/90 bg-amber-50/90 px-2 py-2 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-100"
					>
						<div class="flex flex-col items-center gap-0.5">
							<div class="flex items-center gap-1.5">
								<span class="text-[11px] font-bold tracking-wide uppercase">Sumatif (S)</span>
								{#if canManageStructure}
									<button
										type="button"
										onclick={() => openAddColModal('sumatif')}
										title="Tambah kolom Sumatif (S)"
										aria-label="Tambah kolom Sumatif"
										class="inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-600 text-white transition-colors hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
									>
										<Icon name="plus" class="h-3 w-3" />
									</button>
								{/if}
							</div>
							<button
								type="button"
								onclick={openBobotMapelModal}
								disabled={!canManageStructure}
								aria-disabled={!canManageStructure}
								title="Klik untuk mengubah bobot kelompok F / S / AS mapel ini"
								class="text-[11px] font-semibold text-amber-800 underline decoration-amber-400/80 underline-offset-2 transition-colors hover:text-amber-950 disabled:no-underline disabled:opacity-70 dark:text-amber-300 dark:hover:text-amber-100"
							>
								Bobot: {sumatifWeights.sts}
							</button>
						</div>
					</th>

					<!-- Group 3: SUMATIF AS (AS) -->
					<th
						colspan={Math.max(1, asCols.length) + 1}
						class="border-r border-b border-sky-200/90 bg-sky-50/90 px-2 py-2 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/45 dark:text-sky-100"
					>
						<div class="flex flex-col items-center gap-0.5">
							<div class="flex items-center gap-1.5">
								<span class="text-[11px] font-bold tracking-wide uppercase">Sumatif AS (AS)</span>
								{#if canManageStructure}
									<button
										type="button"
										onclick={() => openAddColModal('as')}
										title="Tambah kolom Sumatif AS (AS)"
										aria-label="Tambah kolom Sumatif AS"
										class="inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-600 text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
									>
										<Icon name="plus" class="h-3 w-3" />
									</button>
								{/if}
							</div>
							<button
								type="button"
								onclick={openBobotMapelModal}
								disabled={!canManageStructure}
								aria-disabled={!canManageStructure}
								title="Klik untuk mengubah bobot kelompok F / S / AS mapel ini"
								class="text-[11px] font-semibold text-sky-800 underline decoration-sky-400/80 underline-offset-2 transition-colors hover:text-sky-950 disabled:no-underline disabled:opacity-70 dark:text-sky-300 dark:hover:text-sky-100"
							>
								Bobot: {sumatifWeights.sas}
							</button>
						</div>
					</th>

					<!-- AKHIR -->
					<th
						rowspan="2"
						class="min-w-20 border-r border-b border-teal-700/30 bg-teal-600 px-2.5 py-2.5 text-center text-[11px] font-bold tracking-wide text-white uppercase dark:border-teal-800 dark:bg-teal-700"
					>
						Akhir
					</th>

					<!-- REVISI -->
					<th
						rowspan="2"
						class="min-w-24 border-b border-slate-200 bg-slate-100 px-2 py-2 text-center text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
					>
						<div class="flex flex-col items-center gap-0.5">
							<div class="flex items-center gap-1">
								<span class="text-[11px] font-bold tracking-wide uppercase">Revisi</span>
								{#if canEdit && !isTerkunci}
									<button
										type="button"
										onclick={() => openBulkModal('revisi', 'REVISI')}
										title="Isi kolom Revisi sekaligus"
										aria-label="Isi kolom Revisi sekaligus"
										class="inline-flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-700"
									>
										<Icon name="copy" class="h-3 w-3" />
									</button>
								{/if}
							</div>
							<span class="text-[10px] font-normal text-slate-500 dark:text-zinc-400">Opsional</span
							>
						</div>
					</th>
				</tr>

				<!-- Row 2: Individual Assessment Columns + NA Summary Columns -->
				<tr>
					<!-- Formatif (F) columns -->
					{#if formatifCols.length === 0}
						<th
							class="min-w-28 border-r border-b border-slate-200 bg-slate-50 px-2 py-2 dark:border-zinc-700 dark:bg-zinc-800/80"
						>
							{#if canManageStructure}
								<button
									type="button"
									onclick={() => openAddColModal('formatif')}
									class="inline-flex items-center gap-1 rounded-lg border border-dashed border-blue-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:bg-zinc-900 dark:text-blue-300"
								>
									<Icon name="plus" class="h-3 w-3" />
									Tambah (F)
								</button>
							{:else}
								<span class="text-[11px] font-normal text-slate-400">Belum ada</span>
							{/if}
						</th>
					{:else}
						{#each formatifCols as col, idx (col.id)}
							{@const label = colShortLabel(col, idx)}
							<th
								class="min-w-24 max-w-32 border-r border-b border-slate-200 bg-slate-50/95 px-1.5 py-1.5 align-top dark:border-zinc-700 dark:bg-zinc-800/90"
							>
								<div class="flex flex-col items-center gap-1">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											onclick={() => openDetailCol(col, idx)}
											title="Lihat detail TP & isi massal"
											aria-label="Lihat detail {label}"
											class="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white transition-colors hover:bg-blue-700"
										>
											<Icon name="eye" class="h-3 w-3" />
										</button>
										{#if canManageStructure}
											<button
												type="button"
												onclick={() => openEditColModal(col)}
												title="Edit kolom & deskripsi TP"
												aria-label="Edit {label}"
												class="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
											>
												<Icon name="edit" class="h-3 w-3" />
											</button>
											<button
												type="button"
												onclick={() => openDeleteColModal(col, idx)}
												title="Hapus kolom"
												aria-label="Hapus {label}"
												class="inline-flex h-5 w-5 items-center justify-center rounded bg-red-600 text-white transition-colors hover:bg-red-700"
											>
												<Icon name="close" class="h-3 w-3" />
											</button>
										{/if}
									</div>
									<span
										class="max-w-28 truncate text-[11px] font-semibold text-slate-800 dark:text-zinc-100"
										title="{label} - {col.deskripsi}"
									>
										{label}
									</span>
									<button
										type="button"
										disabled={!canManageStructure}
										onclick={() => openEditColModal(col, true)}
										title="Ubah bobot kolom ini"
										class="text-[10px] font-semibold text-blue-700 underline decoration-blue-400/70 underline-offset-2 hover:text-blue-900 disabled:no-underline disabled:opacity-70 dark:text-blue-300"
									>
										Bobot: {formatBobot(col.bobot)}
									</button>
								</div>
							</th>
						{/each}
					{/if}

					<!-- NA (F) -->
					<th
						class="min-w-18 border-r border-b border-teal-200/90 bg-teal-600 px-2 py-2 text-center text-[11px] font-bold text-white dark:border-teal-800 dark:bg-teal-700"
					>
						<div>NA</div>
						<div>(F)</div>
					</th>

					<!-- Sumatif (S) columns -->
					{#if usesLegacySts}
						<th
							class="min-w-24 border-r border-b border-slate-200 bg-slate-50/95 px-1.5 py-1.5 align-top dark:border-zinc-700 dark:bg-zinc-800/90"
						>
							<div class="flex flex-col items-center gap-1">
								<div class="flex items-center justify-center gap-1">
									<button
										type="button"
										onclick={() => openDetailLegacy('sumatif')}
										title="Lihat detail & isi massal Sumatif (S)"
										aria-label="Lihat detail Sumatif (S)"
										class="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white transition-colors hover:bg-blue-700"
									>
										<Icon name="eye" class="h-3 w-3" />
									</button>
									{#if canManageStructure}
										<button
											type="button"
											onclick={() => openMaterializeLegacyModal('sumatif')}
											title="Edit judul & bobot kolom Sumatif (S)"
											aria-label="Edit Sumatif (S)"
											class="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
										>
											<Icon name="edit" class="h-3 w-3" />
										</button>
									{/if}
								</div>
								<span class="text-[11px] font-semibold text-slate-800 dark:text-zinc-100">
									{kelasFase ? `(S) Fase ${kelasFase}` : '(S) Sumatif'}
								</span>
								<button
									type="button"
									disabled={!canManageStructure}
									onclick={() => openMaterializeLegacyModal('sumatif', true)}
									title="Ubah bobot kolom Sumatif (S)"
									class="text-[10px] font-semibold text-blue-700 underline decoration-blue-400/70 underline-offset-2 hover:text-blue-900 disabled:no-underline disabled:opacity-70 dark:text-blue-300"
								>
									Bobot: 1
								</button>
							</div>
						</th>
					{:else}
						{#each sumatifCols as col, idx (col.id)}
							{@const label = colShortLabel(col, idx)}
							<th
								class="min-w-24 max-w-32 border-r border-b border-slate-200 bg-slate-50/95 px-1.5 py-1.5 align-top dark:border-zinc-700 dark:bg-zinc-800/90"
							>
								<div class="flex flex-col items-center gap-1">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											onclick={() => openDetailCol(col, idx)}
											title="Lihat detail & isi massal"
											aria-label="Lihat detail {label}"
											class="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white transition-colors hover:bg-blue-700"
										>
											<Icon name="eye" class="h-3 w-3" />
										</button>
										{#if canManageStructure}
											<button
												type="button"
												onclick={() => openEditColModal(col)}
												title="Edit kolom"
												aria-label="Edit {label}"
												class="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
											>
												<Icon name="edit" class="h-3 w-3" />
											</button>
											<button
												type="button"
												onclick={() => openDeleteColModal(col, idx)}
												title="Hapus kolom"
												aria-label="Hapus {label}"
												class="inline-flex h-5 w-5 items-center justify-center rounded bg-red-600 text-white transition-colors hover:bg-red-700"
											>
												<Icon name="close" class="h-3 w-3" />
											</button>
										{/if}
									</div>
									<span
										class="max-w-28 truncate text-[11px] font-semibold text-slate-800 dark:text-zinc-100"
										title="{label} - {col.deskripsi}"
									>
										{label}
									</span>
									<button
										type="button"
										disabled={!canManageStructure}
										onclick={() => openEditColModal(col, true)}
										title="Ubah bobot kolom ini"
										class="text-[10px] font-semibold text-blue-700 underline decoration-blue-400/70 underline-offset-2 hover:text-blue-900 disabled:no-underline disabled:opacity-70 dark:text-blue-300"
									>
										Bobot: {formatBobot(col.bobot)}
									</button>
								</div>
							</th>
						{/each}
					{/if}

					<!-- NA (S) -->
					<th
						class="min-w-18 border-r border-b border-teal-200/90 bg-teal-600 px-2 py-2 text-center text-[11px] font-bold text-white dark:border-teal-800 dark:bg-teal-700"
					>
						<div>NA</div>
						<div>(S)</div>
					</th>

					<!-- Sumatif AS (AS) columns -->
					{#if usesLegacySas}
						<th
							class="min-w-24 border-r border-b border-slate-200 bg-slate-50/95 px-1.5 py-1.5 align-top dark:border-zinc-700 dark:bg-zinc-800/90"
						>
							<div class="flex flex-col items-center gap-1">
								<div class="flex items-center justify-center gap-1">
									<button
										type="button"
										onclick={() => openDetailLegacy('as')}
										title="Lihat detail & isi massal Sumatif AS"
										aria-label="Lihat detail Sumatif AS"
										class="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white transition-colors hover:bg-blue-700"
									>
										<Icon name="eye" class="h-3 w-3" />
									</button>
									{#if canManageStructure}
										<button
											type="button"
											onclick={() => openMaterializeLegacyModal('as')}
											title="Edit judul & bobot kolom Sumatif AS"
											aria-label="Edit Sumatif AS"
											class="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
										>
											<Icon name="edit" class="h-3 w-3" />
										</button>
									{/if}
								</div>
								<span class="text-[11px] font-semibold text-slate-800 dark:text-zinc-100">
									(AS)
								</span>
								<button
									type="button"
									disabled={!canManageStructure}
									onclick={() => openMaterializeLegacyModal('as', true)}
									title="Ubah bobot kolom Sumatif AS"
									class="text-[10px] font-semibold text-blue-700 underline decoration-blue-400/70 underline-offset-2 hover:text-blue-900 disabled:no-underline disabled:opacity-70 dark:text-blue-300"
								>
									Bobot: 1
								</button>
							</div>
						</th>
					{:else}
						{#each asCols as col, idx (col.id)}
							{@const label = colShortLabel(col, idx)}
							<th
								class="min-w-24 max-w-32 border-r border-b border-slate-200 bg-slate-50/95 px-1.5 py-1.5 align-top dark:border-zinc-700 dark:bg-zinc-800/90"
							>
								<div class="flex flex-col items-center gap-1">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											onclick={() => openDetailCol(col, idx)}
											title="Lihat detail & isi massal"
											aria-label="Lihat detail {label}"
											class="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white transition-colors hover:bg-blue-700"
										>
											<Icon name="eye" class="h-3 w-3" />
										</button>
										{#if canManageStructure}
											<button
												type="button"
												onclick={() => openEditColModal(col)}
												title="Edit kolom"
												aria-label="Edit {label}"
												class="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
											>
												<Icon name="edit" class="h-3 w-3" />
											</button>
											<button
												type="button"
												onclick={() => openDeleteColModal(col, idx)}
												title="Hapus kolom"
												aria-label="Hapus {label}"
												class="inline-flex h-5 w-5 items-center justify-center rounded bg-red-600 text-white transition-colors hover:bg-red-700"
											>
												<Icon name="close" class="h-3 w-3" />
											</button>
										{/if}
									</div>
									<span
										class="max-w-28 truncate text-[11px] font-semibold text-slate-800 dark:text-zinc-100"
										title="{label} - {col.deskripsi}"
									>
										{label}
									</span>
									<button
										type="button"
										disabled={!canManageStructure}
										onclick={() => openEditColModal(col, true)}
										title="Ubah bobot kolom ini"
										class="text-[10px] font-semibold text-blue-700 underline decoration-blue-400/70 underline-offset-2 hover:text-blue-900 disabled:no-underline disabled:opacity-70 dark:text-blue-300"
									>
										Bobot: {formatBobot(col.bobot)}
									</button>
								</div>
							</th>
						{/each}
					{/if}

					<!-- NA (AS) -->
					<th
						class="min-w-18 border-r border-b border-teal-200/90 bg-teal-600 px-2 py-2 text-center text-[11px] font-bold text-white dark:border-teal-800 dark:bg-teal-700"
					>
						<div>NA</div>
						<div>(AS)</div>
					</th>
				</tr>
			</thead>

			<tbody>
				{#if filteredRows.length === 0}
					<tr>
						<td
							colspan={totalDesktopCols}
							class="py-8 text-center text-xs text-slate-500 dark:text-zinc-400"
						>
							{searchFilter
								? `Tidak ditemukan peserta didik dengan nama "${searchFilter}".`
								: 'Belum ada data peserta didik untuk kelas ini.'}
						</td>
					</tr>
				{:else}
					{#each filteredRows as r, rowIndex (r.id)}
						{@const naF = calcNaF(r)}
						{@const naS = calcNaS(r)}
						{@const naAs = calcNaAs(r)}
						{@const naAsli = calcNilaiAkhirAsli(r)}
						{@const revNum = parseNum(r.revisi)}
						{@const hasRev = revNum != null && revNum >= 0 && revNum <= 100}
						{@const origRow = initialRowMap.get(r.id)}
						{@const isStsMod = origRow ? origRow.legacySts !== r.legacySts : false}
						{@const isSasMod = origRow ? origRow.legacySas !== r.legacySas : false}
						{@const isRevMod = origRow ? origRow.revisi !== r.revisi : false}
						{@const isRevInv = isSelInvalid(r.revisi)}
						<tr
							class="group odd:bg-white even:bg-slate-50/55 hover:bg-blue-50/35 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/30 dark:hover:bg-blue-950/20"
						>
							<!-- No -->
							<td
								class="sticky left-0 z-10 w-10 min-w-10 border-r border-b border-slate-200/80 bg-inherit py-1.5 text-center font-medium text-slate-500 tabular-nums dark:border-zinc-800 dark:text-zinc-400"
							>
								{r.no}
							</td>

							<!-- Nama Peserta Didik -->
							<td
								class="sticky left-10 z-10 min-w-48 max-w-56 border-r border-b border-slate-200/80 bg-inherit px-3 py-1.5 text-left font-semibold text-slate-900 dark:border-zinc-800 dark:text-zinc-100"
							>
								<div class="flex items-center justify-between gap-1.5">
									<div class="min-w-0">
										<div class="max-w-44 truncate" title={r.nama}>{r.nama}</div>
										{#if r.agamaLabel}
											<div class="text-[10px] font-normal text-slate-500 dark:text-zinc-400">
												{r.agamaLabel}
											</div>
										{/if}
									</div>
								</div>
							</td>

							<!-- Formatif (F) inputs -->
							{#if formatifCols.length === 0}
								<td
									class="border-r border-b border-slate-200/70 px-2 py-1.5 text-slate-300 dark:border-zinc-800 dark:text-zinc-600"
								>
									-
								</td>
							{:else}
								{#each formatifCols as col (col.id)}
									{@const val = r.tp[col.id]}
									{@const isMod = origRow ? origRow.tp?.[col.id] !== val : false}
									{@const isInv = isSelInvalid(val)}
									{@const canCell = canEditTpForRow(r, col)}
									<td class="border-r border-b border-slate-200/70 p-1 dark:border-zinc-800">
										<input
											type="text"
											inputmode="decimal"
											data-row={rowIndex}
											data-col={colNavIndex(`tp:${col.id}`)}
											disabled={!canCell}
											bind:value={r.tp[col.id]}
											onfocus={handleFocus}
											placeholder="-"
											aria-invalid={isInv}
											class="h-7.5 w-16 rounded-lg border text-center font-mono text-xs font-semibold transition-all focus:outline-none disabled:bg-slate-100 disabled:opacity-45 dark:disabled:bg-zinc-800 {isInv
												? 'border-red-400 bg-red-50/70 text-red-900 ring-1 ring-red-400/50 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200'
												: isMod
													? 'border-amber-400 bg-amber-50/80 text-amber-900 ring-1 ring-amber-400/40 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200'
													: 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
										/>
									</td>
								{/each}
							{/if}

							<!-- NA (F) -->
							<td
								class="border-r border-b border-teal-200/70 bg-teal-50/80 px-2 font-mono text-xs font-bold text-teal-900 tabular-nums dark:border-teal-900/50 dark:bg-teal-950/35 dark:text-teal-200"
							>
								{formatScore(naF)}
							</td>

							<!-- Sumatif (S) inputs -->
							{#if usesLegacySts}
								{@const isInv = isSelInvalid(r.legacySts)}
								<td class="border-r border-b border-slate-200/70 p-1 dark:border-zinc-800">
									<input
										type="text"
										inputmode="decimal"
										data-row={rowIndex}
										data-col={colNavIndex('legacySts')}
										disabled={!r.canNilai || isTerkunci}
										bind:value={r.legacySts}
										onfocus={handleFocus}
										placeholder="-"
										aria-invalid={isInv}
										class="h-7.5 w-16 rounded-lg border text-center font-mono text-xs font-semibold transition-all focus:outline-none disabled:bg-slate-100 disabled:opacity-45 dark:disabled:bg-zinc-800 {isInv
											? 'border-red-400 bg-red-50/70 text-red-900 ring-1 ring-red-400/50 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200'
											: isStsMod
												? 'border-amber-400 bg-amber-50/80 text-amber-900 ring-1 ring-amber-400/40 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200'
												: 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
									/>
								</td>
							{:else}
								{#each sumatifCols as col (col.id)}
									{@const val = r.tp[col.id]}
									{@const isMod = origRow ? origRow.tp?.[col.id] !== val : false}
									{@const isInv = isSelInvalid(val)}
									{@const canCell = canEditTpForRow(r, col)}
									<td class="border-r border-b border-slate-200/70 p-1 dark:border-zinc-800">
										<input
											type="text"
											inputmode="decimal"
											data-row={rowIndex}
											data-col={colNavIndex(`tp:${col.id}`)}
											disabled={!canCell}
											bind:value={r.tp[col.id]}
											onfocus={handleFocus}
											placeholder="-"
											aria-invalid={isInv}
											class="h-7.5 w-16 rounded-lg border text-center font-mono text-xs font-semibold transition-all focus:outline-none disabled:bg-slate-100 disabled:opacity-45 dark:disabled:bg-zinc-800 {isInv
												? 'border-red-400 bg-red-50/70 text-red-900 ring-1 ring-red-400/50 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200'
												: isMod
													? 'border-amber-400 bg-amber-50/80 text-amber-900 ring-1 ring-amber-400/40 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200'
													: 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
										/>
									</td>
								{/each}
							{/if}

							<!-- NA (S) -->
							<td
								class="border-r border-b border-teal-200/70 bg-teal-50/80 px-2 font-mono text-xs font-bold text-teal-900 tabular-nums dark:border-teal-900/50 dark:bg-teal-950/35 dark:text-teal-200"
							>
								{formatScore(naS)}
							</td>

							<!-- Sumatif AS (AS) inputs -->
							{#if usesLegacySas}
								{@const isInv = isSelInvalid(r.legacySas)}
								<td class="border-r border-b border-slate-200/70 p-1 dark:border-zinc-800">
									<input
										type="text"
										inputmode="decimal"
										data-row={rowIndex}
										data-col={colNavIndex('legacySas')}
										disabled={!r.canNilai || isTerkunci}
										bind:value={r.legacySas}
										onfocus={handleFocus}
										placeholder="-"
										aria-invalid={isInv}
										class="h-7.5 w-16 rounded-lg border text-center font-mono text-xs font-semibold transition-all focus:outline-none disabled:bg-slate-100 disabled:opacity-45 dark:disabled:bg-zinc-800 {isInv
											? 'border-red-400 bg-red-50/70 text-red-900 ring-1 ring-red-400/50 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200'
											: isSasMod
												? 'border-amber-400 bg-amber-50/80 text-amber-900 ring-1 ring-amber-400/40 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200'
												: 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
									/>
								</td>
							{:else}
								{#each asCols as col (col.id)}
									{@const val = r.tp[col.id]}
									{@const isMod = origRow ? origRow.tp?.[col.id] !== val : false}
									{@const isInv = isSelInvalid(val)}
									{@const canCell = canEditTpForRow(r, col)}
									<td class="border-r border-b border-slate-200/70 p-1 dark:border-zinc-800">
										<input
											type="text"
											inputmode="decimal"
											data-row={rowIndex}
											data-col={colNavIndex(`tp:${col.id}`)}
											disabled={!canCell}
											bind:value={r.tp[col.id]}
											onfocus={handleFocus}
											placeholder="-"
											aria-invalid={isInv}
											class="h-7.5 w-16 rounded-lg border text-center font-mono text-xs font-semibold transition-all focus:outline-none disabled:bg-slate-100 disabled:opacity-45 dark:disabled:bg-zinc-800 {isInv
												? 'border-red-400 bg-red-50/70 text-red-900 ring-1 ring-red-400/50 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200'
												: isMod
													? 'border-amber-400 bg-amber-50/80 text-amber-900 ring-1 ring-amber-400/40 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200'
													: 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
										/>
									</td>
								{/each}
							{/if}

							<!-- NA (AS) -->
							<td
								class="border-r border-b border-teal-200/70 bg-teal-50/80 px-2 font-mono text-xs font-bold text-teal-900 tabular-nums dark:border-teal-900/50 dark:bg-teal-950/35 dark:text-teal-200"
							>
								{formatScore(naAs)}
							</td>

							<!-- AKHIR (formula) -->
							<td
								class="border-r border-b border-teal-300/70 bg-teal-100/80 px-2.5 font-mono text-xs font-bold tabular-nums dark:border-teal-800/60 dark:bg-teal-900/40"
								title={hasRev
									? `Nilai rumus: ${formatScore(naAsli)}. Nilai rapor aktif memakai Revisi: ${formatScore(revNum)}`
									: `Nilai Akhir rumus: ${formatScore(naAsli)}`}
							>
								{#if naAsli != null}
									<span
										class={hasRev
											? 'text-teal-700/60 line-through dark:text-teal-300/60'
											: naAsli >= kkm
												? 'text-teal-950 dark:text-teal-100'
												: 'text-amber-800 dark:text-amber-300'}
									>
										{formatScore(naAsli)}
									</span>
								{:else}
									<span class="text-teal-700/40 dark:text-teal-400/40">-</span>
								{/if}
							</td>

							<!-- REVISI (optional override) -->
							<td class="border-b border-slate-200/70 p-1 dark:border-zinc-800">
								<input
									type="text"
									inputmode="decimal"
									data-row={rowIndex}
									data-col={colNavIndex('revisi')}
									disabled={!r.canNilai || isTerkunci}
									bind:value={r.revisi}
									onfocus={handleFocus}
									placeholder=""
									aria-label="Revisi nilai {r.nama}"
									aria-invalid={isRevInv}
									class="h-7.5 w-20 rounded-lg border text-center font-mono text-xs font-bold transition-all focus:outline-none disabled:bg-slate-100 disabled:opacity-45 dark:disabled:bg-zinc-800 {isRevInv
										? 'border-red-400 bg-red-50/70 text-red-900 ring-1 ring-red-400/50 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200'
										: isRevMod
											? 'border-amber-400 bg-amber-50/80 text-amber-900 ring-1 ring-amber-400/40 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200'
											: hasRev
												? 'border-teal-500 bg-teal-50/60 text-teal-900 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-200'
												: 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
								/>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>

<!-- Mobile sticky bottom action bar -->
<div
	class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm md:hidden dark:border-zinc-800 dark:bg-zinc-900/95"
>
	<div
		class="mx-auto flex max-w-3xl items-center gap-2 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
	>
		<div class="min-w-0 flex-1">
			{#if isDirty}
				<p
					class="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
				>
					<span class="h-2 w-2 rounded-full bg-amber-500"></span>
					{dirtyCount} nilai belum disimpan
				</p>
			{:else}
				<p
					class="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
				>
					<Icon name="check" class="h-3.5 w-3.5" />
					Semua tersimpan
				</p>
			{/if}
		</div>
		{#if isDirty}
			<button
				type="button"
				class="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
				onclick={resetChanges}
				disabled={saving}
			>
				Batal
			</button>
		{/if}
		<button
			type="button"
			class="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500"
			onclick={saveAll}
			disabled={saving || !isDirty || isTerkunci || !canEdit}
			aria-disabled={saving || !isDirty || isTerkunci || !canEdit}
		>
			{#if saving}
				<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
				Menyimpan...
			{:else}
				<Icon name="save" class="h-4 w-4" />
				Simpan
			{/if}
		</button>
	</div>
</div>

<!-- ==================== MODAL 1: LIHAT DETAIL KOLOM ==================== -->
{#if detailModal}
	{@const stats = calcDetailStats(detailModal)}
	<div
		class="modal modal-open modal-bottom bg-slate-950/45 backdrop-blur-[2px] sm:modal-middle"
		role="dialog"
		aria-label="Detail kolom penilaian"
	>
		<div
			class="modal-box w-full max-w-md rounded-t-2xl border border-slate-200/80 bg-white p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-slate-900 shadow-2xl sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<div
				class="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-zinc-800"
			>
				<div>
					<p class="text-[11px] font-semibold text-blue-600 uppercase dark:text-blue-400">
						{groupTitle(detailModal.jenis)}
					</p>
					<h3 class="mt-0.5 text-base font-bold">{detailModal.label}</h3>
				</div>
				<button
					type="button"
					onclick={() => (detailModal = null)}
					aria-label="Tutup"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800"
				>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>

			<div class="mt-3 space-y-3 text-xs">
				<div class="grid grid-cols-3 gap-2">
					<div class="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-zinc-800/60">
						<p class="text-[10px] font-medium text-slate-500 dark:text-zinc-400">Bobot</p>
						<p class="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-zinc-100">
							{formatBobot(detailModal.bobot)}
						</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-zinc-800/60">
						<p class="text-[10px] font-medium text-slate-500 dark:text-zinc-400">Terisi</p>
						<p class="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-zinc-100">
							{stats.filled}/{stats.total}
						</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-zinc-800/60">
						<p class="text-[10px] font-medium text-slate-500 dark:text-zinc-400">Rata Kelas</p>
						<p class="mt-0.5 font-mono text-sm font-bold text-teal-700 dark:text-teal-300">
							{formatScore(stats.avg)}
						</p>
					</div>
				</div>

				{#if detailModal.teknikNama}
					<p class="text-slate-600 dark:text-zinc-400">
						Teknik Penilaian: <strong class="text-slate-900 dark:text-zinc-100"
							>{detailModal.teknikNama}</strong
						>
					</p>
				{/if}

				<div
					class="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40"
				>
					<p
						class="text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-zinc-400"
					>
						Tujuan Pembelajaran / Keterangan
					</p>
					<p class="mt-1 leading-relaxed text-slate-800 dark:text-zinc-200">
						{detailModal.deskripsi}
					</p>
				</div>
			</div>

			<div
				class="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800"
			>
				{#if canEdit && !isTerkunci}
					<button
						type="button"
						class="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:h-9 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						onclick={() => {
							const d = detailModal;
							detailModal = null;
							if (d) openBulkModal(d.kind, d.label, d.col?.id);
						}}
					>
						<Icon name="copy" class="h-3.5 w-3.5" />
						Isi Sekaligus
					</button>
				{/if}
				{#if canManageStructure}
					<button
						type="button"
						class="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 sm:h-9"
						onclick={() => {
							const d = detailModal;
							detailModal = null;
							if (!d) return;
							if (d.kind === 'tp' && d.col) openEditColModal(d.col);
							else if (d.kind === 'legacySts') openMaterializeLegacyModal('sumatif');
							else openMaterializeLegacyModal('as');
						}}
					>
						<Icon name="edit" class="h-3.5 w-3.5" />
						Edit Kolom
					</button>
				{/if}
			</div>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop bg-transparent"
			onclick={() => (detailModal = null)}
		></button>
	</div>
{/if}

<!-- ==================== MODAL 2: TAMBAH / EDIT KOLOM ==================== -->
{#if colFormModal}
	<div
		class="modal modal-open modal-bottom bg-slate-950/45 backdrop-blur-[2px] sm:modal-middle"
		role="dialog"
		aria-label="Kelola kolom penilaian"
	>
		<div
			class="modal-box max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200/80 bg-white p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-slate-900 shadow-2xl sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="border-b border-slate-100 pb-3 text-base font-bold dark:border-zinc-800">
				{#if colFormModal.mode === 'create'}
					Tambah Kolom {groupTitle(colFormModal.jenisAsesmen)}
				{:else}
					Edit Kolom {groupTitle(colFormModal.jenisAsesmen)}
				{/if}
			</h3>

			<form class="mt-4 space-y-3.5" onsubmit={submitColForm}>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<div class="sm:col-span-2">
						<label
							for="col-lingkup-input"
							class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>
							Label Kolom / Lingkup
						</label>
						<input
							id="col-lingkup-input"
							type="text"
							bind:value={colFormModal.lingkupMateri}
							placeholder="Contoh: Fase E / Bab 1"
							class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none sm:h-9 sm:text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>
					<div>
						<label
							for="col-bobot-input"
							class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>
							Bobot Kolom
						</label>
						<input
							id="col-bobot-input"
							type="number"
							min="0.1"
							max="100"
							step="0.5"
							bind:value={colFormModal.bobot}
							required
							class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-center font-mono text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none sm:h-9 sm:text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>
				</div>

				{#if teknikList.length > 0}
					<div>
						<label
							for="col-teknik-select"
							class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>
							Teknik Penilaian (opsional)
						</label>
						<select
							id="col-teknik-select"
							bind:value={colFormModal.teknikPenilaianId}
							class="app-select h-11 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none sm:h-9 sm:text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						>
							<option value="">Tanpa teknik khusus</option>
							{#each teknikList as tk (tk.id)}
								<option value={String(tk.id)}>{tk.nama} ({tk.singkatan})</option>
							{/each}
						</select>
					</div>
				{/if}

				<div>
					<label
						for="col-deskripsi-input"
						class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Deskripsi Tujuan Pembelajaran (TP)
					</label>
					<textarea
						id="col-deskripsi-input"
						rows="3"
						bind:value={colFormModal.deskripsi}
						required
						placeholder="Contoh: Memahami konsep jaringan komputer dan penerapannya..."
						class="w-full rounded-xl border border-[#7e8b9b] bg-white p-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none sm:text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					></textarea>
					{#if colFormModal.jenisAsesmen !== 'as'}
						<p class="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
							Deskripsi ini dipakai otomatis untuk menyusun kalimat Capaian Kompetensi di rapor.
						</p>
					{/if}
				</div>

				<div
					class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800"
				>
					<button
						type="button"
						class="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:h-9 sm:flex-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						onclick={() => (colFormModal = null)}
						disabled={colFormSaving}
					>
						Batal
					</button>
					<button
						type="submit"
						class="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:h-9 sm:flex-none"
						disabled={colFormSaving}
					>
						{#if colFormSaving}
							<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
							Menyimpan...
						{:else}
							<Icon name="save" class="h-3.5 w-3.5" />
							Simpan Kolom
						{/if}
					</button>
				</div>
			</form>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop bg-transparent"
			onclick={() => (colFormModal = null)}
		></button>
	</div>
{/if}

<!-- ==================== MODAL 3: HAPUS KOLOM ==================== -->
{#if deleteModalCol}
	<div
		class="modal modal-open modal-bottom bg-slate-950/45 backdrop-blur-[2px] sm:modal-middle"
		role="dialog"
		aria-label="Konfirmasi hapus kolom"
	>
		<div
			class="modal-box w-full max-w-md rounded-t-2xl border border-slate-200/80 bg-white p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-slate-900 shadow-2xl sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3
				class="border-b border-slate-100 pb-3 text-base font-bold text-red-700 dark:border-zinc-800 dark:text-red-400"
			>
				Hapus Kolom {deleteModalCol.label}?
			</h3>
			<p class="mt-3 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
				Seluruh nilai peserta didik pada kolom <strong>{deleteModalCol.label}</strong> akan ikut terhapus
				dan nilai akhir dihitung ulang secara otomatis.
			</p>
			<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
				<button
					type="button"
					class="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:h-9 sm:flex-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					onclick={() => (deleteModalCol = null)}
					disabled={deletingCol}
				>
					Batal
				</button>
				<button
					type="button"
					class="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 sm:h-9 sm:flex-none"
					onclick={confirmDeleteCol}
					disabled={deletingCol}
				>
					{#if deletingCol}
						Menghapus...
					{:else}
						Hapus Kolom
					{/if}
				</button>
			</div>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop bg-transparent"
			onclick={() => (deleteModalCol = null)}
		></button>
	</div>
{/if}

<!-- ==================== MODAL 4: BOBOT KELOMPOK MAPEL ==================== -->
{#if bobotModalOpen}
	<div
		class="modal modal-open modal-bottom bg-slate-950/45 backdrop-blur-[2px] sm:modal-middle"
		role="dialog"
		aria-label="Atur bobot kelompok mapel"
	>
		<div
			class="modal-box max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200/80 bg-white p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-slate-900 shadow-2xl sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<div class="border-b border-slate-100 pb-3 dark:border-zinc-800">
				<h3 class="text-base font-bold">Bobot Penilaian Mapel</h3>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Berlaku khusus untuk <strong class="text-slate-800 dark:text-zinc-200">{mapelNama}</strong
					>.
					{#if sumatifWeights.sekolahDefault}
						Default sekolah: {sumatifWeights.sekolahDefault.lingkup}% F / {sumatifWeights
							.sekolahDefault.sts}% S / {sumatifWeights.sekolahDefault.sas}% AS.
					{/if}
				</p>
			</div>

			<div class="mt-4 space-y-3">
				<div>
					<label
						for="mapel-bobot-f"
						class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Formatif (F) (%)
					</label>
					<input
						id="mapel-bobot-f"
						type="number"
						min="0"
						max="100"
						bind:value={bobotFInput}
						disabled={bobotMapelSaving}
						class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none sm:h-9 sm:text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					/>
				</div>
				<div>
					<label
						for="mapel-bobot-s"
						class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Sumatif (S) (%)
					</label>
					<input
						id="mapel-bobot-s"
						type="number"
						min="0"
						max="100"
						bind:value={bobotSInput}
						disabled={bobotMapelSaving}
						class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none sm:h-9 sm:text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					/>
				</div>
				<div>
					<label
						for="mapel-bobot-as"
						class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Sumatif AS (AS) (%)
					</label>
					<input
						id="mapel-bobot-as"
						type="number"
						min="0"
						max="100"
						bind:value={bobotAsInput}
						disabled={bobotMapelSaving}
						class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none sm:h-9 sm:text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					/>
				</div>

				<div
					class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-zinc-800/60"
				>
					<span class="text-slate-600 dark:text-zinc-300">Total bobot</span>
					<span
						class="font-mono font-bold {totalBobotMapel === 100
							? 'text-emerald-700 dark:text-emerald-400'
							: 'text-red-600 dark:text-red-400'}"
					>
						{totalBobotMapel}%
					</span>
				</div>
				<p class="text-[11px] text-slate-500 dark:text-zinc-400">
					Rapor Tengah Semester (RTS) tetap menghitung proporsi dari Formatif (F) dan Sumatif (S).
				</p>
			</div>

			<div
				class="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800"
			>
				<button
					type="button"
					class="inline-flex h-11 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:h-9 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					onclick={() => (bobotModalOpen = false)}
					disabled={bobotMapelSaving}
				>
					Batal
				</button>
				{#if sumatifWeights.isCustom}
					<button
						type="button"
						class="inline-flex h-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 sm:ml-auto sm:h-9 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
						onclick={() => submitBobotMapel(true)}
						disabled={bobotMapelSaving}
					>
						Ikuti Default Sekolah
					</button>
				{/if}
				<button
					type="button"
					class="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 {!sumatifWeights.isCustom
						? 'sm:ml-auto'
						: ''}"
					onclick={() => submitBobotMapel(false)}
					disabled={bobotMapelSaving || totalBobotMapel !== 100}
				>
					{bobotMapelSaving ? 'Menyimpan...' : 'Simpan Bobot'}
				</button>
			</div>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop bg-transparent"
			onclick={() => (bobotModalOpen = false)}
		></button>
	</div>
{/if}

<!-- ==================== MODAL 5: ISI KOLOM SEKALIGUS ==================== -->
{#if bulkModalCol}
	<div
		class="modal modal-open modal-bottom bg-slate-950/45 backdrop-blur-[2px] sm:modal-middle"
		role="dialog"
		aria-label="Isi kolom sekaligus"
	>
		<div
			class="modal-box w-full max-w-md rounded-t-2xl border border-slate-200/80 bg-white p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-slate-900 shadow-2xl sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3
				class="flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold dark:border-zinc-800"
			>
				<span aria-hidden="true" class="text-blue-600 dark:text-blue-400">
					<Icon name="copy" class="h-4 w-4" />
				</span>
				<span>Isi Kolom {bulkModalCol.label} Sekaligus</span>
			</h3>
			<p class="mt-3 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
				Masukkan nilai 0 sampai 100 untuk diterapkan ke semua peserta didik pada kolom
				<strong class="text-slate-800 dark:text-zinc-200">{bulkModalCol.label}</strong>. Kosongkan
				jika ingin menghapus seluruh nilai di kolom ini.
			</p>

			<div class="mt-3">
				<label
					class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					for="bulk-input-field">Nilai (0 - 100)</label
				>
				<input
					id="bulk-input-field"
					type="text"
					inputmode="decimal"
					placeholder="Contoh: 85"
					bind:value={bulkValueInput}
					class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-center font-mono text-base font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				/>
			</div>

			<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
				<button
					type="button"
					class="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 sm:h-9 sm:flex-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={() => (bulkModalCol = null)}
				>
					Batal
				</button>
				<button
					type="button"
					class="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 sm:h-9 sm:flex-none dark:bg-blue-500 dark:hover:bg-blue-600"
					onclick={applyBulkValue}
				>
					Terapkan Nilai
				</button>
			</div>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop bg-transparent"
			onclick={() => (bulkModalCol = null)}
		></button>
	</div>
{/if}
