<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import {
		agamaMapelNames,
		agamaParentName,
		pksMapelNames,
		pksParentName,
		jenisMapel
	} from '$lib/statics';

	const AGAMA_MAPEL_NAME_SET = new Set<string>(agamaMapelNames);
	const PKS_MAPEL_NAME_SET = new Set<string>(pksMapelNames);

	type KelasLite = {
		id?: number;
		nama?: string;
		fase?: string | null;
	};

	type FormMapel = {
		id?: number;
		nama?: string;
		namaLokal?: string | null;
		jenis?: MataPelajaran['jenis'];
		kkm?: number | null;
		kode?: string | null;
		kelas?: KelasLite | null;
	} & Record<string, unknown>;

	type FormData = {
		mode?: 'add' | 'edit';
		mapel?: FormMapel | null;
		kelasAktif?: KelasLite | null;
		daftarKelas?: Array<{ id: number; nama: string; fase?: string | null }>;
		dapodikMapelList?: Array<{ nama: string; kode: string | null }>;
		indukList?: Array<{ nama: string; pembelajaranId: string }>;
	} & Record<string, unknown>;

	let { data }: { data: FormData } = $props();
	const mode: 'add' | 'edit' = $derived(data?.mode === 'edit' ? 'edit' : 'add');
	const mapel = $derived(data?.mapel ?? null);
	const kelasAktif = $derived(data?.kelasAktif ?? mapel?.kelas ?? null);
	const daftarKelas = $derived(data?.daftarKelas ?? []);

	// svelte-ignore state_referenced_locally
	let terpilihKelasIds = $state<number[]>(
		kelasAktif?.id
			? [kelasAktif.id]
			: mode === 'add'
				? (data.daftarKelas ?? []).map((kelas) => kelas.id)
				: []
	);

	const kelasAktifLabel = $derived(
		kelasAktif
			? kelasAktif.fase
				? `${kelasAktif.nama} - ${kelasAktif.fase}`
				: kelasAktif.nama
			: 'Belum ada kelas aktif'
	);
	const isAgamaGroup = $derived(!!mapel?.nama && AGAMA_MAPEL_NAME_SET.has(mapel.nama));
	const isAgamaParent = $derived(!!mapel?.nama && mapel.nama === agamaParentName);
	const isPksGroup = $derived(!!mapel?.nama && PKS_MAPEL_NAME_SET.has(mapel.nama));
	const isPksParent = $derived(!!mapel?.nama && mapel.nama === pksParentName);
	const disableNama = $derived(mode === 'edit' && (isAgamaGroup || isPksGroup));
	const disableJenis = $derived(mode === 'edit' && isAgamaGroup);
	const formAction = $derived(mode === 'edit' ? '?/update' : '?/add');
	const invalidateTargets = $derived(
		mode === 'edit'
			? ['app:mapel', 'app:mapel_tp-rl', 'app:asesmen-sumatif']
			: ['app:mapel', 'app:asesmen-sumatif']
	);
	const formInit = $derived(
		mode === 'edit' && mapel
			? {
					nama: mapel.nama,
					nama_lokal: mapel.namaLokal ?? '',
					kkm: mapel.kkm ?? '',
					jenis: mapel.jenis,
					kode: mapel.kode ?? ''
				}
			: undefined
	);
	function initialKode(): string {
		if (mode === 'edit' && isAgamaGroup) return 'PAPB';
		if (mode === 'edit' && isPksGroup) return 'PKS';
		return mapel?.kode ?? '';
	}
	let localKode = $state(initialKode());

	// Dapatkan jenjang varian dari sekolah (misalnya 'SMK')
	const jenjangVariant = $derived.by(() => {
		const sekolah = page.data.sekolah as { jenjangVariant?: string | null } | null | undefined;
		return sekolah?.jenjangVariant ?? null;
	});

	// Fungsi untuk mendapatkan label jenis mapel yang dinamis berdasarkan jenjang
	function getJenisMapelLabel(jenis: string): string {
		if (jenis === 'wajib' && jenjangVariant?.toUpperCase() === 'SMK') {
			return 'Mata Pelajaran Umum';
		}
		return jenisMapel[jenis as MataPelajaran['jenis']] ?? jenis;
	}

	// Derive displayable jenis mapel options
	const displayJenisMapel = $derived.by(() => {
		const result: Record<string, string> = {};
		for (const key of Object.keys(jenisMapel)) {
			// "belum_dipetakan" hanya untuk hasil tarikan Dapodik — tidak bisa dipilih manual.
			if (key === 'belum_dipetakan') {
				continue;
			}
			// Sembunyikan opsi "kejuruan" jika bukan SMK
			if (key === 'kejuruan' && jenjangVariant?.toUpperCase() !== 'SMK') {
				continue;
			}
			// Sembunyikan opsi "pemberdayaan" jika bukan PKBM/SKB
			if (
				key === 'pemberdayaan' &&
				!['PKBM', 'SKB'].includes(jenjangVariant?.toUpperCase() ?? '')
			) {
				continue;
			}
			result[key] = getJenisMapelLabel(key);
		}
		return result;
	});

	function applyNamaRules(v: string) {
		if (AGAMA_MAPEL_NAME_SET.has(v)) {
			localKode = 'PAPB';
		} else if (PKS_MAPEL_NAME_SET.has(v)) {
			localKode = 'PKS';
		} else if (mode !== 'edit') {
			if (localKode === 'PAPB' || localKode === 'PKS') localKode = '';
		}
	}

	function onNamaInput(e: Event) {
		applyNamaRules(((e.target as HTMLInputElement)?.value ?? '').trim());
	}
	/**
	 * Ada kelas tujuan? Mode tambah bisa dijalankan dari mode "Semua Kelas"
	 * (kelasAktif null) asalkan pengguna mencentang kelas di fieldset di atas.
	 * Sebelumnya KKM/kode & tombol Simpan dikunci oleh `!kelasAktif` sehingga
	 * form tidak pernah bisa disimpan bila tidak ada kelas aktif.
	 */
	const adaKelasTujuan = $derived(
		mode === 'edit' ? Boolean(kelasAktif?.id) : terpilihKelasIds.length > 0
	);
	const heading = $derived(mode === 'edit' ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran');
	const namaPlaceholder = $derived(
		mode === 'edit' && isAgamaParent
			? 'Pendidikan Agama dan Budi Pekerti'
			: 'Contoh: Ilmu Pengetahuan Alam dan Sosial'
	);
	// Ada referensi Dapodik di DB (hasil Sinkronisasi) → mode tambah memakai select.
	const dapodikMapelOptions = $derived(data.dapodikMapelList ?? []);
	const pakaiSelectDapodik = $derived(dapodikMapelOptions.length > 0);
	// Kandidat pembelajaran induk (terdaftar di Dapodik) untuk Sub Pembelajaran.
	const indukList = $derived(data.indukList ?? []);
	// Combobox pencarian nama mapel (input + dropdown hasil filter).
	// Combobox pencarian nama mapel (input + dropdown hasil filter).
	// Mode edit diseed dengan nama mapel saat ini agar combobox konsisten
	// dengan mode tambah (keduanya memakai daftar Dapodik). Seed sekali saat
	// mount — modal di-{#key} per data sehingga aman.
	// svelte-ignore state_referenced_locally
	let namaQuery = $state(data?.mode === 'add' ? '' : (data?.mapel?.nama ?? ''));
	let daftarNamaTerbuka = $state(false);
	let indeksSorot = $state(-1);
	function normNamaMapel(nama: string): string {
		// Harus sinkron dengan normMapelName ($lib/server/dapodik).
		return nama
			.toLowerCase()
			.replace(/\(.*?\)/g, '')
			.replace(/\bkatholik\b/g, 'katolik')
			.replace(/\s+/g, ' ')
			.trim();
	}
	const indukTerdaftarSet = $derived(new Set(indukList.map((i) => normNamaMapel(i.nama))));
	// Nama efektif: hasil combobox (add & edit dengan data Dapodik), nama mapel
	// pada edit tanpa data Dapodik.
	const namaEfektif = $derived(
		pakaiSelectDapodik || mode === 'add' ? namaQuery.trim() : (mapel?.nama ?? '')
	);
	// Logika konsisten tambah & edit: nama tidak terdaftar sebagai pembelajaran
	// Dapodik → wajib pilih Mata Pelajaran Induk (Sub Pembelajaran).
	// Untuk varian agama pada mode edit, selalu tampilkan induk agar user bisa
	// mengatur sub-pembelajaran meskipun nama terdaftar di Dapodik.
	const tampilkanInduk = $derived(
		indukList.length > 0 &&
			namaEfektif !== '' &&
			(mode === 'edit' && isAgamaGroup ? true : !indukTerdaftarSet.has(normNamaMapel(namaEfektif)))
	);
	const MAX_OPSI_TAMPIL = 80;
	// Semua varian mapel agama (termasuk Kepercayaan) sudah dibuat otomatis oleh
	// ensureAgamaMapelForClasses — larang tambah manual via select Dapodik.
	// Cakup nama resmi ber-"Budi Pekerti" maupun versi Dapodik tanpa "Budi Pekerti"
	// (mis. "Pendidikan Agama", "Pendidikan Agama Kristen").
	const RE_MAPEL_AGAMA = /^pendidikan (agama|kepercayaan)/i;
	const agamaDapodikBlocked = $derived(
		pakaiSelectDapodik && mode === 'add' && RE_MAPEL_AGAMA.test(namaQuery.trim())
	);
	// PAPB & varian agama wajib sama dengan Dapodik → input "Nama Mata Pelajaran Lokal"
	// disembunyikan; input itu sendiri juga hanya tampil bila DB punya data Dapodik.
	const tampilNamaLokal = $derived(
		!AGAMA_MAPEL_NAME_SET.has(namaEfektif) &&
			!RE_MAPEL_AGAMA.test(namaEfektif) &&
			(dapodikMapelOptions.length > 0 || !!mapel?.namaLokal)
	);
	const namaTersaring = $derived.by(() => {
		const q = namaQuery.trim().toLowerCase();
		if (!q) return dapodikMapelOptions;
		return dapodikMapelOptions.filter((o) => o.nama.toLowerCase().includes(q));
	});
	function pilihNama(nama: string) {
		namaQuery = nama;
		daftarNamaTerbuka = false;
		indeksSorot = -1;
		applyNamaRules(nama);
	}
	function sorotGeser(delta: number) {
		const total = Math.min(namaTersaring.length, MAX_OPSI_TAMPIL);
		if (total === 0) return;
		indeksSorot = (indeksSorot + delta + total) % total;
		document.getElementById(`nama-opsi-${indeksSorot}`)?.scrollIntoView({ block: 'nearest' });
	}
	function onNamaKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			daftarNamaTerbuka = false;
			return;
		}
		if (!daftarNamaTerbuka || namaTersaring.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			sorotGeser(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			sorotGeser(-1);
		} else if (e.key === 'Enter' && indeksSorot >= 0) {
			e.preventDefault();
			pilihNama(namaTersaring[Math.min(indeksSorot, namaTersaring.length - 1)].nama);
		}
	}
</script>

<FormEnhance
	action={formAction}
	class="flex min-h-0 flex-1 flex-col"
	init={formInit}
	onsuccess={async () => {
		await Promise.all(invalidateTargets.map((token) => invalidate(token)));
		if (typeof window !== 'undefined' && window.history?.state?.modal) {
			history.back();
		} else {
			await goto('/intrakurikuler', { replaceState: true });
		}
	}}
>
	{#snippet children({ submitting, invalid })}
		<h2
			class="mb-3 border-b border-slate-200 pb-3 text-lg font-bold tracking-tight text-slate-900 dark:border-zinc-800 dark:text-zinc-100"
		>
			{heading}
		</h2>
		<div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 pt-1">
			{#if mode === 'add'}
				<div
					class="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
				>
					<div
						class="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-zinc-800"
					>
						<label
							class="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-800 dark:text-zinc-200"
						>
							<input
								type="checkbox"
								name="semuaKelas"
								value="1"
								class="checkbox checkbox-xs"
								checked={daftarKelas.length > 0 && terpilihKelasIds.length === daftarKelas.length}
								onchange={(e) => {
									if ((e.currentTarget as HTMLInputElement).checked) {
										terpilihKelasIds = daftarKelas.map((k) => k.id);
									} else {
										terpilihKelasIds = [];
									}
								}}
							/>
							<span>Pilih Semua Kelas ({daftarKelas.length} kelas)</span>
						</label>
						<div class="flex items-center gap-2">
							<button
								type="button"
								class="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
								onclick={() => (terpilihKelasIds = daftarKelas.map((k) => k.id))}
							>
								Pilih Semua
							</button>
							<span class="text-slate-300 dark:text-zinc-600">&middot;</span>
							<button
								type="button"
								class="text-xs font-semibold text-red-700 hover:underline dark:text-red-400"
								onclick={() => (terpilihKelasIds = [])}
							>
								Kosongkan
							</button>
						</div>
					</div>

					<!-- Daftar Kelas Selalu Ditampilkan -->
					<div
						class="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900"
					>
						{#each daftarKelas as k (k.id)}
							<label
								class="flex cursor-pointer items-center gap-1.5 rounded-md p-1 text-xs text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
							>
								<input
									type="checkbox"
									name="kelasIds"
									value={k.id}
									class="checkbox checkbox-xs"
									checked={terpilihKelasIds.includes(k.id)}
									onchange={(e) => {
										const checked = (e.currentTarget as HTMLInputElement).checked;
										if (checked) {
											terpilihKelasIds = [...terpilihKelasIds, k.id];
										} else {
											terpilihKelasIds = terpilihKelasIds.filter((id) => id !== k.id);
										}
									}}
								/>
								<span class="truncate">{k.nama}</span>
							</label>
						{/each}
					</div>
					<div
						class="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400"
					>
						<span
							>Terpilih: <strong class="text-slate-900 dark:text-zinc-100"
								>{terpilihKelasIds.length}</strong
							>
							dari {daftarKelas.length} kelas</span
						>
						{#if daftarKelas.length > 0 && terpilihKelasIds.length === daftarKelas.length}
							<span
								class="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
								>Semua Kelas Terpilih</span
							>
						{:else if terpilihKelasIds.length === 0}
							<span
								class="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800 dark:bg-red-950/70 dark:text-red-300"
								>Wajib pilih minimal 1 kelas</span
							>
						{/if}
					</div>
				</div>
			{:else}
				<p class="text-xs text-slate-600 dark:text-zinc-400">Kelas aktif: {kelasAktifLabel}</p>
			{/if}

			{#if mode === 'edit'}
				<input name="id" value={mapel?.id ?? ''} hidden />
			{/if}
			{#if mode === 'edit' && disableNama}
				<input name="nama" value={mapel?.nama ?? ''} hidden />
			{/if}
			{#if mode === 'edit' && disableJenis}
				<input name="jenis" value={mapel?.jenis ?? ''} hidden />
			{/if}
			<div class="flex flex-col gap-1.5">
				<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>Nama Mata Pelajaran</span
				>
				{#if pakaiSelectDapodik}
					<div class="relative">
						<input
							type="text"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
							placeholder="Pilih Mata Pelajaran"
							name="nama"
							required={!disableNama}
							disabled={disableNama}
							autocomplete="off"
							role="combobox"
							aria-expanded={daftarNamaTerbuka}
							aria-controls="daftar-nama-mapel"
							aria-activedescendant={daftarNamaTerbuka && indeksSorot >= 0
								? `nama-opsi-${indeksSorot}`
								: undefined}
							bind:value={namaQuery}
							onfocus={() => {
								daftarNamaTerbuka = true;
								indeksSorot = 0;
							}}
							oninput={() => {
								daftarNamaTerbuka = true;
								indeksSorot = 0;
								applyNamaRules(namaQuery.trim());
							}}
							onblur={() => (daftarNamaTerbuka = false)}
							onkeydown={onNamaKeydown}
						/>
						{#if daftarNamaTerbuka && namaTersaring.length > 0}
							<ul
								id="daftar-nama-mapel"
								role="listbox"
								class="absolute z-50 mt-1 max-h-60 w-full list-none overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
							>
								{#each namaTersaring.slice(0, MAX_OPSI_TAMPIL) as opsi, i (`${opsi.kode ?? ''}|${opsi.nama}`)}
									<li id={`nama-opsi-${i}`} role="option" aria-selected={i === indeksSorot}>
										<button
											type="button"
											class="w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-800 transition-colors hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-800 {i ===
											indeksSorot
												? 'bg-blue-50 font-semibold text-blue-900 dark:bg-zinc-800 dark:text-blue-300'
												: ''}"
											onmousedown={(e) => e.preventDefault()}
											onclick={() => pilihNama(opsi.nama)}
										>
											{#if opsi.kode}
												<span class="mr-1.5 font-mono text-[11px] text-slate-500 dark:text-zinc-400"
													>{opsi.kode}</span
												>
											{/if}
											{opsi.nama}
										</button>
									</li>
								{/each}
								{#if namaTersaring.length > MAX_OPSI_TAMPIL}
									<li class="px-2.5 py-1 text-xs text-slate-500 dark:text-zinc-400">
										{namaTersaring.length - MAX_OPSI_TAMPIL} lainnya. Ketik untuk mempersempit.
									</li>
								{/if}
							</ul>
						{/if}
					</div>
				{:else}
					<input
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
						placeholder={namaPlaceholder}
						name="nama"
						required={!disableNama}
						disabled={disableNama}
						value={mapel?.nama ?? ''}
						oninput={onNamaInput}
					/>
				{/if}
				<p class="text-xs text-slate-500 dark:text-zinc-400">
					{#if pakaiSelectDapodik}
						Ketik untuk mencari, lalu pilih dari daftar. Nama mata pelajaran jangan disingkat!
					{:else}
						Nama mata pelajaran jangan disingkat!
					{/if}
				</p>
				{#if agamaDapodikBlocked}
					<div
						class="mt-1 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
						role="alert"
					>
						<Icon name="alert" class="h-4 w-4 shrink-0" />
						<span
							>Tidak dapat menambahkan mapel agama karena termasuk ke dalam PAPB dan sub mapel yang
							sudah ada secara otomatis di tabel</span
						>
					</div>
				{/if}
			</div>
			{#if tampilNamaLokal}
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Nama Mata Pelajaran Lokal</span
					>
					<input
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
						placeholder="Kosongkan bila sama dengan Dapodik"
						name="nama_lokal"
						maxlength="100"
						disabled={!adaKelasTujuan}
					/>
					<span class="text-xs text-slate-500 dark:text-zinc-400">
						Nama lokal mata pelajaran di Dapodik (opsional). Kosongkan bila sama dengan Nama Mata
						Pelajaran.
					</span>
				</label>
			{/if}
			{#if tampilkanInduk}
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Mata Pelajaran Induk</span
					>
					<div class="relative flex items-center">
						<select
							name="induk_pembelajaran_id"
							required={!isAgamaGroup && !isPksGroup}
							class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						>
							<option disabled selected={mode === 'add' || !mapel?.dapodikIndukPembelajaranId}>
								Pilih Pembelajaran Induk (terdaftar di Dapodik)
							</option>
							{#each indukList as induk (induk.pembelajaranId)}
								<option
									value={induk.pembelajaranId}
									selected={mode === 'edit' &&
										mapel?.dapodikIndukPembelajaranId === induk.pembelajaranId}
								>
									{induk.nama}
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
					<span class="text-xs text-slate-500 dark:text-zinc-400">
						{#if mode === 'edit' && isAgamaGroup}
							Jika salah satu varian agama sudah terdaftar di Dapodik, ia akan menjadi mapel induk.
							Varian tanpa padanan Dapodik akan dikirim sebagai Sub Pembelajaran. Pilihan berlaku
							untuk semua varian agama di kelas ini.
						{:else}
							"{namaEfektif}" belum terdaftar sebagai pembelajaran Dapodik, akan dikirim sebagai Sub
							Pembelajaran dari mata pelajaran induk yang dipilih.
						{/if}
					</span>
				</label>
			{/if}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">KKM</span>
					<input
						type="number"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
						placeholder="Contoh: 76"
						name="kkm"
						required
						disabled={!adaKelasTujuan}
						min="0"
					/>
				</label>
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Singkatan/kode</span
					>
					<input
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
						placeholder="Contoh: PAPB"
						name="kode"
						bind:value={localKode}
						disabled={isAgamaGroup || isPksGroup ? true : !adaKelasTujuan}
					/>
					<span class="text-xs text-slate-500 dark:text-zinc-400"
						>Singkatan/kode singkat untuk mata pelajaran (opsional).</span
					>
				</label>
			</div>
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>Jenis Mata Pelajaran</span
				>
				<div class="relative flex items-center">
					<select
						class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
						name="jenis"
						required={!disableJenis}
						disabled={disableJenis}
					>
						<option disabled selected>Pilih Jenis Mata Pelajaran</option>
						{#each Object.entries(displayJenisMapel) as [value, label] (value)}
							<option {value}>{label}</option>
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
			{#if mode === 'edit' && isAgamaParent}
				<p class="text-xs text-slate-600 dark:text-zinc-400">
					Perubahan KKM akan diterapkan ke semua varian mata pelajaran Pendidikan Agama dan Budi
					Pekerti.
				</p>
			{/if}
			{#if mode === 'edit' && isPksParent}
				<p class="text-xs text-slate-600 dark:text-zinc-400">
					Perubahan KKM dan jenis akan diterapkan ke semua varian mata pelajaran Pendalaman Kitab
					Suci.
				</p>
			{/if}
		</div>
		<div class="modal-action mt-4 border-t border-slate-200 pt-3 dark:border-zinc-800">
			<button
				type="button"
				class="mr-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={() => history.back()}
			>
				<Icon name="close-sm" class="h-3.5 w-3.5" />
				Batal
			</button>
			<button
				type="submit"
				class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={submitting ||
					(invalid && !isAgamaParent && !isPksParent) ||
					!adaKelasTujuan ||
					agamaDapodikBlocked}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					<Icon name="save" class="h-3.5 w-3.5" />
				{/if}
				Simpan
			</button>
		</div>
	{/snippet}
</FormEnhance>
