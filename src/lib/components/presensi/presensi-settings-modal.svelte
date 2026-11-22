<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { hideModal, setLoading } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { isValidTime } from '$lib/utils';
	import {
		HARI_SEKOLAH_KEYS,
		parseHariSekolahCustom,
		type HariSekolahKey
	} from '$lib/hari-sekolah';

	interface SemesterRange {
		start: string;
		end: string;
	}

	interface KelasPresensiInfo {
		hariAktif: string;
		jamMasuk: string | null;
		jamPulang: string | null;
	}

	interface KelasRow {
		id: number;
		nama: string;
		hari: boolean[];
		jamMasuk: string;
		jamPulang: string;
	}

	interface Props {
		tahunAjaranId: number | string;
		jamMasuk?: string;
		jamPulang?: string;
		hariSekolah?: number;
		hariSekolahCustom?: string | null;
		tipePresensi?: string;
		jenisPresensi?: string;
		liburNasional?: string;
		liburSemester?: string;
		kelasList?: Array<{ id: number; nama: string }>;
		kelasPresensi?: Record<number, KelasPresensiInfo>;
		onAction?: (actions: { submit: () => Promise<void>; cancel: () => void }) => void;
	}

	let {
		tahunAjaranId,
		jamMasuk = '07:30',
		jamPulang = '15:00',
		hariSekolah = 6,
		hariSekolahCustom = null,
		tipePresensi = 'masuk_saja',
		jenisPresensi = 'wali_kelas_saja',
		liburNasional = '[]',
		liburSemester = '[]',
		kelasList = [],
		kelasPresensi = {},
		onAction
	}: Props = $props();

	let submitting = $state(false);
	// svelte-ignore state_referenced_locally
	let jamMasukValue = $state(jamMasuk);
	// svelte-ignore state_referenced_locally
	let jamPulangValue = $state(jamPulang);
	// svelte-ignore state_referenced_locally
	const parsedCustom = parseHariSekolahCustom(hariSekolahCustom);
	// Intentional one-time form defaults from initial props.
	// svelte-ignore state_referenced_locally
	let hariSekolahValue = $state(
		parsedCustom && parsedCustom.length > 0
			? 'custom'
			: hariSekolah === 5 || hariSekolah === 6
				? String(hariSekolah)
				: '6'
	);
	let customDays = $state<HariSekolahKey[]>(parsedCustom ?? []);

	const customDayLabels: Record<HariSekolahKey, string> = {
		senin: 'Senin',
		selasa: 'Selasa',
		rabu: 'Rabu',
		kamis: 'Kamis',
		jumat: 'Jumat',
		sabtu: 'Sabtu',
		minggu: 'Minggu'
	};

	function toggleCustomDay(key: HariSekolahKey) {
		customDays = customDays.includes(key)
			? customDays.filter((x) => x !== key)
			: [...customDays, key];
	}
	// svelte-ignore state_referenced_locally
	let tipePresensiValue = $state(tipePresensi);
	// svelte-ignore state_referenced_locally
	let jenisPresensiValue = $state(jenisPresensi);

	// Intentional one-time init from props (parsed via IIFE closure per Svelte guidance).
	let liburDates = $state<string[]>(
		(() => {
			const parsed: unknown = JSON.parse(liburNasional);
			return Array.isArray(parsed) ? parsed : [];
		})()
	);

	let newLiburDate = $state('');

	function addLiburDate() {
		if (!newLiburDate) return;
		if (liburDates.includes(newLiburDate)) return;
		liburDates = [...liburDates, newLiburDate];
		newLiburDate = '';
	}

	function removeLiburDate(index: number) {
		liburDates = liburDates.filter((_, i) => i !== index);
	}

	let semesterRanges = $state<SemesterRange[]>(
		(() => {
			const parsed: unknown = JSON.parse(liburSemester);
			return Array.isArray(parsed) ? parsed : [];
		})()
	);

	function addSemesterRange() {
		semesterRanges = [...semesterRanges, { start: '', end: '' }];
	}

	function removeSemesterRange(index: number) {
		semesterRanges = semesterRanges.filter((_, i) => i !== index);
	}

	// Client-side copy of the Senin..Minggu day mask helpers (hari-efektif.ts is server-only).
	function parseDayMask(mask: string | null | undefined): boolean[] {
		const raw = mask ? mask.split(',') : [];
		const flags = Array.from({ length: 7 }, (_, i) => (raw[i] ?? '1') !== '0');
		if (!mask) flags[6] = false;
		return flags;
	}

	const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

	// Intentional one-time form defaults from initial props.
	// svelte-ignore state_referenced_locally
	let kelasRows: KelasRow[] = $state(
		kelasList.map((k) => {
			const config = kelasPresensi[k.id];
			return {
				id: k.id,
				nama: k.nama,
				hari: parseDayMask(config?.hariAktif),
				jamMasuk: config?.jamMasuk ?? '',
				jamPulang: config?.jamPulang ?? ''
			};
		})
	);

	function toggleKelasHari(row: KelasRow, index: number) {
		const next = [...kelasRows];
		const i = next.findIndex((r) => r.id === row.id);
		if (i === -1) return;
		const hari = [...next[i].hari];
		hari[index] = !hari[index];
		next[i] = { ...next[i], hari };
		kelasRows = next;
	}

	function setKelasJam(row: KelasRow, field: 'jamMasuk' | 'jamPulang', value: string) {
		const next = [...kelasRows];
		const i = next.findIndex((r) => r.id === row.id);
		if (i === -1) return;
		next[i] = { ...next[i], [field]: value };
		kelasRows = next;
	}

	function updateSemesterRange(index: number, field: 'start' | 'end', value: string) {
		const next = [...semesterRanges];
		next[index] = { ...next[index], [field]: value };
		semesterRanges = next;
	}

	const validationError = $derived.by(() => {
		if (!jamMasukValue || !jamPulangValue) return 'Jam masuk dan jam pulang harus diisi';
		if (!isValidTime(jamMasukValue)) return 'Format jam masuk tidak valid (HH:mm)';
		if (!isValidTime(jamPulangValue)) return 'Format jam pulang tidak valid (HH:mm)';
		if (jamMasukValue >= jamPulangValue) return 'Jam masuk harus lebih awal dari jam pulang';
		if (!['5', '6', 'custom'].includes(hariSekolahValue)) return 'Pilih hari sekolah';
		if (hariSekolahValue === 'custom' && customDays.length === 0)
			return 'Pilih minimal satu hari belajar';
		if (!['masuk_saja', 'awal_mapel', 'awal_akhir_mapel'].includes(tipePresensiValue))
			return 'Pilih tipe presensi';
		if (
			['awal_mapel', 'awal_akhir_mapel'].includes(tipePresensiValue) &&
			jenisPresensiValue !== 'tiap_mapel'
		)
			return 'Tipe presensi Awal/Awal & Akhir Mapel hanya tersedia untuk jenis presensi Tiap Mapel';
		if (tipePresensiValue === 'masuk_saja' && jenisPresensiValue !== 'wali_kelas_saja')
			return 'Tipe presensi Masuk Saja hanya tersedia untuk jenis presensi Wali Kelas Saja';
		if (!['wali_kelas_saja', 'tiap_mapel'].includes(jenisPresensiValue))
			return 'Pilih jenis presensi';
		for (const row of kelasRows) {
			if (row.jamMasuk && !isValidTime(row.jamMasuk))
				return 'Format jam masuk kelas tidak valid (HH:mm)';
			if (row.jamPulang && !isValidTime(row.jamPulang))
				return 'Format jam pulang kelas tidak valid (HH:mm)';
			if (row.jamMasuk && row.jamPulang && row.jamMasuk >= row.jamPulang)
				return 'Jam masuk kelas harus lebih awal dari jam pulang';
		}
		return null;
	});

	function validateBeforeSubmit() {
		if (!jamMasukValue || !jamPulangValue) {
			toast('Jam masuk dan jam pulang harus diisi', 'warning');
			return false;
		}
		if (!isValidTime(jamMasukValue)) {
			toast('Format jam masuk tidak valid (HH:mm)', 'warning');
			return false;
		}
		if (!isValidTime(jamPulangValue)) {
			toast('Format jam pulang tidak valid (HH:mm)', 'warning');
			return false;
		}
		if (jamMasukValue >= jamPulangValue) {
			toast('Jam masuk harus lebih awal dari jam pulang', 'warning');
			return false;
		}
		if (!['5', '6', 'custom'].includes(hariSekolahValue)) {
			toast('Pilih hari sekolah', 'warning');
			return false;
		}
		if (hariSekolahValue === 'custom' && customDays.length === 0) {
			toast('Pilih minimal satu hari belajar', 'warning');
			return false;
		}
		if (!['masuk_saja', 'awal_mapel', 'awal_akhir_mapel'].includes(tipePresensiValue)) {
			toast('Pilih tipe presensi', 'warning');
			return false;
		}
		if (
			['awal_mapel', 'awal_akhir_mapel'].includes(tipePresensiValue) &&
			jenisPresensiValue !== 'tiap_mapel'
		) {
			toast(
				'Tipe presensi Awal/Awal & Akhir Mapel hanya tersedia untuk jenis presensi Tiap Mapel',
				'warning'
			);
			return false;
		}
		if (tipePresensiValue === 'masuk_saja' && jenisPresensiValue !== 'wali_kelas_saja') {
			toast(
				'Tipe presensi Masuk Saja hanya tersedia untuk jenis presensi Wali Kelas Saja',
				'warning'
			);
			return false;
		}
		for (const row of kelasRows) {
			if (row.jamMasuk && !isValidTime(row.jamMasuk)) {
				toast(`Format jam masuk kelas ${row.nama} tidak valid (HH:mm)`, 'warning');
				return false;
			}
			if (row.jamPulang && !isValidTime(row.jamPulang)) {
				toast(`Format jam pulang kelas ${row.nama} tidak valid (HH:mm)`, 'warning');
				return false;
			}
			if (row.jamMasuk && row.jamPulang && row.jamMasuk >= row.jamPulang) {
				toast(`Jam masuk kelas ${row.nama} harus lebih awal dari jam pulang`, 'warning');
				return false;
			}
		}
		return true;
	}

	function buildKelasFormData(): FormData {
		const formData = new FormData();
		for (const row of kelasRows) {
			row.hari.forEach((on, index) => {
				if (on) formData.append(`kelas_${row.id}_hariAktif`, String(index));
			});
			formData.append(`kelas_${row.id}_jamMasuk`, row.jamMasuk);
			formData.append(`kelas_${row.id}_jamPulang`, row.jamPulang);
		}
		return formData;
	}

	async function handleSubmit() {
		if (!validateBeforeSubmit()) return;

		submitting = true;
		setLoading(true);
		const formData = new FormData();
		formData.append('tahunAjaranId', String(tahunAjaranId));
		formData.append('jamMasuk', jamMasukValue);
		formData.append('jamPulang', jamPulangValue);
		formData.append('hariSekolah', hariSekolahValue);
		formData.append(
			'hariSekolahCustom',
			hariSekolahValue === 'custom' ? JSON.stringify(customDays) : ''
		);
		formData.append('tipePresensi', tipePresensiValue);
		formData.append('jenisPresensi', jenisPresensiValue);
		formData.append('liburNasional', JSON.stringify(liburDates));
		formData.append(
			'liburSemester',
			JSON.stringify(semesterRanges.filter((r) => r.start && r.end))
		);

		try {
			const response = await fetch('?/savePresensiSettings', {
				method: 'POST',
				body: formData,
				redirect: 'error'
			});

			if (!response.ok) {
				const err = await response
					.json()
					.catch(() => ({ fail: 'Gagal menyimpan pengaturan presensi' }));
				throw new Error(err.fail ?? `Error ${response.status}`);
			}

			// Per-class presensi config is a separate action when kelas data is present.
			if (kelasRows.length > 0) {
				const kelasResponse = await fetch('?/simpanPresensiKelas', {
					method: 'POST',
					body: buildKelasFormData(),
					redirect: 'error'
				});
				if (!kelasResponse.ok) {
					const err = await kelasResponse
						.json()
						.catch(() => ({ fail: 'Gagal menyimpan pengaturan presensi kelas' }));
					throw new Error(err.fail ?? `Error ${kelasResponse.status}`);
				}
			}

			hideModal();
			toast('Pengaturan presensi berhasil disimpan', 'success');
			await invalidate('app:akademik');
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Gagal menyimpan pengaturan presensi';
			toast(message, 'error');
		} finally {
			submitting = false;
			setLoading(false);
		}
	}

	function handleCancel() {
		hideModal();
	}

	$effect(() => {
		onAction?.({ submit: handleSubmit, cancel: handleCancel });
	});

	// Auto-set tipePresensi when jenisPresensi changes
	$effect(() => {
		if (jenisPresensiValue === 'tiap_mapel') {
			if (!['awal_mapel', 'awal_akhir_mapel'].includes(tipePresensiValue)) {
				tipePresensiValue = 'awal_mapel';
			}
		} else if (['awal_mapel', 'awal_akhir_mapel'].includes(tipePresensiValue)) {
			tipePresensiValue = 'masuk_saja';
		}
	});
</script>

<div class="not-prose flex flex-col gap-4">
	<div class="my-1 flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-zinc-300">
		<div class="h-px flex-1 bg-slate-200/80 dark:bg-zinc-800"></div>
		<span>Presensi Murid</span>
		<div class="h-px flex-1 bg-slate-200/80 dark:bg-zinc-800"></div>
	</div>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<label class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Jam Masuk</span>
			<input
				type="text"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={jamMasukValue}
				pattern="[0-9]{2}:[0-9]{2}"
				inputmode="numeric"
				placeholder="HH:mm"
			/>
		</label>
		<label class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Jam Pulang</span>
			<input
				type="text"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={jamPulangValue}
				pattern="[0-9]{2}:[0-9]{2}"
				inputmode="numeric"
				placeholder="HH:mm"
			/>
		</label>
	</div>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<label class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Hari Sekolah</span>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={hariSekolahValue}
				>
					<option value="5">5 Hari Sekolah (Senin - Jumat)</option>
					<option value="6">6 Hari Sekolah (Senin - Sabtu)</option>
					<option value="custom">Kustom (pilih hari belajar)</option>
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
			{#if hariSekolahValue === 'custom'}
				<div class="flex flex-wrap gap-1.5 pt-1">
					{#each HARI_SEKOLAH_KEYS as key (key)}
						<button
							type="button"
							class="inline-flex cursor-pointer items-center rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors {customDays.includes(
								key
							)
								? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300'
								: 'border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}"
							onclick={() => toggleCustomDay(key)}
						>
							{customDayLabels[key]}
						</button>
					{/each}
				</div>
			{/if}
		</label>
		<label class="flex flex-col gap-1.5">
			<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Jenis Presensi</span>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={jenisPresensiValue}
				>
					<option value="wali_kelas_saja">Wali kelas saja</option>
					<option value="tiap_mapel">Tiap mapel</option>
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</label>
	</div>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<div class="flex flex-col gap-1.5 sm:order-2">
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Tipe Presensi</span>
				<div class="relative flex items-center">
					<select
						class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={tipePresensiValue}
					>
						<option value="masuk_saja" disabled={jenisPresensiValue === 'tiap_mapel'}>
							Masuk Saja
						</option>
						<option value="awal_mapel" disabled={jenisPresensiValue !== 'tiap_mapel'}>
							Awal Mapel
						</option>
						<option value="awal_akhir_mapel" disabled={jenisPresensiValue !== 'tiap_mapel'}>
							Awal & Akhir Mapel
						</option>
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</div>
			</label>
		</div>

		<div class="flex flex-col gap-1.5 sm:order-1">
			<span class="text-xs font-medium text-slate-700 dark:text-zinc-300"
				>Tanggal Libur Nasional</span
			>
			<div class="flex items-center gap-2">
				<input
					type="date"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={newLiburDate}
					disabled={submitting}
				/>
				<button
					type="button"
					class="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={addLiburDate}
					disabled={submitting || !newLiburDate}
				>
					Tambah
				</button>
			</div>
		</div>
	</div>

	{#if liburDates.length > 0}
		<div class="flex flex-wrap gap-1.5">
			{#each liburDates as date, i (date)}
				<div
					class="inline-flex items-center gap-1.5 rounded-full border border-red-200/80 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
				>
					<span>{date}</span>
					<button
						type="button"
						class="inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-red-200/60 dark:hover:bg-red-900/60"
						onclick={() => removeLiburDate(i)}
						disabled={submitting}
						aria-label="Hapus {date}"
					>
						<Icon name="close-sm" class="h-3 w-3" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<div class="flex flex-col gap-2">
		<div class="flex items-center justify-between">
			<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Libur Semester</span>
			<button
				type="button"
				class="inline-flex h-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={addSemesterRange}
				disabled={submitting}
			>
				Tambah Rentang
			</button>
		</div>
		{#each semesterRanges as range, i (i)}
			<div class="flex flex-wrap items-center gap-2">
				<input
					type="date"
					class="h-9 w-44 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					value={range.start}
					onchange={(e) =>
						updateSemesterRange(i, 'start', (e.currentTarget as HTMLInputElement).value)}
				/>
				<span class="text-xs text-slate-500 dark:text-zinc-400">s.d.</span>
				<input
					type="date"
					class="h-9 w-44 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					value={range.end}
					onchange={(e) =>
						updateSemesterRange(i, 'end', (e.currentTarget as HTMLInputElement).value)}
				/>
				<button
					type="button"
					class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
					onclick={() => removeSemesterRange(i)}
					disabled={submitting}
					aria-label="Hapus rentang tanggal"
				>
					<Icon name="close-sm" class="h-3.5 w-3.5" />
				</button>
			</div>
		{/each}
		{#if semesterRanges.length === 0}
			<p class="text-[11px] text-slate-400 dark:text-zinc-500">Belum ada rentang libur semester.</p>
		{/if}
	</div>

	{#if kelasRows.length > 0}
		<div class="flex flex-col gap-2">
			<div
				class="my-1 flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-zinc-300"
			>
				<div class="h-px flex-1 bg-slate-200/80 dark:bg-zinc-800"></div>
				<span>Presensi Per Kelas (Halaman Pengaturan)</span>
				<div class="h-px flex-1 bg-slate-200/80 dark:bg-zinc-800"></div>
			</div>
			<div
				class="max-h-64 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<table class="w-full border-collapse text-left text-xs">
					<thead
						class="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 text-[11px] font-semibold tracking-wider text-slate-500 uppercase backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-800/95 dark:text-zinc-400"
					>
						<tr>
							<th class="px-3 py-2">Kelas</th>
							{#each DAY_LABELS as day (day)}
								<th class="px-1.5 py-2 text-center">{day}</th>
							{/each}
							<th class="px-2 py-2">Jam Masuk</th>
							<th class="px-2 py-2">Jam Pulang</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200/70 dark:divide-zinc-800">
						{#each kelasRows as row (row.id)}
							<tr class="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40">
								<td
									class="px-3 py-2 font-medium whitespace-nowrap text-slate-800 dark:text-zinc-200"
									>{row.nama}</td
								>
								{#each row.hari as on, i (i)}
									<td class="px-1.5 py-2 text-center">
										<input
											type="checkbox"
											class="checkbox checkbox-sm rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
											checked={on}
											onchange={() => toggleKelasHari(row, i)}
											disabled={submitting}
											aria-label="{row.nama} {DAY_LABELS[i]}"
										/>
									</td>
								{/each}
								<td class="px-2 py-1.5">
									<input
										type="text"
										class="h-8 w-20 rounded-lg border border-[#7e8b9b] bg-white px-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
										value={row.jamMasuk}
										onchange={(e) =>
											setKelasJam(row, 'jamMasuk', (e.currentTarget as HTMLInputElement).value)}
										placeholder="HH:mm"
										disabled={submitting}
									/>
								</td>
								<td class="px-2 py-1.5">
									<input
										type="text"
										class="h-8 w-20 rounded-lg border border-[#7e8b9b] bg-white px-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
										value={row.jamPulang}
										onchange={(e) =>
											setKelasJam(row, 'jamPulang', (e.currentTarget as HTMLInputElement).value)}
										placeholder="HH:mm"
										disabled={submitting}
									/>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-[11px] text-slate-400 dark:text-zinc-500">
				Kosongkan jam untuk mengikuti jam masuk/pulang umum di atas.
			</p>
		</div>
	{/if}

	{#if validationError}
		<div
			class="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
			role="alert"
		>
			<Icon name="warning" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>{validationError}</span>
		</div>
	{/if}
</div>
