<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	type PenugasanGroup = {
		mapelNama: string;
		kelasNames: string[];
		jenis: string | null;
	};

	type GuruRekapItem = {
		id: number;
		nama: string;
		nip: string | null;
		nik: string | null;
		hasAkun: boolean;
		username: string | null;
		penugasanList?: PenugasanGroup[];
		mapelList: string[];
		kelasList: string[];
		totalTugas: number;
	};

	// Mode tampilan: 'guru' (berdasarkan guru) atau 'mapel' (berdasarkan mata pelajaran & kelas)
	let activeTab = $state<'guru' | 'mapel'>('guru');
	let searchQuery = $state('');

	// Data dari server
	const daftarKelas = $derived(data.daftarKelas ?? []);
	const daftarGuru = $derived(data.daftarGuru ?? []);
	const distinctMapels = $derived(data.distinctMapels ?? []);
	const guruRekap = $derived((data.guruRekap ?? []) as unknown as GuruRekapItem[]);
	const allMapelRows = $derived(data.allMapelRows ?? []);
	const mapelRows = $derived(data.mapelRows ?? []);
	const selectedKelasId = $derived(data.selectedKelasId ?? 'semua');

	const totalMapel = $derived(data.totalMapel ?? 0);
	const totalTerisi = $derived(data.totalTerisi ?? 0);
	const totalKosong = $derived(totalMapel - totalTerisi);

	// Filter untuk tabel guru
	const filteredGurus = $derived(
		guruRekap.filter((g) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase().trim();
			return (
				g.nama.toLowerCase().includes(q) ||
				(g.nip ?? '').toLowerCase().includes(q) ||
				(g.nik ?? '').toLowerCase().includes(q) ||
				g.mapelList.some((m) => m.toLowerCase().includes(q)) ||
				g.kelasList.some((k) => k.toLowerCase().includes(q))
			);
		})
	);

	// Filter untuk tabel mapel
	const filteredMapels = $derived(
		mapelRows.filter((m) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase().trim();
			return (
				m.nama.toLowerCase().includes(q) ||
				(m.kode ?? '').toLowerCase().includes(q) ||
				(m.kelasNama ?? '').toLowerCase().includes(q) ||
				(m.pengampuNama ?? '').toLowerCase().includes(q)
			);
		})
	);

	// Bulk selection pada tabel mapel
	let selectedMapelIds = $state<number[]>([]);
	let bulkGuruId = $state<number | null>(null);

	const allVisibleMapelIds = $derived(filteredMapels.map((m) => m.id));
	const isAllVisibleSelected = $derived(
		allVisibleMapelIds.length > 0 && allVisibleMapelIds.every((id) => selectedMapelIds.includes(id))
	);

	function toggleSelectAllMapel() {
		if (isAllVisibleSelected) {
			selectedMapelIds = selectedMapelIds.filter((id) => !allVisibleMapelIds.includes(id));
		} else {
			const set = new Set([...selectedMapelIds, ...allVisibleMapelIds]);
			selectedMapelIds = Array.from(set);
		}
	}

	function toggleMapelId(id: number) {
		if (selectedMapelIds.includes(id)) {
			selectedMapelIds = selectedMapelIds.filter((item) => item !== id);
		} else {
			selectedMapelIds = [...selectedMapelIds, id];
		}
	}

	function clearSelectedMapels() {
		selectedMapelIds = [];
		bulkGuruId = null;
	}

	// ================= STATE MODAL SALIN PENUGASAN =================
	let modalSalinTerbuka = $state(false);
	let salinSumberId = $state<number | null>(null);
	let salinTargetId = $state<number | null>(null);
	let salinKelasIds = $state<number[]>([]);
	let salinTimpa = $state(false);

	const salinSumber = $derived(daftarGuru.find((g) => g.id === salinSumberId) ?? null);
	const salinTarget = $derived(guruRekap.find((g) => g.id === salinTargetId) ?? null);
	const salinSumberTugas = $derived(
		salinSumberId ? allMapelRows.filter((m) => m.pengampuId === salinSumberId).length : 0
	);
	const salinSumberMapel = $derived([
		...new Set(
			salinSumberId
				? allMapelRows.filter((m) => m.pengampuId === salinSumberId).map((m) => m.nama)
				: []
		)
	]);
	const salinSemuaKelas = $derived(
		daftarKelas.length > 0 && salinKelasIds.length === daftarKelas.length
	);

	function bukaModalSalin(sumberId?: number | null) {
		salinSumberId = sumberId ?? null;
		salinTargetId = null;
		salinKelasIds = daftarKelas.map((kelas) => kelas.id);
		salinTimpa = false;
		modalSalinTerbuka = true;
	}

	function tutupModalSalin() {
		modalSalinTerbuka = false;
	}

	function togolSemuaKelasSalin() {
		salinKelasIds = salinSemuaKelas ? [] : daftarKelas.map((kelas) => kelas.id);
	}

	function toggleKelasSalin(kelasId: number) {
		salinKelasIds = salinKelasIds.includes(kelasId)
			? salinKelasIds.filter((id) => id !== kelasId)
			: [...salinKelasIds, kelasId];
	}

	async function handleSalinSuccess({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:master-data-pengampu');
		modalSalinTerbuka = false;
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Penugasan berhasil disalin.',
			type: 'success',
			persist: true
		});
	}

	// ================= STATE MODAL ATUR TUGAS GURU =================
	let modalSetupTerbuka = $state(false);
	let modalGuruId = $state<number | null>(null);
	let modalSelectedMapelIds = $state<Set<number>>(new Set());
	let addedMapelNames = $state<string[]>([]);

	const modalGuru = $derived(daftarGuru.find((g) => g.id === modalGuruId) ?? null);

	const modalActiveMapelNames = $derived.by(() => {
		const names = new Set<string>();
		for (const id of modalSelectedMapelIds) {
			const m = allMapelRows.find((row) => row.id === id);
			if (m?.nama) names.add(m.nama);
		}
		for (const n of addedMapelNames) {
			names.add(n);
		}
		return Array.from(names);
	});

	function loadGuruToModal(guruId: number, targetMapelNama?: string) {
		modalGuruId = guruId;
		const currentAssigned = allMapelRows.filter((m) => m.pengampuId === guruId).map((m) => m.id);
		modalSelectedMapelIds = new Set(currentAssigned);
		addedMapelNames = [];
		if (targetMapelNama) {
			addedMapelNames = [targetMapelNama];
		}
	}

	function bukaModalSetup(guruId?: number, mapelNama?: string) {
		const targetGuruId = guruId ?? (daftarGuru.length > 0 ? daftarGuru[0].id : null);
		if (targetGuruId) {
			loadGuruToModal(targetGuruId, mapelNama);
		} else {
			modalGuruId = null;
			modalSelectedMapelIds = new Set();
			addedMapelNames = [];
		}
		modalSetupTerbuka = true;
	}

	function toggleMapelIdSelection(mapelId: number) {
		const next = new Set(modalSelectedMapelIds);
		if (next.has(mapelId)) {
			next.delete(mapelId);
		} else {
			next.add(mapelId);
		}
		modalSelectedMapelIds = next;
	}

	function selectAllRowsForMapel(rows: typeof allMapelRows) {
		const next = new Set(modalSelectedMapelIds);
		for (const r of rows) next.add(r.id);
		modalSelectedMapelIds = next;
	}

	function selectRowsByTingkat(rows: typeof allMapelRows, tingkat: 'X' | 'XI' | 'XII') {
		const next = new Set(modalSelectedMapelIds);
		for (const r of rows) {
			if ((r.kelasNama ?? '').trim().toUpperCase().startsWith(tingkat)) {
				next.add(r.id);
			}
		}
		modalSelectedMapelIds = next;
	}

	function removeMapelFromModal(mapelNama: string) {
		const next = new Set(modalSelectedMapelIds);
		for (const r of allMapelRows) {
			if (r.nama === mapelNama) {
				next.delete(r.id);
			}
		}
		modalSelectedMapelIds = next;
		addedMapelNames = addedMapelNames.filter((n) => n !== mapelNama);
	}

	function addMapelToModal(mapelNama: string) {
		if (!addedMapelNames.includes(mapelNama)) {
			addedMapelNames = [...addedMapelNames, mapelNama];
		}
		const rows = allMapelRows.filter((m) => m.nama === mapelNama);
		const next = new Set(modalSelectedMapelIds);
		for (const r of rows) next.add(r.id);
		modalSelectedMapelIds = next;
	}

	async function switchKelas(kId: number | 'semua') {
		const params = new URLSearchParams(page.url.search);
		if (kId === 'semua') {
			params.set('kelas', 'semua');
		} else {
			params.set('kelas', String(kId));
		}
		await goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	}

	async function handleSuccess({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:master-data-pengampu');
		modalSetupTerbuka = false;
		selectedMapelIds = [];
		bulkGuruId = null;
		toast({
			message:
				typeof hasil?.message === 'string'
					? hasil.message
					: 'Penugasan guru pengampu berhasil disimpan.',
			type: 'success'
		});
	}
</script>

<div class="space-y-4">
	<!-- Header Utama -->
	<div
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div class="flex items-start gap-3 sm:items-center">
				<a
					href="/master-data"
					class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
					title="Kembali ke Master Data"
				>
					<Icon name="left" class="h-4 w-4" />
				</a>
				<div>
					<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
						Guru Pengampu Mata Pelajaran
					</h1>
					<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
						Tentukan guru yang mengajar setiap mata pelajaran dan rombel. Akun login guru akan
						otomatis terhubung. Varian agama/PKS ditampilkan sebagai satu baris mapel induk (sama
						dengan tampilan Intrakurikuler per kelas).
					</p>
				</div>
			</div>

			<!-- Status & Aksi Utama -->
			<div class="flex flex-wrap items-center gap-2">
				<div
					class="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300"
				>
					<span class="inline-block h-2 w-2 rounded-full bg-emerald-600"></span>
					<span>Terisi <strong>{totalTerisi}</strong> / {totalMapel} mapel</span>
					{#if totalKosong > 0}
						<span class="text-slate-300 dark:text-zinc-600">&middot;</span>
						<span class="font-semibold text-amber-700 dark:text-amber-400"
							><strong>{totalKosong}</strong> belum diisi</span
						>
					{/if}
				</div>

				<button
					type="button"
					class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={() => bukaModalSalin()}
					title="Salin semua penugasan mapel dari guru lain"
				>
					<Icon name="copy" class="h-3.5 w-3.5" />
					Salin dari Guru Lain
				</button>

				<button
					type="button"
					class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
					onclick={() => bukaModalSetup()}
				>
					<Icon name="plus" class="h-3.5 w-3.5" />
					Tugaskan Guru
				</button>
			</div>
		</div>

		<!-- Navigasi Tab & Pencarian -->
		<div
			class="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
		>
			<!-- Tab Pilihan Tampilan -->
			<div
				class="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-800/60"
			>
				<button
					type="button"
					class="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors {activeTab ===
					'guru'
						? 'bg-blue-600 text-white shadow-sm'
						: 'text-slate-700 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800'}"
					onclick={() => (activeTab = 'guru')}
				>
					<Icon name="users" class="h-3.5 w-3.5" />
					Daftar Guru ({daftarGuru.length})
				</button>
				<button
					type="button"
					class="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors {activeTab ===
					'mapel'
						? 'bg-blue-600 text-white shadow-sm'
						: 'text-slate-700 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800'}"
					onclick={() => (activeTab = 'mapel')}
				>
					<Icon name="book" class="h-3.5 w-3.5" />
					Daftar Mapel ({totalMapel})
				</button>
			</div>

			<!-- Input Pencarian -->
			<div class="w-full sm:w-80">
				<div class="relative flex items-center">
					<span
						aria-hidden="true"
						class="pointer-events-none absolute left-3 flex items-center text-slate-500 dark:text-zinc-400"
					>
						<Icon name="search" class="h-4 w-4" />
					</span>
					<input
						type="search"
						bind:value={searchQuery}
						placeholder={activeTab === 'guru'
							? 'Cari nama guru, NIP, mapel, kelas...'
							: 'Cari mapel, kode, kelas, atau guru...'}
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-9 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
					/>
					{#if searchQuery}
						<button
							type="button"
							class="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800"
							onclick={() => (searchQuery = '')}
							aria-label="Hapus pencarian"
						>
							<Icon name="close" class="h-3.5 w-3.5" />
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- ================= TAB 1: DAFTAR GURU PENGAMPU ================= -->
	{#if activeTab === 'guru'}
		<div
			class="overflow-hidden rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div
				class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800"
			>
				<div class="text-xs text-slate-600 dark:text-zinc-400">
					Menampilkan <strong class="text-slate-900 dark:text-zinc-100"
						>{filteredGurus.length}</strong
					>
					guru di sekolah
				</div>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full border-collapse text-xs">
					<thead>
						<tr
							class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
						>
							<th class="w-12 px-3 py-2.5 text-center">No</th>
							<th class="min-w-64 px-3 py-2.5">Guru</th>
							<th class="min-w-96 px-3 py-2.5">Mata Pelajaran &amp; Rombel yang Diampu</th>
							<th class="w-32 px-3 py-2.5 text-center">Total Beban</th>
							<th class="w-28 px-3 py-2.5 text-center">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
						{#each filteredGurus as guru, idx (guru.id)}
							<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
								<td
									class="px-3 py-2.5 text-center font-mono text-xs text-slate-500 tabular-nums dark:text-zinc-400"
									>{idx + 1}</td
								>
								<td class="px-3 py-2.5">
									<div class="font-bold text-slate-900 dark:text-zinc-100">{guru.nama}</div>
									<div
										class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400"
									>
										{#if guru.nip && guru.nip !== '-'}
											<span>NIP: {guru.nip}</span>
										{:else if guru.nik}
											<span>NIK: {guru.nik}</span>
										{/if}
										{#if guru.hasAkun}
											<span
												class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
											>
												<span class="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
												Akun aktif
											</span>
										{:else}
											<span class="text-[11px] text-slate-400 dark:text-zinc-500"
												>Belum ada akun</span
											>
										{/if}
									</div>
								</td>
								<td class="px-3 py-2.5">
									{#if guru.penugasanList && guru.penugasanList.length > 0}
										<div class="flex flex-col gap-2">
											{#each guru.penugasanList as p (p.mapelNama)}
												<div class="flex flex-wrap items-center gap-2">
													<button
														type="button"
														class="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
														onclick={() => bukaModalSetup(guru.id, p.mapelNama)}
														title="Klik untuk ubah rombel mapel {p.mapelNama}"
													>
														<Icon name="book" class="h-3 w-3" />
														<span>{p.mapelNama}</span>
													</button>
													<div class="flex flex-wrap items-center gap-1">
														{#each p.kelasNames as k (k)}
															<span
																class="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
															>
																{k}
															</span>
														{/each}
														<span class="ml-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
															({p.kelasNames.length} rombel)
														</span>
													</div>
												</div>
											{/each}
											<div>
												<button
													type="button"
													class="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
													onclick={() => bukaModalSetup(guru.id, '')}
													title="Tambah mata pelajaran lain untuk guru ini"
												>
													<Icon name="plus" class="h-3 w-3" />
													<span>Tambah Mapel Lain</span>
												</button>
											</div>
										</div>
									{:else}
										<div class="flex items-center gap-2">
											<span class="text-xs italic text-slate-400 dark:text-zinc-500">
												Belum ada tugas mengajar
											</span>
											<button
												type="button"
												class="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
												onclick={() => bukaModalSetup(guru.id, '')}
											>
												<Icon name="plus" class="h-3 w-3" />
												<span>Tugaskan Mapel</span>
											</button>
										</div>
									{/if}
								</td>
								<td class="px-3 py-2.5 text-center">
									{#if guru.totalTugas > 0}
										<span
											class="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-sky-800 tabular-nums dark:bg-sky-950/60 dark:text-sky-300"
										>
											{guru.totalTugas} rombel
										</span>
									{:else}
										<span class="font-mono text-xs text-slate-400 dark:text-zinc-500">-</span>
									{/if}
								</td>
								<td class="px-3 py-2.5 text-center">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											class="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-400 dark:hover:bg-zinc-800"
											onclick={() => bukaModalSetup(guru.id)}
											title="Atur penugasan guru ini"
										>
											<Icon name="edit" class="h-3.5 w-3.5" />
											<span>Atur</span>
										</button>
										<button
											type="button"
											class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
											onclick={() => bukaModalSalin(guru.id)}
											disabled={guru.totalTugas === 0}
											aria-disabled={guru.totalTugas === 0}
											title={guru.totalTugas === 0
												? 'Guru ini belum punya penugasan untuk disalin'
												: 'Salin penugasan guru ini ke guru lain'}
											aria-label="Salin penugasan {guru.nama} ke guru lain"
										>
											<Icon name="copy" class="h-3.5 w-3.5" />
										</button>
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="px-3 py-10 text-center text-slate-500 dark:text-zinc-400">
									<Icon name="users" class="mx-auto h-6 w-6 opacity-60" />
									<p class="mt-2 text-xs">Tidak ada data guru yang cocok dengan kata kunci.</p>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- ================= TAB 2: DAFTAR MAPEL & KELAS ================= -->
	{#if activeTab === 'mapel'}
		<!-- Filter Kelas Bar -->
		<div
			class="rounded-2xl border border-slate-200/75 bg-white p-3.5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="mr-2 text-xs font-semibold text-slate-600 dark:text-zinc-400"
					>Filter Kelas:</span
				>
				<button
					type="button"
					class="inline-flex h-7 items-center rounded-lg border px-2.5 text-xs font-semibold transition-colors {selectedKelasId ===
					'semua'
						? 'border-blue-600 bg-blue-600 text-white shadow-sm'
						: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'}"
					onclick={() => switchKelas('semua')}
				>
					Semua Kelas
				</button>
				{#each daftarKelas as k (k.id)}
					<button
						type="button"
						class="inline-flex h-7 items-center rounded-lg border px-2.5 text-xs font-semibold transition-colors {selectedKelasId ===
						k.id
							? 'border-blue-600 bg-blue-600 text-white shadow-sm'
							: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'}"
						onclick={() => switchKelas(k.id)}
					>
						{k.nama}
					</button>
				{/each}
			</div>
		</div>

		<!-- Toolbar Aksi Massal (Muncul saat ada baris dicentang) -->
		{#if selectedMapelIds.length > 0}
			<div
				class="sticky top-4 z-20 rounded-2xl border border-blue-700 bg-blue-600 p-3 text-white shadow-lg dark:border-blue-500 dark:bg-blue-700"
			>
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-center gap-2 text-xs font-semibold">
						<Icon name="check-square" class="h-4 w-4" />
						<span>{selectedMapelIds.length} mata pelajaran terpilih</span>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<!-- Form Bulk Assign Guru -->
						<FormEnhance action="?/bulkAssign" showToast={false} onsuccess={handleSuccess}>
							{#snippet children({ submitting })}
								{#each selectedMapelIds as id (id)}
									<input type="hidden" name="mapel_ids" value={id} />
								{/each}

								<div class="flex items-center gap-2">
									<div class="relative flex items-center">
										<select
											name="guru_id"
											bind:value={bulkGuruId}
											class="h-8 appearance-none rounded-lg border border-white/25 bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:outline-none"
											disabled={submitting}
										>
											<option value={null}>- Pilih Guru Pengampu -</option>
											{#each daftarGuru as guru (guru.id)}
												<option value={guru.id}>
													{guru.nama}
												</option>
											{/each}
										</select>
										<span
											aria-hidden="true"
											class="pointer-events-none absolute right-2 flex items-center text-slate-500"
										>
											<Icon name="down" class="h-3 w-3" />
										</span>
									</div>

									<button
										type="submit"
										class="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
										disabled={submitting || !bulkGuruId}
									>
										<Icon name="check" class="h-3.5 w-3.5" />
										Terapkan ke Terpilih
									</button>
								</div>
							{/snippet}
						</FormEnhance>

						<!-- Form Kosongkan Pengampu -->
						<FormEnhance action="?/bulkAssign" showToast={false} onsuccess={handleSuccess}>
							{#snippet children({ submitting })}
								{#each selectedMapelIds as id (id)}
									<input type="hidden" name="mapel_ids" value={id} />
								{/each}
								<input type="hidden" name="guru_id" value="" />
								<button
									type="submit"
									class="inline-flex h-8 items-center rounded-lg border border-amber-300 bg-amber-100 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
									disabled={submitting}
									title="Hapus guru pengampu pada baris terpilih"
								>
									Kosongkan
								</button>
							{/snippet}
						</FormEnhance>

						<button
							type="button"
							class="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-white/85 hover:bg-white/10"
							onclick={clearSelectedMapels}
						>
							Batal
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Form Simpan Penugasan Baris demi Baris -->
		<FormEnhance action="?/simpan" showToast={false} onsuccess={handleSuccess}>
			{#snippet children({ submitting })}
				<div
					class="overflow-hidden rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
				>
					<!-- Action Bar Atas -->
					<div
						class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800"
					>
						<div class="text-xs text-slate-600 dark:text-zinc-400">
							Menampilkan <strong class="text-slate-900 dark:text-zinc-100"
								>{filteredMapels.length}</strong
							> mata pelajaran
						</div>
						<button
							type="submit"
							class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
							disabled={submitting || filteredMapels.length === 0}
						>
							<Icon name="check" class="h-3.5 w-3.5" />
							{submitting ? 'Menyimpan...' : 'Simpan Penugasan'}
						</button>
					</div>

					<!-- Tabel Daftar Mapel & Pengampu -->
					<div class="overflow-x-auto">
						<table class="w-full border-collapse text-xs">
							<thead>
								<tr
									class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
								>
									<th class="w-10 px-3 py-2.5 text-center">
										<input
											type="checkbox"
											class="checkbox checkbox-xs"
											checked={isAllVisibleSelected}
											onchange={toggleSelectAllMapel}
											aria-label="Pilih semua baris"
										/>
									</th>
									<th class="w-12 px-3 py-2.5 text-center">No</th>
									<th class="px-3 py-2.5" style="min-width: 90px;">Kelas</th>
									<th class="px-3 py-2.5" style="min-width: 70px;">Kode</th>
									<th class="px-3 py-2.5" style="min-width: 220px;">Mata Pelajaran</th>
									<th class="px-3 py-2.5" style="min-width: 90px;">Kelompok</th>
									<th class="px-3 py-2.5" style="min-width: 260px;">Guru Pengampu</th>
									<th class="px-3 py-2.5 text-center" style="width: 110px;">Status</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
								{#each filteredMapels as mapel, idx (mapel.id)}
									<tr
										class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 {selectedMapelIds.includes(
											mapel.id
										)
											? 'bg-blue-50/40 dark:bg-blue-950/20'
											: ''}"
									>
										<td class="px-3 py-2.5 text-center">
											<input
												type="checkbox"
												class="checkbox checkbox-xs"
												checked={selectedMapelIds.includes(mapel.id)}
												onchange={() => toggleMapelId(mapel.id)}
												aria-label="Pilih mapel {mapel.nama} {mapel.kelasNama}"
											/>
										</td>
										<td
											class="px-3 py-2.5 text-center font-mono text-xs text-slate-500 tabular-nums dark:text-zinc-400"
										>
											<input type="hidden" name="mapel_id" value={mapel.id} />
											{idx + 1}
										</td>
										<td class="px-3 py-2.5">
											<span
												class="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-800 dark:bg-zinc-800 dark:text-zinc-200"
												>{mapel.kelasNama}</span
											>
										</td>
										<td class="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-zinc-400"
											>{mapel.kode || '-'}</td
										>
										<td class="px-3 py-2.5">
											<div class="font-semibold text-slate-900 dark:text-zinc-100">
												{mapel.nama}
											</div>
											{#if mapel.urutan}
												<span class="text-[11px] text-slate-500 dark:text-zinc-400"
													>Urutan: #{mapel.urutan}</span
												>
											{/if}
										</td>
										<td class="px-3 py-2.5">
											<span
												class="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize {mapel.jenis ===
												'kejuruan'
													? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
													: mapel.jenis === 'mulok'
														? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
														: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'}"
											>
												{mapel.jenis === 'wajib' ? 'Umum' : mapel.jenis}
											</span>
										</td>
										<td class="px-3 py-2.5">
											<div class="relative flex items-center">
												<select
													name="pengampu_{mapel.id}"
													class="h-8 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
													disabled={submitting}
												>
													<option value="">- Belum Ditentukan -</option>
													{#each daftarGuru as guru (guru.id)}
														<option value={guru.id} selected={mapel.pengampuId === guru.id}>
															{guru.nama}
															{guru.nip && guru.nip !== '-' ? `(NIP: ${guru.nip})` : ''}
														</option>
													{/each}
												</select>
												<span
													aria-hidden="true"
													class="pointer-events-none absolute right-2 flex items-center text-slate-500 dark:text-zinc-400"
												>
													<Icon name="down" class="h-3 w-3" />
												</span>
											</div>
										</td>
										<td class="px-3 py-2.5 text-center">
											{#if mapel.pengampuId}
												<span
													class="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
												>
													<Icon name="check" class="h-3 w-3" /> Terisi
												</span>
											{:else}
												<span
													class="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
												>
													Belum Ada
												</span>
											{/if}
										</td>
									</tr>
								{:else}
									<tr>
										<td
											colspan="8"
											class="px-3 py-10 text-center text-slate-500 dark:text-zinc-400"
										>
											<Icon name="book" class="mx-auto h-6 w-6 opacity-60" />
											<p class="mt-2 text-xs">Tidak ada mata pelajaran yang cocok.</p>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Action Bar Bawah -->
					{#if filteredMapels.length > 5}
						<div
							class="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-zinc-800"
						>
							<span class="text-xs text-slate-500 dark:text-zinc-400">
								Pastikan menekan tombol simpan setelah mengubah pilihan guru pengampu.
							</span>
							<button
								type="submit"
								class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
								disabled={submitting || filteredMapels.length === 0}
							>
								<Icon name="check" class="h-3.5 w-3.5" />
								{submitting ? 'Menyimpan...' : 'Simpan Penugasan'}
							</button>
						</div>
					{/if}
				</div>
			{/snippet}
		</FormEnhance>
	{/if}
</div>

<!-- ================= MODAL ATUR TUGAS GURU ================= -->
{#if modalSetupTerbuka}
	<dialog class="modal modal-bottom sm:modal-middle bg-slate-950/45 backdrop-blur-[2px]" open>
		<div
			class="modal-box max-w-4xl space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<!-- Header Modal -->
			<div
				class="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-zinc-800"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-base font-bold text-blue-700 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/60"
					>
						{modalGuru ? modalGuru.nama.charAt(0) : '?'}
					</div>
					<div>
						<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">
							{modalGuru ? `Atur Tugas Mengajar - ${modalGuru.nama}` : 'Tugaskan Guru Pengampu'}
						</h3>
						<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
							{#if modalGuru}
								{#if modalGuru.nip && modalGuru.nip !== '-'}
									<span>NIP: {modalGuru.nip}</span> &middot;
								{/if}
								<span>{modalSelectedMapelIds.size} rombel aktif terpilih</span>
							{:else}
								Pilih guru pengampu terlebih dahulu untuk mengatur mata pelajaran dan rombel.
							{/if}
						</p>
					</div>
				</div>
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
					onclick={() => (modalSetupTerbuka = false)}
					aria-label="Tutup"
				>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>

			<!-- Pilihan Guru -->
			<div class="flex flex-col gap-1.5">
				<label
					class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
					for="modal-select-guru"
				>
					Guru Pengampu
				</label>
				<div class="relative flex items-center">
					<select
						id="modal-select-guru"
						class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						value={modalGuruId}
						onchange={(e) => {
							const val = Number((e.currentTarget as HTMLSelectElement).value);
							if (val) loadGuruToModal(val);
						}}
					>
						<option value={null}>- Pilih Guru -</option>
						{#each daftarGuru as guru (guru.id)}
							<option value={guru.id}>
								{guru.nama}
								{guru.nip && guru.nip !== '-' ? `(NIP: ${guru.nip})` : ''}
							</option>
						{/each}
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</div>
			</div>

			{#if modalGuruId}
				<FormEnhance action="?/simpanTugasGuru" showToast={false} onsuccess={handleSuccess}>
					{#snippet children({ submitting })}
						<input type="hidden" name="guru_id" value={modalGuruId} />
						{#each Array.from(modalSelectedMapelIds) as id (id)}
							<input type="hidden" name="mapel_ids" value={id} />
						{/each}

						<!-- Daftar Card Per-Mata Pelajaran -->
						<div class="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
							{#if modalActiveMapelNames.length === 0}
								<div
									class="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-zinc-700"
								>
									<Icon name="book" class="mx-auto h-6 w-6 text-slate-400" />
									<p class="mt-2 text-sm font-semibold text-slate-800 dark:text-zinc-200">
										Belum ada mata pelajaran yang diampu
									</p>
									<p class="mt-1 text-xs text-slate-500 dark:text-zinc-400">
										Pilih mata pelajaran di kotak penambahan di bawah untuk mulai menugaskan
										kelas/rombel.
									</p>
								</div>
							{:else}
								{#each modalActiveMapelNames as mapelNama (mapelNama)}
									{@const rowsForMapel = allMapelRows.filter((m) => m.nama === mapelNama)}
									{@const selectedRows = rowsForMapel.filter((m) =>
										modalSelectedMapelIds.has(m.id)
									)}
									{@const jenis = rowsForMapel[0]?.jenis}

									<div
										class="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
									>
										<!-- Baris Judul Mapel -->
										<div
											class="flex flex-col justify-between gap-2 border-b border-slate-200 pb-2.5 sm:flex-row sm:items-center dark:border-zinc-800"
										>
											<div class="flex flex-wrap items-center gap-2">
												<span class="text-sm font-bold text-slate-900 dark:text-zinc-100"
													>{mapelNama}</span
												>
												<span
													class="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize {jenis ===
													'kejuruan'
														? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
														: jenis === 'mulok'
															? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
															: 'bg-slate-200/80 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200'}"
												>
													{jenis === 'wajib' ? 'Umum' : (jenis ?? 'Umum')}
												</span>
												<span class="text-xs text-slate-500 dark:text-zinc-400">
													({selectedRows.length} dari {rowsForMapel.length} rombel aktif)
												</span>
											</div>

											<div class="flex flex-wrap items-center gap-1">
												<!-- Shortcut tombol kelas -->
												<button
													type="button"
													class="inline-flex h-6 items-center rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
													onclick={() => selectAllRowsForMapel(rowsForMapel)}
												>
													Pilih Semua
												</button>
												<button
													type="button"
													class="inline-flex h-6 items-center rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
													onclick={() => selectRowsByTingkat(rowsForMapel, 'X')}
												>
													Kls X
												</button>
												<button
													type="button"
													class="inline-flex h-6 items-center rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
													onclick={() => selectRowsByTingkat(rowsForMapel, 'XI')}
												>
													Kls XI
												</button>
												<button
													type="button"
													class="inline-flex h-6 items-center rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
													onclick={() => selectRowsByTingkat(rowsForMapel, 'XII')}
												>
													Kls XII
												</button>
												<button
													type="button"
													class="inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-semibold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
													onclick={() => removeMapelFromModal(mapelNama)}
													title="Hapus mapel ini dari guru"
												>
													<Icon name="del" class="h-3 w-3" />
													<span>Hapus Mapel</span>
												</button>
											</div>
										</div>

										<!-- Grid Tombol Rombel (Pills) -->
										<div class="flex flex-wrap gap-1.5">
											{#each rowsForMapel as m (m.id)}
												{@const isChecked = modalSelectedMapelIds.has(m.id)}
												{@const otherTeacher =
													m.pengampuId && m.pengampuId !== modalGuruId ? m.pengampuNama : null}

												<button
													type="button"
													class="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors {isChecked
														? 'border-blue-600 bg-blue-600 text-white shadow-sm'
														: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'}"
													onclick={() => toggleMapelIdSelection(m.id)}
												>
													<span
														class="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] {isChecked
															? 'bg-white font-black text-blue-600'
															: 'border border-slate-300 dark:border-zinc-600'}"
													>
														{#if isChecked}✓{/if}
													</span>
													<span>{m.kelasNama}</span>
													{#if otherTeacher}
														<span class="text-[10px] font-normal opacity-75">({otherTeacher})</span>
													{/if}
												</button>
											{/each}
										</div>
									</div>
								{/each}
							{/if}

							<!-- Card Tambah Mata Pelajaran Baru -->
							<div
								class="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30"
							>
								<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
									<div>
										<div class="text-xs font-bold text-slate-900 sm:text-sm dark:text-zinc-100">
											+ Tambah Mata Pelajaran Lain
										</div>
										<div class="text-[11px] text-slate-500 dark:text-zinc-400">
											Pilih mapel tambahan yang juga diajar oleh guru ini.
										</div>
									</div>
									<div class="relative flex w-full items-center sm:w-72">
										<select
											class="h-8 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
											onchange={(e) => {
												const val = (e.currentTarget as HTMLSelectElement).value;
												if (val) {
													addMapelToModal(val);
													(e.currentTarget as HTMLSelectElement).value = '';
												}
											}}
										>
											<option value="">+ Pilih Mapel Tambahan…</option>
											{#each distinctMapels.filter((d) => !modalActiveMapelNames.includes(d.nama)) as mapel (mapel.nama)}
												<option value={mapel.nama}>
													{mapel.nama} ({mapel.countKelas} kelas)
												</option>
											{/each}
										</select>
										<span
											aria-hidden="true"
											class="pointer-events-none absolute right-2 flex items-center text-slate-500 dark:text-zinc-400"
										>
											<Icon name="down" class="h-3 w-3" />
										</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Footer Modal Actions -->
						<div
							class="modal-action flex items-center justify-between border-t border-slate-200 pt-3 dark:border-zinc-800"
						>
							<div class="text-xs text-slate-600 dark:text-zinc-400">
								Total: <strong class="text-slate-900 dark:text-zinc-100"
									>{modalActiveMapelNames.length}</strong
								>
								mapel &middot;
								<strong class="text-slate-900 dark:text-zinc-100"
									>{modalSelectedMapelIds.size}</strong
								> rombel
							</div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									class="inline-flex h-8 items-center rounded-lg border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100"
									onclick={() => (modalSetupTerbuka = false)}
									disabled={submitting}
								>
									Batal
								</button>
								<button
									type="submit"
									class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
									disabled={submitting}
								>
									{#if submitting}
										<span class="loading loading-spinner loading-xs"></span>
										Menyimpan...
									{:else}
										<Icon name="check" class="h-3.5 w-3.5" />
										Simpan Penugasan
									{/if}
								</button>
							</div>
						</div>
					{/snippet}
				</FormEnhance>
			{/if}
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button onclick={() => (modalSetupTerbuka = false)}>Tutup</button>
		</form>
	</dialog>
{/if}

<!-- ================= MODAL SALIN PENUGASAN DARI GURU LAIN ================= -->
{#if modalSalinTerbuka}
	<dialog
		class="modal modal-open modal-bottom sm:modal-middle bg-slate-950/45 backdrop-blur-[2px]"
		open
	>
		<div
			class="modal-box max-w-2xl space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<div
				class="flex items-start justify-between border-b border-slate-200 pb-3 dark:border-zinc-800"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
					>
						<Icon name="copy" class="h-4 w-4" />
					</div>
					<div>
						<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">
							Salin Penugasan Guru
						</h3>
						<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
							Semua mapel yang diampu guru sumber ditugaskan ke guru target. Baris yang sudah diampu
							guru lain tidak ditimpa kecuali opsi timpa dicentang.
						</p>
					</div>
				</div>
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
					onclick={tutupModalSalin}
					aria-label="Tutup"
				>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>

			<FormEnhance action="?/salinPenugasan" showToast={false} onsuccess={handleSalinSuccess}>
				{#snippet children({ submitting })}
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Guru Sumber</span
							>
							<div class="relative flex items-center">
								<select
									name="guru_sumber"
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									bind:value={salinSumberId}
									required
									disabled={submitting}
								>
									<option value={null}>- Pilih guru sumber -</option>
									{#each daftarGuru as guru (guru.id)}
										<option value={guru.id} disabled={guru.id === salinTargetId}>
											{guru.nama}{guru.id === salinTargetId ? ' (target)' : ''}
										</option>
									{/each}
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2 flex items-center text-slate-500 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3 w-3" />
								</span>
							</div>
							<span class="text-[11px] text-slate-500 dark:text-zinc-400">
								{#if salinSumber}
									{salinSumberTugas} penugasan &middot; {salinSumberMapel.length} mapel
								{:else}
									Pilih guru yang penugasannya mau disalin.
								{/if}
							</span>
						</label>

						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Guru Target</span
							>
							<div class="relative flex items-center">
								<select
									name="guru_target"
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									bind:value={salinTargetId}
									required
									disabled={submitting}
								>
									<option value={null}>- Pilih guru target -</option>
									{#each daftarGuru as guru (guru.id)}
										<option value={guru.id} disabled={guru.id === salinSumberId}>
											{guru.nama}{guru.id === salinSumberId ? ' (sumber)' : ''}
										</option>
									{/each}
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2 flex items-center text-slate-500 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3 w-3" />
								</span>
							</div>
							<span class="text-[11px] text-slate-500 dark:text-zinc-400">
								{#if salinTarget}
									Saat ini mengampu {salinTarget.totalTugas} penugasan.
								{:else}
									Guru yang akan menerima salinan penugasan.
								{/if}
							</span>
						</label>
					</div>

					{#if salinSumberId}
						<div
							class="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
						>
							<div class="flex items-center justify-between gap-2">
								<span class="text-xs font-semibold text-slate-800 dark:text-zinc-200"
									>Cakupan Kelas</span
								>
								<button
									type="button"
									class="inline-flex h-6 items-center rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
									onclick={togolSemuaKelasSalin}
									disabled={submitting}
								>
									{salinSemuaKelas ? 'Kosongkan' : 'Pilih Semua'}
								</button>
							</div>
							<div class="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
								{#each daftarKelas as kelas (kelas.id)}
									<button
										type="button"
										class="inline-flex h-7 items-center rounded-lg border px-2.5 text-xs font-semibold transition-colors {salinKelasIds.includes(
											kelas.id
										)
											? 'border-blue-600 bg-blue-600 text-white shadow-sm'
											: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}"
										onclick={() => toggleKelasSalin(kelas.id)}
										disabled={submitting}
									>
										{kelas.nama}
									</button>
								{/each}
							</div>
							{#each salinKelasIds as kelasId (kelasId)}
								<input type="hidden" name="kelas_ids" value={kelasId} />
							{/each}
							{#if salinKelasIds.length === 0}
								<p class="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
									Pilih minimal satu kelas. Tanpa pilihan, server menyalin ke semua kelas.
								</p>
							{/if}
						</div>

						<label
							class="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-800/40"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-xs mt-0.5"
								name="timpa"
								bind:checked={salinTimpa}
								disabled={submitting}
							/>
							<span>
								<span class="font-semibold text-slate-900 dark:text-zinc-100"
									>Timpa penugasan guru lain</span
								>
								<span class="block text-slate-500 dark:text-zinc-400">
									Tanpa ini, baris yang sudah diampu guru lain dilewati dan jumlahnya dilaporkan.
								</span>
							</span>
						</label>
					{/if}

					<div class="modal-action border-t border-slate-200 pt-3 dark:border-zinc-800">
						<button
							type="button"
							class="inline-flex h-8 items-center rounded-lg border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100"
							onclick={tutupModalSalin}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
							disabled={submitting || !salinSumberId || !salinTargetId}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs"></span>
								Menyalin...
							{:else}
								<Icon name="copy" class="h-3.5 w-3.5" />
								Salin Penugasan
							{/if}
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button onclick={tutupModalSalin}>Tutup</button>
		</form>
	</dialog>
{/if}
