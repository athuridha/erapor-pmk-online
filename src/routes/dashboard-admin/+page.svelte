<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import MoveKelasModal from '$lib/components/murid/move-kelas-modal.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.page.q ?? '');
	let tab = $state<'modul' | 'rekap'>('modul');
	let modulSearch = $state('');
	let selectedIds = $state<number[]>([]);
	let moveModalOpen = $state(false);

	const modul = $derived(data.modul ?? []);
	const kelompok = $derived(data.kelompok ?? []);
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

	const modulTersaring = $derived.by(() => {
		const keyword = modulSearch.trim().toLowerCase();
		if (!keyword) return modul;
		return modul.filter(
			(item) =>
				item.judul.toLowerCase().includes(keyword) ||
				item.deskripsi.toLowerCase().includes(keyword) ||
				item.tags.some((tag) => tag.includes(keyword))
		);
	});

	const modulPerKelompok = $derived(
		kelompok
			.map((nama) => ({ nama, items: modulTersaring.filter((item) => item.kelompok === nama) }))
			.filter((grup) => grup.items.length > 0)
	);

	const muridTerpilih = $derived(
		baris
			.filter((row) => selectedIds.includes(row.muridId))
			.map((row) => ({
				id: row.muridId,
				nama: row.nama,
				nis: row.nis
			}))
	);

	function buildUrl(params: Record<string, string | number | null>) {
		const search = new URLSearchParams(page.url.search);
		for (const [key, value] of Object.entries(params)) {
			if (value == null || value === '') search.delete(key);
			else search.set(key, String(value));
		}
		search.delete('page');
		const query = search.toString();
		return `${page.url.pathname}${query ? `?${query}` : ''}`;
	}

	async function setFilter(key: string, value: string | null) {
		await goto(buildUrl({ [key]: value }), { keepFocus: true });
	}

	async function applySearch(value: string) {
		const target = buildUrl({ q: value || null });
		if (target === `${page.url.pathname}${page.url.search}`) return;
		await goto(target, { keepFocus: true });
	}

	async function gotoPage(pageNumber: number) {
		const search = new URLSearchParams(page.url.search);
		search.set('page', String(pageNumber));
		await goto(`${page.url.pathname}?${search.toString()}`, { keepFocus: true });
	}

	function toggleSemua(checked: boolean) {
		selectedIds = checked ? baris.map((row) => row.muridId) : [];
	}

	function toggleSatu(id: number, checked: boolean) {
		selectedIds = checked
			? [...new Set([...selectedIds, id])]
			: selectedIds.filter((value) => value !== id);
	}

	function formatScore(value: number | null | undefined) {
		if (value == null) return '—';
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
				return 'bg-base-200 text-base-content/60 dark:bg-base-300';
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
		`/api/dashboard-admin/export${page.url.search ? page.url.search : ''}`
	);
</script>

<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<h2 class="text-xl font-bold">Dashboard Admin</h2>
		<p class="text-base-content/80 block text-sm">
			Pusat pengelolaan seluruh data sekolah: murid, kelas, mapel, guru, nilai, hingga administrasi.
		</p>
	</div>
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		<a class="btn btn-outline shadow-none max-sm:w-full" href={exportUrl}>
			<Icon name="download" />
			Unduh Excel
		</a>
	</div>
</div>

<div class="stats dark:bg-base-200 shadow-md">
	<div class="stat">
		<div class="stat-title">Murid</div>
		<div class="stat-value text-lg">{statistik?.totalMurid ?? 0}</div>
		<div class="stat-desc">{statistik?.muridSudahNilai ?? 0} punya nilai</div>
	</div>
	<div class="stat">
		<div class="stat-title">Kelas</div>
		<div class="stat-value text-lg">{statistik?.totalKelas ?? 0}</div>
		<div class="stat-desc text-wrap">{statistik?.totalSemester ?? 0} semester tercatat</div>
	</div>
	<div class="stat">
		<div class="stat-title">Mata Pelajaran</div>
		<div class="stat-value text-lg">{statistik?.totalMapel ?? 0}</div>
		<div class="stat-desc text-wrap">{statistik?.totalGuru ?? 0} guru pengampu</div>
	</div>
	<div class="stat">
		<div class="stat-title">Nilai Terinput</div>
		<div class="stat-value text-lg">{statistik?.jumlahNilai ?? 0}</div>
		<div class="stat-desc">{statistik?.muridBelumNilai ?? 0} murid belum ada nilai</div>
	</div>
	<div class="stat">
		<div class="stat-title">Rata-rata Sekolah</div>
		<div class="stat-value text-lg">{formatScore(statistik?.rataRataKeseluruhan)}</div>
		<div class="stat-desc text-wrap">Semua mapel & semester</div>
	</div>
</div>

<div role="tablist" class="tabs tabs-box mt-6 w-fit">
	<button role="tab" class="tab" class:tab-active={tab === 'modul'} onclick={() => (tab = 'modul')}>
		<Icon name="grid" />
		Modul Data
	</button>
	<button role="tab" class="tab" class:tab-active={tab === 'rekap'} onclick={() => (tab = 'rekap')}>
		<Icon name="chart" />
		Rekap Nilai
	</button>
</div>

{#if tab === 'modul'}
	<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<h3 class="text-lg font-bold">Kelola Data ({modulTersaring.length} modul)</h3>
		<label class="input input-bordered flex w-full max-w-xs items-center gap-2">
			<Icon name="search" />
			<input
				type="search"
				bind:value={modulSearch}
				spellcheck="false"
				placeholder="Cari modul..."
				autocomplete="off"
			/>
		</label>
	</div>

	{#each modulPerKelompok as grup (grup.nama)}
		<div class="mt-6">
			<h4 class="text-base-content/70 mb-2 text-sm font-semibold uppercase">{grup.nama}</h4>
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each grup.items as item (item.key)}
					<div class="card bg-base-100 dark:bg-base-200 rounded-lg border border-none shadow-md">
						<div class="card-body p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="flex items-center gap-2">
									<span
										class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg"
									>
										<Icon name={item.ikon} />
									</span>
									<h5 class="card-title text-base">{item.judul}</h5>
								</div>
								{#if item.jumlah != null}
									<span class="badge badge-soft badge-primary">{item.jumlah}</span>
								{/if}
							</div>
							<p class="text-base-content/70 text-xs">{item.deskripsi}</p>
							<div class="card-actions mt-2 justify-end">
								{#if item.tambah}
									<a class="btn btn-soft btn-primary btn-sm shadow-none" href={item.tambah}>
										<Icon name="plus" />
										Tambah
									</a>
								{/if}
								<a class="btn btn-soft btn-sm shadow-none" href={item.kelola}>
									<Icon name="edit" />
									Kelola
								</a>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<p class="text-base-content/60 mt-4 text-sm">Tidak ada modul yang cocok.</p>
	{/each}
{:else}
	<div class="mt-4 grid gap-3 md:grid-cols-4">
		<label class="form-control">
			<span class="label-text mb-1 text-sm">Kelas</span>
			<select
				class="select select-bordered w-full"
				value={filter.kelasId ?? ''}
				onchange={(event) =>
					setFilter('kelas_id', (event.currentTarget as HTMLSelectElement).value || null)}
			>
				<option value="">Semua Kelas</option>
				{#each daftarKelas as kelas (kelas.id)}
					<option value={kelas.id}>{kelas.nama} — {kelas.semesterLabel}</option>
				{/each}
			</select>
		</label>

		<label class="form-control">
			<span class="label-text mb-1 text-sm">Mata Pelajaran</span>
			<select
				class="select select-bordered w-full"
				value={filter.mapel ?? ''}
				onchange={(event) =>
					setFilter('mapel', (event.currentTarget as HTMLSelectElement).value || null)}
			>
				<option value="">Semua Mata Pelajaran</option>
				{#each daftarMapel as mapel (mapel.nama)}
					<option value={mapel.nama}>{mapel.nama}</option>
				{/each}
			</select>
		</label>

		<label class="form-control">
			<span class="label-text mb-1 text-sm">Guru Pengampu</span>
			<select
				class="select select-bordered w-full"
				value={filter.pengampuId ?? ''}
				onchange={(event) =>
					setFilter('pengampu_id', (event.currentTarget as HTMLSelectElement).value || null)}
			>
				<option value="">Semua Guru</option>
				{#each daftarGuru as guru (guru.id)}
					<option value={guru.id}>{guru.nama}</option>
				{/each}
			</select>
		</label>

		<label class="form-control">
			<span class="label-text mb-1 text-sm">Cari Murid</span>
			<label class="input input-bordered flex w-full items-center gap-2">
				<Icon name="search" />
				<input
					type="search"
					bind:value={searchTerm}
					spellcheck="false"
					placeholder="Nama / NIS..."
					autocomplete="off"
					onchange={(event) => applySearch((event.currentTarget as HTMLInputElement).value)}
				/>
			</label>
		</label>
	</div>

	<div class="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<h3 class="text-lg font-bold">Rekap Nilai Murid</h3>
		{#if selectedIds.length}
			<button
				type="button"
				class="btn btn-soft btn-primary shadow-none"
				onclick={() => (moveModalOpen = true)}
			>
				<Icon name="move" />
				Pindahkan {selectedIds.length} Murid
			</button>
		{/if}
	</div>

	{#if !semester.length}
		<div class="alert alert-warning alert-soft mt-3 flex items-center gap-3">
			<Icon name="warning" />
			<span
				>Belum ada data nilai. Data muncul setelah semester berjalan dan nilai akhir terinput.</span
			>
		</div>
	{:else}
		<div
			class="bg-base-100 dark:bg-base-200 mt-3 overflow-x-auto rounded-md shadow-md dark:shadow-none"
		>
			<table class="border-base-200 table border dark:border-none">
				<thead>
					<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
						<th class="w-10 text-center">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={selectedIds.length > 0 && selectedIds.length === baris.length}
								onchange={(event) => toggleSemua((event.currentTarget as HTMLInputElement).checked)}
							/>
						</th>
						<th style="min-width: 200px;">Nama Murid</th>
						{#each semester as sem (sem.semesterId)}
							<th class="text-center" style="min-width: 130px;">
								{sem.label}
								<span class="block text-xs font-normal opacity-70">{selKelas(sem.semesterId)}</span>
							</th>
						{/each}
						<th class="text-center" style="min-width: 130px;">Rata-rata Kumulatif</th>
						<th class="text-center" style="min-width: 90px;">Peringkat</th>
					</tr>
				</thead>
				<tbody>
					{#each baris as row (row.key)}
						<tr class={selectedIds.includes(row.muridId) ? 'bg-primary/5' : ''}>
							<td class="text-center">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={selectedIds.includes(row.muridId)}
									onchange={(event) =>
										toggleSatu(row.muridId, (event.currentTarget as HTMLInputElement).checked)}
								/>
							</td>
							<td>
								<div class="font-medium">{row.nama}</div>
								<div class="text-xs opacity-60">
									{row.kelasSekarang ?? '-'} · NIS {row.nis || '-'}
								</div>
							</td>
							{#each row.perSemester as sel (sel.semesterId)}
								<td class="text-center">
									<span
										class={`badge badge-sm ${badgeClass(sel.kriteria)}`}
										title={sel.kelasNama ? `Kelas: ${sel.kelasNama}` : 'Tidak ada data kelas'}
									>
										{formatScore(sel.nilai)}
									</span>
									<span class="block text-xs opacity-60">{sel.dinilai}/{sel.total} mapel</span>
								</td>
							{/each}
							<td class="text-center">
								<span class={`badge badge-sm ${badgeClass(row.kriteriaKumulatif)}`}>
									{formatScore(row.rataKumulatif)}
								</span>
							</td>
							<td class="text-center font-semibold">{row.peringkat}</td>
						</tr>
					{:else}
						<tr>
							<td colspan={semester.length + 5} class="py-6 text-center opacity-70">
								Tidak ada murid yang cocok.
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="bg-base-200 dark:bg-base-300 font-semibold">
						<td></td>
						<td>Rata-rata Kelas</td>
						{#each ringkasan as item (item.semesterId)}
							<td class="text-center">
								{formatScore(item.nilai)}
								<span class="block text-xs font-normal opacity-70">{item.dinilai} nilai</span>
							</td>
						{/each}
						<td colspan="2"></td>
					</tr>
				</tfoot>
			</table>
		</div>

		<div class="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
			<p class="text-base-content/60 text-xs">
				Menampilkan {Math.min(perPage, Math.max(0, totalItems - (currentPage - 1) * perPage))} dari
				{totalItems} murid
			</p>
			<div class="join">
				<button
					type="button"
					class="btn btn-sm join-item"
					disabled={currentPage <= 1}
					onclick={() => gotoPage(currentPage - 1)}
				>
					«
				</button>
				<button type="button" class="btn btn-sm join-item pointer-events-none">
					{currentPage} / {totalPages}
				</button>
				<button
					type="button"
					class="btn btn-sm join-item"
					disabled={currentPage >= totalPages}
					onclick={() => gotoPage(currentPage + 1)}
				>
					»
				</button>
			</div>
		</div>
	{/if}

	<div class="mt-8 grid gap-4 lg:grid-cols-2">
		<div class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none">
			<h3 class="px-4 pt-4 text-lg font-bold">Rekap per Mata Pelajaran</h3>
			<table class="border-base-200 table-sm table border dark:border-none">
				<thead>
					<tr class="bg-base-200 dark:bg-base-300 text-left font-bold">
						<th>Mata Pelajaran</th>
						<th>Guru</th>
						<th class="text-center">Kelas</th>
						<th class="text-center">Nilai</th>
						<th class="text-center">Rata-rata</th>
					</tr>
				</thead>
				<tbody>
					{#each rekapMapel as item (item.nama)}
						<tr>
							<td>{item.nama}</td>
							<td class="text-xs opacity-70">{item.guru.join(', ') || '-'}</td>
							<td class="text-center">{item.kelas}</td>
							<td class="text-center">{item.jumlahNilai}</td>
							<td class="text-center font-semibold">{formatScore(item.rataRata)}</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="py-4 text-center opacity-70">Belum ada nilai.</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none">
			<h3 class="px-4 pt-4 text-lg font-bold">Rekap per Guru</h3>
			<table class="border-base-200 table-sm table border dark:border-none">
				<thead>
					<tr class="bg-base-200 dark:bg-base-300 text-left font-bold">
						<th>Guru Pengampu</th>
						<th>Mata Pelajaran</th>
						<th class="text-center">Murid</th>
						<th class="text-center">Nilai</th>
						<th class="text-center">Rata-rata</th>
					</tr>
				</thead>
				<tbody>
					{#each rekapGuru as item (item.id)}
						<tr>
							<td>{item.nama}</td>
							<td class="text-xs opacity-70">{item.mapel.join(', ')}</td>
							<td class="text-center">{item.jumlahMurid}</td>
							<td class="text-center">{item.jumlahNilai}</td>
							<td class="text-center font-semibold">{formatScore(item.rataRata)}</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="py-4 text-center opacity-70">Belum ada nilai.</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

<MoveKelasModal
	bind:isOpen={moveModalOpen}
	murid={muridTerpilih}
	kelasList={daftarKelas}
	onSuccess={() => (selectedIds = [])}
/>
