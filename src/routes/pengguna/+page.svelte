<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/master-data/pengguna', { replaceState: true });
	});
</script>

<div class="flex h-64 items-center justify-center">
	<span class="loading loading-spinner loading-md text-blue-600 dark:text-blue-400"></span>
</div>
