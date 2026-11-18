<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	type MuridRekap = {
		nama: string;
		nisn: string | null;
		totalPoin: number;
		count: number;
	};

	type KelasRekap = {
		namaKelas: string;
		murids: MuridRekap[];
	};

	type PageData = {
		kelas: KelasRekap[];
	};

	let { data }: { data: PageData } = $props();

	// Badge color by total points: >=30 needs parent summons, >=15 needs
	// monitoring, >0 is fine, 0 is neutral.
	function badgePoin(total: number) {
		if (total >= 30) {
			return {
				cls: 'border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300',
				label: 'Panggil Orang Tua'
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

	function cetak() {
		window.print();
	}
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="no-print mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800"
	>
		<div>
			<h1
				class="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100"
			>
				<Icon name="warning" class="h-5 w-5 text-amber-600 dark:text-amber-400" />
				Rekap Poin Siswa
			</h1>
			<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
				Seluruh kelas · Rekap poin tata tertib
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<a
				href="/poin-siswa"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			>
				<Icon name="users" class="h-3.5 w-3.5" />
				Kembali
			</a>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
				onclick={cetak}
				title="Cetak rekap"
			>
				<Icon name="print" class="h-3.5 w-3.5" />
				Cetak
			</button>
		</div>
	</div>

	{#if !data.kelas.length}
		<div
			class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
			<span>Belum ada data murid pada sekolah ini.</span>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.kelas as kelas (kelas.namaKelas)}
				<div
					class="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
				>
					<h2 class="mb-2.5 text-sm font-bold text-slate-900 dark:text-zinc-100">
						Kelas {kelas.namaKelas}
						<span class="text-xs font-normal text-slate-500 dark:text-zinc-400">
							({kelas.murids.length} murid)
						</span>
					</h2>
					<div
						class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
					>
						<table class="w-full border-collapse text-xs">
							<thead>
								<tr
									class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
								>
									<th class="min-w-28 px-3.5 py-2.5">NISN</th>
									<th class="min-w-40 px-3.5 py-2.5">Nama</th>
									<th class="min-w-20 px-3.5 py-2.5 text-center">Kasus</th>
									<th class="min-w-24 px-3.5 py-2.5 text-center">Total Poin</th>
									<th class="min-w-36 px-3.5 py-2.5 text-center">Status</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
								{#each kelas.murids as murid (murid.nama + murid.nisn)}
									{@const badge = badgePoin(murid.totalPoin)}
									<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
										<td class="px-3.5 py-2.5 text-slate-500 dark:text-zinc-400">
											{murid.nisn ?? '-'}
										</td>
										<td class="px-3.5 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
											{murid.nama}
										</td>
										<td class="px-3.5 py-2.5 text-center text-slate-700 dark:text-zinc-300">
											{murid.count}
										</td>
										<td class="px-3.5 py-2.5 text-center">
											<span
												class="inline-flex min-w-7 items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold {badge.cls}"
											>
												{murid.totalPoin}
											</span>
										</td>
										<td class="px-3.5 py-2.5 text-center">
											<span
												class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold {badge.cls}"
											>
												{badge.label}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	/* Hide action buttons on printed output; keep tables fully visible. */
	@media print {
		.no-print {
			display: none;
		}
	}
</style>
