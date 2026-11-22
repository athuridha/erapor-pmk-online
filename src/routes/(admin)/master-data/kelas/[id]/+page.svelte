<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import { faseBadgeClass } from '$lib/components/kelas/fase';
	import PindahMuridModal from '$lib/components/murid/pindah-murid-modal.svelte';
	import { isAdminUser } from '../../../../pengguna/permissions';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	interface MuridDetail {
		id: number;
		nis: string;
		nisn: string;
		nama: string;
		jenisKelamin: string;
		wali: string | null;
		waliAsuh: string | null;
		nilaiTerisi: number;
		nilaiDiharapkan: number;
		mapelKosong: number;
		rataNilai: number | null;
		sakit: number;
		izin: number;
		alfa: number;
	}

	interface MapelDetail {
		id: number;
		nama: string;
		kode: string | null;
		kkm: number;
		jenis: string;
		pengampu: string | null;
		pengampuNip: string | null;
		guruAkun: Array<{ username: string; nama: string; type: string }>;
		nilaiTerisi: number;
		nilaiDiharapkan: number;
		rataNilai: number | null;
	}

	const kelas = $derived(data.kelas);
	const bisaKelola = $derived(isAdminUser(page.data.user));
	const ringkasan = $derived(data.ringkasan);
	const daftarMurid = $derived((data.daftarMurid ?? []) as MuridDetail[]);
	const daftarMapel = $derived((data.daftarMapel ?? []) as MapelDetail[]);

	let cariMurid = $state('');

	const muridTersaring = $derived.by(() => {
		const query = cariMurid.trim().toLowerCase();
		if (!query) return daftarMurid;
		return daftarMurid.filter(
			(murid) =>
				murid.nama.toLowerCase().includes(query) ||
				murid.nis.toLowerCase().includes(query) ||
				(murid.wali ?? '').toLowerCase().includes(query)
		);
	});
	let terpilih = $state<number[]>([]);
	let pindahTerbuka = $state(false);
	const semuaTerpilih = $derived(
		muridTersaring.length > 0 && muridTersaring.every((murid) => terpilih.includes(murid.id))
	);
	const muridTerpilih = $derived(
		muridTersaring
			.filter((murid) => terpilih.includes(murid.id))
			.map((murid) => ({ id: murid.id, nama: murid.nama, nis: murid.nis }))
	);

	function togglePilih(id: number, checked: boolean) {
		terpilih = checked ? [...new Set([...terpilih, id])] : terpilih.filter((item) => item !== id);
	}

	function toggleSemua(checked: boolean) {
		terpilih = checked ? muridTersaring.map((murid) => murid.id) : [];
	}
</script>

<div class="space-y-5">
	<header class="flex flex-wrap items-start justify-between gap-3">
		<div class="space-y-1.5">
			<div class="flex flex-wrap items-center gap-2">
				<a
					class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-600 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
					href="/master-data/kelas"
				>
					<Icon name="left" class="h-3.5 w-3.5" />
					Kembali ke Semua Kelas
				</a>
				{#if bisaKelola}
					<a
						class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
						href="/master-data/kelas/form/{kelas.id}"
					>
						<Icon name="edit" class="h-3.5 w-3.5" />
						Edit Kelas &amp; Wali Kelas
					</a>
				{/if}
			</div>
			<h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				{kelas.nama}
			</h1>
			<div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
				{#if kelas.fase}
					<span
						class={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${faseBadgeClass(kelas.fase)}`}
					>
						{kelas.fase}
					</span>
				{/if}
				<span>{kelas.semester ?? 'Semester belum ditentukan'}</span>
				{#if kelas.tahunAjaran}
					<span>· {kelas.tahunAjaran}</span>
				{/if}
			</div>
		</div>
	</header>

	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div
				class="rounded-xl border border-slate-200/75 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/45"
			>
				<p class="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Wali Kelas</p>
				<p class="mt-1 text-sm font-bold text-slate-900 dark:text-zinc-100">
					{kelas.waliKelas ?? 'Belum ditentukan'}
				</p>
				{#if kelas.waliKelasNip}
					<p class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
						NIP {kelas.waliKelasNip}
					</p>
				{/if}
			</div>
			<div
				class="rounded-xl border border-slate-200/75 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/45"
			>
				<p class="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Wali Asuh</p>
				<p class="mt-1 text-sm font-bold text-slate-900 dark:text-zinc-100">
					{kelas.waliAsuh ?? 'Belum ditentukan'}
				</p>
			</div>
			<div
				class="rounded-xl border border-slate-200/75 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/45"
			>
				<p class="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Murid</p>
				<p class="mt-1 text-sm font-bold text-slate-900 dark:text-zinc-100">
					{ringkasan.jumlahMurid}
				</p>
				<p class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
					{ringkasan.lakiLaki} laki-laki · {ringkasan.perempuan} perempuan
				</p>
			</div>
			<div
				class="rounded-xl border border-slate-200/75 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/45"
			>
				<p class="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
					Guru & Mata Pelajaran
				</p>
				<p class="mt-1 text-sm font-bold text-slate-900 dark:text-zinc-100">
					{ringkasan.jumlahGuru} guru · {ringkasan.jumlahMapel} mapel
				</p>
				<p class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
					Sakit {ringkasan.sakit} · Izin {ringkasan.izin} · Alfa {ringkasan.alfa}
				</p>
			</div>
		</div>
	</section>

	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<header
			class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800"
		>
			<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Daftar Siswa
			</h2>
			<div class="flex w-full items-center gap-2 sm:w-auto">
				{#if terpilih.length}
					<button
						type="button"
						class="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
						onclick={() => (pindahTerbuka = true)}
					>
						<Icon name="move" class="h-3.5 w-3.5" />
						Pindah ({terpilih.length})
					</button>
				{/if}
				<div class="relative flex w-full max-w-64 items-center">
					<span
						aria-hidden="true"
						class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
					>
						<Icon name="search" class="h-3.5 w-3.5" />
					</span>
					<input
						type="search"
						placeholder="Cari nama / NIS / wali..."
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						bind:value={cariMurid}
					/>
				</div>
			</div>
		</header>

		{#if muridTersaring.length === 0}
			<p class="text-xs text-slate-500 dark:text-zinc-400">Belum ada siswa di kelas ini.</p>
		{:else}
			<div
				class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<table class="w-full border-collapse text-xs">
					<thead>
						<tr
							class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
						>
							<th class="w-10 px-3 py-2.5">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={semuaTerpilih}
									onchange={(event) => toggleSemua(event.currentTarget.checked)}
									aria-label="Pilih semua murid"
								/>
							</th>
							<th class="px-3.5 py-2.5">No</th>
							<th class="px-3.5 py-2.5">Nama</th>
							<th class="px-3.5 py-2.5">NIS</th>
							<th class="px-3.5 py-2.5">L/P</th>
							<th class="px-3.5 py-2.5">Wali Murid</th>
							<th class="px-3.5 py-2.5">Wali Asuh</th>
							<th class="px-3.5 py-2.5 text-right">Nilai</th>
							<th class="px-3.5 py-2.5 text-right">Rata-rata</th>
							<th class="px-3.5 py-2.5 text-right">S/I/A</th>
							<th class="px-3.5 py-2.5 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
						{#each muridTersaring as murid, index (murid.id)}
							<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
								<td class="px-3 py-2.5 text-center">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										checked={terpilih.includes(murid.id)}
										onchange={(event) => togglePilih(murid.id, event.currentTarget.checked)}
										aria-label="Pilih {murid.nama}"
									/>
								</td>
								<td class="px-3.5 py-2.5 text-slate-500 dark:text-zinc-400">{index + 1}</td>
								<td class="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-zinc-100">
									{murid.nama}
								</td>
								<td class="px-3.5 py-2.5 text-slate-600 dark:text-zinc-300">{murid.nis}</td>
								<td class="px-3.5 py-2.5 text-slate-600 dark:text-zinc-300">{murid.jenisKelamin}</td
								>
								<td class="px-3.5 py-2.5 text-slate-600 dark:text-zinc-300">
									{murid.wali ?? '-'}
								</td>
								<td class="px-3.5 py-2.5 text-slate-600 dark:text-zinc-300">
									{murid.waliAsuh ?? '-'}
								</td>
								<td class="px-3.5 py-2.5 text-right text-slate-700 dark:text-zinc-300">
									{murid.nilaiTerisi}/{murid.nilaiDiharapkan}
									{#if murid.mapelKosong > 0}
										<div class="text-[11px] text-slate-400 dark:text-zinc-500">
											{murid.mapelKosong} mapel kosong
										</div>
									{/if}
								</td>
								<td class="px-3.5 py-2.5 text-right font-medium text-slate-900 dark:text-zinc-100">
									{murid.rataNilai ?? '-'}
								</td>
								<td class="px-3.5 py-2.5 text-right text-slate-600 dark:text-zinc-300">
									{murid.sakit}/{murid.izin}/{murid.alfa}
								</td>
								<td class="px-3 py-2.5">
									<div class="flex items-center justify-end gap-1">
										{#if bisaKelola}
											<button
												type="button"
												class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
												onclick={() => {
													terpilih = [murid.id];
													pindahTerbuka = true;
												}}
												title="Pindah kelas {murid.nama}"
												aria-label="Pindah kelas {murid.nama}"
											>
												<Icon name="move" class="h-3.5 w-3.5" />
											</button>
											<a
												class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
												href="/master-data/murid/form/{murid.id}"
												title="Edit data {murid.nama}"
												aria-label="Edit data {murid.nama}"
											>
												<Icon name="edit" class="h-3.5 w-3.5" />
											</a>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<h2
			class="mb-4 border-b border-slate-100 pb-3 text-base font-bold tracking-tight text-slate-900 dark:border-zinc-800 dark:text-zinc-100"
		>
			Mata Pelajaran & Guru Pengampu
		</h2>
		{#if daftarMapel.length === 0}
			<p class="text-xs text-slate-500 dark:text-zinc-400">
				Belum ada mata pelajaran di kelas ini.
			</p>
		{:else}
			<div
				class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
			>
				<table class="w-full border-collapse text-xs">
					<thead>
						<tr
							class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
						>
							<th class="px-3.5 py-2.5">Mata Pelajaran</th>
							<th class="px-3.5 py-2.5">Pengampu</th>
							<th class="px-3.5 py-2.5">Akun Guru</th>
							<th class="px-3.5 py-2.5 text-right">Nilai Terisi</th>
							<th class="px-3.5 py-2.5 text-right">Rata-rata</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
						{#each daftarMapel as mapel (mapel.id)}
							<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
								<td class="px-3.5 py-2.5">
									<div class="font-semibold text-slate-900 dark:text-zinc-100">{mapel.nama}</div>
									{#if mapel.kode}
										<div class="text-[11px] text-slate-500 dark:text-zinc-400">{mapel.kode}</div>
									{/if}
								</td>
								<td class="px-3.5 py-2.5 text-slate-700 dark:text-zinc-300">
									{mapel.pengampu ?? 'Belum ditentukan'}
									{#if mapel.pengampuNip}
										<div class="text-[11px] text-slate-500 dark:text-zinc-400">
											NIP {mapel.pengampuNip}
										</div>
									{/if}
								</td>
								<td class="px-3.5 py-2.5 text-slate-600 dark:text-zinc-300">
									{#if mapel.guruAkun.length === 0}
										-
									{:else}
										<ul class="space-y-0.5">
											{#each mapel.guruAkun as guru (guru.username)}
												<li>
													{guru.nama}
													<span class="text-[11px] text-slate-500 dark:text-zinc-400"
														>({guru.username})</span
													>
												</li>
											{/each}
										</ul>
									{/if}
								</td>
								<td class="px-3.5 py-2.5 text-right text-slate-700 dark:text-zinc-300">
									{mapel.nilaiTerisi}/{mapel.nilaiDiharapkan}
								</td>
								<td class="px-3.5 py-2.5 text-right font-medium text-slate-900 dark:text-zinc-100">
									{mapel.rataNilai ?? '-'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<PindahMuridModal
	bind:isOpen={pindahTerbuka}
	{muridTerpilih}
	kelasTujuan={data.kelasTujuan}
	action="?/pindahMurid"
	onSuccess={() => (terpilih = [])}
/>
