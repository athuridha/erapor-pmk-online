<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from './icon.svelte';

	type KelasPilihan = { id: number; nama: string; fase: string | null };

	let {
		currentId = null
	}: {
		currentId?: number | null;
	} = $props();

	const pilihan = $derived(
		((page.data as { kelasKontenPilihan?: KelasPilihan[] | null }).kelasKontenPilihan ?? []).slice()
	);
	const tampil = $derived(pilihan.length > 1);

	async function pilihKelas(event: Event) {
		const selector = event.currentTarget as HTMLSelectElement;
		const value = selector.value;
		const params = new URLSearchParams(page.url.search);
		if (value) params.set('kelas', value);
		else params.delete('kelas');
		params.delete('page');
		const query = params.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, {
			keepFocus: true,
			noScroll: true
		});
	}
</script>

{#if tampil}
	<label
		class="input bg-base-200 border-base-300 dark:border-none h-9 flex w-auto cursor-pointer items-center gap-2 rounded-lg text-sm"
	>
		<Icon name="school" class="opacity-60" />
		<select
			class="grow appearance-none focus:outline-none"
			title="Pilih kelas yang diampu untuk halaman ini"
			onchange={pilihKelas}
			value={String(currentId ?? '')}
		>
			{#if currentId == null}
				<option value="" disabled selected>Pilih kelas…</option>
			{/if}
			{#each pilihan as kelas (kelas.id)}
				<option value={String(kelas.id)}>
					{kelas.nama}{kelas.fase ? ` - ${kelas.fase}` : ''}
				</option>
			{/each}
		</select>
	</label>
{/if}
