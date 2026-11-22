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

<section
	class="rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
		<div class="flex items-start gap-2.5">
			<span
				aria-hidden="true"
				class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
			>
				<Icon name="bar-chart" class="h-4 w-4" />
			</span>
			<div>
				<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Ringkasan Semua Kelas
				</h2>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Monitoring rombel, wali kelas, dan kelengkapan nilai sumatif semester aktif.
				</p>
			</div>
		</div>
		<a
			href="/master-data/kelas"
			class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
		>
			<span aria-hidden="true" class="text-slate-400 dark:text-zinc-400">
				<Icon name="grid" class="h-3.5 w-3.5" />
			</span>
			<span>Kelola Semua Kelas</span>
			<span aria-hidden="true" class="text-slate-400 dark:text-zinc-400">
				<Icon name="right" class="h-3 w-3" />
			</span>
		</a>
	</div>

	<div class="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
		<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
			<div
				class="rounded-xl border border-slate-200/65 bg-slate-50/75 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/45"
			>
				<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Kelas</div>
				<div class="mt-0.5 text-lg font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{ringkasan.totalKelas}
				</div>
				<div class="text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
					{ringkasan.totalLakiLaki} L / {ringkasan.totalPerempuan} P
				</div>
			</div>
			<div
				class="rounded-xl border border-slate-200/65 bg-slate-50/75 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/45"
			>
				<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Murid</div>
				<div class="mt-0.5 text-lg font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{ringkasan.totalMurid}
				</div>
				<div class="text-[11px] text-slate-500 dark:text-zinc-400">semester aktif</div>
			</div>
			<div
				class="rounded-xl border border-slate-200/65 bg-slate-50/75 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/45"
			>
				<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Guru Mengajar</div>
				<div class="mt-0.5 text-lg font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{ringkasan.totalGuru}
				</div>
				<div class="text-[11px] text-slate-500 dark:text-zinc-400">unik per mapel</div>
			</div>
			<div
				class="rounded-xl border border-slate-200/65 bg-slate-50/75 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/45"
			>
				<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Kelengkapan</div>
				<div class="mt-0.5 text-lg font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{ringkasan.persenNilai}%
				</div>
				<div class="text-[11px] text-slate-500 dark:text-zinc-400">nilai sumatif</div>
			</div>
			<div
				class="col-span-2 rounded-xl border border-slate-200/65 bg-slate-50/75 px-3 py-2.5 sm:col-span-1 dark:border-zinc-800 dark:bg-zinc-800/45"
			>
				<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Perlu Perhatian</div>
				<div
					class="mt-0.5 text-lg font-bold tabular-nums {ringkasan.kelasPerluPerhatian > 0
						? 'text-rose-600 dark:text-rose-400'
						: 'text-emerald-600 dark:text-emerald-400'}"
				>
					{ringkasan.kelasPerluPerhatian}
				</div>
				<div class="text-[11px] text-slate-500 dark:text-zinc-400">nilai &lt; 50%</div>
			</div>
		</div>

		{#if perluPerhatian.length > 0}
			<div
				class="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
				role="status"
			>
				<span aria-hidden="true" class="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400">
					<Icon name="warning" class="h-4 w-4" />
				</span>
				<span>
					{#if perluPerhatian.length <= 6}
						Kelas dengan kelengkapan nilai sumatif di bawah 50%:
						<strong class="font-semibold">
							{perluPerhatian.map((kelas) => kelas.nama).join(', ')}
						</strong>.
					{:else}
						<strong class="font-semibold">
							{perluPerhatian.length} dari {daftarKelas.length} kelas
						</strong>
						memiliki kelengkapan nilai sumatif di bawah 50% (di antaranya
						{perluPerhatian
							.slice(0, 4)
							.map((kelas) => kelas.nama)
							.join(', ')}, dan lainnya).
					{/if}
				</span>
			</div>
		{/if}

		{#if daftarKelas.length === 0}
			<div
				class="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-zinc-700"
			>
				<p class="text-sm font-medium text-slate-800 dark:text-zinc-200">
					Belum ada kelas pada semester aktif
				</p>
				<p class="mt-1 text-xs text-slate-500 dark:text-zinc-400">
					Tambahkan rombel di menu Kelola Kelas atau impor data pokok terlebih dahulu.
				</p>
			</div>
		{:else}
			<div class="max-h-96 overflow-auto">
				<table class="w-full border-collapse text-left text-xs">
					<thead
						class="sticky top-0 z-10 border-b border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
					>
						<tr class="text-xs font-semibold text-slate-500 dark:text-zinc-400">
							<th class="px-2 py-2.5">Kelas</th>
							<th class="px-2 py-2.5">Wali Kelas</th>
							<th class="px-2 py-2.5 text-right">Murid</th>
							<th class="px-2 py-2.5 text-right">Guru</th>
							<th class="min-w-36 px-2 py-2.5">Kelengkapan Nilai</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
						{#each daftarKelas as kelas (kelas.id)}
							<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
								<td class="px-2 py-2.5">
									<div class="font-semibold text-slate-900 dark:text-zinc-100">{kelas.nama}</div>
									{#if kelas.fase}
										<div class="text-[11px] text-slate-500 dark:text-zinc-400">{kelas.fase}</div>
									{/if}
								</td>
								<td class="px-2 py-2.5 text-slate-700 dark:text-zinc-300">
									{kelas.waliKelas ?? '-'}
								</td>
								<td
									class="px-2 py-2.5 text-right font-medium text-slate-800 tabular-nums dark:text-zinc-200"
								>
									{kelas.jumlahMurid}
								</td>
								<td
									class="px-2 py-2.5 text-right font-medium text-slate-800 tabular-nums dark:text-zinc-200"
								>
									{kelas.jumlahGuru}
								</td>
								<td class="px-2 py-2.5">
									<div class="flex items-center gap-2.5">
										<div
											class="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800"
											role="progressbar"
											aria-label={`Kelengkapan nilai ${kelas.nama}`}
											aria-valuenow={kelas.persenNilai}
											aria-valuemin={0}
											aria-valuemax={100}
										>
											<div
												class="h-full rounded-full transition-all {kelas.persenNilai > 0 &&
												kelas.persenNilai < 50
													? 'min-w-1.5 bg-amber-500 dark:bg-amber-400'
													: kelas.persenNilai >= 50
														? 'bg-emerald-600 dark:bg-emerald-500'
														: ''}"
												style="width: {kelas.persenNilai}%"
											></div>
										</div>
										<span
											class="w-8 text-right font-semibold text-slate-600 tabular-nums dark:text-zinc-300"
										>
											{kelas.persenNilai}%
										</span>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if ringkasan.persenNilai === 0 && ringkasan.totalMurid > 0}
			<p class="text-[11px] text-slate-500 dark:text-zinc-400">
				Belum ada nilai sumatif yang terisi pada semester aktif. Mulai input lewat menu Input Nilai,
				lalu Asesmen Sumatif.
			</p>
		{/if}
	</div>
</section>
