<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	type Props = {
		isDownloading?: boolean;
		isImporting?: boolean;
		disabled?: boolean;
		onDownload?: () => void;
		onImport?: () => void;
	};

	let {
		isDownloading = false,
		isImporting = false,
		disabled = false,
		onDownload,
		onImport
	}: Props = $props();
</script>

<div class="mb-4 flex flex-col justify-between gap-2 sm:flex-row">
	<button
		type="button"
		class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
		onclick={onDownload}
		disabled={isDownloading || disabled}
	>
		{#if isDownloading}
			<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
		{:else}
			<Icon name="download" class="h-3.5 w-3.5" />
		{/if}
		Download template
	</button>
	<button
		type="button"
		class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
		onclick={onImport}
		disabled={isImporting || disabled}
	>
		{#if isImporting}
			<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
		{:else}
			<Icon name="import" class="h-3.5 w-3.5" />
		{/if}
		Import nilai
	</button>
</div>
