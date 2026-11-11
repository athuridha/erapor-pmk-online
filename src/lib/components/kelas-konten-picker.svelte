<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

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
	<div class="w-full sm:w-56 md:w-64">
		<select
			class="select bg-base-200 w-full truncate font-semibold dark:border-none"
			title="Pilih kelas"
			onchange={pilihKelas}
			value={String(currentId ?? '')}
		>
			{#if currentId == null}
				<option value="" disabled selected>Pilih Kelas…</option>
			{/if}
			{#each pilihan as kelas (kelas.id)}
				<option value={String(kelas.id)}>
					{kelas.nama}{kelas.fase ? ` - ${kelas.fase}` : ''}
				</option>
			{/each}
		</select>
	</div>
{/if}
