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
	<div class="card bg-base-100 rounded-2xl border-none p-5 shadow-sm">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div class="flex items-center gap-3">
				<a
					href="/master-data"
					class="btn btn-circle btn-ghost btn-sm"
					title="Kembali ke Master Data"
				>
					<Icon name="left" />
				</a>
				<div>
					<h1 class="text-xl font-bold tracking-tight">Guru Pengampu Mata Pelajaran</h1>
					<p class="text-base-content/70 mt-0.5 text-xs sm:text-sm">
						Tentukan guru yang mengajar setiap mata pelajaran dan rombel. Akun login guru akan
						otomatis terhubung. Varian agama/PKS ditampilkan sebagai satu baris mapel induk (sama
						dengan tampilan Intrakurikuler per kelas).
					</p>
				</div>
			</div>

			<!-- Status & Aksi Utama -->
			<div class="flex flex-wrap items-center gap-2">
				<div
					class="flex items-center gap-2 rounded-xl bg-base-200/70 px-3 py-1.5 text-xs font-medium"
				>
					<span class="inline-block h-2 w-2 rounded-full bg-success"></span>
					<span>Terisi <strong>{totalTerisi}</strong> / {totalMapel} mapel</span>
					{#if totalKosong > 0}
						<span class="text-base-content/30">•</span>
						<span class="text-warning"><strong>{totalKosong}</strong> belum diisi</span>
					{/if}
				</div>

				<button
					type="button"
					class="btn btn-soft btn-sm rounded-xl gap-1.5 shadow-none"
					onclick={() => bukaModalSalin()}
					title="Salin semua penugasan mapel dari guru lain"
				>
					<Icon name="copy" />
					Salin dari Guru Lain
				</button>

				<button
					type="button"
					class="btn btn-primary btn-sm rounded-xl gap-1.5 shadow-none"
					onclick={() => bukaModalSetup()}
				>
					<Icon name="plus" />
					Tugaskan Guru
				</button>
			</div>
		</div>

		<!-- Navigasi Tab & Pencarian -->
		<div
			class="mt-4 flex flex-col gap-3 border-t border-base-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
		>
			<!-- Tab Pilihan Tampilan -->
			<div class="join bg-base-200/70 p-1 rounded-xl">
				<button
					type="button"
					class="btn btn-sm rounded-lg border-none shadow-none {activeTab === 'guru'
						? 'bg-base-100 text-primary font-bold shadow-sm'
						: 'btn-ghost text-base-content/70'}"
					onclick={() => (activeTab = 'guru')}
				>
					<Icon name="users" />
					Daftar Guru ({daftarGuru.length})
				</button>
				<button
					type="button"
					class="btn btn-sm rounded-lg border-none shadow-none {activeTab === 'mapel'
						? 'bg-base-100 text-primary font-bold shadow-sm'
						: 'btn-ghost text-base-content/70'}"
					onclick={() => (activeTab = 'mapel')}
				>
					<Icon name="book" />
					Daftar Mapel ({totalMapel})
				</button>
			</div>

			<!-- Input Pencarian -->
			<div class="w-full sm:w-80">
				<label
					class="input input-sm bg-base-200/80 dark:bg-base-300/80 flex items-center gap-2 rounded-xl border-none"
				>
					<Icon name="search" />
					<input
						type="search"
						bind:value={searchQuery}
						placeholder={activeTab === 'guru'
							? 'Cari nama guru, NIP, mapel, kelas...'
							: 'Cari mapel, kode, kelas, atau guru...'}
						class="grow text-xs"
					/>
					{#if searchQuery}
						<button
							type="button"
							class="btn btn-ghost btn-xs btn-circle"
							onclick={() => (searchQuery = '')}
						>
							<Icon name="close" />
						</button>
					{/if}
				</label>
			</div>
		</div>
	</div>

	<!-- ================= TAB 1: DAFTAR GURU PENGAMPU ================= -->
	{#if activeTab === 'guru'}
		<div class="card bg-base-100 rounded-2xl border-none shadow-sm overflow-hidden">
			<div class="flex items-center justify-between border-b border-base-200 px-5 py-3">
				<div class="text-xs text-base-content/70">
					Menampilkan <strong>{filteredGurus.length}</strong> guru di sekolah
				</div>
			</div>

			<div class="overflow-x-auto">
				<table class="table table-md">
					<thead>
						<tr class="bg-base-200/50 text-xs text-base-content/70 border-b border-base-200">
							<th class="w-12 text-center">No</th>
							<th class="min-w-64">Guru</th>
							<th class="min-w-96">Mata Pelajaran & Rombel yang Diampu</th>
							<th class="w-32 text-center">Total Beban</th>
							<th class="w-28 text-center">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-base-200/60 text-sm">
						{#each filteredGurus as guru, idx (guru.id)}
							<tr class="hover:bg-base-200/30 transition-colors">
								<td class="text-center text-xs opacity-60 font-mono">{idx + 1}</td>
								<td>
									<div class="font-bold text-base-content">{guru.nama}</div>
									<div class="flex items-center gap-2 text-xs text-base-content/60 mt-0.5">
										{#if guru.nip && guru.nip !== '-'}
											<span>NIP: {guru.nip}</span>
										{:else if guru.nik}
											<span>NIK: {guru.nik}</span>
										{/if}
										{#if guru.hasAkun}
											<span
												class="inline-flex items-center gap-1 text-[11px] text-success font-medium"
											>
												<span class="h-1.5 w-1.5 rounded-full bg-success"></span>
												Akun aktif
											</span>
										{:else}
											<span class="text-[11px] text-base-content/40">Belum ada akun</span>
										{/if}
									</div>
								</td>
								<td>
									{#if guru.penugasanList && guru.penugasanList.length > 0}
										<div class="flex flex-col gap-2">
											{#each guru.penugasanList as p (p.mapelNama)}
												<div class="flex flex-wrap items-center gap-2">
													<button
														type="button"
														class="badge badge-primary badge-soft hover:badge-primary font-semibold text-xs cursor-pointer transition-all gap-1 py-1"
														onclick={() => bukaModalSetup(guru.id, p.mapelNama)}
														title="Klik untuk ubah rombel mapel {p.mapelNama}"
													>
														<Icon name="book" />
														<span>{p.mapelNama}</span>
													</button>
													<div class="flex flex-wrap items-center gap-1">
														{#each p.kelasNames as k (k)}
															<span class="badge badge-neutral badge-xs font-mono font-medium">
																{k}
															</span>
														{/each}
														<span class="text-[11px] text-base-content/50 ml-0.5">
															({p.kelasNames.length} rombel)
														</span>
													</div>
												</div>
											{/each}
											<div>
												<button
													type="button"
													class="btn btn-ghost btn-xs text-primary hover:bg-primary/10 rounded-lg gap-1 font-semibold"
													onclick={() => bukaModalSetup(guru.id, '')}
													title="Tambah mata pelajaran lain untuk guru ini"
												>
													<Icon name="plus" />
													<span>Tambah Mapel Lain</span>
												</button>
											</div>
										</div>
									{:else}
										<div class="flex items-center gap-2">
											<span class="text-xs text-base-content/40 italic">
												Belum ada tugas mengajar
											</span>
											<button
												type="button"
												class="btn btn-ghost btn-xs text-primary hover:bg-primary/10 rounded-lg gap-1"
												onclick={() => bukaModalSetup(guru.id, '')}
											>
												<Icon name="plus" />
												<span>Tugaskan Mapel</span>
											</button>
										</div>
									{/if}
								</td>
								<td class="text-center">
									{#if guru.totalTugas > 0}
										<span class="badge badge-soft badge-info font-bold text-xs">
											{guru.totalTugas} rombel
										</span>
									{:else}
										<span class="text-xs text-base-content/30 font-mono">—</span>
									{/if}
								</td>
								<td class="text-center">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											class="btn btn-ghost btn-sm text-primary hover:bg-primary/10 rounded-xl gap-1"
											onclick={() => bukaModalSetup(guru.id)}
											title="Atur penugasan guru ini"
										>
											<Icon name="edit" />
											<span>Atur</span>
										</button>
										<button
											type="button"
											class="btn btn-ghost btn-sm text-secondary hover:bg-secondary/10 rounded-xl"
											onclick={() => bukaModalSalin(guru.id)}
											disabled={guru.totalTugas === 0}
											aria-disabled={guru.totalTugas === 0}
											title={guru.totalTugas === 0
												? 'Guru ini belum punya penugasan untuk disalin'
												: 'Salin penugasan guru ini ke guru lain'}
											aria-label="Salin penugasan {guru.nama} ke guru lain"
										>
											<Icon name="copy" />
										</button>
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="py-12 text-center text-base-content/50">
									<Icon name="users" />
									<p class="mt-2 text-sm">Tidak ada data guru yang cocok dengan kata kunci.</p>
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
		<div class="card bg-base-100 rounded-2xl border-none p-4 shadow-sm">
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="text-base-content/70 mr-2 text-xs font-semibold">Filter Kelas:</span>
				<button
					type="button"
					class="btn btn-xs rounded-lg {selectedKelasId === 'semua' ? 'btn-primary' : 'btn-soft'}"
					onclick={() => switchKelas('semua')}
				>
					Semua Kelas
				</button>
				{#each daftarKelas as k (k.id)}
					<button
						type="button"
						class="btn btn-xs rounded-lg {selectedKelasId === k.id ? 'btn-primary' : 'btn-soft'}"
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
				class="card bg-primary text-primary-content sticky top-4 z-20 rounded-2xl p-3 shadow-xl transition-all"
			>
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-center gap-2 text-sm font-semibold">
						<Icon name="check-square" />
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
									<select
										name="guru_id"
										bind:value={bulkGuruId}
										class="select select-sm rounded-xl bg-base-100 text-base-content font-medium text-xs border-none"
										disabled={submitting}
									>
										<option value={null}>— Pilih Guru Pengampu —</option>
										{#each daftarGuru as guru (guru.id)}
											<option value={guru.id}>
												{guru.nama}
											</option>
										{/each}
									</select>

									<button
										type="submit"
										class="btn btn-sm btn-neutral rounded-xl"
										disabled={submitting || !bulkGuruId}
									>
										<Icon name="check" />
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
									class="btn btn-sm btn-warning btn-soft rounded-xl"
									disabled={submitting}
									title="Hapus guru pengampu pada baris terpilih"
								>
									Kosongkan
								</button>
							{/snippet}
						</FormEnhance>

						<button
							type="button"
							class="btn btn-sm btn-ghost text-primary-content/80 rounded-xl"
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
				<div class="card bg-base-100 rounded-2xl border-none shadow-sm overflow-hidden">
					<!-- Action Bar Atas -->
					<div class="flex items-center justify-between border-b border-base-200 px-5 py-3">
						<div class="text-xs text-base-content/70">
							Menampilkan <strong>{filteredMapels.length}</strong> mata pelajaran
						</div>
						<button
							type="submit"
							class="btn btn-primary btn-sm rounded-xl shadow-none"
							disabled={submitting || filteredMapels.length === 0}
						>
							<Icon name="check" />
							{submitting ? 'Menyimpan...' : 'Simpan Penugasan'}
						</button>
					</div>

					<!-- Tabel Daftar Mapel & Pengampu -->
					<div class="overflow-x-auto">
						<table class="table table-md">
							<thead>
								<tr class="bg-base-200/50 text-xs text-base-content/70 border-b border-base-200">
									<th class="w-10 text-center">
										<input
											type="checkbox"
											class="checkbox checkbox-xs"
											checked={isAllVisibleSelected}
											onchange={toggleSelectAllMapel}
											aria-label="Pilih semua baris"
										/>
									</th>
									<th class="w-12 text-center">No</th>
									<th style="min-width: 90px;">Kelas</th>
									<th style="min-width: 70px;">Kode</th>
									<th style="min-width: 220px;">Mata Pelajaran</th>
									<th style="min-width: 90px;">Kelompok</th>
									<th style="min-width: 260px;">Guru Pengampu</th>
									<th style="width: 110px;" class="text-center">Status</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-base-200/60 text-sm">
								{#each filteredMapels as mapel, idx (mapel.id)}
									<tr
										class="hover:bg-base-200/30 transition-colors {selectedMapelIds.includes(
											mapel.id
										)
											? 'bg-primary/5'
											: ''}"
									>
										<td class="text-center">
											<input
												type="checkbox"
												class="checkbox checkbox-xs"
												checked={selectedMapelIds.includes(mapel.id)}
												onchange={() => toggleMapelId(mapel.id)}
												aria-label="Pilih mapel {mapel.nama} {mapel.kelasNama}"
											/>
										</td>
										<td class="text-center text-xs opacity-60 font-mono">
											<input type="hidden" name="mapel_id" value={mapel.id} />
											{idx + 1}
										</td>
										<td>
											<span class="badge badge-neutral badge-sm font-semibold"
												>{mapel.kelasNama}</span
											>
										</td>
										<td class="font-mono text-xs opacity-75">{mapel.kode || '—'}</td>
										<td>
											<div class="font-semibold text-base-content">{mapel.nama}</div>
											{#if mapel.urutan}
												<span class="text-[10px] opacity-60">Urutan: #{mapel.urutan}</span>
											{/if}
										</td>
										<td>
											<span
												class="badge badge-xs capitalize {mapel.jenis === 'kejuruan'
													? 'badge-info'
													: mapel.jenis === 'mulok'
														? 'badge-secondary'
														: 'badge-neutral'}"
											>
												{mapel.jenis === 'wajib' ? 'Umum' : mapel.jenis}
											</span>
										</td>
										<td>
											<select
												name="pengampu_{mapel.id}"
												class="select select-sm bg-base-200/80 w-full rounded-xl text-xs border-none"
												disabled={submitting}
											>
												<option value="">— Belum Ditentukan —</option>
												{#each daftarGuru as guru (guru.id)}
													<option value={guru.id} selected={mapel.pengampuId === guru.id}>
														{guru.nama}
														{guru.nip && guru.nip !== '-' ? `(NIP: ${guru.nip})` : ''}
													</option>
												{/each}
											</select>
										</td>
										<td class="text-center">
											{#if mapel.pengampuId}
												<span class="badge badge-success badge-soft badge-xs font-semibold gap-1">
													<Icon name="check" /> Terisi
												</span>
											{:else}
												<span class="badge badge-warning badge-soft badge-xs font-semibold">
													Belum Ada
												</span>
											{/if}
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="8" class="py-12 text-center text-base-content/50">
											<Icon name="book" />
											<p class="mt-2 text-sm">Tidak ada mata pelajaran yang cocok.</p>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Action Bar Bawah -->
					{#if filteredMapels.length > 5}
						<div class="flex items-center justify-between border-t border-base-200 px-5 py-3">
							<span class="text-xs text-base-content/60">
								Pastikan menekan tombol simpan setelah mengubah pilihan guru pengampu.
							</span>
							<button
								type="submit"
								class="btn btn-primary btn-sm rounded-xl shadow-none"
								disabled={submitting || filteredMapels.length === 0}
							>
								<Icon name="check" />
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
	<dialog class="modal modal-bottom sm:modal-middle" open>
		<div class="modal-box max-w-4xl rounded-3xl p-6 space-y-5 bg-base-100 shadow-2xl">
			<!-- Header Modal -->
			<div class="flex items-start justify-between border-b border-base-200 pb-4">
				<div class="flex items-center gap-3">
					<div
						class="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg"
					>
						{modalGuru ? modalGuru.nama.charAt(0) : '?'}
					</div>
					<div>
						<h3 class="text-lg font-bold text-base-content">
							{modalGuru ? `Atur Tugas Mengajar — ${modalGuru.nama}` : 'Tugaskan Guru Pengampu'}
						</h3>
						<p class="text-xs text-base-content/60 mt-0.5">
							{#if modalGuru}
								{#if modalGuru.nip && modalGuru.nip !== '-'}
									<span>NIP: {modalGuru.nip}</span> •
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
					class="btn btn-ghost btn-xs btn-circle"
					onclick={() => (modalSetupTerbuka = false)}
				>
					<Icon name="close" />
				</button>
			</div>

			<!-- Pilihan Guru (Jika dibuka dari header / ingin ganti guru) -->
			<div class="form-control">
				<label class="label py-1" for="modal-select-guru">
					<span class="label-text text-xs font-semibold">Guru Pengampu</span>
				</label>
				<select
					id="modal-select-guru"
					class="select select-sm bg-base-200/80 w-full rounded-xl border-none font-medium text-xs"
					value={modalGuruId}
					onchange={(e) => {
						const val = Number((e.currentTarget as HTMLSelectElement).value);
						if (val) loadGuruToModal(val);
					}}
				>
					<option value={null}>— Pilih Guru —</option>
					{#each daftarGuru as guru (guru.id)}
						<option value={guru.id}>
							{guru.nama}
							{guru.nip && guru.nip !== '-' ? `(NIP: ${guru.nip})` : ''}
						</option>
					{/each}
				</select>
			</div>

			{#if modalGuruId}
				<FormEnhance action="?/simpanTugasGuru" showToast={false} onsuccess={handleSuccess}>
					{#snippet children({ submitting })}
						<input type="hidden" name="guru_id" value={modalGuruId} />
						{#each Array.from(modalSelectedMapelIds) as id (id)}
							<input type="hidden" name="mapel_ids" value={id} />
						{/each}

						<!-- Daftar Card Per-Mata Pelajaran -->
						<div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
							{#if modalActiveMapelNames.length === 0}
								<div class="rounded-2xl border border-dashed border-base-300 p-8 text-center">
									<Icon name="book" />
									<p class="font-semibold text-sm mt-2">Belum ada mata pelajaran yang diampu</p>
									<p class="text-xs text-base-content/60 mt-1">
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

									<div class="card bg-base-200/40 rounded-2xl p-4 border border-base-200 space-y-3">
										<!-- Baris Judul Mapel -->
										<div
											class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-base-200 pb-2"
										>
											<div class="flex items-center gap-2">
												<span class="font-bold text-sm text-base-content">{mapelNama}</span>
												<span
													class="badge badge-xs capitalize {jenis === 'kejuruan'
														? 'badge-info'
														: jenis === 'mulok'
															? 'badge-secondary'
															: 'badge-neutral'}"
												>
													{jenis === 'wajib' ? 'Umum' : (jenis ?? 'Umum')}
												</span>
												<span class="text-xs text-base-content/60">
													({selectedRows.length} dari {rowsForMapel.length} rombel aktif)
												</span>
											</div>

											<div class="flex items-center gap-1">
												<!-- Shortcut tombol kelas -->
												<button
													type="button"
													class="btn btn-xs btn-soft rounded-lg text-[11px]"
													onclick={() => selectAllRowsForMapel(rowsForMapel)}
												>
													Pilih Semua
												</button>
												<button
													type="button"
													class="btn btn-xs btn-soft rounded-lg text-[11px]"
													onclick={() => selectRowsByTingkat(rowsForMapel, 'X')}
												>
													Kls X
												</button>
												<button
													type="button"
													class="btn btn-xs btn-soft rounded-lg text-[11px]"
													onclick={() => selectRowsByTingkat(rowsForMapel, 'XI')}
												>
													Kls XI
												</button>
												<button
													type="button"
													class="btn btn-xs btn-soft rounded-lg text-[11px]"
													onclick={() => selectRowsByTingkat(rowsForMapel, 'XII')}
												>
													Kls XII
												</button>
												<button
													type="button"
													class="btn btn-xs btn-ghost text-error rounded-lg text-[11px] gap-1"
													onclick={() => removeMapelFromModal(mapelNama)}
													title="Hapus mapel ini dari guru"
												>
													<Icon name="del" />
													<span>Hapus Mapel</span>
												</button>
											</div>
										</div>

										<!-- Grid Tombol Rombel (Pills) -->
										<div class="flex flex-wrap gap-2">
											{#each rowsForMapel as m (m.id)}
												{@const isChecked = modalSelectedMapelIds.has(m.id)}
												{@const otherTeacher =
													m.pengampuId && m.pengampuId !== modalGuruId ? m.pengampuNama : null}

												<button
													type="button"
													class="btn btn-sm rounded-xl transition-all gap-1.5 {isChecked
														? 'btn-primary shadow-xs'
														: 'btn-outline border-base-300 text-base-content/80'}"
													onclick={() => toggleMapelIdSelection(m.id)}
												>
													<span
														class="h-3.5 w-3.5 rounded-full flex items-center justify-center text-[10px] {isChecked
															? 'bg-primary-content text-primary font-black'
															: 'border border-base-content/30'}"
													>
														{#if isChecked}✓{/if}
													</span>
													<span>{m.kelasNama}</span>
													{#if otherTeacher}
														<span class="text-[10px] opacity-70 font-normal">({otherTeacher})</span>
													{/if}
												</button>
											{/each}
										</div>
									</div>
								{/each}
							{/if}

							<!-- Card Tambah Mata Pelajaran Baru -->
							<div class="card border border-dashed border-base-300 bg-base-100/60 p-4 rounded-2xl">
								<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
									<div>
										<div class="font-bold text-xs sm:text-sm text-base-content">
											+ Tambah Mata Pelajaran Lain
										</div>
										<div class="text-[11px] text-base-content/60">
											Pilih mapel tambahan yang juga diajar oleh guru ini.
										</div>
									</div>
									<div class="w-full sm:w-72">
										<select
											class="select select-sm bg-base-200/90 w-full rounded-xl border-none text-xs"
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
									</div>
								</div>
							</div>
						</div>

						<!-- Footer Modal Actions -->
						<div
							class="modal-action border-t border-base-200 pt-4 flex items-center justify-between"
						>
							<div class="text-xs text-base-content/70">
								Total: <strong>{modalActiveMapelNames.length}</strong> mapel •
								<strong>{modalSelectedMapelIds.size}</strong> rombel
							</div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									class="btn btn-ghost btn-sm rounded-xl"
									onclick={() => (modalSetupTerbuka = false)}
									disabled={submitting}
								>
									Batal
								</button>
								<button
									type="submit"
									class="btn btn-primary btn-sm rounded-xl gap-1.5"
									disabled={submitting}
								>
									{#if submitting}
										<span class="loading loading-spinner loading-xs"></span>
										Menyimpan...
									{:else}
										<Icon name="check" />
										Simpan Penugasan
									{/if}
								</button>
							</div>
						</div>
					{/snippet}
				</FormEnhance>
			{/if}
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => (modalSetupTerbuka = false)}>Tutup</button>
		</form>
	</dialog>
{/if}

<!-- ================= MODAL SALIN PENUGASAN DARI GURU LAIN ================= -->
{#if modalSalinTerbuka}
	<dialog class="modal modal-open modal-bottom sm:modal-middle" open>
		<div class="modal-box max-w-2xl rounded-3xl p-6 space-y-4 bg-base-100 shadow-2xl">
			<div class="flex items-start justify-between border-b border-base-200 pb-3">
				<div class="flex items-center gap-3">
					<div
						class="h-10 w-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center"
					>
						<Icon name="copy" />
					</div>
					<div>
						<h3 class="text-lg font-bold text-base-content">Salin Penugasan Guru</h3>
						<p class="text-base-content/70 mt-0.5 text-xs">
							Semua mapel yang diampu guru sumber ditugaskan ke guru target. Baris yang sudah diampu
							guru lain tidak ditimpa kecuali opsi timpa dicentang.
						</p>
					</div>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-circle"
					onclick={tutupModalSalin}
					aria-label="Tutup"
				>
					<Icon name="close" />
				</button>
			</div>

			<FormEnhance action="?/salinPenugasan" showToast={false} onsuccess={handleSalinSuccess}>
				{#snippet children({ submitting })}
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="form-control">
							<span class="label-text mb-1 block text-xs font-semibold">Guru Sumber</span>
							<select
								name="guru_sumber"
								class="select select-sm bg-base-200/80 w-full rounded-xl border-none text-xs"
								bind:value={salinSumberId}
								required
								disabled={submitting}
							>
								<option value={null}>— Pilih guru sumber —</option>
								{#each daftarGuru as guru (guru.id)}
									<option value={guru.id} disabled={guru.id === salinTargetId}>
										{guru.nama}{guru.id === salinTargetId ? ' (target)' : ''}
									</option>
								{/each}
							</select>
							<span class="text-base-content/60 mt-1 block text-[11px]">
								{#if salinSumber}
									{salinSumberTugas} penugasan · {salinSumberMapel.length} mapel
								{:else}
									Pilih guru yang penugasannya mau disalin.
								{/if}
							</span>
						</label>

						<label class="form-control">
							<span class="label-text mb-1 block text-xs font-semibold">Guru Target</span>
							<select
								name="guru_target"
								class="select select-sm bg-base-200/80 w-full rounded-xl border-none text-xs"
								bind:value={salinTargetId}
								required
								disabled={submitting}
							>
								<option value={null}>— Pilih guru target —</option>
								{#each daftarGuru as guru (guru.id)}
									<option value={guru.id} disabled={guru.id === salinSumberId}>
										{guru.nama}{guru.id === salinSumberId ? ' (sumber)' : ''}
									</option>
								{/each}
							</select>
							<span class="text-base-content/60 mt-1 block text-[11px]">
								{#if salinTarget}
									Saat ini mengampu {salinTarget.totalTugas} penugasan.
								{:else}
									Guru yang akan menerima salinan penugasan.
								{/if}
							</span>
						</label>
					</div>

					{#if salinSumberId}
						<div class="card bg-base-200/40 rounded-2xl border border-base-200 p-4">
							<div class="flex items-center justify-between gap-2">
								<span class="text-xs font-semibold">Cakupan Kelas</span>
								<button
									type="button"
									class="btn btn-xs btn-soft rounded-lg"
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
										class="btn btn-xs rounded-lg {salinKelasIds.includes(kelas.id)
											? 'btn-primary'
											: 'btn-outline border-base-300'}"
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
								<p class="text-warning mt-2 text-[11px]">
									Pilih minimal satu kelas. Tanpa pilihan, server menyalin ke semua kelas.
								</p>
							{/if}
						</div>

						<label
							class="flex cursor-pointer items-start gap-2 rounded-xl bg-base-200/40 p-3 text-xs"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-xs mt-0.5"
								name="timpa"
								bind:checked={salinTimpa}
								disabled={submitting}
							/>
							<span>
								<span class="font-semibold">Timpa penugasan guru lain</span>
								<span class="text-base-content/60 block">
									Tanpa ini, baris yang sudah diampu guru lain dilewati dan jumlahnya dilaporkan.
								</span>
							</span>
						</label>
					{/if}

					<div class="modal-action border-t border-base-200 pt-3">
						<button
							type="button"
							class="btn btn-ghost btn-sm rounded-xl"
							onclick={tutupModalSalin}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-secondary btn-sm rounded-xl gap-1.5"
							disabled={submitting || !salinSumberId || !salinTargetId}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs"></span>
								Menyalin...
							{:else}
								<Icon name="copy" />
								Salin Penugasan
							{/if}
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={tutupModalSalin}>Tutup</button>
		</form>
	</dialog>
{/if}
