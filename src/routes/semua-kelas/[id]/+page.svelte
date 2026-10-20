<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { faseBadgeClass } from '$lib/components/kelas/fase';
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
</script>

<div class="space-y-4">
	<header class="flex flex-wrap items-start justify-between gap-3">
		<div class="space-y-1">
			<a class="btn btn-ghost btn-xs shadow-none" href="/semua-kelas">
				<Icon name="left" />
				Kembali ke Semua Kelas
			</a>
			<h1 class="text-2xl font-bold">{kelas.nama}</h1>
			<div class="text-base-content/70 flex flex-wrap items-center gap-2 text-sm">
				{#if kelas.fase}
					<span class={`badge badge-soft ${faseBadgeClass(kelas.fase)}`}>{kelas.fase}</span>
				{/if}
				<span>{kelas.semester ?? 'Semester belum ditentukan'}</span>
				{#if kelas.tahunAjaran}
					<span>· {kelas.tahunAjaran}</span>
				{/if}
			</div>
		</div>
		<form method="POST" action="/semua-kelas?/pilihKelas">
			<input type="hidden" name="kelasId" value={kelas.id} />
			<button class="btn btn-soft btn-info btn-sm shadow-none" type="submit">
				<Icon name="right" />
				Pindah ke Kelas Ini
			</button>
		</form>
	</header>

	<div class="card bg-base-100 rounded-box shadow-md">
		<div class="card-body grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<p class="text-base-content/60 text-xs">Wali Kelas</p>
				<p class="text-lg font-semibold">{kelas.waliKelas ?? 'Belum ditentukan'}</p>
				{#if kelas.waliKelasNip}
					<p class="text-base-content/60 text-xs">NIP {kelas.waliKelasNip}</p>
				{/if}
			</div>
			<div>
				<p class="text-base-content/60 text-xs">Wali Asuh</p>
				<p class="text-lg font-semibold">{kelas.waliAsuh ?? 'Belum ditentukan'}</p>
			</div>
			<div>
				<p class="text-base-content/60 text-xs">Murid</p>
				<p class="text-lg font-semibold">{ringkasan.jumlahMurid}</p>
				<p class="text-base-content/60 text-xs">
					{ringkasan.lakiLaki} laki-laki · {ringkasan.perempuan} perempuan
				</p>
			</div>
			<div>
				<p class="text-base-content/60 text-xs">Guru & Mata Pelajaran</p>
				<p class="text-lg font-semibold">
					{ringkasan.jumlahGuru} guru · {ringkasan.jumlahMapel} mapel
				</p>
				<p class="text-base-content/60 text-xs">
					Sakit {ringkasan.sakit} · Izin {ringkasan.izin} · Alfa {ringkasan.alfa}
				</p>
			</div>
		</div>
	</div>

	<div class="card bg-base-100 rounded-box shadow-md">
		<div class="card-body gap-3 p-4">
			<header class="flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-lg font-bold">Daftar Siswa</h2>
				<label class="input input-sm w-full max-w-64">
					<Icon name="search" />
					<input type="search" placeholder="Cari nama / NIS / wali…" bind:value={cariMurid} />
				</label>
			</header>

			{#if muridTersaring.length === 0}
				<p class="text-base-content/60 text-sm">Belum ada siswa di kelas ini.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr>
								<th>No</th>
								<th>Nama</th>
								<th>NIS</th>
								<th>L/P</th>
								<th>Wali Murid</th>
								<th>Wali Asuh</th>
								<th class="text-right">Nilai</th>
								<th class="text-right">Rata-rata</th>
								<th class="text-right">S/I/A</th>
							</tr>
						</thead>
						<tbody>
							{#each muridTersaring as murid, index (murid.id)}
								<tr>
									<td class="text-base-content/60">{index + 1}</td>
									<td class="font-semibold">{murid.nama}</td>
									<td class="text-xs">{murid.nis}</td>
									<td>{murid.jenisKelamin}</td>
									<td class="text-sm">{murid.wali ?? '—'}</td>
									<td class="text-sm">{murid.waliAsuh ?? '—'}</td>
									<td class="text-right">
										{murid.nilaiTerisi}/{murid.nilaiDiharapkan}
										{#if murid.mapelKosong > 0}
											<div class="text-base-content/60 text-xs">
												{murid.mapelKosong} mapel kosong
											</div>
										{/if}
									</td>
									<td class="text-right">
										{murid.rataNilai ?? '—'}
									</td>
									<td class="text-right text-xs">
										{murid.sakit}/{murid.izin}/{murid.alfa}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>

	<div class="card bg-base-100 rounded-box shadow-md">
		<div class="card-body gap-3 p-4">
			<h2 class="text-lg font-bold">Mata Pelajaran & Guru Pengampu</h2>
			{#if daftarMapel.length === 0}
				<p class="text-base-content/60 text-sm">Belum ada mata pelajaran di kelas ini.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr>
								<th>Mata Pelajaran</th>
								<th>Pengampu</th>
								<th>Akun Guru</th>
								<th class="text-right">Nilai Terisi</th>
								<th class="text-right">Rata-rata</th>
							</tr>
						</thead>
						<tbody>
							{#each daftarMapel as mapel (mapel.id)}
								<tr>
									<td>
										<div class="font-semibold">{mapel.nama}</div>
										{#if mapel.kode}
											<div class="text-base-content/60 text-xs">{mapel.kode}</div>
										{/if}
									</td>
									<td class="text-sm">
										{mapel.pengampu ?? 'Belum ditentukan'}
										{#if mapel.pengampuNip}
											<div class="text-base-content/60 text-xs">NIP {mapel.pengampuNip}</div>
										{/if}
									</td>
									<td class="text-sm">
										{#if mapel.guruAkun.length === 0}
											—
										{:else}
											<ul class="space-y-0.5">
												{#each mapel.guruAkun as guru (guru.username)}
													<li>{guru.nama} <span class="text-xs">({guru.username})</span></li>
												{/each}
											</ul>
										{/if}
									</td>
									<td class="text-right">{mapel.nilaiTerisi}/{mapel.nilaiDiharapkan}</td>
									<td class="text-right">{mapel.rataNilai ?? '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
