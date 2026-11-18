<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let slug = $derived(page.params.slug ?? '');
	let title = $derived(
		slug
			.split('-')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ')
	);

	let pdfUrl = $state('');
	let loadError = $state(false);

	onMount(async () => {
		const token = page.url.searchParams.get('token');
		if (!token) {
			loadError = true;
			return;
		}

		history.replaceState(null, '', `/cetak/pdf/${slug}/`);

		try {
			const res = await fetch(`/cetak/pdf/${slug}/${token}`);
			if (!res.ok) throw new Error('Gagal memuat PDF');
			const blob = await res.blob();
			pdfUrl = URL.createObjectURL(blob);
		} catch {
			loadError = true;
		}
	});
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="h-screen w-full">
	{#if pdfUrl}
		<object data={pdfUrl} type="application/pdf" class="h-full w-full" {title}>
			<embed src={pdfUrl} type="application/pdf" class="h-full w-full" />
		</object>
	{:else if loadError}
		<div class="flex h-full items-center justify-center bg-slate-50 p-8 dark:bg-zinc-950">
			<div
				class="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
			>
				<p class="mb-2 text-lg font-bold text-red-700 dark:text-red-400">Gagal memuat PDF</p>
				<p class="mb-5 text-sm text-slate-600 dark:text-zinc-400">
					Token tidak valid atau sudah kedaluwarsa.
				</p>
				<button
					onclick={() => window.close()}
					class="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
					>Tutup</button
				>
			</div>
		</div>
	{:else}
		<div class="flex h-full items-center justify-center bg-slate-50 dark:bg-zinc-950">
			<div class="text-center">
				<span class="loading loading-spinner loading-lg mb-4 text-blue-600 dark:text-blue-400"
				></span>
				<p class="text-sm text-slate-600 dark:text-zinc-400">Memuat PDF...</p>
			</div>
		</div>
	{/if}
</div>
