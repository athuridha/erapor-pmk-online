<script lang="ts">
	import { invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	type Perusahaan = {
		id: number;
		nama: string;
		alamat: string | null;
		bidangUsaha: string | null;
		pembimbing: string | null;
		telepon: string | null;
	};

	type Anggota = {
		id: number;
		muridId: number;
		murid: { nama: string; nisn: string } | null;
	};

	type Kelompok = {
		id: number;
		kelasId: number;
		perusahaanId: number | null;
		pembimbingPegawaiId: number | null;
		nama: string | null;
		skPenugasan: string | null;
		tanggalMulai: string | null;
		tanggalSelesai: string | null;
		lokasi: string | null;
		catatan: string | null;
		kelas: { nama: string; fase: string | null } | null;
		perusahaan: { nama: string } | null;
		pembimbing: { nama: string } | null;
		anggota: Anggota[];
	};

	type Tujuan = {
		id: number;
		urutan: number | null;
		deskripsi: string;
	};

	type MuridLite = { id: number; nama: string; kelasId: number; nisn: string | null };
	type PegawaiLite = { id: number; nama: string };
	type KelasLite = { id: number; nama: string; fase: string | null };

	interface PageData {
		authorized: boolean;
		kelasId: number | null;
		semuaKelasMode: boolean;
		perusahaan: Perusahaan[];
		kelompok: Kelompok[];
		tujuan: Tujuan[];
		muridList: MuridLite[];
		pegawaiList: PegawaiLite[];
		daftarKelas: KelasLite[];
	}

	let { data }: { data: PageData } = $props();

	const canManage = $derived(data.authorized);

	/* ===== modal states ===== */
	let anggotaModalKelompok = $state<Kelompok | null>(null);
	let memberToggle = $state<Record<number, boolean>>({});
	let anggotaSearch = $state('');
	let kelompokModalOpen = $state(false);
	let perusahaanModalOpen = $state(false);
	let confirmDelete = $state<{
		title: string;
		message: string;
		action: string;
		id: number;
	} | null>(null);

	// submit state for modals whose action button sits outside the enhanced form
	let anggotaSubmitting = $state(false);
	let kelompokSubmitting = $state(false);
	let perusahaanSubmitting = $state(false);
	let hapusSubmitting = $state(false);

	const anggotaInitial = $derived.by(() => {
		if (!anggotaModalKelompok) return new Set<number>();
		return new Set(anggotaModalKelompok.anggota.map((a) => a.muridId));
	});
	const anggotaCandidates = $derived.by(() => {
		if (!anggotaModalKelompok) return [] as MuridLite[];
		return data.muridList.filter((m) => m.kelasId === (anggotaModalKelompok as Kelompok).kelasId);
	});

	function bukaAnggotaModal(item: Kelompok) {
		anggotaModalKelompok = item;
		memberToggle = {};
		anggotaSearch = '';
	}

	function tutupAnggotaModal() {
		anggotaModalKelompok = null;
		memberToggle = {};
		anggotaSearch = '';
	}

	function toggleAnggota(muridId: number) {
		const checked = memberToggle[muridId] ?? anggotaInitial.has(muridId);
		memberToggle = { ...memberToggle, [muridId]: !checked };
	}

	function isAnggotaChecked(muridId: number) {
		return memberToggle[muridId] ?? anggotaInitial.has(muridId);
	}

	/** Murid kelas kelompok yang tampil (difilter pencarian nama/NISN). */
	const anggotaFiltered = $derived.by(() => {
		const q = anggotaSearch.trim().toLowerCase();
		if (!q) return anggotaCandidates;
		return anggotaCandidates.filter(
			(murid) =>
				murid.nama.toLowerCase().includes(q) || (murid.nisn ?? '').toLowerCase().includes(q)
		);
	});

	const anggotaTerpilih = $derived(anggotaCandidates.filter((m) => isAnggotaChecked(m.id)).length);
	const anggotaAkanDitambah = $derived(
		Object.entries(memberToggle).filter(
			([muridId, checked]) => checked && !anggotaInitial.has(Number(muridId))
		).length
	);
	const anggotaAkanDihapus = $derived(
		Object.entries(memberToggle).filter(
			([muridId, checked]) => !checked && anggotaInitial.has(Number(muridId))
		).length
	);
	const semuaAnggotaTampilTercentang = $derived(
		anggotaFiltered.length > 0 && anggotaFiltered.every((m) => isAnggotaChecked(m.id))
	);

	/** Centang / lepas semua murid yang sedang tampil sekaligus. */
	function togolSemuaAnggotaTampil() {
		const target = !semuaAnggotaTampilTercentang;
		const next = { ...memberToggle };
		for (const murid of anggotaFiltered) {
			const wasMember = anggotaInitial.has(murid.id);
			if (wasMember === target) delete next[murid.id];
			else next[murid.id] = target;
		}
		memberToggle = next;
	}

	function bukaConfirm(title: string, message: string, action: string, id: number) {
		confirmDelete = { title, message, action, id };
	}

	function tutupConfirm() {
		confirmDelete = null;
	}

	function suksesTutupModal() {
		kelompokModalOpen = false;
		perusahaanModalOpen = false;
		tutupConfirm();
		invalidate('app:prakerin');
	}

	// Non-null snapshots for use inside lazy snippets (Svelte narrows only in the
	// immediate {#if} block, not inside default snippets).
	const modalKelompokId = $derived(anggotaModalKelompok?.id ?? 0);
	const confirmDeleteAction = $derived(confirmDelete?.action ?? '?');
	const confirmDeleteId = $derived(confirmDelete?.id ?? 0);
</script>

<div class="space-y-5">
	{#if !data.authorized}
		<div
			class="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="lock" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Anda tidak memiliki izin untuk mengelola PKL (Prakerin).</span>
		</div>
	{/if}

	<!-- ==================== Bagian 1: kelompok PKL ==================== -->
	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
		>
			<div class="flex flex-wrap items-center gap-2.5">
				<span
					class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
				>
					<Icon name="users" class="h-4 w-4" />
				</span>
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
							Kelompok PKL
						</h1>
						{#if data.semuaKelasMode}
							<span
								class="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
							>
								Semua Kelas
							</span>
						{/if}
					</div>
					<p class="text-xs text-slate-500 dark:text-zinc-400">
						Kelola kelompok, penempatan perusahaan mitra, dan anggota PKL murid.
					</p>
				</div>
			</div>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
				disabled={!canManage}
				aria-disabled={!canManage}
				onclick={() => (kelompokModalOpen = true)}
				title={!canManage ? 'Anda tidak memiliki izin untuk menambah' : ''}
			>
				<Icon name="plus" class="h-3.5 w-3.5" />
				Tambah Kelompok
			</button>
		</div>

		{#if data.kelompok.length === 0}
			<div
				class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
			>
				<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<span>Belum ada kelompok PKL. Tambahkan kelompok terlebih dahulu.</span>
			</div>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{#each data.kelompok as item (item.id)}
					<div
						class="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/65 p-4 transition-colors hover:border-slate-300/80 dark:border-zinc-800 dark:bg-zinc-800/45 dark:hover:border-zinc-700"
					>
						<div>
							<div class="flex items-start justify-between gap-2">
								<div>
									<h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100">
										{item.nama ?? `Kelompok ${item.id}`}
									</h3>
									<p class="mt-0.5 text-xs font-medium text-slate-500 dark:text-zinc-400">
										{item.kelas?.fase
											? `${item.kelas.nama} - ${item.kelas.fase}`
											: (item.kelas?.nama ?? '-')}
									</p>
								</div>
								<button
									type="button"
									class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/50"
									disabled={!canManage}
									aria-disabled={!canManage}
									aria-label="Hapus kelompok"
									title={!canManage ? 'Anda tidak memiliki izin untuk menghapus' : 'Hapus kelompok'}
									onclick={() =>
										bukaConfirm(
											'Hapus Kelompok PKL',
											`Yakin ingin menghapus kelompok "${item.nama ?? `Kelompok ${item.id}`}"? Semua anggota ikut terhapus.`,
											'?/hapusKelompok',
											item.id
										)}
								>
									<Icon name="del" class="h-3.5 w-3.5" />
								</button>
							</div>

							<dl class="mt-3 space-y-1.5 text-xs text-slate-700 dark:text-zinc-300">
								<div class="flex gap-2">
									<dt class="w-22 shrink-0 font-semibold text-slate-500 dark:text-zinc-400">
										Perusahaan
									</dt>
									<dd class="min-w-0">{item.perusahaan?.nama ?? '-'}</dd>
								</div>
								<div class="flex gap-2">
									<dt class="w-22 shrink-0 font-semibold text-slate-500 dark:text-zinc-400">
										Pembimbing
									</dt>
									<dd class="min-w-0">{item.pembimbing?.nama ?? '-'}</dd>
								</div>
								<div class="flex gap-2">
									<dt class="w-22 shrink-0 font-semibold text-slate-500 dark:text-zinc-400">
										Lokasi
									</dt>
									<dd class="min-w-0">{item.lokasi ?? '-'}</dd>
								</div>
								<div class="flex gap-2">
									<dt class="w-22 shrink-0 font-semibold text-slate-500 dark:text-zinc-400">
										Periode
									</dt>
									<dd class="min-w-0">
										{item.tanggalMulai ?? '-'} s/d {item.tanggalSelesai ?? '-'}
									</dd>
								</div>
							</dl>

							<div class="mt-3.5 border-t border-slate-200/70 pt-3 dark:border-zinc-700/70">
								<p
									class="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
								>
									Anggota ({item.anggota.length})
								</p>
								<ul class="space-y-1">
									{#each item.anggota as anggota (anggota.id)}
										<li class="text-xs text-slate-700 dark:text-zinc-300">
											<span class="font-medium text-slate-900 dark:text-zinc-100">
												{anggota.murid?.nama ?? `Murid #${anggota.muridId}`}
											</span>
											<span class="text-slate-400 dark:text-zinc-500">
												· {anggota.murid?.nisn ?? '-'}
											</span>
										</li>
									{:else}
										<li class="text-xs text-slate-400 italic dark:text-zinc-500">
											Belum ada anggota
										</li>
									{/each}
								</ul>
							</div>
						</div>

						<div class="mt-4 flex flex-wrap items-center justify-end gap-2">
							<button
								type="button"
								class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
								disabled={!canManage}
								aria-disabled={!canManage}
								onclick={() => bukaAnggotaModal(item)}
								title={!canManage ? 'Anda tidak memiliki izin' : 'Kelola anggota kelompok'}
							>
								<Icon name="users" class="h-3.5 w-3.5" />
								Kelola Anggota
							</button>
							<a
								href={`/prakerin/nilais?kelompok=${item.id}`}
								class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
								title="Input nilai PKL kelompok ini"
							>
								<Icon name="book" class="h-3.5 w-3.5" />
								Input Nilai
							</a>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- ==================== Bagian 2: perusahaan ==================== -->
	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
		>
			<div class="flex items-center gap-2.5">
				<span
					class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
				>
					<Icon name="briefcase" class="h-4 w-4" />
				</span>
				<div>
					<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
						Perusahaan Mitra
					</h2>
					<p class="text-xs text-slate-500 dark:text-zinc-400">
						Daftar dunia usaha / dunia industri tempat pelaksanaan PKL.
					</p>
				</div>
			</div>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				disabled={!canManage}
				aria-disabled={!canManage}
				onclick={() => (perusahaanModalOpen = true)}
				title={!canManage ? 'Anda tidak memiliki izin untuk menambah' : ''}
			>
				<Icon name="plus" class="h-3.5 w-3.5" />
				Tambah Perusahaan
			</button>
		</div>

		{#if data.perusahaan.length === 0}
			<div
				class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
			>
				<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<span>Belum ada data perusahaan mitra.</span>
			</div>
		{:else}
			<div
				class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<table class="min-w-[640px] w-full border-collapse text-xs">
					<thead>
						<tr
							class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
						>
							<th class="w-12 px-3.5 py-2.5">No</th>
							<th class="px-3.5 py-2.5">Nama</th>
							<th class="px-3.5 py-2.5">Alamat</th>
							<th class="px-3.5 py-2.5">Bidang Usaha</th>
							<th class="px-3.5 py-2.5">Pembimbing</th>
							<th class="px-3.5 py-2.5">Telepon</th>
							<th class="w-20 px-3.5 py-2.5 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
						{#each data.perusahaan as item, index (item.id)}
							<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
								<td class="px-3.5 py-2.5 text-slate-500 dark:text-zinc-400">{index + 1}</td>
								<td class="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-zinc-100">
									{item.nama}
								</td>
								<td class="px-3.5 py-2.5 text-slate-600 dark:text-zinc-300">
									{item.alamat ?? '-'}
								</td>
								<td class="px-3.5 py-2.5 text-slate-600 dark:text-zinc-300">
									{item.bidangUsaha ?? '-'}
								</td>
								<td class="px-3.5 py-2.5 text-slate-600 dark:text-zinc-300">
									{item.pembimbing ?? '-'}
								</td>
								<td class="px-3.5 py-2.5 text-slate-600 dark:text-zinc-300">
									{item.telepon ?? '-'}
								</td>
								<td class="px-3.5 py-2.5 text-right">
									<button
										type="button"
										class="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/50"
										disabled={!canManage}
										aria-disabled={!canManage}
										aria-label="Hapus perusahaan"
										title={!canManage
											? 'Anda tidak memiliki izin untuk menghapus'
											: 'Hapus perusahaan'}
										onclick={() =>
											bukaConfirm(
												'Hapus Perusahaan',
												`Yakin ingin menghapus perusahaan "${item.nama}"?`,
												'?/hapusPerusahaan',
												item.id
											)}
									>
										<Icon name="del" class="h-3.5 w-3.5" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- ==================== Bagian 3: tujuan pembelajaran ==================== -->
	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
		>
			<div class="flex items-center gap-2.5">
				<span
					class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
				>
					<Icon name="check-square" class="h-4 w-4" />
				</span>
				<div>
					<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
						Tujuan Pembelajaran PKL
					</h2>
					<p class="text-xs text-slate-500 dark:text-zinc-400">
						Kompetensi atau capaian yang dinilai selama program PKL berlangsung.
					</p>
				</div>
			</div>
		</div>

		<FormEnhance
			id="form-tambah-tujuan"
			action="?/tambahTujuan"
			onsuccess={({ form }) => {
				form.reset();
				invalidate('app:prakerin');
			}}
		>
			{#snippet children({ submitting, invalid })}
				<div class="mb-4 flex flex-col gap-2 sm:flex-row">
					<input
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						placeholder="Deskripsi tujuan pembelajaran PKL"
						name="deskripsi"
						required
						autocomplete="off"
						aria-invalid={invalid}
						disabled={!canManage}
					/>
					<button
						type="submit"
						class="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
						disabled={submitting || !canManage}
						aria-disabled={submitting || !canManage}
						title={!canManage ? 'Anda tidak memiliki izin untuk menambah' : ''}
					>
						{#if submitting}
							<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
						{:else}
							<Icon name="plus" class="h-3.5 w-3.5" />
						{/if}
						Tambah
					</button>
				</div>
			{/snippet}
		</FormEnhance>

		{#if data.tujuan.length === 0}
			<div
				class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
			>
				<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<span>Belum ada tujuan pembelajaran PKL.</span>
			</div>
		{:else}
			<div
				class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<table class="min-w-[480px] w-full border-collapse text-xs">
					<thead>
						<tr
							class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
						>
							<th class="w-20 px-3.5 py-2.5">Urutan</th>
							<th class="px-3.5 py-2.5">Deskripsi</th>
							<th class="w-20 px-3.5 py-2.5 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
						{#each data.tujuan as item (item.id)}
							<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
								<td class="px-3.5 py-2.5">
									<span
										class="inline-flex min-w-6 items-center justify-center rounded-md border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
									>
										{item.urutan ?? '-'}
									</span>
								</td>
								<td class="px-3.5 py-2.5 text-slate-700 dark:text-zinc-200">{item.deskripsi}</td>
								<td class="px-3.5 py-2.5 text-right">
									<button
										type="button"
										class="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/50"
										disabled={!canManage}
										aria-disabled={!canManage}
										aria-label="Hapus tujuan"
										title={!canManage ? 'Anda tidak memiliki izin untuk menghapus' : 'Hapus tujuan'}
										onclick={() =>
											bukaConfirm(
												'Hapus Tujuan',
												`Yakin ingin menghapus tujuan "${item.deskripsi}"?`,
												'?/hapusTujuan',
												item.id
											)}
									>
										<Icon name="del" class="h-3.5 w-3.5" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<!-- ==================== Kelola Anggota Modal ==================== -->
{#if anggotaModalKelompok}
	<div
		class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		onkeydown={(event) => {
			if (event.key === 'Escape') tutupAnggotaModal();
		}}
	>
		<dialog
			class="modal-box relative z-10 max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
			open
			aria-modal="true"
		>
			<div class="border-b border-slate-100 pb-3 dark:border-zinc-800">
				<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">Kelola Anggota</h3>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					{anggotaModalKelompok.nama ?? `Kelompok ${anggotaModalKelompok.id}`} ·
					{anggotaModalKelompok.kelas?.nama ?? '-'}
				</p>
			</div>

			<FormEnhance
				id="form-atur-anggota"
				action="?/aturAnggota"
				submitStateChange={(v) => (anggotaSubmitting = v)}
				onsuccess={() => {
					suksesTutupModal();
				}}
			>
				<input name="kelompokId" value={modalKelompokId} hidden />
				{#if anggotaCandidates.length === 0}
					<div
						class="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
					>
						<Icon name="warning" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
						<span>Belum ada murid di kelas ini.</span>
					</div>
				{:else}
					<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
						<div class="relative flex grow items-center">
							<span
								aria-hidden="true"
								class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
							>
								<Icon name="search" class="h-3.5 w-3.5" />
							</span>
							<input
								type="search"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								placeholder="Cari nama atau NISN murid..."
								bind:value={anggotaSearch}
								autocomplete="off"
							/>
						</div>
						<button
							type="button"
							class="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={togolSemuaAnggotaTampil}
						>
							<Icon name="check-square" class="h-3.5 w-3.5" />
							{semuaAnggotaTampilTercentang ? 'Lepas Semua' : 'Centang Semua'}
						</button>
					</div>

					<div class="mt-2.5 text-xs text-slate-600 dark:text-zinc-400">
						Terpilih <strong class="text-slate-900 dark:text-zinc-100">{anggotaTerpilih}</strong>
						dari {anggotaCandidates.length} murid kelas ini{#if anggotaAkanDitambah || anggotaAkanDihapus}
							· <span class="font-medium text-emerald-600 dark:text-emerald-400"
								>+{anggotaAkanDitambah} ditambah</span
							>
							{#if anggotaAkanDihapus}
								· <span class="font-medium text-red-600 dark:text-red-400"
									>-{anggotaAkanDihapus} dihapus</span
								>
							{/if}
						{/if}
					</div>

					<div
						class="mt-2.5 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/60 p-1.5 dark:border-zinc-800 dark:bg-zinc-800/40"
					>
						{#each anggotaFiltered as murid (murid.id)}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-white dark:hover:bg-zinc-800"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={isAnggotaChecked(murid.id)}
									onchange={() => toggleAnggota(murid.id)}
								/>
								<span class="min-w-0 grow text-xs">
									<span class="font-semibold text-slate-900 dark:text-zinc-100">{murid.nama}</span>
									{#if murid.nisn}
										<span class="block text-[11px] text-slate-500 dark:text-zinc-400"
											>NISN {murid.nisn}</span
										>
									{/if}
								</span>
								{#if anggotaInitial.has(murid.id)}
									<span
										class="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
										>Anggota</span
									>
								{/if}
							</label>
						{:else}
							<p class="px-2 py-4 text-center text-xs text-slate-500 italic dark:text-zinc-400">
								Tidak ada murid yang cocok dengan pencarian.
							</p>
						{/each}
					</div>

					{#each Object.entries(memberToggle) as [muridId, checked] (muridId)}
						{@const muridIdNum = Number(muridId)}
						{@const wasMember = anggotaInitial.has(muridIdNum)}
						{#if checked && !wasMember}
							<input name="add" value={muridIdNum} hidden />
						{:else if !checked && wasMember}
							<input name="remove" value={muridIdNum} hidden />
						{/if}
					{/each}
				{/if}
			</FormEnhance>

			<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={tutupAnggotaModal}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					Batal
				</button>
				<button
					type="submit"
					form="form-atur-anggota"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
					disabled={anggotaSubmitting}
				>
					<Icon name="save" class="h-3.5 w-3.5" />
					Simpan Anggota
				</button>
			</div>
		</dialog>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button
				type="submit"
				onclick={(event) => {
					event.preventDefault();
					tutupAnggotaModal();
				}}
			>
				tutup
			</button>
		</form>
	</div>
{/if}

<!-- ==================== Tambah Kelompok Modal ==================== -->
{#if kelompokModalOpen}
	<div
		class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		onkeydown={(event) => {
			if (event.key === 'Escape') kelompokModalOpen = false;
		}}
	>
		<dialog
			class="modal-box relative z-10 max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
			open
			aria-modal="true"
		>
			<div class="border-b border-slate-100 pb-3 dark:border-zinc-800">
				<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">Tambah Kelompok PKL</h3>
			</div>

			<FormEnhance
				id="form-tambah-kelompok"
				action="?/tambahKelompok"
				submitStateChange={(v) => (kelompokSubmitting = v)}
				onsuccess={({ form }) => {
					form.reset();
					suksesTutupModal();
				}}
			>
				<div class="mt-4 space-y-3">
					<label class="block w-full">
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Kelas *
						</span>
						<div class="relative flex items-center">
							<select
								name="kelasId"
								class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								required
							>
								{#each data.daftarKelas as kelas (kelas.id)}
									<option value={kelas.id} selected={kelas.id === data.kelasId}>
										{kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama}
									</option>
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

					<label class="block w-full">
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Nama Kelompok
						</span>
						<input
							type="text"
							name="nama"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
							autocomplete="off"
						/>
					</label>

					<label class="block w-full">
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Perusahaan
						</span>
						<div class="relative flex items-center">
							<select
								name="perusahaanId"
								class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							>
								<option value="">- Pilih perusahaan -</option>
								{#each data.perusahaan as item (item.id)}
									<option value={item.id}>{item.nama}</option>
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

					<label class="block w-full">
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Pembimbing (Guru)
						</span>
						<div class="relative flex items-center">
							<select
								name="pembimbingPegawaiId"
								class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							>
								<option value="">- Pilih pembimbing -</option>
								{#each data.pegawaiList as item (item.id)}
									<option value={item.id}>{item.nama}</option>
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

					<label class="block w-full">
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Nomor SK Penugasan
						</span>
						<input
							type="text"
							name="skPenugasan"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
							autocomplete="off"
						/>
					</label>

					<div class="grid grid-cols-2 gap-3">
						<label class="block w-full">
							<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Tanggal Mulai
							</span>
							<input
								type="date"
								name="tanggalMulai"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							/>
						</label>
						<label class="block w-full">
							<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Tanggal Selesai
							</span>
							<input
								type="date"
								name="tanggalSelesai"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							/>
						</label>
					</div>

					<label class="block w-full">
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Lokasi
						</span>
						<input
							type="text"
							name="lokasi"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
							autocomplete="off"
						/>
					</label>

					<label class="block w-full">
						<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Catatan
						</span>
						<textarea
							name="catatan"
							class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
							rows="2"></textarea>
					</label>
				</div>
			</FormEnhance>

			<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={() => (kelompokModalOpen = false)}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					Batal
				</button>
				<button
					type="submit"
					form="form-tambah-kelompok"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
					disabled={kelompokSubmitting}
				>
					<Icon name="save" class="h-3.5 w-3.5" />
					Simpan
				</button>
			</div>
		</dialog>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button
				type="submit"
				onclick={(event) => {
					event.preventDefault();
					kelompokModalOpen = false;
				}}
			>
				tutup
			</button>
		</form>
	</div>
{/if}

<!-- ==================== Tambah Perusahaan Modal ==================== -->
{#if perusahaanModalOpen}
	<div
		class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		onkeydown={(event) => {
			if (event.key === 'Escape') perusahaanModalOpen = false;
		}}
	>
		<dialog
			class="modal-box relative z-10 max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
			open
			aria-modal="true"
		>
			<div class="border-b border-slate-100 pb-3 dark:border-zinc-800">
				<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">Tambah Perusahaan</h3>
			</div>

			<FormEnhance
				id="form-tambah-perusahaan"
				action="?/tambahPerusahaan"
				submitStateChange={(v) => (perusahaanSubmitting = v)}
				onsuccess={({ form }) => {
					form.reset();
					suksesTutupModal();
				}}
			>
				{#snippet children({ invalid })}
					<div class="mt-4 space-y-3">
						<label class="block w-full">
							<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Nama Perusahaan *
							</span>
							<input
								type="text"
								name="nama"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								required
								autocomplete="off"
								aria-invalid={invalid}
							/>
						</label>
						<label class="block w-full">
							<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Alamat
							</span>
							<input
								type="text"
								name="alamat"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								autocomplete="off"
							/>
						</label>
						<label class="block w-full">
							<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Bidang Usaha
							</span>
							<input
								type="text"
								name="bidangUsaha"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								autocomplete="off"
							/>
						</label>
						<div class="grid grid-cols-2 gap-3">
							<label class="block w-full">
								<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
									Pembimbing
								</span>
								<input
									type="text"
									name="pembimbing"
									class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
									autocomplete="off"
								/>
							</label>
							<label class="block w-full">
								<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
									Telepon
								</span>
								<input
									type="tel"
									name="telepon"
									class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								/>
							</label>
						</div>
					</div>
				{/snippet}
			</FormEnhance>

			<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={() => (perusahaanModalOpen = false)}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					Batal
				</button>
				<button
					type="submit"
					form="form-tambah-perusahaan"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
					disabled={perusahaanSubmitting}
				>
					<Icon name="save" class="h-3.5 w-3.5" />
					Simpan
				</button>
			</div>
		</dialog>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button
				type="submit"
				onclick={(event) => {
					event.preventDefault();
					perusahaanModalOpen = false;
				}}
			>
				tutup
			</button>
		</form>
	</div>
{/if}

<!-- ==================== Hapus Confirm Modal ==================== -->
{#if confirmDelete}
	<div
		class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		onkeydown={(event) => {
			if (event.key === 'Escape') tutupConfirm();
		}}
	>
		<dialog
			class="modal-box relative z-10 max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
			open
			aria-modal="true"
		>
			<span
				class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
			>
				<Icon name="warning" class="h-5 w-5" />
			</span>
			<h3 class="mt-3 text-base font-bold text-slate-900 dark:text-zinc-100">
				{confirmDelete.title}
			</h3>
			<p class="mt-1.5 text-xs text-slate-600 dark:text-zinc-400">{confirmDelete.message}</p>

			<FormEnhance
				id="form-hapus-prakerin"
				action={confirmDeleteAction}
				submitStateChange={(v) => (hapusSubmitting = v)}
				onsuccess={() => {
					suksesTutupModal();
				}}
			>
				<input name="id" value={confirmDeleteId} hidden />
			</FormEnhance>

			<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={tutupConfirm}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					Batal
				</button>
				<button
					type="submit"
					form="form-hapus-prakerin"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-4 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
					disabled={hapusSubmitting}
				>
					<Icon name="del" class="h-3.5 w-3.5" />
					Hapus
				</button>
			</div>
		</dialog>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button
				type="submit"
				onclick={(event) => {
					event.preventDefault();
					tutupConfirm();
				}}
			>
				tutup
			</button>
		</form>
	</div>
{/if}
