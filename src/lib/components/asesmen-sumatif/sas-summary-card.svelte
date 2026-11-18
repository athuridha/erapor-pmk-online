<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	interface Props {
		nilaiSas: number | null;
		formatScore: (value: number | null) => string;
		/** optional title for the card */
		title?: string;
		/** optional subtitle for the card */
		subtitle?: string;
	}

	let {
		nilaiSas,
		formatScore,
		title = 'NA Sumatif Akhir Semester',
		subtitle = 'Rata-rata dari nilai Tes dan Non Tes SAS'
	}: Props = $props();
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
	<span>
		<p class="text-xs font-semibold text-blue-800 dark:text-blue-200">{title}</p>
		<p class="mt-0.5 text-xl font-bold text-slate-900 dark:text-zinc-100">
			{formatScore(nilaiSas)}
		</p>
		<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-300">{subtitle}</p>
	</span>
</div>
