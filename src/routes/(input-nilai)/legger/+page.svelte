<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let cariMuridKelas = $state('');

	const mode = $derived(data.mode ?? 'murid');
	const daftarKelas = $derived(data.daftarKelas ?? []);
	const activeSemesterKelas = $derived(daftarKelas.filter((k) => k.isSemesterAktif));
	const otherSemesterKelas = $derived(daftarKelas.filter((k) => !k.isSemesterAktif));

	const daftarMuridKelas = $derived(data.daftarMuridKelas ?? []);
	const muridDetail = $derived(data.muridDetail ?? null);
	const kelasLegger = $derived(data.kelas ?? null);
	const kolom = $derived(data.kolom ?? []);
	const baris = $derived(data.baris ?? []);
	const rekap = $derived(data.rekap ?? { terisi: 0, total: 0, persentase: null });
	const bobot = $derived(data.bobot ?? { lingkup: 60, sts: 20, sas: 20 });

	const barisTersaring = $derived.by(() => {
		const q = cariMuridKelas.trim().toLowerCase();
		if (!q) return baris;
		return baris.filter(
			(r) =>
				r.nama.toLowerCase().includes(q) ||
				r.nisn.toLowerCase().includes(q) ||
				r.nis.toLowerCase().includes(q)
		);
	});

	const isSinglePeriodDetail = $derived(
		Boolean(
			muridDetail &&
			muridDetail.riwayatTampil.length === 1 &&
			muridDetail.waktuTerpilih.startsWith('riwayat:')
		)
	);

	const exportHref = $derived.by(() => {
		if (!data.kelasId) return '/api/legger/export';
		const params = new URLSearchParams();
		params.set('kelas', String(data.kelasId));
		params.set('mode', mode);
		if (mode === 'murid' && data.muridId) {
			params.set('murid', String(data.muridId));
			if (muridDetail?.waktuTerpilih && muridDetail.waktuTerpilih !== 'semua') {
				params.set('waktu', muridDetail.waktuTerpilih);
			}
		}
		return `/api/legger/export?${params.toString()}`;
	});

	function buildUrl(next: {
		mode?: 'murid' | 'kelas';
		kelasId?: number | null;
		muridId?: number | null;
		waktu?: string | null;
	}) {
		const params = new URLSearchParams();
		const targetMode = next.mode ?? mode;
		const targetKelas = next.kelasId === undefined ? data.kelasId : next.kelasId;
		params.set('mode', targetMode);
		if (targetKelas) params.set('kelas', String(targetKelas));
		if (targetMode === 'murid') {
			const targetMurid = next.muridId === undefined ? data.muridId : next.muridId;
			if (targetMurid) params.set('murid', String(targetMurid));
			if (next.waktu && next.waktu !== 'semua') params.set('waktu', next.waktu);
		}
		return `/legger?${params.toString()}`;
	}

	async function onChangeKelas(kelasIdRaw: string) {
		const id = Number(kelasIdRaw);
		if (!Number.isInteger(id) || id <= 0) return;
		await goto(buildUrl({ kelasId: id, muridId: null, waktu: null }), {
			keepFocus: true,
			noScroll: true
		});
	}

	async function onChangeMurid(muridIdRaw: string) {
		const id = Number(muridIdRaw);
		if (!Number.isInteger(id) || id <= 0) return;
		await goto(buildUrl({ muridId: id, waktu: null }), {
			keepFocus: true,
			noScroll: true
		});
	}

	async function onChangeWaktu(waktuRaw: string) {
		await goto(buildUrl({ waktu: waktuRaw || 'semua' }), {
			keepFocus: true,
			noScroll: true
		});
	}

	function formatNilai(value: number | null) {
		if (value == null) return '-';
		if (Number.isInteger(value)) return value.toLocaleString('id-ID');
		return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function warnaNilai(value: number | null) {
		if (value == null) return 'text-slate-400 dark:text-zinc-500';
		if (value >= 90) return 'text-emerald-700 dark:text-emerald-400';
		if (value >= 80) return 'text-sky-700 dark:text-sky-400';
		if (value >= 70) return 'text-amber-700 dark:text-amber-400';
		return 'text-red-700 dark:text-red-400';
	}

	function statusMuridLabel(status: string) {
		if (status === 'lulus') return 'Lulus';
		if (status === 'pindah') return 'Pindah';
		if (status === 'keluar') return 'Keluar';
		return 'Aktif';
	}

	function tingkatLabelPrefix(tingkat: string) {
		if (tingkat === 'X' || tingkat === 'XI' || tingkat === 'XII') return `Kelas ${tingkat}`;
		return tingkat || 'Rombel';
	}
</script>

<div class="space-y-5">
	<!-- Printable Header (only visible when printing) -->
	<div class="hidden border-b border-slate-300 pb-3 print:block">
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-600">{data.sekolahNama}</p>
		<h1 class="text-lg font-bold text-slate-900">
			{#if mode === 'murid' && muridDetail}
				Leger Nilai Murid (Kelas X - XII): {muridDetail.murid.nama}
			{:else if kelasLegger}
				Leger Nilai Kelas {kelasLegger.nama} ({kelasLegger.semesterLabel})
			{:else}
				Leger Nilai
			{/if}
		</h1>
		{#if mode === 'murid' && muridDetail}
			<p class="mt-1 text-xs text-slate-700">
				NIS: {muridDetail.murid.nis || '-'} | NISN: {muridDetail.murid.nisn || '-'} | Kelas Acuan: {muridDetail
					.murid.kelasNama}
			</p>
		{/if}
	</div>

	<!-- Top Header, Mode Switch & Filter Bar -->
	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 print:hidden"
	>
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Legger</h1>
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					{#if mode === 'murid'}
						Catatan nilai akhir murid dari kelas awal sampai akhir (Kelas X, XI, XII) secara
						kronologis.
					{:else}
						Rekap nilai akhir seluruh murid pada satu rombel. Klik nama murid untuk melihat riwayat
						kelas X sampai XII.
					{/if}
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<!-- View Mode Toggle -->
				<div
					class="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
					role="tablist"
					aria-label="Mode tampilan legger"
				>
					<a
						href={buildUrl({ mode: 'murid' })}
						role="tab"
						aria-selected={mode === 'murid'}
						class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {mode === 'murid'
							? 'bg-blue-600 text-white shadow-sm'
							: 'text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-zinc-100'}"
					>
						Per Siswa (X - XII)
					</a>
					<a
						href={buildUrl({ mode: 'kelas' })}
						role="tab"
						aria-selected={mode === 'kelas'}
						class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {mode === 'kelas'
							? 'bg-blue-600 text-white shadow-sm'
							: 'text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-zinc-100'}"
					>
						Satu Kelas
					</a>
				</div>

				{#if data.kelasId && (mode === 'kelas' ? baris.length > 0 : muridDetail != null)}
					<a
						data-sveltekit-reload
						download
						class="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						href={exportHref}
					>
						<span aria-hidden="true"><Icon name="download" class="h-3.5 w-3.5" /></span>
						<span>Unduh Excel</span>
					</a>
					<button
						type="button"
						class="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
						onclick={() => window.print()}
					>
						<span aria-hidden="true"><Icon name="print" class="h-3.5 w-3.5" /></span>
						<span>Cetak</span>
					</button>
				{/if}
			</div>
		</div>

		<!-- Selectors -->
		<div
			class="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 md:grid-cols-3 dark:border-zinc-800"
		>
			<!-- Dropdown 1: Pilih Kelas -->
			<div class="min-w-0">
				<label
					for="legger-kelas-select"
					class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
				>
					Pilih Kelas
				</label>
				<div class="relative flex items-center">
					<select
						id="legger-kelas-select"
						name="kelas"
						class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
						disabled={daftarKelas.length === 0}
						value={data.kelasId ? String(data.kelasId) : ''}
						onchange={(e) => onChangeKelas(e.currentTarget.value)}
					>
						{#if daftarKelas.length === 0}
							<option value="">Belum ada kelas</option>
						{:else if activeSemesterKelas.length > 0 && otherSemesterKelas.length > 0}
							<optgroup label="Semester Aktif">
								{#each activeSemesterKelas as k (k.id)}
									<option value={String(k.id)}>
										{k.nama} ({k.semesterLabel}) - {k.jumlahMurid} murid
									</option>
								{/each}
							</optgroup>
							<optgroup label="Semester Lainnya">
								{#each otherSemesterKelas as k (k.id)}
									<option value={String(k.id)}>
										{k.nama} ({k.semesterLabel}) - {k.jumlahMurid} murid
									</option>
								{/each}
							</optgroup>
						{:else}
							{#each daftarKelas as k (k.id)}
								<option value={String(k.id)}>
									{k.nama} ({k.semesterLabel}) - {k.jumlahMurid} murid
								</option>
							{/each}
						{/if}
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</div>
			</div>

			{#if mode === 'murid'}
				<!-- Dropdown 2: Pilih Siswa -->
				<div class="min-w-0">
					<label
						for="legger-murid-select"
						class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Pilih Siswa
					</label>
					<div class="relative flex items-center">
						<select
							id="legger-murid-select"
							name="murid"
							class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
							disabled={daftarMuridKelas.length === 0}
							value={data.muridId ? String(data.muridId) : ''}
							onchange={(e) => onChangeMurid(e.currentTarget.value)}
						>
							{#if daftarMuridKelas.length === 0}
								<option value="">Belum ada siswa di kelas ini</option>
							{:else}
								{#each daftarMuridKelas as m (m.id)}
									<option value={String(m.id)}>
										{m.nama}{m.nisn ? ` (NISN ${m.nisn})` : m.nis ? ` (NIS ${m.nis})` : ''}
									</option>
								{/each}
							{/if}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
				</div>

				<!-- Dropdown 3: Waktu / Kelas Berapa -->
				<div class="min-w-0">
					<label
						for="legger-waktu-select"
						class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Waktu / Kelas Berapa
					</label>
					<div class="relative flex items-center">
						<select
							id="legger-waktu-select"
							name="waktu"
							class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
							disabled={!muridDetail || muridDetail.waktuPilihan.length === 0}
							value={muridDetail?.waktuTerpilih ?? 'semua'}
							onchange={(e) => onChangeWaktu(e.currentTarget.value)}
						>
							{#if !muridDetail}
								<option value="semua">Semua Kelas (X - XI - XII)</option>
							{:else}
								{#each muridDetail.waktuPilihan as opsi (opsi.value)}
									<option value={opsi.value}>
										{opsi.label}{opsi.sublabel ? ` - ${opsi.sublabel}` : ''}
									</option>
								{/each}
							{/if}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
				</div>
			{:else}
				<!-- Cari Siswa in Satu Kelas mode -->
				<div class="min-w-0 md:col-span-2">
					<label
						for="legger-cari-kelas"
						class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Cari Murid di Kelas {kelasLegger?.nama ?? ''}
					</label>
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
						<div
							class="flex h-9 flex-1 items-center gap-2 rounded-xl border border-[#7e8b9b] bg-white px-2.5 transition-colors focus-within:border-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-blue-400"
						>
							<span aria-hidden="true" class="shrink-0 text-slate-500 dark:text-zinc-400">
								<Icon name="search" class="h-3.5 w-3.5" />
							</span>
							<input
								id="legger-cari-kelas"
								type="search"
								bind:value={cariMuridKelas}
								placeholder="Ketik nama, NIS, atau NISN murid..."
								class="min-w-0 flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
							/>
						</div>
						{#if kelasLegger}
							<span
								class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 tabular-nums dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
								title="Kelengkapan {rekap.terisi} dari {rekap.total} sel nilai"
							>
								<span>Kelengkapan:</span>
								<strong class="text-blue-600 dark:text-blue-400">
									{rekap.persentase ?? 0}%
								</strong>
							</span>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</section>

	{#if mode === 'murid'}
		{#if !data.kelasId}
			<div
				class="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
				role="alert"
			>
				<span aria-hidden="true" class="shrink-0 text-amber-700 dark:text-amber-400">
					<Icon name="info" class="h-4 w-4" />
				</span>
				<span>Belum ada kelas terdaftar untuk ditampilkan di Legger.</span>
			</div>
		{:else if !muridDetail}
			<div
				class="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
				role="alert"
			>
				<span aria-hidden="true" class="shrink-0 text-amber-700 dark:text-amber-400">
					<Icon name="info" class="h-4 w-4" />
				</span>
				<span
					>Belum ada data siswa di kelas {kelasLegger?.nama ?? ''}. Pilih kelas lain di atas.</span
				>
			</div>
		{:else}
			<!-- Student Identity & Grade Progression Cards (Kelas X, XI, XII, Kumulatif) -->
			<section
				class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 print:hidden"
			>
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-base font-bold text-slate-900 sm:text-lg dark:text-zinc-100">
								{muridDetail.murid.nama}
							</h2>
							<span
								class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
							>
								{statusMuridLabel(muridDetail.murid.status)}
							</span>
						</div>
						<div
							class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-zinc-400"
						>
							<span
								>NIS: <strong class="font-semibold text-slate-800 dark:text-zinc-200"
									>{muridDetail.murid.nis || '-'}</strong
								></span
							>
							<span
								>NISN: <strong class="font-semibold text-slate-800 dark:text-zinc-200"
									>{muridDetail.murid.nisn || '-'}</strong
								></span
							>
							<span
								>Kelas Acuan: <strong class="font-semibold text-slate-800 dark:text-zinc-200"
									>{muridDetail.murid.kelasNama}</strong
								></span
							>
							{#if muridDetail.murid.waliKelas}
								<span
									>Wali Kelas: <strong class="font-semibold text-slate-800 dark:text-zinc-200"
										>{muridDetail.murid.waliKelas}</strong
									></span
								>
							{/if}
							<span
								>Agama: <strong class="font-semibold text-slate-800 dark:text-zinc-200"
									>{muridDetail.murid.agama || '-'}</strong
								></span
							>
						</div>
					</div>

					<div class="flex shrink-0 items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
						<span>
							Tercatat <strong class="text-slate-900 tabular-nums dark:text-zinc-100"
								>{muridDetail.semuaRiwayat.length}</strong
							> periode semester
						</span>
					</div>
				</div>

				<!-- 4 Cards: Kelas X | Kelas XI | Kelas XII | Kumulatif -->
				<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{#each muridDetail.ringkasanTingkat as item (item.tingkat)}
						{@const isSelectedLevel =
							muridDetail.waktuTerpilih === `tingkat:${item.tingkat}` ||
							(muridDetail.riwayatTampil.length === 1 &&
								muridDetail.waktuTerpilih !== 'semua' &&
								muridDetail.riwayatTampil[0]?.tingkat === item.tingkat)}
						<button
							type="button"
							disabled={!item.adaData}
							onclick={() => {
								if (!item.adaData) return;
								const targetWaktu =
									item.jumlahSemester > 1
										? isSelectedLevel
											? 'semua'
											: `tingkat:${item.tingkat}`
										: isSelectedLevel
											? 'semua'
											: `riwayat:${muridDetail.semuaRiwayat.find((r) => r.tingkat === item.tingkat)?.muridId}`;
								onChangeWaktu(targetWaktu);
							}}
							class="flex flex-col justify-between rounded-xl border p-3.5 text-left transition-colors {isSelectedLevel
								? 'border-blue-600 bg-blue-50/75 dark:border-blue-500 dark:bg-blue-950/40'
								: item.adaData
									? 'border-slate-200 bg-slate-50/70 hover:border-blue-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-blue-700'
									: 'cursor-default border-dashed border-slate-200 bg-slate-50/40 opacity-75 dark:border-zinc-800 dark:bg-zinc-900/40'}"
						>
							<div class="flex items-center justify-between gap-2">
								<span class="text-xs font-bold text-slate-800 dark:text-zinc-200">
									{item.label}
								</span>
								{#if item.adaData}
									<span
										class="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"
									>
										{item.kelasDaftar.join(', ')}
									</span>
								{:else}
									<span class="text-[11px] text-slate-500 dark:text-zinc-500">Belum ada data</span>
								{/if}
							</div>

							<div class="mt-2 flex items-baseline justify-between gap-2">
								<span class="text-xl font-bold tabular-nums {warnaNilai(item.rataRata)}">
									{formatNilai(item.rataRata)}
								</span>
								<span class="text-[11px] text-slate-600 tabular-nums dark:text-zinc-400">
									{#if item.adaData}
										{item.terisi}/{item.totalMapel} mapel · {item.jumlahSemester} smt
									{:else}
										Riwayat kosong
									{/if}
								</span>
							</div>
						</button>
					{/each}

					<!-- 4th Card: Kumulatif -->
					<div
						class="flex flex-col justify-between rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30"
					>
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-bold text-blue-900 dark:text-blue-200">
								Rata-rata Ditampilkan
							</span>
							{#if muridDetail.waktuTerpilih !== 'semua'}
								<button
									type="button"
									class="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
									onclick={() => onChangeWaktu('semua')}
								>
									Tampilkan semua
								</button>
							{:else}
								<span class="text-[11px] font-medium text-blue-700 dark:text-blue-300">
									Awal s.d. Akhir
								</span>
							{/if}
						</div>

						<div class="mt-2 flex items-baseline justify-between gap-2">
							<span class="text-xl font-bold tabular-nums {warnaNilai(muridDetail.rataKumulatif)}">
								{formatNilai(muridDetail.rataKumulatif)}
							</span>
							<span class="text-[11px] text-slate-700 tabular-nums dark:text-zinc-300">
								S:{muridDetail.totalKehadiran.sakit} I:{muridDetail.totalKehadiran.izin} A:{muridDetail
									.totalKehadiran.alfa}
							</span>
						</div>
					</div>
				</div>
			</section>

			<!-- Longitudinal Grades Grid -->
			<section
				class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 print:border-none print:p-0 print:shadow-none"
			>
				{#if muridDetail.barisMapel.length === 0}
					<div
						class="rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-zinc-700"
					>
						<p class="text-sm font-semibold text-slate-800 dark:text-zinc-200">
							Belum ada mata pelajaran intrakurikuler pada periode ini
						</p>
						<p class="mt-1 text-xs text-slate-600 dark:text-zinc-400">
							Tambahkan mata pelajaran terlebih dahulu di menu Intrakurikuler agar nilai muncul di
							Legger.
						</p>
					</div>
				{:else if isSinglePeriodDetail}
					{@const period = muridDetail.riwayatTampil[0]}
					<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
						<div>
							<h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100">
								Rincian Nilai {tingkatLabelPrefix(period.tingkat)} ({period.kelasNama})
							</h3>
							<p class="text-xs text-slate-600 dark:text-zinc-400">
								{period.semesterLabel}
								{#if period.waliKelas}
									· Wali kelas: {period.waliKelas}
								{/if}
							</p>
						</div>
						<button
							type="button"
							class="text-xs font-semibold text-blue-600 hover:underline print:hidden dark:text-blue-400"
							onclick={() => onChangeWaktu('semua')}
						>
							Lihat Semua Kelas (X - XI - XII)
						</button>
					</div>

					<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
						<table class="w-full min-w-[680px] border-collapse text-left text-xs sm:text-sm">
							<thead
								class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
							>
								<tr>
									<th class="w-11 px-3 py-2.5 text-center">No</th>
									<th class="min-w-52 px-3 py-2.5">Mata Pelajaran</th>
									<th class="px-3 py-2.5 text-center">KKM</th>
									<th class="px-3 py-2.5 text-center">Lingkup ({bobot.lingkup}%)</th>
									<th class="px-3 py-2.5 text-center">STS ({bobot.sts}%)</th>
									<th class="px-3 py-2.5 text-center">SAS ({bobot.sas}%)</th>
									<th class="px-3 py-2.5 text-center">Nilai Akhir</th>
									<th class="px-3 py-2.5 text-center">Capaian</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
								{#each muridDetail.barisMapel as row, idx (row.key)}
									{@const sel = row.sel[0]}
									{@const tuntas =
										sel.nilaiAkhir != null && sel.kkm != null && sel.nilaiAkhir >= sel.kkm}
									<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
										<td
											class="px-3 py-2.5 text-center text-slate-600 tabular-nums dark:text-zinc-400"
										>
											{idx + 1}
										</td>
										<td class="px-3 py-2.5">
											<div class="font-medium text-slate-900 dark:text-zinc-100">{row.nama}</div>
											{#if row.jenisLabel || row.kode}
												<div class="text-[11px] text-slate-500 dark:text-zinc-400">
													{[row.kode, row.jenisLabel].filter(Boolean).join(' · ')}
												</div>
											{/if}
										</td>
										<td
											class="px-3 py-2.5 text-center text-slate-600 tabular-nums dark:text-zinc-400"
										>
											{sel.kkm ?? '-'}
										</td>
										<td
											class="px-3 py-2.5 text-center text-slate-700 tabular-nums dark:text-zinc-300"
										>
											{formatNilai(sel.naLingkup)}
										</td>
										<td
											class="px-3 py-2.5 text-center text-slate-700 tabular-nums dark:text-zinc-300"
										>
											{formatNilai(sel.sts)}
										</td>
										<td
											class="px-3 py-2.5 text-center text-slate-700 tabular-nums dark:text-zinc-300"
										>
											{formatNilai(sel.sas)}
										</td>
										<td
											class="px-3 py-2.5 text-center font-bold tabular-nums {warnaNilai(
												sel.nilaiAkhir
											)}"
										>
											{formatNilai(sel.nilaiAkhir)}
										</td>
										<td class="px-3 py-2.5 text-center">
											{#if sel.nilaiAkhir == null}
												<span class="text-[11px] text-slate-500 dark:text-zinc-500"
													>Belum dinilai</span
												>
											{:else if tuntas}
												<span
													class="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
												>
													Tuntas
												</span>
											{:else}
												<span
													class="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
												>
													Di bawah KKM
												</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
							<tfoot
								class="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100"
							>
								<tr>
									<td></td>
									<td class="px-3 py-2.5">Jumlah / Rata-rata Semester</td>
									<td
										colspan="4"
										class="px-3 py-2.5 text-right text-slate-600 tabular-nums dark:text-zinc-400"
									>
										Jumlah: {period.terisi > 0 ? formatNilai(period.jumlahNilai) : '-'}
									</td>
									<td
										class="px-3 py-2.5 text-center font-bold tabular-nums {warnaNilai(
											period.rataRata
										)}"
									>
										{formatNilai(period.rataRata)}
									</td>
									<td
										class="px-3 py-2.5 text-center text-[11px] text-slate-600 tabular-nums dark:text-zinc-300"
									>
										S:{period.sakit} I:{period.izin} A:{period.alfa}
									</td>
								</tr>
							</tfoot>
						</table>
					</div>
				{:else}
					<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
						<div>
							<h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100">
								Perkembangan Nilai Lintas Semester
							</h3>
							<p class="text-xs text-slate-600 dark:text-zinc-400">
								Klik judul kolom semester untuk melihat rincian Lingkup, STS, dan SAS periode
								tersebut.
							</p>
						</div>
					</div>

					<div
						class="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 print:max-h-none print:overflow-visible dark:border-zinc-800"
					>
						<table class="w-full min-w-[600px] border-collapse text-left text-xs sm:text-sm">
							<thead>
								<tr
									class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
								>
									<th
										class="sticky top-0 left-0 z-30 w-11 min-w-11 border-b border-slate-200 bg-slate-50 px-2.5 py-3 text-center dark:border-zinc-800 dark:bg-zinc-800"
									>
										No
									</th>
									<th
										class="sticky top-0 left-11 z-30 min-w-52 border-r border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-800"
									>
										Mata Pelajaran
									</th>
									{#each muridDetail.riwayatTampil as period (period.muridId)}
										<th
											class="sticky top-0 z-20 min-w-36 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-800"
										>
											<button
												type="button"
												onclick={() => onChangeWaktu(`riwayat:${period.muridId}`)}
												class="group inline-flex flex-col items-center rounded-md px-1.5 py-0.5 transition-colors hover:bg-white dark:hover:bg-zinc-700"
												title={`Klik untuk rincian ${period.kelasNama} (${period.semesterLabel})`}
											>
												<span
													class="text-xs font-bold text-blue-700 group-hover:underline dark:text-blue-300"
												>
													{tingkatLabelPrefix(period.tingkat)} · {period.kelasNama}
												</span>
												<span class="text-[11px] font-normal text-slate-600 dark:text-zinc-400">
													{period.semesterLabel}
												</span>
											</button>
										</th>
									{/each}
									<th
										class="sticky top-0 z-20 min-w-24 border-l border-b border-slate-200 bg-blue-50 px-3 py-3 text-center font-bold text-blue-900 dark:border-zinc-800 dark:bg-blue-950/60 dark:text-blue-200"
									>
										Rata-rata
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
								{#each muridDetail.barisMapel as row, idx (row.key)}
									<tr class="group transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/40">
										<td
											class="sticky left-0 z-10 w-11 min-w-11 bg-white px-2.5 py-2.5 text-center text-slate-600 tabular-nums group-hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-400 dark:group-hover:bg-zinc-800"
										>
											{idx + 1}
										</td>
										<td
											class="sticky left-11 z-10 min-w-52 border-r border-slate-200 bg-white px-3 py-2.5 group-hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:group-hover:bg-zinc-800"
										>
											<div class="font-medium text-slate-900 dark:text-zinc-100">{row.nama}</div>
											{#if row.jenisLabel || row.kode}
												<div class="text-[11px] text-slate-500 dark:text-zinc-400">
													{[row.kode, row.jenisLabel].filter(Boolean).join(' · ')}
												</div>
											{/if}
										</td>
										{#each row.sel as sel, sIdx (sIdx)}
											<td
												class="px-3 py-2.5 text-center tabular-nums"
												title={sel.diambil
													? `Lingkup: ${formatNilai(sel.naLingkup)} | STS: ${formatNilai(sel.sts)} | SAS: ${formatNilai(sel.sas)} | KKM: ${sel.kkm ?? '-'}`
													: 'Mapel tidak ada pada periode ini'}
											>
												{#if !sel.diambil}
													<span class="text-slate-300 dark:text-zinc-600">-</span>
												{:else if sel.nilaiAkhir == null}
													<span class="text-[11px] text-slate-400 italic dark:text-zinc-500">
														Belum
													</span>
												{:else}
													<span class="font-semibold {warnaNilai(sel.nilaiAkhir)}">
														{formatNilai(sel.nilaiAkhir)}
													</span>
												{/if}
											</td>
										{/each}
										<td
											class="border-l border-slate-200 bg-blue-50/40 px-3 py-2.5 text-center font-bold tabular-nums dark:border-zinc-800 dark:bg-blue-950/20 {warnaNilai(
												row.rataRata
											)}"
										>
											{formatNilai(row.rataRata)}
										</td>
									</tr>
								{/each}
							</tbody>
							<tfoot
								class="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100"
							>
								<tr class="border-b border-slate-200 dark:border-zinc-700">
									<td class="sticky left-0 z-10 bg-slate-50 dark:bg-zinc-800"></td>
									<td
										class="sticky left-11 z-10 border-r border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
									>
										Jumlah Nilai
									</td>
									{#each muridDetail.riwayatTampil as period (period.muridId)}
										<td class="px-3 py-2 text-center tabular-nums">
											{period.terisi > 0 ? formatNilai(period.jumlahNilai) : '-'}
										</td>
									{/each}
									<td
										class="border-l border-slate-200 px-3 py-2 text-center tabular-nums dark:border-zinc-700"
									>
										{muridDetail.totalTerisiKumulatif > 0
											? formatNilai(muridDetail.totalNilaiKumulatif)
											: '-'}
									</td>
								</tr>
								<tr class="border-b border-slate-200 dark:border-zinc-700">
									<td class="sticky left-0 z-10 bg-slate-50 dark:bg-zinc-800"></td>
									<td
										class="sticky left-11 z-10 border-r border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
									>
										Rata-rata Semester
									</td>
									{#each muridDetail.riwayatTampil as period (period.muridId)}
										<td
											class="px-3 py-2 text-center font-bold tabular-nums {warnaNilai(
												period.rataRata
											)}"
										>
											{formatNilai(period.rataRata)}
										</td>
									{/each}
									<td
										class="border-l border-slate-200 px-3 py-2 text-center font-bold tabular-nums dark:border-zinc-700 {warnaNilai(
											muridDetail.rataKumulatif
										)}"
									>
										{formatNilai(muridDetail.rataKumulatif)}
									</td>
								</tr>
								<tr class="border-b border-slate-200 dark:border-zinc-700">
									<td class="sticky left-0 z-10 bg-slate-50 dark:bg-zinc-800"></td>
									<td
										class="sticky left-11 z-10 border-r border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
									>
										Mapel Dinilai
									</td>
									{#each muridDetail.riwayatTampil as period (period.muridId)}
										<td
											class="px-3 py-2 text-center text-slate-600 tabular-nums dark:text-zinc-300"
										>
											{period.terisi} / {period.totalMapel}
										</td>
									{/each}
									<td
										class="border-l border-slate-200 px-3 py-2 text-center text-slate-600 tabular-nums dark:border-zinc-700 dark:text-zinc-300"
									>
										{muridDetail.totalTerisiKumulatif} / {muridDetail.totalMapelKumulatif}
									</td>
								</tr>
								<tr>
									<td class="sticky left-0 z-10 bg-slate-50 dark:bg-zinc-800"></td>
									<td
										class="sticky left-11 z-10 border-r border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
									>
										Ketidakhadiran (S / I / A)
									</td>
									{#each muridDetail.riwayatTampil as period (period.muridId)}
										<td
											class="px-3 py-2 text-center text-slate-600 tabular-nums dark:text-zinc-300"
										>
											{period.sakit} / {period.izin} / {period.alfa}
										</td>
									{/each}
									<td
										class="border-l border-slate-200 px-3 py-2 text-center text-slate-700 tabular-nums dark:border-zinc-700 dark:text-zinc-200"
									>
										{muridDetail.totalKehadiran.sakit} / {muridDetail.totalKehadiran.izin} / {muridDetail
											.totalKehadiran.alfa}
									</td>
								</tr>
							</tfoot>
						</table>
					</div>
				{/if}

				{#if muridDetail.barisMapel.length > 0}
					<div
						class="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600 print:hidden dark:text-zinc-400"
					>
						<span class="flex items-center gap-1.5 font-medium">
							<span aria-hidden="true"><Icon name="info" class="h-3.5 w-3.5" /></span>
							<span>Keterangan warna nilai:</span>
						</span>
						<span class="font-semibold text-emerald-700 dark:text-emerald-400">&ge; 90</span>
						<span class="font-semibold text-sky-700 dark:text-sky-400">80 - 89</span>
						<span class="font-semibold text-amber-700 dark:text-amber-400">70 - 79</span>
						<span class="font-semibold text-red-700 dark:text-red-400">&lt; 70</span>
					</div>
				{/if}
			</section>
		{/if}
	{:else}
		<!-- Mode: Satu Kelas -->
		<section
			class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 print:border-none print:p-0 print:shadow-none"
		>
			{#if !kolom.length || !baris.length}
				<div
					class="rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-zinc-700"
				>
					<p class="text-sm font-semibold text-slate-800 dark:text-zinc-200">
						Belum ada murid atau mata pelajaran pada kelas ini
					</p>
					<p class="mt-1 text-xs text-slate-600 dark:text-zinc-400">
						Pilih kelas lain di dropdown atas untuk melihat grid nilai legger satu kelas.
					</p>
				</div>
			{:else if barisTersaring.length === 0}
				<div
					class="rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-zinc-700"
				>
					<p class="text-sm font-semibold text-slate-800 dark:text-zinc-200">
						Murid "{cariMuridKelas}" tidak ditemukan
					</p>
					<button
						type="button"
						class="mt-2 rounded-lg px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
						onclick={() => (cariMuridKelas = '')}
					>
						Reset pencarian
					</button>
				</div>
			{:else}
				<div
					class="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 print:max-h-none print:overflow-visible dark:border-zinc-800"
				>
					<table class="w-full min-w-full border-collapse text-left text-xs sm:text-sm">
						<thead>
							<tr
								class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
							>
								<th
									class="sticky top-0 left-0 z-30 w-11 min-w-11 border-b border-slate-200 bg-slate-50 px-2.5 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-800"
								>
									No
								</th>
								<th
									class="sticky top-0 left-11 z-30 min-w-48 border-r border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800"
								>
									Nama Murid
								</th>
								{#each kolom as col (col.key)}
									<th
										class="sticky top-0 z-20 min-w-14 border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-center whitespace-nowrap dark:border-zinc-800 dark:bg-zinc-800"
										title={col.nama}
									>
										{col.singkatan}
									</th>
								{/each}
								<th
									class="sticky top-0 z-20 min-w-20 border-l border-b border-slate-200 bg-blue-50 px-2.5 py-2.5 text-center font-bold text-blue-900 whitespace-nowrap dark:border-zinc-800 dark:bg-blue-950/60 dark:text-blue-200"
								>
									Rata-rata
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
							{#each barisTersaring as row, index (row.muridId)}
								<tr class="group transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/40">
									<td
										class="sticky left-0 z-10 w-11 min-w-11 bg-white px-2.5 py-2 text-center text-slate-600 tabular-nums group-hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-400 dark:group-hover:bg-zinc-800"
									>
										{index + 1}
									</td>
									<td
										class="sticky left-11 z-10 min-w-48 border-r border-slate-200 bg-white px-3 py-2 group-hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:group-hover:bg-zinc-800"
									>
										<a
											href={buildUrl({ mode: 'murid', muridId: row.muridId, waktu: null })}
											class="font-semibold text-blue-600 hover:underline dark:text-blue-400"
											title="Buka legger riwayat lengkap siswa ini"
										>
											{row.nama}
										</a>
										<div class="text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
											NISN {row.nisn || '-'}
										</div>
									</td>
									{#each row.sel as value, cellIndex (cellIndex)}
										<td class="px-2 py-2 text-center font-medium tabular-nums {warnaNilai(value)}">
											{formatNilai(value)}
										</td>
									{/each}
									<td
										class="border-l border-slate-200 bg-blue-50/40 px-2.5 py-2 text-center font-bold tabular-nums dark:border-zinc-800 dark:bg-blue-950/20 {warnaNilai(
											row.rataRata
										)}"
									>
										{formatNilai(row.rataRata)}
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot
							class="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100"
						>
							<tr>
								<td class="sticky left-0 z-10 bg-slate-50 dark:bg-zinc-800"></td>
								<td
									class="sticky left-11 z-10 border-r border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800"
								>
									Terisi {rekap.terisi} / {rekap.total} sel
								</td>
								{#each kolom as col (col.key)}
									<td></td>
								{/each}
								<td
									class="border-l border-slate-200 px-2.5 py-2.5 text-center dark:border-zinc-700"
								>
									{rekap.persentase ?? 0}%
								</td>
							</tr>
						</tfoot>
					</table>
				</div>

				<div
					class="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600 print:hidden dark:text-zinc-400"
				>
					<span class="flex items-center gap-1.5 font-medium">
						<span aria-hidden="true"><Icon name="info" class="h-3.5 w-3.5" /></span>
						<span>Keterangan warna nilai:</span>
					</span>
					<span class="font-semibold text-emerald-700 dark:text-emerald-400">&ge; 90</span>
					<span class="font-semibold text-sky-700 dark:text-sky-400">80 - 89</span>
					<span class="font-semibold text-amber-700 dark:text-amber-400">70 - 79</span>
					<span class="font-semibold text-red-700 dark:text-red-400">&lt; 70</span>
				</div>
			{/if}
		</section>
	{/if}
</div>
