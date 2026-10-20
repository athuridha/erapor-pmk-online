<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';

	let { data } = $props();

	const daftar = $derived(data.daftar ?? []);
	const totalData = $derived(daftar.reduce((total, item) => total + (item.jumlah ?? 0), 0));

	async function pilih(key: string) {
		await goto(`/master-data/${key}`);
	}
</script>

<div class="mb-4">
	<h2 class="text-2xl leading-tight font-bold tracking-tight">Master Data</h2>
	<p class="text-base-content/60 mt-0.5 block text-sm">
		Data referensi sekolah: dipakai seluruh modul untuk menghitung nilai, rapor, dan presensi.
	</p>
</div>

<div class="mb-4 grid gap-3 sm:grid-cols-3">
	<div class="rounded-2xl border border-base-200/60 bg-base-100 p-4">
		<p class="text-base-content/50 text-xs font-medium tracking-wide uppercase">
			Jenis Master Data
		</p>
		<p class="mt-1 text-2xl font-bold tracking-tight">{daftar.length}</p>
		<p class="text-base-content/50 text-xs">kumpulan data acuan sekolah</p>
	</div>
	<div class="rounded-2xl border border-base-200/60 bg-base-100 p-4">
		<p class="text-base-content/50 text-xs font-medium tracking-wide uppercase">Total Data</p>
		<p class="mt-1 text-2xl font-bold tracking-tight">{totalData}</p>
		<p class="text-base-content/50 text-xs">baris di seluruh master data</p>
	</div>
</div>

<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md mt-4">
	<label class="form-control w-full max-w-sm">
		<span class="label-text mb-1 text-sm">Pilih jenis master data</span>
		<select
			class="select select-bordered w-full rounded-xl"
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

<div class="mt-4 overflow-x-auto rounded-2xl border border-base-200/60 bg-base-100 shadow-sm">
	<table class="border-base-200 table border dark:border-none">
		<thead>
			<tr
				class="bg-base-200/40 text-base-content/50 border-b border-base-200/60 text-left text-[11px] font-semibold tracking-wider uppercase"
			>
				<th>Master Data</th>
				<th>Keterangan</th>
				<th class="text-center" style="width: 120px;">Jumlah Data</th>
				<th class="text-center" style="width: 130px;">Aksi</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-base-200/60">
			{#each daftar as item (item.key)}
				<tr>
					<td>
						<div class="flex items-center gap-2">
							<Icon name={item.ikon} />
							<span class="font-medium">{item.judul}</span>
						</div>
					</td>
					<td class="text-sm opacity-70">{item.deskripsi}</td>
					<td class="text-center">{item.jumlah ?? 0}</td>
					<td class="text-center">
						<a class="btn btn-ghost btn-sm rounded-lg" href={`/master-data/${item.key}`}>
							<Icon name="edit" />
							Kelola
						</a>
					</td>
				</tr>
			{:else}
				<tr>
					<td class="p-10 text-center" colspan="4">
						<em class="opacity-60">Belum ada master data.</em>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
