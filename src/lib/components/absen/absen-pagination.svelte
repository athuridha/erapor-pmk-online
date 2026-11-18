<script lang="ts">
	let {
		pages,
		currentPage,
		onPageClick
	}: {
		pages: number[];
		currentPage: number;
		onPageClick: (page: number) => void;
	} = $props();
</script>

<div class="mt-4 flex flex-wrap items-center justify-center gap-1 sm:mx-auto">
	{#each pages as pageNumber (pageNumber)}
		<button
			type="button"
			class="pointer-events-auto inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold tabular-nums transition-colors {pageNumber ===
			currentPage
				? 'border-blue-600 bg-blue-600 text-white'
				: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
			onclick={() => onPageClick(pageNumber)}
			aria-current={pageNumber === currentPage ? 'page' : undefined}
		>
			{pageNumber}
		</button>
	{/each}
</div>
