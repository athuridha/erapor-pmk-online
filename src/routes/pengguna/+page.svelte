<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/master-data/pengguna/guru', { replaceState: true });
	});
</script>

<div class="flex h-64 items-center justify-center">
	<span class="loading loading-spinner loading-md text-primary"></span>
</div>
