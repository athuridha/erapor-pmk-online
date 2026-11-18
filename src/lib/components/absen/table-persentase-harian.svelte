<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	type PersentaseHarianSubject = {
		kodeKegiatan: string;
		label: string;
	};

	type PersentaseHarianRow = {
		no: number;
		muridId: number;
		nama: string;
		subjects: Record<string, string>;
		sessionStatuses: Record<string, { masuk: string; selesai: string }>;
		persentase: number;
	};

	let {
		subjects,
		rows,
		tipePresensi = 'awal_mapel'
	}: {
		subjects: PersentaseHarianSubject[];
		rows: PersentaseHarianRow[];
		tipePresensi?: string;
	} = $props();

	const isAwalAkhir = $derived(tipePresensi === 'awal_akhir_mapel');

	function statusClass(status: string) {
		if (status === 'H') return 'font-bold text-emerald-600 dark:text-emerald-400';
		if (status === 'S') return 'font-bold text-amber-600 dark:text-amber-400';
		if (status === 'I') return 'font-bold text-blue-600 dark:text-blue-400';
		if (status === 'TK') return 'font-bold text-red-600 dark:text-red-400';
		return 'text-slate-300 dark:text-zinc-600';
	}

	function displayStatus(status: string) {
		return status || '-';
	}
</script>

{#if subjects.length === 0}
	<div
		class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
	>
		<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
		<span>
			Tidak ada jadwal pelajaran untuk hari ini. Persentase kehadiran per mapel tidak tersedia.
		</span>
	</div>
{:else}
	<div
		class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full border-collapse text-xs">
			<thead>
				{#if isAwalAkhir}
					<tr
						class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th class="w-12 min-w-10 px-3 py-2.5 text-center" rowspan="2">No</th>
						<th class="min-w-40 px-3.5 py-2.5" rowspan="2">Nama</th>
						{#each subjects as subject (subject.kodeKegiatan)}
							<th
								class="min-w-20 border-l border-slate-200/70 px-2 py-2 text-center dark:border-zinc-700"
								colspan="2"
							>
								{subject.label}
							</th>
						{/each}
						<th class="min-w-20 px-3 py-2.5 text-center" rowspan="2">%</th>
					</tr>
					<tr
						class="border-b border-slate-200/80 bg-slate-50/80 text-left text-[11px] font-semibold text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-400"
					>
						{#each subjects as subject (subject.kodeKegiatan)}
							<th class="border-l border-slate-200/60 px-2 py-1.5 text-center dark:border-zinc-700"
								>Masuk</th
							>
							<th class="px-2 py-1.5 text-center">Selesai</th>
						{/each}
					</tr>
				{:else}
					<tr
						class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th class="w-12 min-w-10 px-3 py-2.5 text-center">No</th>
						<th class="min-w-40 px-3.5 py-2.5">Nama</th>
						{#each subjects as subject (subject.kodeKegiatan)}
							<th class="min-w-20 px-2.5 py-2.5 text-center">{subject.label}</th>
						{/each}
						<th class="min-w-20 px-3 py-2.5 text-center">%</th>
					</tr>
				{/if}
			</thead>
			<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
				{#each rows as row (row.muridId)}
					<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
						<td class="px-3 py-2.5 text-center text-slate-500 dark:text-zinc-400">{row.no}</td>
						<td class="px-3.5 py-2.5 font-medium text-slate-900 dark:text-zinc-100">{row.nama}</td>
						{#if isAwalAkhir}
							{#each subjects as subject (subject.kodeKegiatan)}
								{@const ss = row.sessionStatuses[subject.kodeKegiatan] ?? {
									masuk: '',
									selesai: ''
								}}
								<td class="px-2 py-2.5 text-center">
									<span class={statusClass(ss.masuk)}>{displayStatus(ss.masuk)}</span>
								</td>
								<td class="px-2 py-2.5 text-center">
									<span class={statusClass(ss.selesai)}>{displayStatus(ss.selesai)}</span>
								</td>
							{/each}
						{:else}
							{#each subjects as subject (subject.kodeKegiatan)}
								{@const status = row.subjects[subject.kodeKegiatan] ?? ''}
								<td class="px-2.5 py-2.5 text-center">
									<span class={statusClass(status)}>{displayStatus(status)}</span>
								</td>
							{/each}
						{/if}
						<td class="px-3 py-2.5 text-center font-bold text-slate-900 dark:text-zinc-100">
							{row.persentase}%
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
