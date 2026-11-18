<script lang="ts">
	import Icon from './icon.svelte';

	let isVisible = $state(false);

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function handleScroll() {
		isVisible = window.scrollY > 320;
	}

	$effect(() => {
		handleScroll();
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	});
</script>

{#if isVisible}
	<div class="fixed end-5 bottom-5 z-40">
		<button
			type="button"
			onclick={scrollToTop}
			title="Kembali ke atas"
			aria-label="Kembali ke atas"
			class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
		>
			<span aria-hidden="true"><Icon name="up" class="h-4 w-4" /></span>
		</button>
	</div>
{/if}
