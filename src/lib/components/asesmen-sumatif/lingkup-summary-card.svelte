<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { LingkupSummary } from './types';

	interface Props {
		naSumatifLingkup: number | null;
		lingkupSummaries: LingkupSummary[];
		totalBobot: number;
		formatScore: (value: number | null) => string;
	}

	let { naSumatifLingkup, lingkupSummaries, totalBobot, formatScore }: Props = $props();
</script>

<div
	role="alert"
	class="mt-4 flex items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50/70 p-4 text-xs text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100"
>
	<span
		class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300"
	>
		<Icon name="info" class="h-4 w-4" />
	</span>
	<span class="w-full">
		<p class="text-xs font-semibold text-blue-800 dark:text-blue-200">NA Sumatif Lingkup Materi</p>
		<p class="mt-0.5 text-xl font-bold text-slate-900 dark:text-zinc-100">
			{formatScore(naSumatifLingkup)}
		</p>
		<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">
			Rata-rata dari {lingkupSummaries.length} lingkup materi
			{#if totalBobot > 0}
				(dengan total bobot {totalBobot}%)
			{/if}
		</p>
		{#if lingkupSummaries.length}
			<ul class="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-zinc-300">
				{#each lingkupSummaries as summary (summary.lingkupMateri)}
					<li>
						<strong class="text-slate-800 dark:text-zinc-100">{summary.lingkupMateri}</strong>:
						{formatScore(summary.rataRata)}
						{#if summary.bobot != null}
							<span class="ml-1">(Bobot {formatScore(summary.bobot)}%)</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</span>
</div>
