<script lang="ts">
	import { searchQueryMarker } from '$lib/utils';

	type StatusPerDay = 'hadir' | 'izin' | 'sakit' | 'dinas_luar' | 'cuti' | 'belum' | '';

	type BulananRow = {
		no: number;
		nama: string;
		statusPerDay: StatusPerDay[];
		countHadir: number;
		countIzin: number;
		countSakit: number;
		countDinasLuar: number;
		countCuti: number;
		countBelum: number;
	};

	let {
		rows,
		daysInMonth,
		redDays,
		search
	}: {
		rows: BulananRow[];
		daysInMonth: number;
		redDays: number[];
		search: string | null;
	} = $props();
</script>

<div
	class="mt-4 overflow-x-auto rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
>
	<table class="w-full border-collapse text-left text-xs">
		<thead>
			<tr
				class="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
			>
				<th
					class="sticky left-0 z-10 border-r border-slate-200/70 bg-slate-50/95 px-2.5 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-800/95"
					style="width: 40px; min-width: 36px;">No</th
				>
				<th
					class="sticky left-[40px] z-10 border-r border-slate-200/70 bg-slate-50/95 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/95"
					style="min-width: 160px;">Nama Guru</th
				>
				{#each Array.from({ length: daysInMonth }, (_, i) => i) as day (day)}
					{@const isRed = redDays.includes(day + 1)}
					<th
						class="border-r border-slate-200/60 py-2 text-center dark:border-zinc-800/70 {isRed
							? 'text-red-600 dark:text-red-400'
							: ''}"
						style="width: 30px; min-width: 26px;">{day + 1}</th
					>
				{/each}
				<th
					class="border-r border-slate-200/60 py-2 text-center dark:border-zinc-800/70"
					style="width: 34px; min-width: 30px;">H</th
				>
				<th
					class="border-r border-slate-200/60 py-2 text-center dark:border-zinc-800/70"
					style="width: 34px; min-width: 30px;">I</th
				>
				<th
					class="border-r border-slate-200/60 py-2 text-center dark:border-zinc-800/70"
					style="width: 34px; min-width: 30px;">S</th
				>
				<th
					class="border-r border-slate-200/60 py-2 text-center dark:border-zinc-800/70"
					style="width: 38px; min-width: 34px;">DL</th
				>
				<th
					class="border-r border-slate-200/60 py-2 text-center dark:border-zinc-800/70"
					style="width: 38px; min-width: 34px;">Ct</th
				>
				<th class="py-2 text-center" style="width: 38px; min-width: 34px;">TK</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-200/70 dark:divide-zinc-800">
			{#each rows as row (row.no)}
				<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/35">
					<td
						class="sticky left-0 z-10 border-r border-slate-200/70 bg-white px-2 py-2 text-center text-slate-500 tabular-nums dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
						>{row.no}</td
					>
					<td
						class="sticky left-[40px] z-10 border-r border-slate-200/70 bg-white px-3 py-2 font-medium text-slate-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
						>{@html searchQueryMarker(search, row.nama)}</td
					>
					{#each row.statusPerDay as status, i (i)}
						{@const isRed = redDays.includes(i + 1)}
						<td
							class="border-r border-slate-200/60 text-center font-mono dark:border-zinc-800/70 {isRed
								? 'bg-red-50/50 dark:bg-red-950/20'
								: ''}"
							style="height: 32px; padding: 0;"
						>
							{#if status === 'hadir'}
								<span class="font-semibold text-emerald-600 dark:text-emerald-400">H</span>
							{:else if status === 'sakit'}
								<span class="font-semibold text-amber-600 dark:text-amber-400">S</span>
							{:else if status === 'izin'}
								<span class="font-semibold text-sky-600 dark:text-sky-400">I</span>
							{:else if status === 'dinas_luar'}
								<span class="font-semibold text-blue-600 dark:text-blue-400">D</span>
							{:else if status === 'cuti'}
								<span class="font-semibold text-slate-700 dark:text-zinc-200">Ct</span>
							{:else if status === 'belum'}
								<span class="font-semibold text-red-600 dark:text-red-400">TK</span>
							{:else}
								<span class="text-slate-300 dark:text-zinc-600">-</span>
							{/if}
						</td>
					{/each}
					<td
						class="border-r border-slate-200/60 text-center font-semibold text-slate-800 tabular-nums dark:border-zinc-800/70 dark:text-zinc-200"
						>{row.countHadir || ''}</td
					>
					<td
						class="border-r border-slate-200/60 text-center font-semibold text-slate-800 tabular-nums dark:border-zinc-800/70 dark:text-zinc-200"
						>{row.countIzin || ''}</td
					>
					<td
						class="border-r border-slate-200/60 text-center font-semibold text-slate-800 tabular-nums dark:border-zinc-800/70 dark:text-zinc-200"
						>{row.countSakit || ''}</td
					>
					<td
						class="border-r border-slate-200/60 text-center font-semibold text-slate-800 tabular-nums dark:border-zinc-800/70 dark:text-zinc-200"
						>{row.countDinasLuar || ''}</td
					>
					<td
						class="border-r border-slate-200/60 text-center font-semibold text-slate-800 tabular-nums dark:border-zinc-800/70 dark:text-zinc-200"
						>{row.countCuti || ''}</td
					>
					<td class="text-center font-semibold text-slate-800 tabular-nums dark:text-zinc-200"
						>{row.countBelum || ''}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
