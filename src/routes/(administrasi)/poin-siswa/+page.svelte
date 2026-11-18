<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';

	type Pelanggaran = {
		id: number;
		nama: string;
		poin: number;
		kategori: string | null;
		dipakai: number;
	};

	type MuridRekap = {
		id: number;
		nama: string;
		nisn: string | null;
		kelasNama: string | null;
		totalPoin: number;
		jumlahRiwayat: number;
	};

	type Riwayat = {
		id: number;
		tanggal: string;
		catatan: string | null;
		muridNama: string;
		pelanggaranNama: string;
		poin: number;
		pelaporNama: string | null;
	};

	type PageData = {
		kelasAktif: { id: number; nama: string } | null;
		daftarPelanggaran: Pelanggaran[];
		rekap: MuridRekap[];
		riwayat: Riwayat[];
	};

	let { data }: { data: PageData } = $props();

	const today = $derived(new Date().toISOString().slice(0, 10));

	let tambahTerbuka = $state(false);
	let beriPoinTerbuka = $state(false);
	let targetMuridNama = $state('');
	let targetMuridId = $state<number | null>(null);

	let formBeriTanggal = $state('');
	let formBeriPelanggaranId = $state('');
	let formBeriCatatan = $state('');

	function bukaTambah() {
		tambahTerbuka = true;
	}

	function bukaBeriPoin(murid: MuridRekap) {
		targetMuridId = murid.id;
		targetMuridNama = murid.nama;
		formBeriTanggal = new Date().toISOString().slice(0, 10);
		formBeriPelanggaranId = '';
		formBeriCatatan = '';
		beriPoinTerbuka = true;
	}

	function tutupBeriPoin() {
		beriPoinTerbuka = false;
		targetMuridId = null;
		targetMuridNama = '';
	}

	// Shared delete form: set the hidden input value directly (state updates are
	// flushed asynchronously, so submitting right after assigning state used to
	// send an empty id and fail silently — B4).
	function submitHapus(formId: string, id: number) {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form) return;
		const input = form.elements.namedItem('id') as HTMLInputElement | null;
		if (input) input.value = String(id);
		form.requestSubmit();
	}

	function konfirmasiHapusPelanggaran(pelanggaran: Pelanggaran) {
		showModal({
			title: 'Hapus Pelanggaran',
			body: `Hapus pelanggaran <strong>${pelanggaran.nama}</strong> (${
				pelanggaran.dipakai
			} riwayat ${pelanggaran.dipakai > 0 ? 'akan ikut terhapus' : 'belum ada'})?`,
			dismissible: false,
			onPositive: {
				label: 'Hapus',
				class: 'btn-error',
				action: async ({ close }) => {
					close();
					submitHapus('form-hapus-pelanggaran', pelanggaran.id);
				}
			},
			onNegative: { label: 'Batal' }
		});
	}

	function konfirmasiHapusPoin(riwayat: Riwayat) {
		showModal({
			title: 'Hapus Riwayat Poin',
			body: `Hapus riwayat <strong>${riwayat.pelanggaranNama}</strong> atas <strong>${riwayat.muridNama}</strong>?`,
			dismissible: false,
			onPositive: {
				label: 'Hapus',
				class: 'btn-error',
				action: async ({ close }) => {
					close();
					submitHapus('form-hapus-poin', riwayat.id);
				}
			},
			onNegative: { label: 'Batal' }
		});
	}

	function badgePoin(total: number) {
		if (total >= 30) {
			return {
				cls: 'border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300',
				label: 'Panggil Ortu'
			};
		}
		if (total >= 15) {
			return {
				cls: 'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
				label: 'Pemantauan'
			};
		}
		if (total > 0) {
			return {
				cls: 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
				label: 'Aman'
			};
		}
		return {
			cls: 'border-slate-200/80 bg-slate-100 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
			label: 'Bersih'
		};
	}

	function formatTanggal(iso: string) {
		try {
			return new Date(iso).toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			});
		} catch {
			return iso;
		}
	}

	const adaKelasAktif = $derived(!!data.kelasAktif);
	let filterStatusPoin = $state<'semua' | 'ada_poin' | 'bersih'>('semua');
	let searchNama = $state('');

	// Group students per class when browsing all classes (admin mode),
	// otherwise they already belong to the active class.
	const rekapGrup = $derived.by(() => {
		const q = searchNama.trim().toLowerCase();
		const filteredMurids = data.rekap.filter((m) => {
			if (q && !m.nama.toLowerCase().includes(q)) return false;
			if (filterStatusPoin === 'ada_poin') return m.totalPoin > 0;
			if (filterStatusPoin === 'bersih') return m.totalPoin === 0;
			return true;
		});

		if (adaKelasAktif) return [{ kelasNama: data.kelasAktif!.nama, murid: filteredMurids }];
		const map = new Map<string, MuridRekap[]>();
		for (const murid of filteredMurids) {
			const key = murid.kelasNama ?? '(Tanpa Kelas)';
			const list = map.get(key);
			if (list) list.push(murid);
			else map.set(key, [murid]);
		}
		return [...map.entries()].map(([kelasNama, murid]) => ({ kelasNama, murid }));
	});

	// Multi-pilih murid: beri satu pelanggaran yang sama untuk banyak murid
	// sekaligus dalam satu kali simpan.
	let terpilihMurid = $state<number[]>([]);
	let bulkBeriTerbuka = $state(false);
	let bulkPelanggaranId = $state('');
	let bulkTanggal = $state('');
	let bulkCatatan = $state('');

	const idMuridTampil = $derived(rekapGrup.flatMap((grup) => grup.murid.map((m) => m.id)));
	const semuaMuridTerpilih = $derived(
		idMuridTampil.length > 0 && terpilihMurid.length === idMuridTampil.length
	);

	function toggleMurid(id: number, checked: boolean) {
		terpilihMurid = checked
			? [...new Set([...terpilihMurid, id])]
			: terpilihMurid.filter((value) => value !== id);
	}

	function pilihSemuaMurid(checked: boolean) {
		terpilihMurid = checked ? [...idMuridTampil] : [];
	}

	function semuaGrupTerpilih(murid: MuridRekap[]) {
		return murid.length > 0 && murid.every((item) => terpilihMurid.includes(item.id));
	}

	function pilihGrup(murid: MuridRekap[], checked: boolean) {
		const ids = murid.map((item) => item.id);
		terpilihMurid = checked
			? [...new Set([...terpilihMurid, ...ids])]
			: terpilihMurid.filter((id) => !ids.includes(id));
	}

	const muridTerpilih = $derived(
		rekapGrup.flatMap((grup) => grup.murid).filter((murid) => terpilihMurid.includes(murid.id))
	);

	function bukaBulkBeriPoin() {
		if (!terpilihMurid.length) return;
		bulkPelanggaranId = '';
		bulkTanggal = new Date().toISOString().slice(0, 10);
		bulkCatatan = '';
		bulkBeriTerbuka = true;
	}

	function selesaiBulkBeriPoin() {
		bulkBeriTerbuka = false;
		terpilihMurid = [];
	}
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Poin Siswa</h1>
			<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
				{adaKelasAktif ? `Kelas ${data.kelasAktif!.nama}` : 'Semua Kelas'} · Rekap poin tata tertib
			</p>
		</div>
		<!-- Satu pintu Poin Siswa dengan dua tab; halaman rekap detail tetap ada. -->
		<div
			class="inline-flex rounded-xl border border-slate-200/80 bg-slate-50 p-1 dark:border-zinc-700 dark:bg-zinc-800"
		>
			<a
				class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs dark:bg-blue-500"
				href="/poin-siswa"
				aria-current="page"
			>
				<Icon name="plus" class="h-3.5 w-3.5" />
				Beri Poin
			</a>
			<a
				class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white"
				href="/poin-siswa/rekap"
			>
				<Icon name="users" class="h-3.5 w-3.5" />
				Rekap
			</a>
		</div>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		<!-- Master pelanggaran -->
		<div
			class="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
		>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-sm font-bold text-slate-900 dark:text-zinc-100">Master Pelanggaran</h2>
				<button
					type="button"
					class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
					onclick={bukaTambah}
				>
					<Icon name="plus" class="h-3.5 w-3.5" />
					Tambah
				</button>
			</div>
			{#if !data.daftarPelanggaran.length}
				<div
					class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
				>
					<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
					<span>Belum ada daftar pelanggaran. Tambahkan lewat tombol Tambah.</span>
				</div>
			{:else}
				<div
					class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
				>
					<table class="w-full border-collapse text-xs">
						<thead>
							<tr
								class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
							>
								<th class="min-w-40 px-3 py-2.5">Nama</th>
								<th class="min-w-14 px-3 py-2.5">Poin</th>
								<th class="min-w-24 px-3 py-2.5">Kategori</th>
								<th class="w-16 px-3 py-2.5 text-center">Pakai</th>
								<th class="w-16 px-3 py-2.5 text-center">Aksi</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
							{#each data.daftarPelanggaran as pelanggaran (pelanggaran.id)}
								<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
									<td class="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100">
										{pelanggaran.nama}
									</td>
									<td class="px-3 py-2">
										<span
											class="inline-flex items-center rounded-md border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
										>
											{pelanggaran.poin}
										</span>
									</td>
									<td class="px-3 py-2 text-slate-600 dark:text-zinc-300">
										{pelanggaran.kategori ?? '-'}
									</td>
									<td class="px-3 py-2 text-center text-slate-600 dark:text-zinc-300">
										{pelanggaran.dipakai}
									</td>
									<td class="px-3 py-2 text-center">
										<button
											type="button"
											class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
											onclick={() => konfirmasiHapusPelanggaran(pelanggaran)}
											aria-label="Hapus"
											title="Hapus"
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
		</div>

		<!-- Rekap murid + riwayat -->
		<div class="flex flex-col gap-4">
			<div
				class="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
			>
				<div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<h2 class="text-sm font-bold text-slate-900 dark:text-zinc-100">Rekap Murid</h2>

					<div class="flex flex-wrap items-center gap-2">
						<!-- Filter Status Poin -->
						<div
							class="inline-flex rounded-xl border border-slate-200/80 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
						>
							<button
								type="button"
								class="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors {filterStatusPoin ===
								'semua'
									? 'bg-blue-600 text-white dark:bg-blue-500'
									: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
								onclick={() => (filterStatusPoin = 'semua')}
							>
								Semua
							</button>
							<button
								type="button"
								class="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors {filterStatusPoin ===
								'ada_poin'
									? 'bg-blue-600 text-white dark:bg-blue-500'
									: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
								onclick={() => (filterStatusPoin = 'ada_poin')}
							>
								Ada Poin
							</button>
							<button
								type="button"
								class="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors {filterStatusPoin ===
								'bersih'
									? 'bg-blue-600 text-white dark:bg-blue-500'
									: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
								onclick={() => (filterStatusPoin = 'bersih')}
							>
								Bersih (0)
							</button>
						</div>

						<!-- Search Murid -->
						<div class="relative flex items-center">
							<span
								aria-hidden="true"
								class="pointer-events-none absolute left-2.5 flex items-center text-slate-400 dark:text-zinc-400"
							>
								<Icon name="search" class="h-3 w-3" />
							</span>
							<input
								type="search"
								placeholder="Cari murid..."
								class="h-7 w-36 rounded-lg border border-[#7e8b9b] bg-white pr-2 pl-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								bind:value={searchNama}
							/>
						</div>

						{#if data.rekap.length}
							<label
								class="flex cursor-pointer items-center gap-1.5 text-xs font-medium whitespace-nowrap text-slate-700 dark:text-zinc-300"
								title="Centang semua murid yang tampil"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-xs"
									checked={semuaMuridTerpilih}
									onchange={(event) => pilihSemuaMurid(event.currentTarget.checked)}
								/>
								Pilih semua
							</label>
						{/if}

						{#if terpilihMurid.length}
							<button
								type="button"
								class="inline-flex h-7 items-center justify-center gap-1 rounded-lg bg-blue-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
								onclick={bukaBulkBeriPoin}
								title="Beri poin untuk murid yang dicentang"
							>
								<Icon name="plus" class="h-3 w-3" />
								Beri Poin ({terpilihMurid.length})
							</button>
						{/if}
					</div>
				</div>

				{#if !data.rekap.length}
					<div
						class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
					>
						<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
						<span>Belum ada murid pada cakupan ini.</span>
					</div>
				{:else}
					{#each rekapGrup as grup, index (grup.kelasNama)}
						{#if !adaKelasAktif}
							<h3
								class="mt-3 mb-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
							>
								{grup.kelasNama}
							</h3>
						{/if}
						<div
							class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
							class:mt-2={adaKelasAktif || index > 0}
						>
							<table class="w-full border-collapse text-xs">
								<thead>
									<tr
										class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
									>
										<th class="w-9 px-3 py-2.5 text-center">
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												checked={semuaGrupTerpilih(grup.murid)}
												onchange={(event) => pilihGrup(grup.murid, event.currentTarget.checked)}
												title="Pilih semua murid pada daftar ini"
												aria-label="Pilih semua murid pada daftar ini"
											/>
										</th>
										<th class="min-w-36 px-3 py-2.5">Nama</th>
										<th class="w-16 px-3 py-2.5">Total</th>
										<th class="min-w-28 px-3 py-2.5 text-center">Status</th>
										<th class="w-28 px-3 py-2.5 text-center">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
									{#each grup.murid as murid (murid.id)}
										{@const badge = badgePoin(murid.totalPoin)}
										<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
											<td class="px-3 py-2 text-center">
												<input
													type="checkbox"
													class="checkbox checkbox-sm"
													checked={terpilihMurid.includes(murid.id)}
													onchange={(event) => toggleMurid(murid.id, event.currentTarget.checked)}
													title="Pilih {murid.nama}"
													aria-label="Pilih {murid.nama}"
												/>
											</td>
											<td class="px-3 py-2">
												<span class="font-medium text-slate-900 dark:text-zinc-100"
													>{murid.nama}</span
												>
												{#if murid.jumlahRiwayat > 0}
													<p class="text-[11px] text-slate-500 dark:text-zinc-400">
														{murid.jumlahRiwayat} riwayat
													</p>
												{/if}
											</td>
											<td class="px-3 py-2">
												<span
													class="inline-flex min-w-7 items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold {badge.cls}"
												>
													{murid.totalPoin}
												</span>
											</td>
											<td class="px-3 py-2 text-center">
												<span
													class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold {badge.cls}"
												>
													{badge.label}
												</span>
											</td>
											<td class="px-3 py-2 text-center">
												<button
													type="button"
													class="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-blue-200/80 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
													onclick={() => bukaBeriPoin(murid)}
													title="Beri poin"
												>
													<Icon name="plus" class="h-3 w-3" />
													Beri Poin
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/each}
				{/if}
			</div>

			<div
				class="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
			>
				<h2 class="mb-2.5 text-sm font-bold text-slate-900 dark:text-zinc-100">Riwayat Terakhir</h2>
				{#if !data.riwayat.length}
					<div
						class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
					>
						<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
						<span>Belum ada riwayat poin.</span>
					</div>
				{:else}
					<ul class="space-y-2">
						{#each data.riwayat as riwayat (riwayat.id)}
							<li
								class="flex items-start justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
							>
								<div class="min-w-0">
									<p class="text-xs text-slate-800 dark:text-zinc-200">
										<span class="font-semibold text-slate-900 dark:text-zinc-100"
											>{riwayat.muridNama}</span
										>
										<span class="text-slate-500 dark:text-zinc-400">
											· {riwayat.pelanggaranNama}</span
										>
									</p>
									<p class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
										{formatTanggal(riwayat.tanggal)}
										{#if riwayat.pelaporNama}
											· pelapor {riwayat.pelaporNama}
										{/if}
									</p>
									{#if riwayat.catatan}
										<p class="mt-1 text-[11px] text-slate-600 italic dark:text-zinc-300">
											{riwayat.catatan}
										</p>
									{/if}
								</div>
								<div class="flex shrink-0 items-center gap-1.5">
									<span
										class="inline-flex items-center rounded-md border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
									>
										+{riwayat.poin}
									</span>
									<button
										type="button"
										class="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
										onclick={() => konfirmasiHapusPoin(riwayat)}
										aria-label="Hapus riwayat"
										title="Hapus riwayat"
									>
										<Icon name="del" class="h-3 w-3" />
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</div>
</section>

{#if tambahTerbuka}
	<dialog
		class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]"
		open
		onclose={() => (tambahTerbuka = false)}
	>
		<div
			class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="mb-3 border-b border-slate-100 pb-3 text-base font-bold dark:border-zinc-800">
				Tambah Pelanggaran
			</h3>
			<FormEnhance
				id="form-tambah-pelanggaran"
				action="?/tambahPelanggaran"
				onsuccess={() => (tambahTerbuka = false)}
			>
				{#snippet children({ submitting })}
					<div class="space-y-3">
						<div>
							<label
								for="pelanggaran-nama"
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Nama pelanggaran</label
							>
							<input
								id="pelanggaran-nama"
								name="nama"
								type="text"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								placeholder="Contoh: Terlambat masuk kelas"
								required
								disabled={submitting}
							/>
						</div>
						<div>
							<label
								for="pelanggaran-poin"
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Poin</label
							>
							<input
								id="pelanggaran-poin"
								name="poin"
								type="number"
								min="0"
								step="1"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								required
								disabled={submitting}
							/>
						</div>
						<div>
							<label
								for="pelanggaran-kategori"
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Kategori (opsional)</label
							>
							<input
								id="pelanggaran-kategori"
								name="kategori"
								type="text"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								placeholder="Contoh: Kedisiplinan"
								disabled={submitting}
							/>
						</div>
					</div>
					<div
						class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800"
					>
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (tambahTerbuka = false)}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
							disabled={submitting}
						>
							<Icon name="save" class="h-3.5 w-3.5" />
							Simpan
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop bg-transparent"
			onclick={() => (tambahTerbuka = false)}
		></button>
	</dialog>
{/if}

{#if beriPoinTerbuka && targetMuridId !== null}
	<dialog class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]" open onclose={tutupBeriPoin}>
		<div
			class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<div class="mb-3 border-b border-slate-100 pb-3 dark:border-zinc-800">
				<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">Beri Poin</h3>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Murid: <strong class="text-slate-700 dark:text-zinc-200">{targetMuridNama}</strong>
				</p>
			</div>
			<FormEnhance id="form-beri-poin" action="?/beriPoin" onsuccess={() => tutupBeriPoin()}>
				{#snippet children({ submitting })}
					<input type="hidden" name="muridId" value={targetMuridId} />
					<div class="space-y-3">
						<div>
							<label
								for="beri-pelanggaran"
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Pelanggaran</label
							>
							<div class="relative flex items-center">
								<select
									id="beri-pelanggaran"
									name="pelanggaranId"
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
									required
									disabled={submitting}
									onchange={(event) => (formBeriPelanggaranId = event.currentTarget.value)}
								>
									<option value="" disabled selected={!formBeriPelanggaranId}
										>Pilih pelanggaran</option
									>
									{#each data.daftarPelanggaran as pelanggaran (pelanggaran.id)}
										<option
											value={pelanggaran.id}
											selected={formBeriPelanggaranId === String(pelanggaran.id)}
										>
											{pelanggaran.nama} ({pelanggaran.poin} poin)
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
						</div>
						<div>
							<label
								for="beri-tanggal"
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Tanggal</label
							>
							<input
								id="beri-tanggal"
								type="date"
								name="tanggal"
								max={today}
								value={formBeriTanggal}
								onchange={(event) => (formBeriTanggal = event.currentTarget.value)}
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								required
								disabled={submitting}
							/>
						</div>
						<div>
							<label
								for="beri-catatan"
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Catatan (opsional)</label
							>
							<textarea
								id="beri-catatan"
								name="catatan"
								class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								rows="2"
								placeholder="Keterangan tambahan"
								disabled={submitting}
								oninput={(event) => (formBeriCatatan = event.currentTarget.value)}
								>{formBeriCatatan}</textarea
							>
						</div>
					</div>
					<div
						class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800"
					>
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={tutupBeriPoin}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
							disabled={submitting}
						>
							<Icon name="check" class="h-3.5 w-3.5" />
							Simpan
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop bg-transparent"
			onclick={tutupBeriPoin}
		></button>
	</dialog>
{/if}

{#if bulkBeriTerbuka && terpilihMurid.length}
	<dialog
		class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]"
		open
		onclose={() => (bulkBeriTerbuka = false)}
	>
		<div
			class="modal-box max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<div class="mb-3 border-b border-slate-100 pb-3 dark:border-zinc-800">
				<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">Beri Poin Massal</h3>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					{terpilihMurid.length} murid terpilih. Satu pelanggaran yang sama akan diberikan ke semuanya.
				</p>
			</div>
			<ul
				class="mb-3 max-h-24 space-y-1 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-800/50"
			>
				{#each muridTerpilih as murid (murid.id)}
					<li class="flex items-center gap-1.5">
						<Icon
							name="check"
							class="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
						/>
						<span class="truncate font-medium">{murid.nama}</span>
						{#if murid.kelasNama}
							<span class="text-[11px] text-slate-500 dark:text-zinc-400">· {murid.kelasNama}</span>
						{/if}
					</li>
				{/each}
			</ul>
			<FormEnhance
				id="form-beri-poin-massal"
				action="?/beriPoinMassal"
				onsuccess={() => selesaiBulkBeriPoin()}
			>
				{#snippet children({ submitting })}
					<input type="hidden" name="muridIds" value={JSON.stringify(terpilihMurid)} />
					<div class="space-y-3">
						<div>
							<label
								for="bulk-pelanggaran"
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Pelanggaran</label
							>
							<div class="relative flex items-center">
								<select
									id="bulk-pelanggaran"
									name="pelanggaranId"
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
									required
									disabled={submitting}
									onchange={(event) => (bulkPelanggaranId = event.currentTarget.value)}
								>
									<option value="" disabled selected={!bulkPelanggaranId}>Pilih pelanggaran</option>
									{#each data.daftarPelanggaran as pelanggaran (pelanggaran.id)}
										<option
											value={pelanggaran.id}
											selected={bulkPelanggaranId === String(pelanggaran.id)}
										>
											{pelanggaran.nama} ({pelanggaran.poin} poin)
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
						</div>
						<div>
							<label
								for="bulk-tanggal"
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Tanggal</label
							>
							<input
								id="bulk-tanggal"
								type="date"
								name="tanggal"
								max={today}
								value={bulkTanggal}
								onchange={(event) => (bulkTanggal = event.currentTarget.value)}
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								required
								disabled={submitting}
							/>
						</div>
						<div>
							<label
								for="bulk-catatan"
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Catatan (opsional)</label
							>
							<textarea
								id="bulk-catatan"
								name="catatan"
								class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								rows="2"
								placeholder="Keterangan tambahan"
								disabled={submitting}
								oninput={(event) => (bulkCatatan = event.currentTarget.value)}
								>{bulkCatatan}</textarea
							>
						</div>
					</div>
					<div
						class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800"
					>
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (bulkBeriTerbuka = false)}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
							disabled={submitting}
						>
							<Icon name="check" class="h-3.5 w-3.5" />
							Simpan ({terpilihMurid.length})
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop bg-transparent"
			onclick={() => (bulkBeriTerbuka = false)}
		></button>
	</dialog>
{/if}

<FormEnhance id="form-hapus-pelanggaran" action="?/hapusPelanggaran" class="hidden">
	<input type="hidden" name="id" value="" />
</FormEnhance>

<FormEnhance id="form-hapus-poin" action="?/hapusPoin" class="hidden">
	<input type="hidden" name="id" value="" />
</FormEnhance>
