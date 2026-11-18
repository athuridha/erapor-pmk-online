<script lang="ts">
	let {
		rows,
		totalHariBelajar,
		jenisPresensi = 'wali_kelas_saja',
		tipePresensi = '',
		totalPertemuan = 0,
		// kept in the signature for API compatibility; not rendered by this table
		tanggalMulai: _tanggalMulai = '',
		tanggalAkhir: _tanggalAkhir = ''
	}: {
		rows: Array<{
			no: number;
			nama: string;
			persentase: number;
			hadir: number;
			sakit: number;
			izin: number;
			alfa: number;
		}>;
		tanggalMulai: string;
		tanggalAkhir: string;
		totalHariBelajar: number;
		jenisPresensi?: string;
		tipePresensi?: string;
		totalPertemuan?: number;
	} = $props();

	const totalPresensi = $derived(
		jenisPresensi === 'wali_kelas_saja' && tipePresensi === 'masuk_pulang'
			? totalHariBelajar * 2
			: null
	);
</script>

<div
	class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
>
	<table class="w-full border-collapse text-xs">
		<thead>
			<tr
				class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
			>
				<th class="w-12 min-w-10 px-3 py-2.5 text-center">No</th>
				<th class="w-full min-w-40 px-3.5 py-2.5">Nama</th>
				<th class="w-12 min-w-10 px-3 py-2.5 text-right">H</th>
				<th class="w-12 min-w-10 px-3 py-2.5 text-right">S</th>
				<th class="w-12 min-w-10 px-3 py-2.5 text-right">I</th>
				<th class="w-12 min-w-10 px-3 py-2.5 text-right">TK</th>
				<th class="min-w-44 px-3.5 py-2.5 text-right">
					Persentase Semester
					{#if totalHariBelajar > 0}
						<span class="block text-[11px] font-normal text-slate-400 dark:text-zinc-400">
							({totalHariBelajar} hari belajar{jenisPresensi === 'tiap_mapel' && totalPertemuan > 0
								? ` ${totalPertemuan} ${tipePresensi === 'awal_akhir_mapel' ? 'presensi' : 'mapel'}`
								: totalPresensi != null
									? ` ${totalPresensi} presensi`
									: ''})
						</span>
					{/if}
				</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
			{#each rows as row (row.no)}
				<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
					<td class="px-3 py-2.5 text-center text-slate-500 dark:text-zinc-400">{row.no}</td>
					<td class="px-3.5 py-2.5 font-medium text-slate-900 dark:text-zinc-100">{row.nama}</td>
					<td class="px-3 py-2.5 text-right text-slate-700 dark:text-zinc-300">{row.hadir || ''}</td
					>
					<td class="px-3 py-2.5 text-right text-slate-700 dark:text-zinc-300">{row.sakit || ''}</td
					>
					<td class="px-3 py-2.5 text-right text-slate-700 dark:text-zinc-300">{row.izin || ''}</td>
					<td class="px-3 py-2.5 text-right text-slate-700 dark:text-zinc-300">{row.alfa || ''}</td>
					<td class="px-3.5 py-2.5 text-right font-bold">
						{#if row.persentase >= 80}
							<span class="text-emerald-600 dark:text-emerald-400">{row.persentase}%</span>
						{:else if row.persentase >= 60}
							<span class="text-amber-600 dark:text-amber-400">{row.persentase}%</span>
						{:else}
							<span class="text-red-600 dark:text-red-400">{row.persentase}%</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
