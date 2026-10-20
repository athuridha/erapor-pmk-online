<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import { faseBadgeClass } from '$lib/components/kelas/fase';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let cariKelas = $state('');
	let filterFase = $state('semua');

	interface RingkasanKelas {
		id: number;
		nama: string;
		fase: string | null;
		waliKelas: string | null;
		waliKelasNip: string | null;
		waliAsuh: string | null;
		jumlahMurid: number;
		jumlahLakiLaki: number;
		jumlahPerempuan: number;
		jumlahMapel: number;
		jumlahGuru: number;
		guru: string[];
		nilaiTerisi: number;
		nilaiDiharapkan: number;
		persenNilai: number;
		rataNilai: number | null;
		sakit: number;
		izin: number;
		alfa: number;
		muridDenganPresensi: number;
		perluPerhatian: boolean;
	}

	const daftarKelas = $derived((data.daftarKelas ?? []) as RingkasanKelas[]);
	const ringkasan = $derived(data.ringkasan ?? null);
	const semesterOptions = $derived(data.semesterOptions ?? []);
	const semesterTerpilih = $derived(data.semesterTerpilih ?? null);
	const semesterAktifId = $derived(data.semesterAktifId ?? null);
	// Kelas aktif selalu terikat semester aktif, jadi berpindah kelas hanya
	// bermakna pada semester aktif.
	const bolehPindah = $derived(
		semesterAktifId != null && semesterTerpilih != null && semesterTerpilih.id === semesterAktifId
	);

	const faseOptions = $derived(
		[...new Set(daftarKelas.map((kelas) => kelas.fase ?? '').filter(Boolean))].sort()
	);

	const kelasTersaring = $derived.by(() => {
		const query = cariKelas.trim().toLowerCase();
		return daftarKelas.filter((kelas) => {
			if (filterFase !== 'semua' && (kelas.fase ?? '') !== filterFase) return false;
			if (!query) return true;
			return (
				kelas.nama.toLowerCase().includes(query) ||
				(kelas.waliKelas ?? '').toLowerCase().includes(query) ||
				kelas.guru.some((nama) => nama.toLowerCase().includes(query))
			);
		});
	});

	function gantiSemester(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		const url = value ? `/semua-kelas?semester=${value}` : '/semua-kelas';
		void goto(url, { invalidateAll: true });
	}

	function statusNilai(persen: number) {
		if (persen >= 90) return { label: 'Lengkap', badge: 'badge-success' };
		if (persen >= 70) return { label: 'Baik', badge: 'badge-warning' };
		return { label: 'Perlu dilengkapi', badge: 'badge-error' };
	}
</script>

<div class="space-y-4">
	<header class="flex flex-col gap-2">
		<h1 class="text-2xl font-bold">Semua Kelas</h1>
		<p class="text-base-content/70 text-sm">
			Pindah kelas seperti menu “Pindah Kelas”, tapi mencakup semua kelas — sekaligus melihat
			ringkasan tiap kelas: jumlah murid, guru pengampu, kelengkapan nilai sumatif, dan presensi.
		</p>
	</header>

	{#if !semesterTerpilih}
		<div class="alert alert-warning">
			<Icon name="warning" />
			<span>
				Belum ada semester yang bisa ditampilkan. Setel tahun ajaran dan semester terlebih dahulu di
				menu Akademik.
			</span>
		</div>
	{:else}
		<div class="card bg-base-100 rounded-box shadow-md">
			<div class="card-body gap-4 p-4">
				<div class="flex flex-wrap items-end gap-3">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Semester</legend>
						<select
							class="select select-bordered w-full min-w-56"
							value={semesterTerpilih.id}
							onchange={gantiSemester}
						>
							{#each semesterOptions as semester (semester.id)}
								<option value={semester.id}>
									{semester.nama} — {semester.tahunAjaran}
								</option>
							{/each}
						</select>
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Fase</legend>
						<select class="select select-bordered w-full min-w-40" bind:value={filterFase}>
							<option value="semua">Semua fase</option>
							{#each faseOptions as fase (fase)}
								<option value={fase}>{fase}</option>
							{/each}
						</select>
					</fieldset>
					<fieldset class="fieldset flex-1">
						<legend class="fieldset-legend">Cari</legend>
						<label class="input w-full">
							<Icon name="search" />
							<input
								type="search"
								placeholder="Nama kelas, wali kelas, atau guru…"
								bind:value={cariKelas}
							/>
						</label>
					</fieldset>
				</div>

				{#if ringkasan}
					<div class="stats stats-vertical w-full bg-base-200/60 sm:stats-horizontal">
						<div class="stat">
							<div class="stat-title">Kelas</div>
							<div class="stat-value text-2xl">{ringkasan.totalKelas}</div>
							<div class="stat-desc">rombel aktif semester ini</div>
						</div>
						<div class="stat">
							<div class="stat-title">Murid</div>
							<div class="stat-value text-2xl">{ringkasan.totalMurid}</div>
							<div class="stat-desc">
								{ringkasan.totalLakiLaki} laki-laki · {ringkasan.totalPerempuan} perempuan
							</div>
						</div>
						<div class="stat">
							<div class="stat-title">Guru Mengajar</div>
							<div class="stat-value text-2xl">{ringkasan.totalGuru}</div>
							<div class="stat-desc">guru dengan mapel di semester ini</div>
						</div>
						<div class="stat">
							<div class="stat-title">Kelengkapan Nilai</div>
							<div class="stat-value text-2xl">{ringkasan.persenNilai}%</div>
							<div class="stat-desc">nilai sumatif terisi</div>
						</div>
						<div class="stat">
							<div class="stat-title">Perlu Perhatian</div>
							<div
								class="stat-value text-2xl {ringkasan.kelasPerluPerhatian > 0
									? 'text-error'
									: 'text-success'}"
							>
								{ringkasan.kelasPerluPerhatian}
							</div>
							<div class="stat-desc">kelas dengan nilai &lt; 50%</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="card bg-base-100 rounded-box shadow-md">
			<div class="card-body p-4">
				{#if kelasTersaring.length === 0}
					<div class="alert alert-info">
						<Icon name="info" />
						<span>Tidak ada kelas yang cocok dengan filter.</span>
					</div>
				{:else}
					{#if !bolehPindah}
						<div class="alert alert-info mb-3">
							<Icon name="info" />
							<span>
								Kelas aktif mengikuti semester aktif. Ringkasan semester lain hanya untuk melihat
								data.
							</span>
						</div>
					{/if}
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>Kelas</th>
									<th>Wali Kelas</th>
									<th class="text-right">Murid</th>
									<th class="text-right">Guru</th>
									<th class="text-right">Mapel</th>
									<th class="min-w-44">Kelengkapan Nilai</th>
									<th class="text-right">Rata-rata</th>
									<th class="text-right">Sakit/Izin/Alfa</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{#each kelasTersaring as kelas (kelas.id)}
									{@const status = statusNilai(kelas.persenNilai)}
									<tr>
										<td>
											<a class="link link-hover font-semibold" href="/semua-kelas/{kelas.id}">
												{kelas.nama}
											</a>
											{#if kelas.fase}
												<span class={`badge badge-soft badge-sm ${faseBadgeClass(kelas.fase)}`}>
													{kelas.fase}
												</span>
											{/if}
										</td>
										<td>
											{#if kelas.waliKelas}
												<div>{kelas.waliKelas}</div>
												{#if kelas.waliAsuh}
													<div class="text-base-content/60 text-xs">
														Wali asuh: {kelas.waliAsuh}
													</div>
												{/if}
											{:else}
												<span class="text-base-content/50 text-xs">Belum ditentukan</span>
											{/if}
										</td>
										<td class="text-right">
											<div class="font-semibold">{kelas.jumlahMurid}</div>
											<div class="text-base-content/60 text-xs">
												{kelas.jumlahLakiLaki} L / {kelas.jumlahPerempuan} P
											</div>
										</td>
										<td class="text-right">
											<div class="font-semibold">{kelas.jumlahGuru}</div>
											{#if kelas.guru.length > 0}
												<div class="text-base-content/60 max-w-40 truncate text-xs">
													{kelas.guru.join(', ')}
												</div>
											{/if}
										</td>
										<td class="text-right">{kelas.jumlahMapel}</td>
										<td>
											<div class="flex items-center gap-2">
												<progress
													class="progress progress-primary w-24"
													max="100"
													value={kelas.persenNilai}
												></progress>
												<span class="text-xs font-semibold">{kelas.persenNilai}%</span>
											</div>
											<div class="text-base-content/60 text-xs">
												{kelas.nilaiTerisi}/{kelas.nilaiDiharapkan} nilai
											</div>
											<span class={`badge badge-soft badge-xs ${status.badge}`}>
												{status.label}
											</span>
										</td>
										<td class="text-right">
											{#if kelas.rataNilai != null}
												<span class="font-semibold">{kelas.rataNilai}</span>
											{:else}
												<span class="text-base-content/50 text-xs">-</span>
											{/if}
										</td>
										<td class="text-right">
											<span class="text-xs">
												{kelas.sakit} / {kelas.izin} / {kelas.alfa}
											</span>
											<div class="text-base-content/60 text-xs">
												{kelas.muridDenganPresensi} murid punya data
											</div>
										</td>
										<td>
											<form method="POST" action="?/pilihKelas">
												<input type="hidden" name="kelasId" value={kelas.id} />
												<button
													class="btn btn-soft btn-info btn-xs shadow-none"
													type="submit"
													disabled={!bolehPindah}
													title={bolehPindah
														? 'Jadikan kelas ini kelas aktif'
														: 'Kelas aktif mengikuti semester aktif'}
												>
													<Icon name="right" />
													Pindah
												</button>
											</form>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
