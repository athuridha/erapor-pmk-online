<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	type ProgressItem = {
		percentage: number;
		completed: number;
		total: number;
	};

	let {
		progress,
		nilaiSumatifKosong = false
	}: {
		progress: {
			akademik: ProgressItem;
			ekstrakurikuler: ProgressItem;
			kokurikuler: ProgressItem;
		};
		nilaiSumatifKosong?: boolean;
	} = $props();

	const rows = $derived([
		{
			id: 'progress-akademik',
			label: 'Nilai Intrakurikuler',
			item: progress.akademik,
			unit: 'penilaian',
			barClass: 'bg-emerald-500 dark:bg-emerald-400',
			dotClass: 'bg-emerald-500'
		},
		{
			id: 'progress-ekskul',
			label: 'Nilai Ekstrakurikuler',
			item: progress.ekstrakurikuler,
			unit: 'murid',
			barClass: 'bg-blue-500 dark:bg-blue-400',
			dotClass: 'bg-blue-500'
		},
		{
			id: 'progress-kokur',
			label: 'Nilai Kokurikuler',
			item: progress.kokurikuler,
			unit: 'murid',
			barClass: 'bg-violet-500 dark:bg-violet-400',
			dotClass: 'bg-violet-500'
		}
	]);
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="flex items-center gap-2.5 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
		<span
			aria-hidden="true"
			class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
		>
			<Icon name="chart" class="h-4 w-4" />
		</span>
		<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
			Progress Pengisian Data
		</h2>
	</div>

	<div class="space-y-4 p-4 sm:p-5">
		{#each rows as row (row.id)}
			<div>
				<div class="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
					<span id={row.id} class="font-semibold text-slate-800 dark:text-zinc-200">
						{row.label}
					</span>
					<span class="font-bold text-slate-900 tabular-nums dark:text-zinc-100">
						{row.item.percentage}%
					</span>
				</div>
				<div
					class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800"
					role="progressbar"
					aria-labelledby={row.id}
					aria-valuenow={row.item.percentage}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					<div
						class="h-full rounded-full transition-all {row.barClass} {row.item.completed > 0 &&
						row.item.percentage === 0
							? 'min-w-1.5'
							: ''}"
						style="width: {row.item.percentage}%"
					></div>
				</div>
				<p
					class="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 tabular-nums dark:text-zinc-400"
				>
					{#if row.item.completed > 0}
						<span aria-hidden="true" class="inline-block h-1.5 w-1.5 rounded-full {row.dotClass}"
						></span>
					{/if}
					<span>
						{row.item.completed} dari {row.item.total}
						{row.unit} terisi
					</span>
				</p>
			</div>
		{/each}

		{#if nilaiSumatifKosong}
			<p
				class="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
			>
				Belum ada nilai sumatif terisi pada semester ini.
			</p>
		{/if}
	</div>
</section>
