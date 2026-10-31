<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	interface RingkasanKelas {
		id: number;
		nama: string;
		fase: string | null;
		waliKelas: string | null;
		jumlahMurid: number;
		jumlahGuru: number;
		persenNilai: number;
		perluPerhatian: boolean;
	}

	interface Total {
		totalKelas: number;
		totalMurid: number;
		totalLakiLaki: number;
		totalPerempuan: number;
		totalGuru: number;
		persenNilai: number;
		kelasPerluPerhatian: number;
	}

	let {
		ringkasan,
		daftarKelas
	}: {
		ringkasan: Total;
		daftarKelas: RingkasanKelas[];
	} = $props();

	const perluPerhatian = $derived(daftarKelas.filter((kelas) => kelas.perluPerhatian));
</script>

<section class="card bg-base-100/80 backdrop-blur-md rounded-3xl border border-emerald-200/60 dark:border-emerald-200/40 shadow-sm">
	<div class="card-body gap-4 p-4">
		<header class="flex flex-wrap items-start justify-between gap-2">
			<div>
				<h2 class="text-lg font-bold">Ringkasan Semua Kelas</h2>
				<p class="text-base-content/60 text-xs">
					Monitoring seluruh rombel: murid, guru pengampu, dan kelengkapan nilai sumatif.
				</p>
			</div>
			<a class="btn btn-soft btn-info btn-xs shadow-none" href="/semua-kelas">
				<Icon name="grid" />
				Buka Semua Kelas
			</a>
		</header>

		<div class="stats stats-vertical w-full bg-base-200/60 sm:stats-horizontal">
			<div class="stat px-3 py-2">
				<div class="stat-title text-xs">Kelas</div>
				<div class="stat-value text-xl">{ringkasan.totalKelas}</div>
				<div class="stat-desc text-xs">
					{ringkasan.totalLakiLaki} L · {ringkasan.totalPerempuan} P
				</div>
			</div>
			<div class="stat px-3 py-2">
				<div class="stat-title text-xs">Murid</div>
				<div class="stat-value text-xl">{ringkasan.totalMurid}</div>
				<div class="stat-desc text-xs">semester aktif</div>
			</div>
			<div class="stat px-3 py-2">
				<div class="stat-title text-xs">Guru Mengajar</div>
				<div class="stat-value text-xl">{ringkasan.totalGuru}</div>
				<div class="stat-desc text-xs">unik per mapel</div>
			</div>
			<div class="stat px-3 py-2">
				<div class="stat-title text-xs">Kelengkapan Nilai</div>
				<div class="stat-value text-xl">{ringkasan.persenNilai}%</div>
				<div class="stat-desc text-xs">nilai sumatif terisi</div>
			</div>
			<div class="stat px-3 py-2">
				<div class="stat-title text-xs">Perlu Perhatian</div>
				<div
					class="stat-value text-xl {ringkasan.kelasPerluPerhatian > 0
						? 'text-error'
						: 'text-success'}"
				>
					{ringkasan.kelasPerluPerhatian}
				</div>
				<div class="stat-desc text-xs">kelas dengan nilai &lt; 50%</div>
			</div>
		</div>

		{#if perluPerhatian.length > 0}
			<div class="alert alert-warning alert-soft p-3 text-xs">
				<Icon name="warning" />
				<span>
					{perluPerhatian.map((kelas) => kelas.nama).join(', ')} — nilai sumatif masih di bawah 50%.
				</span>
			</div>
		{/if}

		{#if daftarKelas.length === 0}
			<p class="text-base-content/60 text-sm">Belum ada kelas pada semester aktif.</p>
		{:else}
			<div class="max-h-80 overflow-y-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Kelas</th>
							<th>Wali Kelas</th>
							<th class="text-right">Murid</th>
							<th class="text-right">Guru</th>
							<th class="min-w-36">Kelengkapan Nilai</th>
						</tr>
					</thead>
					<tbody>
						{#each daftarKelas as kelas (kelas.id)}
							<tr>
								<td>
									<div class="font-semibold">{kelas.nama}</div>
									{#if kelas.fase}
										<div class="text-base-content/60 text-xs">{kelas.fase}</div>
									{/if}
								</td>
								<td class="text-sm">
									{kelas.waliKelas ?? '—'}
								</td>
								<td class="text-right">{kelas.jumlahMurid}</td>
								<td class="text-right">{kelas.jumlahGuru}</td>
								<td>
									<div class="flex items-center gap-2">
										<progress
											class="progress progress-primary w-20"
											max="100"
											value={kelas.persenNilai}
										></progress>
										<span class="text-xs font-semibold">{kelas.persenNilai}%</span>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</section>
