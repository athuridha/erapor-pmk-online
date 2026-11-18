<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	let { data } = $props();

	const kelasFaseLabel = $derived.by(() => {
		const nama = data.kelas.nama;
		const fase = (data.kelas.fase ?? '').trim().replace(/^fase\s+/i, '');
		return fase ? `${nama} - Fase ${fase}` : nama;
	});

	const getPhotoSrc = (murid: { id: number; foto: string | null }) => {
		if (!murid.foto) return null;
		if (typeof murid.foto === 'string') {
			if (
				murid.foto.startsWith('http') ||
				murid.foto.startsWith('data:') ||
				murid.foto.startsWith('/')
			) {
				return murid.foto;
			}
			return `/api/murid-photo/${murid.id}?v=${encodeURIComponent(murid.foto)}`;
		}
		return null;
	};
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Foto Murid</h1>
			<p class="mt-0.5 block text-xs text-slate-600 dark:text-zinc-400">
				{kelasFaseLabel}
			</p>
		</div>
		<form action="/murid" method="get">
			<button
				type="submit"
				class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			>
				<Icon name="left" class="h-4 w-4" />
				Kembali
			</button>
		</form>
	</div>

	{#if data.daftarMurid.length === 0}
		<div class="py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
			<p>Tidak ada murid di kelas ini</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
			{#each data.daftarMurid as murid (murid.id)}
				<div
					class="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
				>
					{#if murid.foto}
						<img
							src={getPhotoSrc(murid)}
							alt={murid.nama}
							class="aspect-3/4 w-full rounded-lg object-cover"
						/>
					{:else}
						<div
							class="flex aspect-3/4 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-zinc-800/70"
						>
							<div class="p-4 text-center text-slate-400 dark:text-zinc-500">
								<Icon name="user" class="mx-auto text-5xl" />
								<p class="mt-2 text-xs font-medium">Foto belum tersedia</p>
							</div>
						</div>
					{/if}
					<div class="w-full pt-1">
						<p
							class="truncate text-center text-sm font-semibold text-slate-900 dark:text-zinc-100"
							title={murid.nama}
						>
							{murid.nama}
						</p>
						<p class="text-center text-xs text-slate-500 tabular-nums dark:text-zinc-400">
							NISN: {murid.nisn ?? '-'}
						</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
