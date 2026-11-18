<script lang="ts">
	import { searchQueryMarker } from '$lib/utils';

	type StatusPerDay = '' | 'H' | 'S' | 'I' | 'TK';

	type BulananRow = {
		no: number;
		nama: string;
		statusPerDay: StatusPerDay[];
		countS: number;
		countI: number;
		countTK: number;
		countHadir: number;
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
	class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
>
	<table class="w-full border-collapse text-xs">
		<thead>
			<tr
				class="border-b border-slate-200/80 bg-slate-50/90 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/90 dark:text-zinc-300"
			>
				<th
					class="sticky left-0 z-10 w-10 min-w-9 bg-slate-50 px-2 py-2.5 text-center dark:bg-zinc-800"
					>No</th
				>
				<th class="sticky left-9 z-10 min-w-36 bg-slate-50 px-3 py-2.5 dark:bg-zinc-800">Nama</th>
				{#each Array(daysInMonth) as _, i (i)}
					{@const isRed = redDays.includes(i + 1)}
					<th
						class="w-7 min-w-6.5 px-1 py-2.5 text-center {isRed
							? 'text-red-600 dark:text-red-400'
							: ''}">{i + 1}</th
					>
				{/each}
				<th class="w-8 min-w-7.5 px-1.5 py-2.5 text-center">S</th>
				<th class="w-8 min-w-7.5 px-1.5 py-2.5 text-center">I</th>
				<th class="w-8 min-w-7.5 px-1.5 py-2.5 text-center">TK</th>
				<th class="w-9 min-w-8.5 px-1.5 py-2.5 text-center">JLH</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
			{#each rows as row (row.no)}
				<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
					<td
						class="sticky left-0 z-10 bg-white px-2 py-2 text-center text-slate-500 dark:bg-zinc-900 dark:text-zinc-400"
						>{row.no}</td
					>
					<td
						class="sticky left-9 z-10 bg-white px-3 py-2 font-medium text-slate-900 dark:bg-zinc-900 dark:text-zinc-100"
						>{@html searchQueryMarker(search, row.nama)}</td
					>
					{#each row.statusPerDay as status, i (i)}
						{@const isRed = redDays.includes(i + 1)}
						<td
							class="px-1 py-2 text-center font-mono {isRed
								? 'bg-red-50/70 dark:bg-red-950/20'
								: ''}"
						>
							{#if status === 'H'}
								<span class="font-bold text-emerald-600 dark:text-emerald-400">{status}</span>
							{:else if status === 'S'}
								<span class="font-bold text-amber-600 dark:text-amber-400">{status}</span>
							{:else if status === 'I'}
								<span class="font-bold text-blue-600 dark:text-blue-400">{status}</span>
							{:else if status === 'TK'}
								<span class="font-bold text-red-600 dark:text-red-400">{status}</span>
							{:else}
								<span class="text-slate-300 dark:text-zinc-600">-</span>
							{/if}
						</td>
					{/each}
					<td class="px-1.5 py-2 text-center font-semibold text-slate-700 dark:text-zinc-200"
						>{row.countS || ''}</td
					>
					<td class="px-1.5 py-2 text-center font-semibold text-slate-700 dark:text-zinc-200"
						>{row.countI || ''}</td
					>
					<td class="px-1.5 py-2 text-center font-semibold text-slate-700 dark:text-zinc-200"
						>{row.countTK || ''}</td
					>
					<td class="px-1.5 py-2 text-center font-bold text-slate-900 dark:text-zinc-100"
						>{row.countHadir || ''}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
