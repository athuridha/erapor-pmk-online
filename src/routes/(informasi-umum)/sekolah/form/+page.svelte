<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import ImportDatabaseModal from '$lib/components/modals/import-database-modal.svelte';
	import SekolahModals from '$lib/components/sekolah/modals.svelte';
	import { jenjangPendidikanSederajat, nauganOptions } from '$lib/statics';
	import { modalRoute } from '$lib/utils';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const isNew = data.isNew as boolean;
	// svelte-ignore state_referenced_locally
	const initialSekolah = (isNew ? undefined : data.sekolah) as Sekolah | undefined;
	/** Varian jenjang yang bisa dipilih (grup SMA/SMK/MA/MAK/SRMA). */
	const varianJenjang = jenjangPendidikanSederajat.sma as { key: string; label: string }[];

	// Combobox "Nama Kepala Sekolah" — aktif hanya bila data pendidik & tenaga
	// pendidik sudah ada di DB (hasil Sinkron Dapodik), logika sama dengan
	// "Nama Mata Pelajaran" pada Tambah Mata Pelajaran.
	type PegawaiOpsi = { id: number; nama: string; nip: string | null };
	const pegawaiOptions = $derived((data.pegawaiList ?? []) as PegawaiOpsi[]);
	const pakaiSelectPegawai = $derived(pegawaiOptions.length > 0);
	// Data Dapodik tersedia (mode edit) → kepala sekolah hanya bisa DIPILIH dari
	// daftar, tidak bisa diketik/direname; ubah nama/NIP via /pengaturan/profil.
	const kunciKepalaSekolah = $derived(Boolean(data.dapodikAktif) && Boolean(initialSekolah?.id));
	let kepalaQuery = $state(initialSekolah?.kepalaSekolah?.nama ?? '');
	let kepalaNip = $state(initialSekolah?.kepalaSekolah?.nip ?? '');
	let kepalaTerpilihId = $state<number | null>(initialSekolah?.kepalaSekolah?.id ?? null);
	let daftarKepalaTerbuka = $state(false);
	let indeksSorotKepala = $state(-1);
	const MAX_OPSI_TAMPIL = 80;
	const kepalaTersaring = $derived.by(() => {
		const q = kepalaQuery.trim().toLowerCase();
		if (!q) return pegawaiOptions;
		return pegawaiOptions.filter(
			(o) => o.nama.toLowerCase().includes(q) || (o.nip ?? '').includes(q)
		);
	});
	function pilihKepala(opsi: PegawaiOpsi) {
		kepalaQuery = opsi.nama;
		kepalaNip = opsi.nip ?? '';
		kepalaTerpilihId = opsi.id;
		daftarKepalaTerbuka = false;
		indeksSorotKepala = -1;
	}
	// Mode terkunci: teks terisi tapi belum memilih orang → blokir simpan.
	const kepalaBelumDipilih = $derived(
		kunciKepalaSekolah && kepalaQuery.trim() !== '' && kepalaTerpilihId === null
	);
	function sorotKepalaGeser(delta: number) {
		const total = Math.min(kepalaTersaring.length, MAX_OPSI_TAMPIL);
		if (total === 0) return;
		indeksSorotKepala = (indeksSorotKepala + delta + total) % total;
		document
			.getElementById(`kepala-opsi-${indeksSorotKepala}`)
			?.scrollIntoView({ block: 'nearest' });
	}
	function onKepalaKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			daftarKepalaTerbuka = false;
			return;
		}
		if (!daftarKepalaTerbuka || kepalaTersaring.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			sorotKepalaGeser(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			sorotKepalaGeser(-1);
		} else if (e.key === 'Enter' && indeksSorotKepala >= 0) {
			e.preventDefault();
			pilihKepala(kepalaTersaring[Math.min(indeksSorotKepala, kepalaTersaring.length - 1)]);
		}
	}

	// When editing, the form enhancer populates the select by jenjangPendidikan (base key).
	// Because options reuse the same value for multiple variants, the browser will select
	// the first matching option for that value (usually the base label). To show the
	// stored variant label (e.g., "Madrasah Ibtidaiyah (MI)") we programmatically
	// select the option whose data-variant matches initialSekolah.jenjangVariant.
	function handleImportDb() {
		showModal({
			title: 'Import Database',
			body: ImportDatabaseModal,
			dismissible: true
		});
	}

	onMount(() => {
		if (!initialSekolah?.jenjangVariant) return;
		// run after microtask to let any form population actions finish
		setTimeout(() => {
			const sel = document.querySelector<HTMLSelectElement>('select[name="jenjangPendidikan"]');
			if (!sel) return;
			const opt = Array.from(sel.options).find(
				(o) => o.dataset?.variant === initialSekolah.jenjangVariant
			);
			if (opt) {
				opt.selected = true;
				// ensure hidden input is in sync
				const hidden = sel.form?.elements.namedItem('jenjangVariant') as HTMLInputElement | null;
				if (hidden) hidden.value = String(initialSekolah.jenjangVariant ?? '');
			}
		}, 0);
	});
</script>

{#if data.isInit}
	<div
		role="alert"
		class="mx-auto mb-4 flex max-w-4xl items-center gap-2.5 rounded-2xl border border-blue-200/80 bg-blue-50/75 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
	>
		<!-- TODO: sesuaikan pesan saat pertama kali setup -->
		<Icon name="info" class="h-4 w-4 shrink-0" />
		<span>Selamat datang! Pertama-tama, isi formulir sekolah terlebih dahulu!</span>
	</div>
{/if}

<FormEnhance
	action="?/save"
	init={initialSekolah}
	enctype="multipart/form-data"
	onsuccess={async () => {
		await invalidate('app:sekolah');
		await goto('/sekolah');
	}}
>
	{#snippet children({ submitting })}
		{#if initialSekolah?.id}
			<input name="id" value={initialSekolah.id} hidden />
		{/if}

		<div
			class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div
				class="mb-4 flex flex-col items-start justify-between gap-2 border-b border-slate-200 pb-4 md:flex-row md:items-center dark:border-zinc-800"
			>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					{#if isNew}
						Tambah Sekolah Baru
					{:else}
						Formulir Isian Identitas Sekolah
					{/if}
				</h1>
				<a
					class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					href="/sekolah/form/sync-dapodik"
					use:modalRoute={'sync-dapodik'}
				>
					<Icon name="dapodik" class="h-4 w-4" />
					Sync Dapodik
				</a>
			</div>

			<div class="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
				<!-- Jenjang Pendidikan & Lokasi Tanda Tangan -->
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Jenjang Pendidikan</span
					>
					<div class="relative flex items-center">
						<select
							class="validator h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							name="jenjangPendidikan"
							required
							onchange={(e) => {
								const sel = e.currentTarget as HTMLSelectElement;
								const option = sel.selectedOptions?.[0];
								const variant = option?.dataset?.variant ?? 'smk';
								const hidden = sel.form?.elements.namedItem(
									'jenjangVariant'
								) as HTMLInputElement | null;
								if (hidden) hidden.value = variant;
							}}
						>
							{#each varianJenjang as varian (varian.key)}
								<option
									value="sma"
									data-variant={varian.key}
									selected={initialSekolah
										? initialSekolah.jenjangVariant === varian.key
										: varian.key === 'smk'}
								>
									{varian.label}
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
					<input hidden name="jenjangVariant" value={initialSekolah?.jenjangVariant ?? 'smk'} />
				</label>

				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Lokasi Tanda Tangan</span
					>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: Karawang"
						name="lokasiTandaTangan"
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<!-- Nama Sekolah -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nama Sekolah</span>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: SMK Pratama Mulya Karawang"
						name="nama"
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<!-- NPSN -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NPSN</span>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: 20260930"
						name="npsn"
					/>
				</label>

				<div class="flex flex-col gap-1.5">
					<!-- Nama Kepala Sekolah -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Nama Kepala Sekolah</span
					>
					{#if pakaiSelectPegawai}
						<div class="relative">
							<input
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Pilih Kepala Sekolah"
								name="kepalaSekolah.nama"
								required
								autocomplete="off"
								role="combobox"
								aria-expanded={daftarKepalaTerbuka}
								aria-controls="daftar-nama-kepala"
								aria-activedescendant={daftarKepalaTerbuka && indeksSorotKepala >= 0
									? `kepala-opsi-${indeksSorotKepala}`
									: undefined}
								bind:value={kepalaQuery}
								onfocus={() => {
									daftarKepalaTerbuka = true;
									indeksSorotKepala = 0;
								}}
								oninput={() => {
									daftarKepalaTerbuka = true;
									indeksSorotKepala = 0;
									kepalaTerpilihId = null;
								}}
								onblur={() => (daftarKepalaTerbuka = false)}
								onkeydown={onKepalaKeydown}
							/>
							{#if daftarKepalaTerbuka && kepalaTersaring.length > 0}
								<ul
									id="daftar-nama-kepala"
									role="listbox"
									class="absolute z-50 mt-1 max-h-60 w-full list-none overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
								>
									{#each kepalaTersaring.slice(0, MAX_OPSI_TAMPIL) as opsi, i (`${opsi.id}|${opsi.nama}`)}
										<li
											id={`kepala-opsi-${i}`}
											role="option"
											aria-selected={i === indeksSorotKepala}
										>
											<button
												type="button"
												class="w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-800 transition-colors hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-800 {i ===
												indeksSorotKepala
													? 'bg-blue-50 font-semibold text-blue-900 dark:bg-zinc-800 dark:text-blue-300'
													: ''}"
												onmousedown={(e) => e.preventDefault()}
												onclick={() => pilihKepala(opsi)}
											>
												{#if opsi.nip}
													<span
														class="mr-1.5 font-mono text-[11px] text-slate-500 dark:text-zinc-400"
														>{opsi.nip}</span
													>
												{/if}
												{opsi.nama}
											</button>
										</li>
									{/each}
									{#if kepalaTersaring.length > MAX_OPSI_TAMPIL}
										<li class="px-2.5 py-1 text-xs text-slate-500 dark:text-zinc-400">
											{kepalaTersaring.length - MAX_OPSI_TAMPIL} lainnya. Ketik untuk mempersempit.
										</li>
									{/if}
								</ul>
							{/if}
						</div>
					{:else}
						<input
							required
							type="text"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							placeholder="Contoh: Bruce Wayne, Bat"
							name="kepalaSekolah.nama"
						/>
					{/if}
					<span class="text-xs text-slate-500 dark:text-zinc-400">
						{#if kunciKepalaSekolah}
							Otomatis dari Dapodik. Menambahkan gelar dilakukan melalui menu Pengaturan - Edit
							profil.
						{:else}
							Masukkan nama Kepala Sekolah lengkap dengan gelar.
						{/if}
					</span>
				</div>

				<label class="flex flex-col gap-1.5">
					<!-- NIP Kepala Sekolah -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>NIP Kepala Sekolah</span
					>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
						placeholder="Contoh: NIP 19700305 199309 1 009"
						name="kepalaSekolah.nip"
						value={pakaiSelectPegawai ? kepalaNip : undefined}
						disabled={kunciKepalaSekolah}
						title={kunciKepalaSekolah
							? 'Mengikuti data Dapodik. Ubah melalui menu Pengaturan Profil akun yang bersangkutan'
							: undefined}
					/>
					{#if !pakaiSelectPegawai}
						<span class="text-xs text-slate-500 dark:text-zinc-400"
							>Biarkan kosong jika kepala sekolah tidak memiliki NIP.</span
						>
					{:else if kunciKepalaSekolah}
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							Otomatis berdasarkan pegawai yang dipilih. Edit melalui menu Pengaturan - Edit profil.
						</span>
					{/if}
				</label>

				<input type="hidden" name="kepalaSekolahId" value={kepalaTerpilihId ?? ''} />

				<label class="flex flex-col gap-1.5">
					<!-- Nama desa atau kelurahan -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Desa atau Kelurahan</span
					>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: Desa Sungai Dangin atau Kelurahan Sungai Sengkuang"
						name="alamat.desa"
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<!-- Kecamatan -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Kecamatan</span>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: Kecamatan Noyan"
						name="alamat.kecamatan"
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<!-- Kabupaten -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Kabupaten</span>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: Kabupaten Sanggau"
						name="alamat.kabupaten"
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<!-- Provinsi -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Provinsi</span>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: Kalimantan Barat"
						name="alamat.provinsi"
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<!-- Kode Pos -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Kode POS</span>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: 78554"
						name="alamat.kodePos"
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<!-- Alamat Sekolah -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Rincian Alamat Sekolah</span
					>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: Jalan Raya Noyan, RT 9 / RW 3, Dusun Periji"
						name="alamat.jalan"
					/>
				</label>

				<div class="flex flex-col gap-1.5">
					<!-- Website Sekolah -->
					<label
						class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						for="sekolah-website">Website Sekolah</label
					>
					<div
						class="flex h-9 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-blue-400"
					>
						<span
							class="border-r border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
							>https://</span
						>
						<input
							id="sekolah-website"
							type="text"
							class="validator h-full w-full bg-transparent px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
							placeholder="Kosongkan bila tidak ada"
							name="website"
						/>
					</div>
				</div>

				<label class="flex flex-col gap-1.5">
					<!-- Email Sekolah -->
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Email Sekolah</span>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: cs@sdn19periji.sch.id"
						name="email"
					/>
				</label>

				<!-- Kementrian -->
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Pilih Naungan</span>
					<div class="relative flex items-center">
						<select
							class="validator h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							name="naungan"
							required
						>
							{#each nauganOptions as option (option.key)}
								<option
									value={option.key}
									selected={initialSekolah?.naungan === option.key ||
										(!initialSekolah && option.key === 'kemendikbud')}
								>
									{option.label}
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

				<!-- Status definitif plt -->
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Status Kepala Sekolah</span
					>
					<div class="relative flex items-center">
						<select
							class="validator h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							name="statusKepalaSekolah"
							required
						>
							<option
								value="definitif"
								selected={initialSekolah?.statusKepalaSekolah === 'definitif'}
							>
								Definitif
							</option>
							<option value="plt" selected={initialSekolah?.statusKepalaSekolah === 'plt'}>
								PLT (Pelaksana Tugas)
							</option>
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
				</label>

				<!-- Ambang kriteria rapor (dulu hanya bisa diubah di Master Data > Profil Sekolah) -->
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Ambang Kriteria Cukup</span
					>
					<input
						type="number"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						name="raporKriteriaCukup"
						min="0"
						max="100"
						required
						value={initialSekolah?.raporKriteriaCukup ?? 85}
					/>
					<span class="text-xs text-slate-500 dark:text-zinc-400">
						Batas bawah predikat "Cukup" pada rapor. Standar: 85.
					</span>
				</label>

				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Ambang Kriteria Baik</span
					>
					<input
						type="number"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						name="raporKriteriaBaik"
						min="0"
						max="100"
						required
						value={initialSekolah?.raporKriteriaBaik ?? 95}
					/>
					<span class="text-xs text-slate-500 dark:text-zinc-400">
						Batas bawah predikat "Baik" pada rapor. Standar: 95.
					</span>
				</label>
			</div>

			<!-- Upload logo sekolah dan dinas pendidikan -->
			<div class="mt-4 grid gap-4 md:grid-cols-2">
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Logo Sekolah</span>
					<input
						type="file"
						class="block w-full text-xs text-slate-600 file:mr-3 file:h-9 file:cursor-pointer file:rounded-xl file:border file:border-[#7e8b9b] file:bg-white file:px-3.5 file:text-xs file:font-semibold file:text-slate-800 hover:file:bg-slate-50 dark:text-zinc-400 dark:file:border-zinc-700 dark:file:bg-zinc-900 dark:file:text-zinc-100 dark:hover:file:bg-zinc-800"
						accept="image/*"
						name="logo"
					/>
					<span class="text-xs text-slate-500 dark:text-zinc-400"
						>Format png, tanpa latar belakang, maksimal 300KB</span
					>
				</label>
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Logo Pemda</span>
					<input
						type="file"
						class="block w-full text-xs text-slate-600 file:mr-3 file:h-9 file:cursor-pointer file:rounded-xl file:border file:border-[#7e8b9b] file:bg-white file:px-3.5 file:text-xs file:font-semibold file:text-slate-800 hover:file:bg-slate-50 dark:text-zinc-400 dark:file:border-zinc-700 dark:file:bg-zinc-900 dark:file:text-zinc-100 dark:hover:file:bg-zinc-800"
						accept="image/*"
						name="logoDinas"
					/>
					<span class="text-xs text-slate-500 dark:text-zinc-400"
						>Format png, tanpa latar belakang, maksimal 300KB</span
					>
				</label>
			</div>

			<!-- Back and Save -->
			<div
				class="mt-6 flex flex-col justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row dark:border-zinc-800"
			>
				{#if !data.isInit}
					<div class="grid grid-cols-2 gap-2 sm:contents">
						<a
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 sm:mr-auto sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							href="/sekolah"
							aria-label="kembali"
						>
							<Icon name="left" class="h-4 w-4" />
							Kembali
						</a>
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={handleImportDb}
						>
							<Icon name="import" class="h-4 w-4" />
							Import DB
						</button>
					</div>
				{:else}
					<button
						type="button"
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						onclick={handleImportDb}
					>
						<Icon name="import" class="h-4 w-4" />
						Import DB
					</button>
				{/if}
				<button
					class="mt-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0 sm:w-auto"
					disabled={submitting || kepalaBelumDipilih}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					<Icon name="save" class="h-4 w-4" />
					Simpan
				</button>
			</div>
		</div>
	{/snippet}
</FormEnhance>

<SekolahModals />
