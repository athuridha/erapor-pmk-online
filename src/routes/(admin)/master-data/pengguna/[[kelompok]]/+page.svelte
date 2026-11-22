<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { buildPageNumbers, OPSI_BARIS_PER_HALAMAN } from '$lib/utils/pagination';
	import { modalRoute } from '$lib/utils';
	import PenggunaModals from '$lib/components/pengguna/modals.svelte';
	import { selectAll, semuaTerpilih, toggleId } from '$lib/utils/bulk-select';

	type Baris = {
		id: number;
		nama: string;
		role: string;
		rawType: string;
		operatorLevel?: string | null;
		username: string;
		pegawaiId?: number | null;
		bisaHapus: boolean;
		nik: string | null;
		nik_username: string;
		kelasDiampu: string | null;
		waliKelas: string | null;
		mapel: string | null;
		ekskulDibina?: string | null;
		izin: number;
		dibuat: string | null;
	};

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.filter?.q ?? '');
	let terpilih = $state<number[]>([]);
	let hapusId = $state<number | null>(null);
	let tambahTerbuka = $state(false);
	let imporTerbuka = $state(false);
	let sandiImport = $state<'username' | 'tetap'>('username');
	let sandiTetap = $state('');
	let wajibGantiImport = $state(true);
	let perbaruiNamaImport = $state(false);
	let namaFileImport = $state('');
	let submittingImpor = $state(false);
	let roleBaru = $state<'user' | 'wali_kelas' | 'pembina_eskul' | 'admin' | 'kepala_sekolah'>(
		'user'
	);
	let kelasBaru = $state('');
	let mapelBaru = $state('');

	const kelompokKey = $derived(String(data.kelompok?.key ?? 'semua'));
	const roleOpsi = $derived.by(() => {
		if (kelompokKey === 'operator') {
			return [
				{ value: 'admin', label: 'Admin' },
				{ value: 'kepala_sekolah', label: 'Kepala Sekolah' }
			];
		}
		if (kelompokKey === 'pembina-eskul') {
			return [{ value: 'pembina_eskul', label: 'Pembina Eskul (Eksternal)' }];
		}
		if (kelompokKey === 'guru') {
			return [
				{ value: 'user', label: 'Guru' },
				{ value: 'wali_kelas', label: 'Wali Kelas' },
				{ value: 'pembina_eskul', label: 'Pembina Eskul (Eksternal)' }
			];
		}
		return [
			{ value: 'user', label: 'Guru' },
			{ value: 'wali_kelas', label: 'Wali Kelas' },
			{ value: 'pembina_eskul', label: 'Pembina Eskul (Eksternal)' },
			{ value: 'admin', label: 'Admin' },
			{ value: 'kepala_sekolah', label: 'Kepala Sekolah' }
		];
	});
	const baris = $derived((data.baris ?? []) as Baris[]);
	const daftarKelas = $derived(
		(data.daftarKelas ?? []) as Array<{ id: number; nama: string; fase: string | null }>
	);
	const daftarMapel = $derived(
		(data.daftarMapel ?? []) as Array<{ id: number; nama: string; kelasId: number }>
	);
	/**
	 * Opsi Mata Pelajaran untuk dialog Tambah Akun.
	 *
	 * Tabel mata_pelajaran menyimpan satu baris per kelas, sehingga daftar
	 * mentah menampilkan mapel yang sama sampai 20× tanpa keterangan kelas.
	 * Di sini mapel dikelompokkan per nama:
	 * - bila Kelas sudah dipilih → hanya mapel kelas itu (id spesifik kelas),
	 * - bila belum → satu opsi per nama + jumlah kelas, id baris pertama.
	 */
	const mapelOpsi = $derived.by(() => {
		const sumber = kelasBaru
			? daftarMapel.filter((m) => String(m.kelasId) === String(kelasBaru))
			: daftarMapel;
		const perNama = new Map<string, { value: number; nama: string; jumlahKelas: number }>();
		for (const mapel of sumber) {
			const ada = perNama.get(mapel.nama);
			if (ada) ada.jumlahKelas += 1;
			else perNama.set(mapel.nama, { value: mapel.id, nama: mapel.nama, jumlahKelas: 1 });
		}
		return [...perNama.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
	});
	const total = $derived(data.total ?? 0);
	const totalHalaman = $derived(data.totalHalaman ?? 1);
	const perHalaman = $derived(data.perHalaman ?? 50);
	const halamanSekarang = $derived(data.filter?.page ?? 1);
	const nomorHalaman = $derived(buildPageNumbers(halamanSekarang, totalHalaman));
	const idsHalaman = $derived(baris.map((row) => row.id));

	const rekapRole = $derived.by(() => {
		const map = new Map<string, number>();
		for (const row of baris) map.set(row.role, (map.get(row.role) ?? 0) + 1);
		return [...map.entries()].sort((a, b) => b[1] - a[1]);
	});

	async function applySearch(value: string) {
		const params = new URLSearchParams(page.url.search);
		if (value.trim()) params.set('q', value.trim());
		else params.delete('q');
		params.delete('page');
		const query = params.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, { keepFocus: true });
	}

	async function gotoPage(pageNumber: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('page', String(pageNumber));
		await goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	}

	async function gotoPerHalaman(jumlah: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('per_page', String(jumlah));
		params.delete('page');
		await goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	}

	function formatTanggal(value: string | null | undefined): string {
		if (!value) return '-';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(parsed);
	}

	async function handleSimpan({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:master-data');
		terpilih = [];
		hapusId = null;
		tambahTerbuka = false;
		imporTerbuka = false;
		namaFileImport = '';
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Tersimpan',
			type: 'success'
		});
	}

	/** Penolakan hapus akun (masih berelasi) harus tampil sebagai pesan, bukan diam (B5). */
	function handleGagalHapus({ data: hasil }: { data?: Record<string, unknown> }) {
		toast({
			message:
				typeof hasil?.fail === 'string'
					? hasil.fail
					: typeof hasil?.message === 'string'
						? hasil.message
						: 'Akun gagal dihapus.',
			type: 'warning',
			persist: true
		});
	}

	function tutupImpor() {
		sandiImport = 'username';
		sandiTetap = '';
		wajibGantiImport = true;
		perbaruiNamaImport = false;
		namaFileImport = '';
		imporTerbuka = false;
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-zinc-800"
	>
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-3">
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					{kelompokKey === 'semua' ? 'Akun Pengguna' : `Akun Pengguna: ${data.kelompok.judul}`}
				</h1>
				<div
					class="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
				>
					<a
						href="/master-data/pengguna"
						class="rounded-lg px-3 py-1 text-xs font-semibold transition-colors {kelompokKey ===
						'semua'
							? 'bg-blue-600 text-white shadow-sm'
							: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-zinc-100'}"
					>
						Semua
					</a>
					<a
						href="/master-data/pengguna/guru"
						class="rounded-lg px-3 py-1 text-xs font-semibold transition-colors {kelompokKey ===
						'guru'
							? 'bg-blue-600 text-white shadow-sm'
							: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-zinc-100'}"
					>
						Guru
					</a>
					<a
						href="/master-data/pengguna/operator"
						class="rounded-lg px-3 py-1 text-xs font-semibold transition-colors {kelompokKey ===
						'operator'
							? 'bg-blue-600 text-white shadow-sm'
							: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-zinc-100'}"
					>
						Operator
					</a>
					<a
						href="/master-data/pengguna/pembina-eskul"
						class="rounded-lg px-3 py-1 text-xs font-semibold transition-colors {kelompokKey ===
						'pembina-eskul'
							? 'bg-blue-600 text-white shadow-sm'
							: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-zinc-100'}"
					>
						Pembina Eskul
					</a>
				</div>
			</div>
			<p class="mt-1 block max-w-2xl text-xs text-slate-600 dark:text-zinc-400">
				{data.kelompok.deskripsi}
			</p>
		</div>
		<div class="flex shrink-0 flex-wrap items-center gap-2">
			{#if terpilih.length}
				<FormEnhance
					action="?/hapusMassal"
					showToast={false}
					onsuccess={handleSimpan}
					onfailure={handleGagalHapus}
				>
					{#snippet children({ submitting })}
						<input type="hidden" name="ids" value={JSON.stringify(terpilih)} />
						<button
							type="submit"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50"
							disabled={submitting}
						>
							<Icon name="del" class="h-4 w-4" />
							Hapus {terpilih.length} Terpilih
						</button>
					{/snippet}
				</FormEnhance>
			{/if}
			{#if kelompokKey === 'semua' || kelompokKey === 'guru'}
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={() => (imporTerbuka = true)}
				>
					<Icon name="import" class="h-4 w-4" />
					Impor Daftar Guru
				</button>
			{/if}
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
				onclick={() => {
					roleBaru =
						kelompokKey === 'operator'
							? 'admin'
							: kelompokKey === 'pembina-eskul'
								? 'pembina_eskul'
								: 'user';
					kelasBaru = '';
					mapelBaru = '';
					tambahTerbuka = true;
				}}
			>
				<Icon name="plus" class="h-4 w-4" />
				Tambah Akun
			</button>
		</div>
	</div>

	<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
		<div class="flex w-full items-center gap-2 sm:max-w-md">
			<div class="relative flex-1">
				<span
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
				>
					<Icon name="search" class="h-4 w-4" />
				</span>
				<input
					type="search"
					name="q"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
					bind:value={searchTerm}
					spellcheck="false"
					placeholder="Cari nama, NIK, atau username..."
					autocomplete="off"
					onchange={(event) => applySearch((event.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="relative flex shrink-0 items-center">
				<select
					class="h-9 appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					value={perHalaman}
					title="Baris per halaman"
					onchange={(event) =>
						gotoPerHalaman(Number((event.currentTarget as HTMLSelectElement).value))}
				>
					{#each OPSI_BARIS_PER_HALAMAN as jumlah (jumlah)}
						<option value={jumlah}>{jumlah} / hal</option>
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
		<div class="flex flex-wrap items-center gap-1.5">
			{#each rekapRole as [role, jumlah] (role)}
				<span
					class="inline-flex items-center rounded-md border border-blue-200/70 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 tabular-nums dark:border-blue-800/60 dark:bg-blue-950/50 dark:text-blue-300"
				>
					{role}: {jumlah}
				</span>
			{/each}
		</div>
	</div>

	<div
		class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th style="width: 48px; min-width: 40px;" class="px-3 py-2.5 text-center">
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							checked={semuaTerpilih(idsHalaman, terpilih)}
							onchange={(event) =>
								(terpilih = selectAll(
									idsHalaman,
									(event.currentTarget as HTMLInputElement).checked
								))}
						/>
					</th>
					<th style="min-width: 150px;" class="px-3 py-2.5">NIK / Username</th>
					<th style="min-width: 200px;" class="px-3 py-2.5">Nama</th>
					<th style="min-width: 110px;" class="px-3 py-2.5">Role</th>
					<th style="min-width: 120px;" class="px-3 py-2.5">Wali Kelas</th>
					<th style="min-width: 120px;" class="px-3 py-2.5">Kelas Diampu</th>
					<th style="min-width: 130px;" class="px-3 py-2.5">Mata Pelajaran</th>
					<th class="hidden px-3 py-2.5 text-center xl:table-cell" style="width: 100px;"
						>Hak Akses</th
					>
					<th class="hidden px-3 py-2.5 xl:table-cell" style="min-width: 110px;">Dibuat</th>
					<th class="px-3 py-2.5 text-center" style="width: 200px;">Aksi</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
				{#each baris as row (row.id)}
					<tr
						class={terpilih.includes(row.id)
							? 'bg-blue-50/70 dark:bg-blue-950/30'
							: 'transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50'}
					>
						<td class="px-3 py-2.5 text-center">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={terpilih.includes(row.id)}
								disabled={!row.bisaHapus}
								onchange={(event) =>
									(terpilih = toggleId(
										terpilih,
										row.id,
										(event.currentTarget as HTMLInputElement).checked
									))}
							/>
						</td>
						<td class="px-3 py-2.5 whitespace-nowrap">
							{#if row.nik}
								<div class="font-mono text-xs font-medium text-slate-900 dark:text-zinc-100">
									{row.nik}
								</div>
								<div class="text-[11px] text-slate-500 dark:text-zinc-400">@{row.username}</div>
							{:else if row.rawType === 'pembina_eskul'}
								<div class="text-[11px] font-medium text-blue-600 dark:text-blue-400">
									Pembina Eksternal
								</div>
								<div class="font-mono text-xs text-slate-800 dark:text-zinc-200">
									@{row.username}
								</div>
							{:else}
								<div class="text-[11px] italic text-slate-500 dark:text-zinc-400">
									NIK belum diisi
								</div>
								<div class="font-mono text-xs text-slate-800 dark:text-zinc-200">
									@{row.username}
								</div>
							{/if}
						</td>
						<td class="px-3 py-2.5">
							<span class="font-medium text-slate-900 dark:text-zinc-100">{row.nama}</span>
						</td>
						<td class="px-3 py-2.5">
							<div class="flex flex-wrap items-center gap-1">
								<span
									class="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
								>
									{row.role}
								</span>
								{#if row.operatorLevel}
									<span
										class="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
									>
										{row.operatorLevel === 'kepala_sekolah' ? 'Kepala Sekolah' : 'Admin'}
									</span>
								{/if}
							</div>
						</td>
						<td class="px-3 py-2.5">
							{#if row.waliKelas}
								<span
									class="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
								>
									{row.waliKelas}
								</span>
							{:else}
								<span class="text-slate-400 dark:text-zinc-500">-</span>
							{/if}
						</td>
						<td class="px-3 py-2.5 text-slate-700 dark:text-zinc-300">
							{#if row.kelasDiampu}
								{row.kelasDiampu}
							{:else}
								<span class="text-slate-400 dark:text-zinc-500">-</span>
							{/if}
						</td>
						<td class="px-3 py-2.5 text-slate-700 dark:text-zinc-300">
							{#if row.mapel || row.ekskulDibina}
								<div class="flex flex-wrap items-center gap-1">
									{#if row.mapel}
										<span>{row.mapel}</span>
									{/if}
									{#if row.ekskulDibina}
										<span
											class="inline-flex items-center rounded-md border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
										>
											Eskul: {row.ekskulDibina}
										</span>
									{/if}
								</div>
							{:else}
								-
							{/if}
						</td>
						<td
							class="hidden px-3 py-2.5 text-center tabular-nums text-slate-700 xl:table-cell dark:text-zinc-300"
						>
							{row.izin}
						</td>
						<td
							class="hidden px-3 py-2.5 whitespace-nowrap tabular-nums text-slate-600 xl:table-cell dark:text-zinc-400"
						>
							{formatTanggal(row.dibuat)}
						</td>
						<td class="px-3 py-2.5">
							<div class="flex items-center justify-center gap-1.5">
								{#if hapusId === row.id}
									<FormEnhance
										action="?/hapus"
										showToast={false}
										onsuccess={handleSimpan}
										onfailure={handleGagalHapus}
									>
										{#snippet children({ submitting })}
											<input type="hidden" name="id" value={row.id} />
											<div class="flex items-center justify-center gap-1.5">
												<button
													type="submit"
													class="inline-flex h-7 items-center rounded-lg bg-red-600 px-2.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
													disabled={submitting}
												>
													Ya
												</button>
												<button
													type="button"
													class="inline-flex h-7 items-center rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
													onclick={() => (hapusId = null)}
												>
													Batal
												</button>
											</div>
										{/snippet}
									</FormEnhance>
								{:else}
									<a
										class="inline-flex h-8 items-center gap-1 rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium whitespace-nowrap text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
										href={`/pengguna/${row.id}`}
									>
										<Icon name="eye" class="h-3.5 w-3.5" />
										Kelola
									</a>
									{#if row.pegawaiId}
										<a
											class="inline-flex h-8 items-center gap-1 rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium whitespace-nowrap text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
											href={`/master-data/pegawai/${row.pegawaiId}`}
											use:modalRoute={'profil-guru'}
										>
											<Icon name="edit" class="h-3.5 w-3.5" />
											Profil
										</a>
									{:else}
										<a
											class="inline-flex h-8 items-center gap-1 rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium whitespace-nowrap text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
											href={`/pengguna/form/${row.id}`}
										>
											<Icon name="edit" class="h-3.5 w-3.5" />
											Ubah akun
										</a>
									{/if}
									<button
										type="button"
										class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50"
										title={row.bisaHapus ? 'Hapus akun' : 'Akun utama admin tidak bisa dihapus'}
										aria-disabled={!row.bisaHapus}
										disabled={!row.bisaHapus}
										onclick={() => (hapusId = row.id)}
									>
										<Icon name="del" class="h-3.5 w-3.5" />
									</button>
								{/if}
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td
							class="p-8 text-center text-xs italic text-slate-500 dark:text-zinc-400"
							colspan="10"
						>
							{kelompokKey === 'semua'
								? 'Belum ada akun pengguna.'
								: `Belum ada akun ${data.kelompok.judul.toLowerCase()}.`}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if totalHalaman > 1}
		<div class="mt-4 flex flex-wrap items-center justify-center gap-1">
			<button
				type="button"
				class="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
				disabled={halamanSekarang <= 1}
				onclick={() => gotoPage(halamanSekarang - 1)}
			>
				&laquo;
			</button>
			{#each nomorHalaman as nomor, index (index)}
				{#if nomor === '…'}
					<span class="inline-flex h-8 items-center px-1.5 text-xs text-slate-500">...</span>
				{:else}
					<button
						type="button"
						class="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border px-2.5 text-xs font-semibold tabular-nums transition-colors {nomor ===
						halamanSekarang
							? 'border-blue-600 bg-blue-600 text-white shadow-sm'
							: 'border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
						onclick={() => gotoPage(nomor)}
					>
						{nomor}
					</button>
				{/if}
			{/each}
			<button
				type="button"
				class="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
				disabled={halamanSekarang >= totalHalaman}
				onclick={() => gotoPage(halamanSekarang + 1)}
			>
				&raquo;
			</button>
		</div>
	{/if}

	<p class="mt-3 text-center text-xs text-slate-500 tabular-nums dark:text-zinc-400">
		Menampilkan {baris.length} dari {total} akun
	</p>
</div>

{#if imporTerbuka}
	<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open onclose={tutupImpor}>
		<div
			class="modal-box flex max-h-[85vh] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:max-w-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="mb-2 shrink-0 text-lg font-bold">Impor Daftar Guru</h3>

			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-0.5">
				<p class="text-xs text-slate-600 dark:text-zinc-400">
					Unggah file Excel (.xlsx) atau CSV dengan kolom <strong>Pengguna/Password</strong> dan
					<strong>Nama</strong>. Akun yang sudah ada akan dilewati.
				</p>

				<div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
					<table class="w-full border-collapse text-xs">
						<thead>
							<tr
								class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
							>
								<th class="px-3 py-2">Pengguna/Password</th>
								<th class="px-3 py-2">Nama</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
							<tr>
								<td class="px-3 py-2 font-mono font-medium">201207002</td>
								<td class="px-3 py-2">Asmin Mulyana, S.Kom., M.M.</td>
							</tr>
							<tr>
								<td class="px-3 py-2 font-mono font-medium">201207003</td>
								<td class="px-3 py-2">Oos Bukhori, S.Pd., M.M.</td>
							</tr>
						</tbody>
					</table>
				</div>

				<FormEnhance
					id="form-impor-guru"
					action="?/imporGuru"
					enctype="multipart/form-data"
					showToast={false}
					onsuccess={handleSimpan}
					submitStateChange={(submitting) => (submittingImpor = submitting)}
				>
					{#snippet children({ submitting })}
						<div class="space-y-4">
							<div>
								<label
									class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
									for="impor-guru-file"
								>
									Pilih file daftar guru
								</label>
								<input
									id="impor-guru-file"
									name="file"
									type="file"
									accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
									class="w-full cursor-pointer rounded-xl border border-dashed border-[#7e8b9b] bg-slate-50 px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
									required
									disabled={submitting}
									onchange={(event) =>
										(namaFileImport =
											(event.currentTarget as HTMLInputElement).files?.[0]?.name ?? '')}
								/>
								<p class="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">
									Maksimal 2 MB. Pastikan kolom <strong>Pengguna/Password</strong> dan
									<strong>Nama</strong> tersedia.
									{#if namaFileImport}
										<span class="font-medium text-slate-900 dark:text-zinc-100">
											Dipilih: <strong>{namaFileImport}</strong>
										</span>
									{/if}
								</p>
							</div>

							<div>
								<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
									Kata sandi awal
								</span>
								<div class="relative flex items-center">
									<select
										name="sandi"
										class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
										disabled={submitting}
										onchange={(event) =>
											(sandiImport = event.currentTarget.value as 'username' | 'tetap')}
									>
										<option value="username" selected={sandiImport === 'username'}>
											Sama dengan username
										</option>
										<option value="tetap" selected={sandiImport === 'tetap'}>
											Sama untuk semua
										</option>
									</select>
									<span
										aria-hidden="true"
										class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
									>
										<Icon name="down" class="h-3.5 w-3.5" />
									</span>
								</div>
								{#if sandiImport === 'tetap'}
									<input
										name="sandi_tetap"
										type="text"
										class="mt-2 h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
										bind:value={sandiTetap}
										placeholder="Kata sandi bersama, minimal 8 karakter"
										disabled={submitting}
									/>
								{/if}
							</div>

							<div class="space-y-2">
								<span class="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
									Opsi lainnya
								</span>
								<label
									class="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-zinc-300"
								>
									<input
										type="checkbox"
										name="wajib_ganti"
										class="checkbox checkbox-sm"
										value="ya"
										checked={wajibGantiImport}
										disabled={submitting}
										onchange={(event) =>
											(wajibGantiImport = (event.currentTarget as HTMLInputElement).checked)}
									/>
									<span>Wajib ganti kata sandi saat login pertama</span>
								</label>
								<label
									class="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-zinc-300"
								>
									<input
										type="checkbox"
										name="perbarui_nama"
										class="checkbox checkbox-sm"
										value="ya"
										checked={perbaruiNamaImport}
										disabled={submitting}
										onchange={(event) =>
											(perbaruiNamaImport = (event.currentTarget as HTMLInputElement).checked)}
									/>
									<span>Perbarui nama akun yang sudah ada</span>
								</label>
							</div>
						</div>
					{/snippet}
				</FormEnhance>
			</div>

			<div
				class="mt-4 flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800"
			>
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={tutupImpor}
					disabled={submittingImpor}
				>
					Batal
				</button>
				<button
					type="submit"
					form="form-impor-guru"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={submittingImpor || !namaFileImport}
				>
					{#if submittingImpor}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon name="import" class="h-4 w-4" /> Impor
					{/if}
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button>Batal</button>
		</form>
	</dialog>
{/if}

{#if tambahTerbuka}
	<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open>
		<div
			class="modal-box max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="mb-4 text-lg font-bold">
				Tambah Akun {kelompokKey === 'semua' ? 'Pengguna' : data.kelompok.judul}
			</h3>

			<FormEnhance action="?/tambah" showToast={false} onsuccess={handleSimpan}>
				{#snippet children({ submitting, invalid })}
					{@const isEducatorRole = roleBaru === 'user' || roleBaru === 'wali_kelas'}
					<div class="grid gap-3.5 sm:grid-cols-2">
						<label class="block sm:col-span-2">
							<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
								Nama Lengkap <span class="text-red-600 dark:text-red-400">*</span>
							</span>
							<input
								name="nama"
								type="text"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Nama lengkap pengguna"
								required
								disabled={submitting}
							/>
						</label>
						{#if roleBaru === 'pembina_eskul'}
							<div
								class="rounded-xl border border-blue-200/80 bg-blue-50/75 p-3 text-xs text-blue-950 sm:col-span-2 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
							>
								Pembina Eskul eksternal login menggunakan <strong>Nama Pengguna</strong>, hanya bisa
								mengatur TP &amp; menilai ekstrakurikuler binaan, serta tidak masuk daftar pegawai
								atau presensi guru.
							</div>
						{:else}
							<label class="block">
								<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
									NIK (opsional)
								</span>
								<input
									name="nik"
									type="text"
									inputmode="numeric"
									maxlength="16"
									class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
									placeholder="16 digit NIK"
									disabled={submitting}
								/>
							</label>
						{/if}
						<label class="block {roleBaru === 'pembina_eskul' ? 'sm:col-span-2' : ''}">
							<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
								Role
							</span>
							<div class="relative flex items-center">
								<select
									name="type"
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									disabled={submitting}
									onchange={(event) => (roleBaru = event.currentTarget.value as typeof roleBaru)}
								>
									{#each roleOpsi as opsi (opsi.value)}
										<option value={opsi.value} selected={roleBaru === opsi.value}>
											{opsi.label}
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
						</label>
						<label class="block">
							<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
								Nama Pengguna <span class="text-red-600 dark:text-red-400">*</span>
							</span>
							<input
								name="username"
								type="text"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Username untuk login"
								required
								disabled={submitting}
							/>
						</label>
						<label class="block">
							<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
								Kata Sandi <span class="text-red-600 dark:text-red-400">*</span>
							</span>
							<input
								name="password"
								type="password"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Minimal 8 karakter"
								required
								disabled={submitting}
							/>
						</label>
						{#if isEducatorRole}
							<label class="block">
								<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
									Kelas
								</span>
								<div class="relative flex items-center">
									<select
										name="kelas_id"
										class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
										disabled={submitting}
										onchange={(event) => {
											kelasBaru = event.currentTarget.value;
											mapelBaru = '';
										}}
									>
										<option value="">Tidak ditentukan</option>
										{#each daftarKelas as kelas (kelas.id)}
											<option value={kelas.id} selected={kelasBaru === String(kelas.id)}>
												{kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama}
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
							</label>
							<label class="block">
								<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
									Mata Pelajaran
								</span>
								<div class="relative flex items-center">
									<select
										name="mata_pelajaran_id"
										class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
										disabled={submitting}
										onchange={(event) => (mapelBaru = event.currentTarget.value)}
									>
										<option value="">Tidak ditentukan</option>
										{#each mapelOpsi as mapel (mapel.nama)}
											<option value={mapel.value} selected={mapelBaru === String(mapel.value)}>
												{kelasBaru ? mapel.nama : `${mapel.nama} (${mapel.jumlahKelas} kelas)`}
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
								<span class="mt-1 block text-[11px] text-slate-500 dark:text-zinc-400">
									{kelasBaru
										? 'Mapel dari kelas yang dipilih.'
										: 'Pilih kelas dulu untuk daftar mapel spesifik kelas; tanpa kelas, nama mapel digabung dari semua kelas.'}
								</span>
							</label>
							<label class="block sm:col-span-2">
								<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
									Level Operator (opsional)
								</span>
								<div class="relative flex items-center">
									<select
										name="operator_level"
										class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
										disabled={submitting}
									>
										<option value="">Tidak ada</option>
										<option value="admin">Admin (akses operator penuh)</option>
										<option value="kepala_sekolah">Kepala Sekolah (tanpa fitur global)</option>
									</select>
									<span
										aria-hidden="true"
										class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
									>
										<Icon name="down" class="h-3.5 w-3.5" />
									</span>
								</div>
								<span class="mt-1 block text-[11px] text-slate-500 dark:text-zinc-400">
									Beri akses operator kepada guru tanpa mengubah peran utamanya.
								</span>
							</label>
						{/if}
					</div>

					<div
						class="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800"
					>
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (tambahTerbuka = false)}
							disabled={submitting}
						>
							<Icon name="close" class="h-4 w-4" />
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={submitting || invalid}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								<Icon name="save" class="h-4 w-4" />
							{/if}
							Simpan Akun
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<div class="modal-backdrop bg-transparent">
			<button type="button" onclick={() => (tambahTerbuka = false)}>close</button>
		</div>
	</dialog>
{/if}

<PenggunaModals />
