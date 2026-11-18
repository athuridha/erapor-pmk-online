<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import PindahMuridModal from '$lib/components/murid/pindah-murid-modal.svelte';
	import { buildPageNumbers, OPSI_BARIS_PER_HALAMAN } from '$lib/utils/pagination';
	import { selectAll, semuaTerpilih, toggleId } from '$lib/utils/bulk-select';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.page.q ?? '');
	let selectedIds = $state<number[]>([]);
	let moveModalOpen = $state(false);

	const rekap = $derived(data.rekap);
	const statistik = $derived(data.statistik);
	const semester = $derived(rekap?.semester ?? []);
	const baris = $derived(rekap?.baris ?? []);
	const ringkasan = $derived(rekap?.ringkasan ?? []);
	const daftarKelas = $derived(data.daftarKelas ?? []);
	const daftarMapel = $derived(rekap?.daftarMapel ?? []);
	const daftarGuru = $derived(rekap?.daftarGuru ?? []);
	const filter = $derived(data.filter ?? { kelasId: null, mapel: null, pengampuId: null });
	const rekapMapel = $derived(rekap?.rekapMapel ?? []);
	const rekapGuru = $derived(rekap?.rekapGuru ?? []);

	const currentPage = $derived(data.page.currentPage ?? 1);
	const totalPages = $derived(Math.max(1, data.page.totalPages ?? 1));
	const totalItems = $derived(data.page.totalItems ?? 0);
	const perPage = $derived(data.page.perPage ?? 50);
	const nomorHalaman = $derived(buildPageNumbers(currentPage, totalPages));

	const muridTerpilih = $derived(
		baris
			.filter((row) => selectedIds.includes(row.muridId))
			.map((row) => ({
				id: row.muridId,
				nama: row.nama,
				nis: row.nis
			}))
	);
	const idsHalaman = $derived(baris.map((row) => row.muridId));

	async function setFilter(key: string, value: string | null) {
		const search = new URLSearchParams(page.url.search);
		if (value) search.set(key, value);
		else search.delete(key);
		search.delete('page');
		const query = search.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, { keepFocus: true });
	}

	async function applySearch(value: string) {
		const search = new URLSearchParams(page.url.search);
		if (value.trim()) search.set('q', value.trim());
		else search.delete('q');
		search.delete('page');
		const query = search.toString();
		const target = `${page.url.pathname}${query ? `?${query}` : ''}`;
		if (target === `${page.url.pathname}${page.url.search}`) return;
		await goto(target, { keepFocus: true });
	}

	async function gotoPage(pageNumber: number) {
		const search = new URLSearchParams(page.url.search);
		search.set('page', String(pageNumber));
		await goto(`${page.url.pathname}?${search.toString()}`, { keepFocus: true });
	}

	async function gotoPerHalaman(jumlah: number) {
		const search = new URLSearchParams(page.url.search);
		search.set('per_page', String(jumlah));
		search.delete('page');
		await goto(`${page.url.pathname}?${search.toString()}`, { keepFocus: true });
	}

	function formatScore(value: number | null | undefined) {
		if (value == null) return '-';
		return value.toLocaleString('id-ID', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	function badgeClass(kriteria: string | null) {
		switch (kriteria) {
			case 'Sangat Baik':
				return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
			case 'Baik':
				return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
			case 'Cukup':
				return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
			case 'Perlu Bimbingan':
				return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
			default:
				return 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400';
		}
	}

	function selKelas(semesterId: number) {
		const kelas = baris
			.map((row) => row.perSemester.find((sel) => sel.semesterId === semesterId)?.kelasNama)
			.filter((value): value is string => Boolean(value));
		if (!kelas.length) return '-';
		const unik = [...new Set(kelas)];
		return unik.length === 1 ? unik[0] : `${unik.length} kelas`;
	}

	const exportUrl = $derived(
		`/api/nilai-akhir/rekap-keseluruhan/export${page.url.search ? page.url.search : ''}`
	);
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Rekap Nilai Keseluruhan
			</h1>
			<p class="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">
				Nilai murid dari semester pertama hingga semester terakhir, lengkap dengan filter kelas,
				mapel, dan guru.
			</p>
		</div>
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
			{#if selectedIds.length}
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
					onclick={() => (moveModalOpen = true)}
				>
					<Icon name="move" class="h-4 w-4" />
					Pindahkan {selectedIds.length} Murid
				</button>
			{/if}
			<a
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 max-sm:w-full dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				href={exportUrl}
			>
				<Icon name="download" class="h-4 w-4" />
				Unduh Excel
			</a>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
		<div
			class="rounded-xl border border-slate-200/70 bg-slate-50/75 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Murid</div>
			<div class="mt-0.5 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{statistik?.totalMurid ?? 0}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
				{statistik?.muridSudahNilai ?? 0} punya nilai
			</div>
		</div>
		<div
			class="rounded-xl border border-slate-200/70 bg-slate-50/75 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Kelas</div>
			<div class="mt-0.5 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{statistik?.totalKelas ?? 0}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
				{statistik?.totalSemester ?? 0} semester tercatat
			</div>
		</div>
		<div
			class="rounded-xl border border-slate-200/70 bg-slate-50/75 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Mata Pelajaran</div>
			<div class="mt-0.5 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{statistik?.totalMapel ?? 0}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
				{statistik?.totalGuru ?? 0} guru pengampu
			</div>
		</div>
		<div
			class="rounded-xl border border-slate-200/70 bg-slate-50/75 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Nilai Terinput</div>
			<div class="mt-0.5 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{statistik?.jumlahNilai ?? 0}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
				{statistik?.muridBelumNilai ?? 0} murid belum ada nilai
			</div>
		</div>
		<div
			class="col-span-2 rounded-xl border border-slate-200/70 bg-slate-50/75 px-3.5 py-2.5 sm:col-span-1 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Rata-rata Sekolah</div>
			<div class="mt-0.5 text-xl font-bold text-blue-700 tabular-nums dark:text-blue-400">
				{formatScore(statistik?.rataRataKeseluruhan)}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
				Semua mapel &amp; semester
			</div>
		</div>
	</div>

	<div class="mt-4 grid gap-3 md:grid-cols-4">
		<label class="block">
			<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">Kelas</span>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					value={filter.kelasId ?? ''}
					onchange={(event) =>
						setFilter('kelas_id', (event.currentTarget as HTMLSelectElement).value || null)}
				>
					<option value="">Semua Kelas</option>
					{#each daftarKelas as kelas (kelas.id)}
						<option value={kelas.id}>{kelas.nama} - {kelas.semesterLabel}</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</label>

		<label class="block">
			<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
				Mata Pelajaran
			</span>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					value={filter.mapel ?? ''}
					onchange={(event) =>
						setFilter('mapel', (event.currentTarget as HTMLSelectElement).value || null)}
				>
					<option value="">Semua Mata Pelajaran</option>
					{#each daftarMapel as mapel (mapel.nama)}
						<option value={mapel.nama}>{mapel.nama}</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</label>

		<label class="block">
			<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
				Guru Pengampu
			</span>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					value={filter.pengampuId ?? ''}
					onchange={(event) =>
						setFilter('pengampu_id', (event.currentTarget as HTMLSelectElement).value || null)}
				>
					<option value="">Semua Guru</option>
					{#each daftarGuru as guru (guru.id)}
						<option value={guru.id}>{guru.nama}</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</label>

		<label class="block">
			<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
				Cari Murid
			</span>
			<div class="relative">
				<span
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
				>
					<Icon name="search" class="h-4 w-4" />
				</span>
				<input
					type="search"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
					bind:value={searchTerm}
					spellcheck="false"
					placeholder="Nama / NIS..."
					autocomplete="off"
					onchange={(event) => applySearch((event.currentTarget as HTMLInputElement).value)}
				/>
			</div>
		</label>
	</div>

	<div class="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Rekap Nilai Murid</h2>
	</div>

	{#if !semester.length}
		<div
			class="mt-3 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="warning" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>
				Belum ada data nilai. Data muncul setelah semester berjalan dan nilai akhir terinput.
			</span>
		</div>
	{:else}
		<div
			class="mt-3 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th class="w-10 px-3 py-2.5 text-center">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={semuaTerpilih(idsHalaman, selectedIds)}
								onchange={(event) =>
									(selectedIds = selectAll(
										idsHalaman,
										(event.currentTarget as HTMLInputElement).checked
									))}
							/>
						</th>
						<th style="min-width: 200px;" class="px-3 py-2.5">Nama Murid</th>
						{#each semester as sem (sem.semesterId)}
							<th class="px-3 py-2.5 text-center" style="min-width: 130px;">
								{sem.label}
								<span class="block text-[11px] font-normal text-slate-500 dark:text-zinc-400">
									{selKelas(sem.semesterId)}
								</span>
							</th>
						{/each}
						<th class="px-3 py-2.5 text-center" style="min-width: 130px;">Rata-rata Kumulatif</th>
						<th class="px-3 py-2.5 text-center" style="min-width: 90px;">Peringkat</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
					{#each baris as row (row.key)}
						<tr
							class={selectedIds.includes(row.muridId)
								? 'bg-blue-50/60 dark:bg-blue-950/30'
								: 'transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40'}
						>
							<td class="px-3 py-2.5 text-center">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={selectedIds.includes(row.muridId)}
									onchange={(event) =>
										(selectedIds = toggleId(
											selectedIds,
											row.muridId,
											(event.currentTarget as HTMLInputElement).checked
										))}
								/>
							</td>
							<td class="px-3 py-2.5">
								<div class="font-medium text-slate-900 dark:text-zinc-100">{row.nama}</div>
								<div class="text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
									{row.kelasSekarang ?? '-'} · NIS {row.nis || '-'}
								</div>
							</td>
							{#each row.perSemester as sel (sel.semesterId)}
								<td class="px-3 py-2.5 text-center">
									<span
										class={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${badgeClass(sel.kriteria)}`}
										title={sel.kelasNama ? `Kelas: ${sel.kelasNama}` : 'Tidak ada data kelas'}
									>
										{formatScore(sel.nilai)}
									</span>
									<span
										class="mt-0.5 block text-[11px] text-slate-500 tabular-nums dark:text-zinc-400"
									>
										{sel.dinilai}/{sel.total} mapel
									</span>
								</td>
							{/each}
							<td class="px-3 py-2.5 text-center">
								<span
									class={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${badgeClass(row.kriteriaKumulatif)}`}
								>
									{formatScore(row.rataKumulatif)}
								</span>
							</td>
							<td class="px-3 py-2.5 text-center font-semibold tabular-nums">{row.peringkat}</td>
						</tr>
					{:else}
						<tr>
							<td
								colspan={semester.length + 5}
								class="p-8 text-center text-xs italic text-slate-500 dark:text-zinc-400"
							>
								Tidak ada murid yang cocok.
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr
						class="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200"
					>
						<td class="px-3 py-2.5"></td>
						<td class="px-3 py-2.5">Rata-rata Kelas</td>
						{#each ringkasan as item (item.semesterId)}
							<td class="px-3 py-2.5 text-center tabular-nums">
								{formatScore(item.nilai)}
								<span class="block text-[11px] font-normal text-slate-500 dark:text-zinc-400">
									{item.dinilai} nilai
								</span>
							</td>
						{/each}
						<td colspan="2" class="px-3 py-2.5"></td>
					</tr>
				</tfoot>
			</table>
		</div>

		<div class="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
			<p class="text-xs text-slate-500 tabular-nums dark:text-zinc-400">
				Menampilkan {Math.min(perPage, Math.max(0, totalItems - (currentPage - 1) * perPage))} dari
				{totalItems} murid
			</p>
			<div class="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
				<label class="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
					<span>Baris per halaman</span>
					<div class="relative flex items-center">
						<select
							class="h-8 appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							value={perPage}
							onchange={(event) =>
								gotoPerHalaman(Number((event.currentTarget as HTMLSelectElement).value))}
						>
							{#each OPSI_BARIS_PER_HALAMAN as jumlah (jumlah)}
								<option value={jumlah}>{jumlah}</option>
							{/each}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3 w-3" />
						</span>
					</div>
				</label>
				<div class="flex flex-wrap items-center gap-1">
					<button
						type="button"
						class="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
						disabled={currentPage <= 1}
						onclick={() => gotoPage(currentPage - 1)}
					>
						&laquo;
					</button>
					{#each nomorHalaman as nomor, index (index)}
						{#if nomor === '…'}
							<span class="inline-flex h-8 items-center px-1.5 text-xs text-slate-400">...</span>
						{:else}
							<button
								type="button"
								class="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border px-2.5 text-xs font-semibold tabular-nums transition-colors {nomor ===
								currentPage
									? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
									: 'border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
								onclick={() => gotoPage(nomor)}
							>
								{nomor}
							</button>
						{/if}
					{/each}
					<button
						type="button"
						class="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
						disabled={currentPage >= totalPages}
						onclick={() => gotoPage(currentPage + 1)}
					>
						&raquo;
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<div class="mt-5 grid gap-5 lg:grid-cols-2">
	<div
		class="overflow-x-auto rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<h2
			class="border-b border-slate-100 px-4 py-3.5 text-sm font-bold text-slate-900 dark:border-zinc-800 dark:text-zinc-100"
		>
			Rekap per Mata Pelajaran
		</h2>
		<table class="w-full border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th class="px-3 py-2.5">Mata Pelajaran</th>
					<th class="px-3 py-2.5">Guru</th>
					<th class="px-3 py-2.5 text-center">Kelas</th>
					<th class="px-3 py-2.5 text-center">Nilai</th>
					<th class="px-3 py-2.5 text-center">Rata-rata</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
				{#each rekapMapel as item (item.nama)}
					<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
						<td class="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100">{item.nama}</td>
						<td class="px-3 py-2 text-[11px] text-slate-500 dark:text-zinc-400">
							{item.guru.join(', ') || '-'}
						</td>
						<td class="px-3 py-2 text-center tabular-nums">{item.kelas}</td>
						<td class="px-3 py-2 text-center tabular-nums">{item.jumlahNilai}</td>
						<td class="px-3 py-2 text-center font-semibold tabular-nums">
							{formatScore(item.rataRata)}
						</td>
					</tr>
				{:else}
					<tr>
						<td
							colspan="5"
							class="p-6 text-center text-xs italic text-slate-500 dark:text-zinc-400"
						>
							Belum ada nilai.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div
		class="overflow-x-auto rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<h2
			class="border-b border-slate-100 px-4 py-3.5 text-sm font-bold text-slate-900 dark:border-zinc-800 dark:text-zinc-100"
		>
			Rekap per Guru
		</h2>
		<table class="w-full border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th class="px-3 py-2.5">Guru Pengampu</th>
					<th class="px-3 py-2.5">Mata Pelajaran</th>
					<th class="px-3 py-2.5 text-center">Murid</th>
					<th class="px-3 py-2.5 text-center">Nilai</th>
					<th class="px-3 py-2.5 text-center">Rata-rata</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
				{#each rekapGuru as item (item.id)}
					<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
						<td class="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100">{item.nama}</td>
						<td class="px-3 py-2 text-[11px] text-slate-500 dark:text-zinc-400">
							{item.mapel.join(', ')}
						</td>
						<td class="px-3 py-2 text-center tabular-nums">{item.jumlahMurid}</td>
						<td class="px-3 py-2 text-center tabular-nums">{item.jumlahNilai}</td>
						<td class="px-3 py-2 text-center font-semibold tabular-nums">
							{formatScore(item.rataRata)}
						</td>
					</tr>
				{:else}
					<tr>
						<td
							colspan="5"
							class="p-6 text-center text-xs italic text-slate-500 dark:text-zinc-400"
						>
							Belum ada nilai.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<PindahMuridModal
	bind:isOpen={moveModalOpen}
	{muridTerpilih}
	kelasTujuan={daftarKelas.map((kelas) => ({
		id: kelas.id,
		nama: kelas.nama,
		fase: kelas.fase,
		semesterNama: kelas.semesterLabel
	}))}
	action="?/pindahMurid"
	onSuccess={() => {
		selectedIds = [];
		void invalidate('app:rekap-keseluruhan');
	}}
/>
