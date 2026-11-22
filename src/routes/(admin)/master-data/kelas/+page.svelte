<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import { isAdminUser } from '../../../pengguna/permissions';
	import { faseBadgeClass } from '$lib/components/kelas/fase';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let cariKelas = $state('');
	const bisaKelola = $derived(isAdminUser(page.data.user));

	interface RingkasanKelas {
		id: number;
		nama: string;
		fase: string | null;
		waliKelas: string | null;
		waliKelasNip: string | null;
		waliAsuh: string | null;
		jumlahMurid: number;
		jumlahLakiLaki: number;
		jumlahPerempuan: number;
		jumlahMapel: number;
		jumlahGuru: number;
		guru: string[];
		nilaiTerisi: number;
		nilaiDiharapkan: number;
		persenNilai: number;
		rataNilai: number | null;
		sakit: number;
		izin: number;
		alfa: number;
		muridDenganPresensi: number;
		perluPerhatian: boolean;
	}

	/**
	 * Normalize legacy fase variants ("F", "Fase F", "fase f") into canonical "Fase F".
	 */
	function normFase(value: string | null | undefined): string {
		const teks = (value ?? '').trim();
		if (!teks) return '';
		const tanpaPrefiks = teks.replace(/^fase\s+/i, '');
		return `Fase ${tanpaPrefiks.toUpperCase()}`;
	}

	const daftarKelas = $derived((data.daftarKelas ?? []) as RingkasanKelas[]);
	const ringkasan = $derived(data.ringkasan ?? null);
	const semesterOptions = $derived(data.semesterOptions ?? []);
	const semesterTerpilih = $derived(data.semesterTerpilih ?? null);

	const filterFase = $derived(normFase(page.url.searchParams.get('filterFase')));
	const faseOptions = $derived(
		[...new Set(daftarKelas.map((kelas) => normFase(kelas.fase)).filter(Boolean))].sort((a, b) =>
			a.localeCompare(b, 'id')
		)
	);

	const kelasTersaring = $derived.by(() => {
		const query = cariKelas.trim().toLowerCase();
		return daftarKelas.filter((kelas) => {
			if (filterFase && normFase(kelas.fase) !== filterFase) return false;
			if (!query) return true;
			return (
				kelas.nama.toLowerCase().includes(query) ||
				(kelas.waliKelas ?? '').toLowerCase().includes(query) ||
				kelas.guru.some((nama) => nama.toLowerCase().includes(query))
			);
		});
	});

	function statusNilai(persen: number) {
		if (persen >= 90) {
			return {
				label: 'Lengkap',
				cls: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
			};
		}
		if (persen >= 70) {
			return {
				label: 'Baik',
				cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
			};
		}
		return {
			label: 'Perlu dilengkapi',
			cls: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
		};
	}

	function gantiFilterFase(value: string) {
		const params = new URLSearchParams(page.url.search);
		if (value && value !== 'semua') params.set('filterFase', value);
		else params.delete('filterFase');
		const query = params.toString();
		goto(`/master-data/kelas${query ? `?${query}` : ''}`, { invalidateAll: true });
	}
</script>

<div class="space-y-5">
	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Kelas</h1>
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Ringkasan rombel, wali kelas, pengampu mapel, presensi, dan kelengkapan nilai sumatif.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				{#if semesterTerpilih}
					<span
						class="inline-flex h-8 w-fit items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
					>
						<span aria-hidden="true" class="text-blue-600 dark:text-blue-400">
							<Icon name="calendar" class="h-3.5 w-3.5" />
						</span>
						<span>{semesterTerpilih.nama}</span>
					</span>
				{/if}
				{#if bisaKelola}
					<a
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
						href="/master-data/kelas/form"
					>
						<Icon name="plus" class="h-4 w-4" />
						Tambah Kelas
					</a>
				{/if}
			</div>
		</div>

		{#if !semesterTerpilih}
			<div
				class="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
				role="alert"
			>
				<span aria-hidden="true" class="shrink-0 text-amber-700 dark:text-amber-400">
					<Icon name="warning" class="h-4 w-4" />
				</span>
				<span>
					Belum ada semester yang bisa ditampilkan. Setel tahun ajaran dan semester terlebih dahulu
					di menu Akademik &amp; Jadwal.
				</span>
			</div>
		{/if}

		<div
			class="mt-4 grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200/80 bg-slate-50/70 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-y-0 dark:border-zinc-800 dark:bg-zinc-800/40 dark:divide-zinc-800"
		>
			<div class="px-3.5 py-2.5">
				<div class="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Kelas</div>
				<div class="mt-0.5 text-lg font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{ringkasan?.totalKelas ?? 0}
				</div>
				<div class="text-[11px] text-slate-500 dark:text-zinc-400">rombel aktif</div>
			</div>
			<div class="px-3.5 py-2.5">
				<div class="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Murid</div>
				<div class="mt-0.5 text-lg font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{ringkasan?.totalMurid ?? 0}
				</div>
				<div class="text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
					{ringkasan?.totalLakiLaki ?? 0} L / {ringkasan?.totalPerempuan ?? 0} P
				</div>
			</div>
			<div class="px-3.5 py-2.5">
				<div class="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Guru</div>
				<div class="mt-0.5 text-lg font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{ringkasan?.totalGuru ?? 0}
				</div>
				<div class="text-[11px] text-slate-500 dark:text-zinc-400">pengampu unik</div>
			</div>
			<div class="px-3.5 py-2.5">
				<div class="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Mapel</div>
				<div class="mt-0.5 text-lg font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{ringkasan?.totalMapel ?? 0}
				</div>
				<div class="text-[11px] text-slate-500 dark:text-zinc-400">baris mapel x kelas</div>
			</div>
			<div class="px-3.5 py-2.5">
				<div class="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Sakit</div>
				<div class="mt-0.5 text-lg font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{ringkasan?.sakit ?? 0}
				</div>
				<div class="text-[11px] text-slate-500 dark:text-zinc-400">total catatan</div>
			</div>
			<div class="px-3.5 py-2.5">
				<div class="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Izin / Alfa</div>
				<div class="mt-0.5 text-lg font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{ringkasan?.izin ?? 0} / {ringkasan?.alfa ?? 0}
				</div>
				<div class="text-[11px] text-slate-500 dark:text-zinc-400">total catatan</div>
			</div>
		</div>
	</section>

	<section
		class="rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="border-b border-slate-200 p-4 sm:p-5 dark:border-zinc-800">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<div class="min-w-0">
					<label
						for="filter-semester"
						class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Semester
					</label>
					<div class="relative">
						<select
							id="filter-semester"
							class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							value={semesterTerpilih?.id ?? ''}
							onchange={(e) => {
								const val = (e.currentTarget as HTMLSelectElement).value;
								goto(val ? `/master-data/kelas?semester=${val}` : '/master-data/kelas', {
									invalidateAll: true
								});
							}}
						>
							<option value="">Pilih Semester</option>
							{#each semesterOptions as semester (semester.id)}
								<option value={semester.id}>{semester.nama} ({semester.tahunAjaran})</option>
							{/each}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
				</div>

				<div class="min-w-0">
					<label
						for="filter-fase"
						class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Fase
					</label>
					<div class="relative">
						<select
							id="filter-fase"
							class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							value={filterFase || 'semua'}
							onchange={(e) => gantiFilterFase((e.currentTarget as HTMLSelectElement).value)}
						>
							<option value="semua">Semua fase</option>
							{#each faseOptions as fase (fase)}
								<option value={fase}>{fase}</option>
							{/each}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
				</div>

				<div class="min-w-0 sm:col-span-2 lg:col-span-1">
					<label
						for="filter-cari"
						class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Cari Kelas / Guru
					</label>
					<div
						class="flex h-9 items-center gap-2 rounded-xl border border-[#7e8b9b] bg-white px-2.5 transition-colors focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
					>
						<span aria-hidden="true" class="shrink-0 text-slate-500 dark:text-zinc-400">
							<Icon name="search" class="h-3.5 w-3.5" />
						</span>
						<input
							id="filter-cari"
							type="search"
							placeholder="Nama kelas, wali kelas, atau guru..."
							class="min-w-0 flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
							bind:value={cariKelas}
						/>
					</div>
				</div>
			</div>
		</div>

		<div class="p-4 sm:p-5">
			{#if kelasTersaring.length === 0}
				<div
					class="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-zinc-700"
				>
					<p class="text-sm font-semibold text-slate-800 dark:text-zinc-200">
						Tidak ada kelas yang cocok
					</p>
					<p class="mt-1 text-xs text-slate-600 dark:text-zinc-400">
						{#if cariKelas || filterFase}
							Ubah filter fase atau kata kunci pencarian untuk menampilkan rombel.
						{:else}
							Belum ada kelas terdaftar pada semester ini.
						{/if}
					</p>
				</div>
			{:else}
				<div class="space-y-3 lg:hidden">
					{#each kelasTersaring as kelas (kelas.id)}
						{@const faseLabel = normFase(kelas.fase)}
						<div
							class="rounded-xl border border-slate-200/80 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-1.5">
										<a
											class="font-semibold text-blue-600 hover:underline dark:text-blue-400"
											href="/master-data/kelas/{kelas.id}"
										>
											{kelas.nama}
										</a>
										{#if faseLabel}
											<span
												class={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${faseBadgeClass(faseLabel)}`}
											>
												{faseLabel}
											</span>
										{/if}
									</div>
									<p class="mt-0.5 text-[11px] text-slate-600 dark:text-zinc-400">
										Wali: {kelas.waliKelas ?? 'Belum ditentukan'}
									</p>
								</div>
								{#if bisaKelola}
									<a
										class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-zinc-700 dark:text-zinc-300"
										href="/master-data/kelas/form/{kelas.id}"
										title="Edit kelas {kelas.nama}"
										aria-label="Edit kelas {kelas.nama}"
									>
										<Icon name="edit" class="h-3.5 w-3.5" />
									</a>
								{/if}
							</div>
							<div class="mt-2.5 grid grid-cols-3 gap-2 text-center">
								<div class="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-zinc-800/60">
									<p class="text-[10px] font-semibold text-slate-500 uppercase dark:text-zinc-400">
										Murid
									</p>
									<p class="text-sm font-bold text-slate-900 tabular-nums dark:text-zinc-100">
										{kelas.jumlahMurid}
									</p>
								</div>
								<div class="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-zinc-800/60">
									<p class="text-[10px] font-semibold text-slate-500 uppercase dark:text-zinc-400">
										Mapel
									</p>
									<p class="text-sm font-bold text-slate-900 tabular-nums dark:text-zinc-100">
										{kelas.jumlahMapel}
									</p>
								</div>
								<div class="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-zinc-800/60">
									<p class="text-[10px] font-semibold text-slate-500 uppercase dark:text-zinc-400">
										Nilai
									</p>
									<p
										class="text-sm font-bold tabular-nums {kelas.persenNilai < 50
											? 'text-amber-600 dark:text-amber-400'
											: 'text-slate-800 dark:text-zinc-200'}"
									>
										{kelas.persenNilai}%
									</p>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<div
					class="hidden overflow-x-auto rounded-xl border border-slate-200/80 lg:block dark:border-zinc-800"
				>
					<table class="w-full min-w-[760px] border-collapse text-left text-sm">
						<thead
							class="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
						>
							<tr>
								<th class="px-3.5 py-2.5">Kelas</th>
								<th class="px-3.5 py-2.5">Wali Kelas</th>
								<th class="px-3.5 py-2.5 text-right">Murid</th>
								<th class="px-3.5 py-2.5 text-right">Guru</th>
								<th class="px-3.5 py-2.5 text-right">Mapel</th>
								<th class="min-w-44 px-3.5 py-2.5">Kelengkapan Nilai</th>
								<th class="px-3.5 py-2.5 text-right">Rata-rata</th>
								<th class="px-3.5 py-2.5 text-right">Sakit / Izin / Alfa</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200/70 dark:divide-zinc-800">
							{#each kelasTersaring as kelas (kelas.id)}
								{@const status = statusNilai(kelas.persenNilai)}
								{@const faseLabel = normFase(kelas.fase)}
								<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
									<td class="px-3.5 py-3">
										<div class="flex flex-wrap items-center gap-1.5">
											<a
												class="font-semibold text-blue-600 hover:underline dark:text-blue-400"
												href="/master-data/kelas/{kelas.id}"
											>
												{kelas.nama}
											</a>
											{#if bisaKelola}
												<a
													class="inline-flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
													href="/master-data/kelas/form/{kelas.id}"
													title="Edit kelas {kelas.nama}"
													aria-label="Edit kelas {kelas.nama}"
												>
													<Icon name="edit" class="h-3.5 w-3.5" />
												</a>
											{/if}
											{#if faseLabel}
												<span
													class={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${faseBadgeClass(faseLabel)}`}
												>
													{faseLabel}
												</span>
											{/if}
										</div>
									</td>
									<td class="px-3.5 py-3">
										{#if kelas.waliKelas}
											<div class="text-xs font-medium text-slate-900 dark:text-zinc-100">
												{kelas.waliKelas}
											</div>
											{#if kelas.waliAsuh}
												<div class="text-[11px] text-slate-500 dark:text-zinc-400">
													Wali asuh: {kelas.waliAsuh}
												</div>
											{/if}
										{:else}
											<span class="text-xs text-slate-500 dark:text-zinc-400">Belum ditentukan</span
											>
										{/if}
									</td>
									<td class="px-3.5 py-3 text-right">
										<div
											class="text-xs font-semibold text-slate-900 tabular-nums dark:text-zinc-100"
										>
											{kelas.jumlahMurid}
										</div>
										<div
											class="text-[11px] whitespace-nowrap text-slate-500 tabular-nums dark:text-zinc-400"
										>
											{kelas.jumlahLakiLaki} L / {kelas.jumlahPerempuan} P
										</div>
									</td>
									<td class="px-3.5 py-3 text-right">
										<div
											class="text-xs font-semibold text-slate-900 tabular-nums dark:text-zinc-100"
										>
											{kelas.jumlahGuru}
										</div>
										{#if kelas.guru.length > 0}
											<div
												class="ml-auto max-w-44 truncate text-[11px] text-slate-500 dark:text-zinc-400"
												title={kelas.guru.join(', ')}
											>
												{kelas.guru.join(', ')}
											</div>
										{/if}
									</td>
									<td
										class="px-3.5 py-3 text-right text-xs font-medium text-slate-800 tabular-nums dark:text-zinc-200"
									>
										{kelas.jumlahMapel}
									</td>
									<td class="px-3.5 py-3">
										<div class="flex items-center gap-2">
											<div
												class="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700"
												role="progressbar"
												aria-label={`Kelengkapan nilai ${kelas.nama}`}
												aria-valuenow={kelas.persenNilai}
												aria-valuemin={0}
												aria-valuemax={100}
											>
												<div
													class="h-full rounded-full transition-all {kelas.persenNilai < 50
														? 'bg-amber-600 dark:bg-amber-500'
														: 'bg-blue-600 dark:bg-blue-500'}"
													style="width: {kelas.persenNilai}%"
												></div>
											</div>
											<span
												class="text-xs font-semibold text-slate-800 tabular-nums dark:text-zinc-200"
											>
												{kelas.persenNilai}%
											</span>
										</div>
										<div class="mt-1 flex flex-wrap items-center gap-1.5">
											<span class="text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
												{kelas.nilaiTerisi}/{kelas.nilaiDiharapkan} nilai
											</span>
											<span
												class="inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold {status.cls}"
											>
												{status.label}
											</span>
										</div>
									</td>
									<td class="px-3.5 py-3 text-right text-xs tabular-nums">
										{#if kelas.rataNilai != null}
											<span class="font-semibold text-slate-900 dark:text-zinc-100">
												{kelas.rataNilai}
											</span>
										{:else}
											<span class="text-slate-500 dark:text-zinc-400">-</span>
										{/if}
									</td>
									<td class="px-3.5 py-3 text-right">
										<div class="text-xs font-medium text-slate-800 tabular-nums dark:text-zinc-200">
											{kelas.sakit} / {kelas.izin} / {kelas.alfa}
										</div>
										<div class="text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
											{kelas.muridDenganPresensi} murid punya data
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</section>
</div>
