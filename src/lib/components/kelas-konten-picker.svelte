<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';

	type KelasPilihan = { id: number; nama: string; fase: string | null };

	let {
		currentId = null
	}: {
		currentId?: number | null;
	} = $props();

	const pilihan = $derived(
		((page.data as { kelasKontenPilihan?: KelasPilihan[] | null }).kelasKontenPilihan ?? []).slice()
	);
	const tampil = $derived(pilihan.length > 0);

	async function pilihKelas(event: Event) {
		const selector = event.currentTarget as HTMLSelectElement;
		const value = selector.value;
		const params = new URLSearchParams(page.url.search);
		if (value) params.set('kelas', value);
		else params.delete('kelas');
		params.delete('page');
		params.delete('mapel_id');
		const query = params.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, {
			keepFocus: true,
			noScroll: true
		});
	}
</script>

{#if tampil}
	<div class="relative flex w-full items-center sm:w-56 md:w-64">
		<select
			class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
			title="Pilih kelas"
			onchange={pilihKelas}
			value={String(currentId ?? '')}
		>
			{#if currentId == null}
				<option value="" disabled selected>Pilih Kelas...</option>
			{/if}
			{#each pilihan as kelas (kelas.id)}
				<option value={String(kelas.id)}>
					{kelas.nama}{kelas.fase ? ` - ${kelas.fase}` : ''}
				</option>
			{/each}
		</select>
		<span
			aria-hidden="true"
			class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
		>
			<Icon name="down" class="h-3.5 w-3.5" />
		</span>
	</div>
{/if}
