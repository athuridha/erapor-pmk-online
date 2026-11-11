<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	type KelasPilihan = { id: number; nama: string; fase: string | null };

	/**
	 * Pemilih kelas LOKAL: mengubah `?kelas_id=` pada URL halaman ini saja.
	 * Server (layout) yang memvalidasi hak akses; cookie `active-kelas-id`
	 * global tidak ditulis sehingga halaman lain tidak ikut berpindah.
	 */
	const picker = $derived(
		(page.data as { kelasPicker?: {
			tampil?: boolean;
			currentId?: number | null;
			bolehSemuaKelas?: boolean;
			pilihan?: KelasPilihan[];
		} | null }).kelasPicker ?? null
	);
	const pilihan = $derived(picker?.pilihan ?? []);

	async function pilihKelas(event: Event) {
		const nilai = (event.currentTarget as HTMLSelectElement).value;
		const params = new URLSearchParams(page.url.search);
		if (nilai) params.set('kelas_id', nilai);
		else params.delete('kelas_id');
		params.delete('page');
		params.delete('murid_id');
		params.delete('mapel_id');
		const query = params.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, {
			keepFocus: true,
			noScroll: true
		});
	}
</script>

{#if picker?.tampil && pilihan.length > 0}
	<div class="mb-3 flex flex-wrap items-center gap-2 rounded-xl">
		<label for="kelas-picker-lokal" class="text-base-content/70 text-sm font-semibold">
			Kelas
		</label>
		<select
			id="kelas-picker-lokal"
			class="select select-sm bg-base-100 dark:bg-base-200 w-full font-semibold dark:border-none sm:w-64"
			title="Pilih kelas untuk halaman ini (tidak mengubah halaman lain)"
			onchange={pilihKelas}
			value={picker.currentId == null ? (picker.bolehSemuaKelas ? 'semua' : '') : String(picker.currentId)}
		>
			{#if picker.bolehSemuaKelas}
				<option value="semua">Semua Kelas</option>
			{:else if picker.currentId == null}
				<option value="" disabled>Pilih Kelas…</option>
			{/if}
			{#each pilihan as kelas (kelas.id)}
				<option value={String(kelas.id)}>
					{kelas.nama}{kelas.fase ? ` - ${kelas.fase}` : ''}
				</option>
			{/each}
		</select>
	</div>
{/if}
