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

	function statusNilai(persen: number) {
		if (persen >= 90) return { label: 'Lengkap', badge: 'badge-success' };
		if (persen >= 70) return { label: 'Baik', badge: 'badge-warning' };
		return { label: 'Perlu dilengkapi', badge: 'badge-error' };
	}
</script>

<!-- Halaman Semua Kelas — style seragam login (glass card, emerald, statis) -->
<div class="login-bg relative flex min-h-screen w-full items-center justify-center py-8">
	<!-- Static glow blobs -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		<div class="blob-a absolute -top-32 -right-32 h-96 w-96 rounded-full"></div>
		<div class="blob-b absolute -bottom-32 -left-32 h-80 w-80 rounded-full"></div>
	</div>

	<!-- Konten -->
	<main class="relative z-10 w-full max-w-2xl mx-auto">
		<div class="login-card rounded-3xl p-8 shadow-2xl">
			<!-- Header -->
			<div class="mb-6 flex flex-col items-center gap-3 text-center">
				<div class="flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-200/60 bg-white p-2 shadow-lg">
					<img src="/logo.png" alt="Logo SMK Pratama Mulya" class="h-full w-full object-contain" />
				</div>
				<div>
					<h1 class="text-2xl font-black tracking-tight text-emerald-950 dark:text-emerald-200">
						e-Rapor SMK Pratama Mulya
					</h1>
					<p class="mt-1 text-sm font-medium text-emerald-700/80 dark:text-emerald-400/80">
						Semua Kelas — Sistem Administrasi dan Pelaporan Hasil Belajar
					</p>
				</div>
			</div>

			<!-- Filter & Ringkasan -->
			<div class="space-y-4">
				{#if !semesterTerpilih}
					<div class="alert alert-warning">
						<Icon name="warning" />
						<span>
							Belum ada semester yang bisa ditampilkan. Setel tahun ajaran dan semester terlebih dahulu di menu Akademik.
						</span>
					</div>
				{/if}

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Ringkasan kelas -->
					<div>
						<div class="rounded-3xl bg-base-100/80 backdrop-blur-md border border-emerald-200/60 dark:border-emerald-200/40 p-6 shadow-sm">
							<h2 class="text-lg font-bold text-emerald-950 dark:text-emerald-200 mb-2">
								Ringkasan Kelas
							</h2>
							<div class="grid grid-cols-2 gap-2 text-sm">
								<div>
									<div class="text-base-content/60 text-xs">Kelas aktif</div>
									<div class="font-bold">{ringkasan?.totalKelas ?? 0}</div>
								</div>
								<div>
									<div class="text-base-content/60 text-xs">Murid</div>
									<div class="font-bold">{ringkasan?.totalMurid ?? 0}</div>
								</div>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<div>
									<div class="text-base-content/60 text-xs">Guru</div>
									<div class="font-bold">{ringkasan?.totalGuru ?? 0}</div>
								</div>
								<div>
									<div class="text-base-content/60 text-xs">Mapel</div>
									<div class="font-bold">{ringkasan?.jumlahMapel ?? 0}</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Filter & Cari -->
					<div class="rounded-3xl bg-base-100/80 backdrop-blur-md border border-emerald-200/60 dark:border-emerald-200/40 p-4">
						<div class="flex flex-col sm:flex-row items-center justify-between gap-3">
							<div>
								<label class="text-base-content/60 text-sm">Semester</label>
								<select
									class="select select-bordered w-full min-w-56"
									value={semesterTerpilih?.id ?? ''}
									onchange={(e) =>
										goto(e.target.value ? `/semua-kelas?semester=${e.target.value}` : '/semua-kelas', { invalidateAll: true })}
								>
									<option value="">-- Pilih Semester --</option>
									{#each semesterOptions as semester (semester.id)}
										<option value={semester.id}>{semester.nama} — {semester.tahunAjaran}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="text-base-content/60 text-sm">Fase</label>
								<select
									class="select select-bordered w-full min-w-40"
									value={filterFase}
									onchange={(e) =>
										goto(
											filterFase === e.target.value
												? '/semua-kelas'
												: `/semua-kelas?filterFase=${e.target.value}`
										)}
								>
									<option value="semua">Semua fase</option>
									{#each faseOptions as fase (fase)}
										<option value={fase}>{fase}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="text-base-content/60 text-sm">Cari</label>
								<div class="relative">
									<Icon name="search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
									<input
										type="search"
										placeholder="Nama kelas, wali kelas, atau guru…"
										class="select-input select-input-sm w-full bg-transparent border-0 pr-8 pl-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
										bind:value={cariKelas}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				{#if kelasTersaring.length > 0 || ringkasan}
					<div class="rounded-3xl bg-base-100/80 backdrop-blur-md border border-emerald-200/60 dark:border-emerald-200/40 p-6 shadow-sm">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<!-- Statistik kelas -->
							<div>
								<div class="flex items-baseline mb-2">
									<div class="text-base-content/60 text-xs">Kelas aktif</div>
									<div class="font-bold">{ringkasan?.totalKelas ?? 0}</div>
								</div>
								<div>
									<div class="text-base-content/60 text-xs">Murid</div>
									<div class="font-bold">{ringkasan?.totalMurid ?? 0}</div>
								</div>
							</div>
							<div>
								<div class="text-base-content/60 text-xs">Guru</div>
								<div class="font-bold">{ringkasan?.totalGuru ?? 0}</div>
							</div>
							<div>
								<div class="text-base-content/60 text-xs">Mapel</div>
								<div class="font-bold">{ringkasan?.jumlahMapel ?? 0}</div>
							</div>
						</div>

						<!-- Statistik lanjutan -->
						<div class="mt-4 grid grid-cols-2 gap-2 text-sm">
							<div>
								<div class="text-base-content/60 text-xs">Sakit</div>
								<div class="font-bold">{ringkasan?.sakit ?? 0}</div>
							</div>
							<div>
								<div class="text-base-content/60 text-xs">Izin</div>
								<div class="font-bold">{ringkasan?.izin ?? 0}</div>
							</div>
							<div>
								<div class="text-base-content/60 text-xs">Alfa</div>
								<div class="font-bold">{ringkasan?.alfa ?? 0}</div>
							</div>
						</div>
					</div>
				{/if}

				{#if kelasTersaring.length > 0 || !semesterTerpilih}
					<div class="mt-6">
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
										<tr class="hover:bg-emerald-50/30 transition-colors">
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
														title={bolehPindah ? 'Jadikan kelas ini kelas aktif' : 'Kelas aktif mengikuti semester aktif'}
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
					</div>
				{/if}
			</div>
		</div>
	</main>
</div>

<style>
	/* ============================================================
	   Global gaya login — diterapkan ke halaman Semua Kelas
	   (glass card, border emerald, rounded-3xl, statis, tanpa animasi)
	   ============================================================ */

	/* Latar belakang halaman */
	.login-bg {
		background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 45%, #d1fae5 100%);
	}
	:global(.dark) .login-bg,
	:global([data-theme='dark']) .login-bg {
		background: linear-gradient(135deg, #064e3b 0%, #0f172a 60%, #134e4a 100%);
	}

	/* Kartu */
	.login-card {
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(16, 185, 129, 0.15);
	}
	:global(.dark) .login-card,
	:global([data-theme='dark']) .login-card {
		background: rgba(15, 23, 42, 0.75);
		border-color: rgba(16, 185, 129, 0.2);
	}

	/* Statik — tidak ada hover/transition */
	.progress {
		height: 0.75rem !important;
		border-radius: 9999px !important;
		background: color-mix(in srgb, var(--color-base-content, #0f172a) 6%, transparent) !important;
	}
	.progress::-webkit-progress-value {
		border-radius: 9999px !important;
		background-image: linear-gradient(90deg, #059669, #34d399) !important;
		border-radius: 9999px !important;
	}

	/* Tabel */
	.table > tbody > tr:hover {
		background: rgba(16, 185, 129, 0.04);
	}

	/* Input & Select */
	.input {
		background: rgba(255, 255, 255, 0.9) !important;
		border: 1px solid rgba(16, 185, 129, 0.2) !important;
		color: var(--color-base-content, #1f2937) !important;
	}
	.input:focus {
		border-color: #059669 !important;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important;
	}
	:global(.dark) .input {
		background: rgba(30, 41, 59, 0.85) !important;
		border-color: rgba(16, 185, 129, 0.25) !important;
	}

	.select {
		border-radius: 1rem !important;
		border-color: rgba(16, 185, 129, 0.2) !important;
		background: color-mix(in srgb, var(--color-base-100, #ffffff) 0.85, transparent) !important;
	}
	.select:focus-within {
		border-color: #059669 !important;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important;
	}
	:global(.dark) .select {
		background: rgba(30, 41, 59, 0.85) !important;
		border-color: rgba(16, 185, 129, 0.25) !important;
	}

	/* Badge */
	.badge {
		border-radius: 9999px !important;
		border-width: 1px !important;
		font-weight: 600 !important;
	}

	/* Alert */
	.alert {
		border-radius: 1.1rem !important;
		border: 1px solid rgba(16, 185, 129, 0.15) !important;
		backdrop-filter: blur(10px);
	}

	/* Focus-visible */
	:focus-visible {
		outline: 2px solid #059669 !important;
		outline-offset: 2px !important;
	}
</style>