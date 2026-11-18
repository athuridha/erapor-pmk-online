<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	let { message }: { message: string } = $props();
</script>

<div
	role="alert"
	class="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
>
	<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
	<div class="flex-1 leading-relaxed">{@html message}</div>
</div>
