<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';

	const required = $derived(
		(page.url.searchParams.get('required') ?? '')
			.split(',')
			.map((p) => p.trim())
			.filter(Boolean)
	);

	function goBack() {
		if (history.length > 1) history.back();
		else location.href = '/';
	}
</script>

<div class="flex items-center justify-center">
	<div class="w-full">
		<div
			class="overflow-hidden rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div class="bg-blue-600 p-6 text-white sm:p-8 dark:bg-blue-500">
				<div class="flex items-center gap-4 sm:gap-6">
					<div
						class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:h-20 sm:w-20"
					>
						<Icon name="lock" class="h-8 w-8 text-white sm:h-10 sm:w-10" />
					</div>
					<div>
						<h1 class="text-xl font-bold tracking-tight sm:text-2xl">Akses Ditolak</h1>
						<p class="mt-1 text-xs text-blue-50 sm:text-sm">
							Anda tidak memiliki izin yang diperlukan untuk membuka halaman ini.
						</p>
					</div>
				</div>
			</div>

			<div class="p-5 sm:p-6">
				<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div class="flex-1">
						<h2 class="text-sm font-bold text-slate-900 dark:text-zinc-100">
							Izin yang dibutuhkan
						</h2>
						{#if required.length}
							<div class="mt-3 flex flex-wrap gap-2">
								{#each required as perm (perm)}
									<span
										class="inline-flex items-center rounded-md bg-red-100 px-2.5 py-1 font-mono text-xs font-semibold text-red-800 dark:bg-red-950/70 dark:text-red-300"
										>{perm}</span
									>
								{/each}
							</div>
						{:else}
							<p class="mt-2 text-xs text-slate-500 dark:text-zinc-400">
								Tidak ada informasi izin tersedia.
							</p>
						{/if}
					</div>

					<div class="flex shrink-0 flex-col items-stretch gap-2 md:items-end">
						<button
							class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={goBack}
							aria-label="Kembali">Kembali</button
						>
					</div>
				</div>

				<p class="mt-6 text-xs text-slate-500 dark:text-zinc-400">
					Hubungi administrator sekolah jika memang membutuhkan akses ke halaman ini.
				</p>
			</div>
		</div>
	</div>
</div>
