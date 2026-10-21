<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	let { data } = $props();

	const daftar = $derived(data.daftar ?? []);
	const totalData = $derived(daftar.reduce((total, item) => total + (item.jumlah ?? 0), 0));
</script>

<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
	<div class="mb-4 flex items-start justify-between gap-2 max-sm:flex-col sm:flex-row">
		<div>
			<h2 class="text-xl font-bold">Master Data</h2>
			<p class="text-base-content/80 block text-sm">
				Data referensi sekolah yang dipakai seluruh modul untuk menghitung nilai, rapor, dan
				presensi.
			</p>
		</div>
		<a class="btn btn-soft shadow-none max-sm:w-full" href="/master-data/murid">
			<Icon name="user" />
			Data Murid
		</a>
	</div>

	<div class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none">
		<table class="border-base-200 table border dark:border-none">
			<thead>
				<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
					<th style="min-width: 220px;">Master Data</th>
					<th>Keterangan</th>
					<th class="text-center" style="width: 120px;">Jumlah</th>
					<th class="text-center" style="width: 130px;">Aksi</th>
				</tr>
			</thead>
			<tbody>
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
							<a
								class="btn btn-soft btn-sm shadow-none"
								href={item.path ?? `/master-data/${item.key}`}
							>
								<Icon name="edit" />
								Kelola
							</a>
						</td>
					</tr>
				{:else}
					<tr>
						<td class="p-6 text-center" colspan="4">
							<em class="opacity-60">Belum ada master data.</em>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="mt-3 text-center text-sm opacity-70">
		{daftar.length} jenis master data · {totalData} baris
	</p>
</div>
