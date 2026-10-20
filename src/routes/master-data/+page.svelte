<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';

	let { data } = $props();

	const daftar = $derived(data.daftar ?? []);

	async function pilih(key: string) {
		await goto(`/master-data/${key}`);
	}
</script>

<div class="mb-4">
	<h2 class="flex items-center gap-2 text-xl font-bold">
		<Icon name="database" />
		Master Data
	</h2>
	<p class="text-base-content/80 block text-sm">
		Data referensi sekolah: dipakai seluruh modul untuk menghitung nilai, rapor, dan presensi.
	</p>
</div>

<div class="bg-base-100 dark:bg-base-200 mb-4 rounded-md p-4 shadow-md">
	<label class="form-control w-full max-w-sm">
		<span class="label-text mb-1 text-sm">Pilih jenis master data</span>
		<select
			class="select select-bordered w-full"
			value=""
			onchange={(event) => pilih((event.currentTarget as HTMLSelectElement).value)}
		>
			<option value="" disabled selected>-- pilih --</option>
			{#each daftar as item (item.key)}
				<option value={item.key}>{item.judul}</option>
			{/each}
		</select>
	</label>
</div>

<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
	{#each daftar as item (item.key)}
		<a
			class="card bg-base-100 dark:bg-base-200 rounded-lg border border-none shadow-md transition hover:shadow-lg"
			href={`/master-data/${item.key}`}
		>
			<div class="card-body p-4">
				<div class="flex items-center gap-2">
					<span
						class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg"
					>
						<Icon name={item.ikon} />
					</span>
					<h3 class="card-title text-base">{item.judul}</h3>
				</div>
				<p class="text-base-content/70 text-xs">{item.deskripsi}</p>
				<div class="card-actions mt-2 justify-end">
					<span class="btn btn-soft btn-sm shadow-none">
						Kelola
						<Icon name="right" />
					</span>
				</div>
			</div>
		</a>
	{/each}
</div>
