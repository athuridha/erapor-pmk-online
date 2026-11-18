<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	interface Props {
		message: string;
		onDismiss: () => void;
	}

	let { message, onDismiss }: Props = $props();
</script>

<div
	class="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
>
	<Icon name="warning" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
	<div class="flex-1 leading-relaxed">{message}</div>
	<button
		class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-amber-700/70 transition-colors hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300/70 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
		type="button"
		aria-label="Tutup notifikasi bobot"
		onclick={onDismiss}
	>
		<Icon name="close" class="h-3.5 w-3.5" />
	</button>
</div>
