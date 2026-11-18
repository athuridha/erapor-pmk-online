<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	let { data } = $props();

	const daftar = $derived(data.daftar ?? []);
	const totalData = $derived(daftar.reduce((total, item) => total + (item.jumlah ?? 0), 0));
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4 max-sm:flex-col sm:flex-row sm:items-center dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Master Data
			</h1>
			<p class="mt-0.5 block text-xs text-slate-600 dark:text-zinc-400">
				Data referensi sekolah yang dipakai seluruh modul untuk menghitung nilai, rapor, dan
				presensi.
			</p>
		</div>
		<a
			class="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 max-sm:w-full dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			href="/master-data/murid"
		>
			<Icon name="user" class="h-4 w-4" />
			Data Murid
		</a>
	</div>

	<div
		class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th class="px-3 py-2.5" style="min-width: 220px;">Master Data</th>
					<th class="px-3 py-2.5">Keterangan</th>
					<th class="px-3 py-2.5 text-center" style="width: 120px;">Jumlah</th>
					<th class="px-3 py-2.5 text-center" style="width: 130px;">Aksi</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
				{#each daftar as item (item.key)}
					<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
						<td class="px-3 py-2.5">
							<div class="flex items-center gap-2 font-semibold text-slate-900 dark:text-zinc-100">
								<Icon name={item.ikon} class="h-4 w-4 text-blue-600 dark:text-blue-400" />
								<span>{item.judul}</span>
							</div>
						</td>
						<td class="px-3 py-2.5 text-slate-600 dark:text-zinc-400">{item.deskripsi}</td>
						<td
							class="px-3 py-2.5 text-center font-medium text-slate-800 tabular-nums dark:text-zinc-200"
							>{item.jumlah ?? 0}</td
						>
						<td class="px-3 py-2.5 text-center">
							<a
								class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
								href={item.path ?? `/master-data/${item.key}`}
							>
								<Icon name="edit" class="h-3.5 w-3.5" />
								{item.readOnly ? 'Lihat' : 'Kelola'}
							</a>
						</td>
					</tr>
				{:else}
					<tr>
						<td class="px-3 py-8 text-center text-slate-500 dark:text-zinc-400" colspan="4">
							Belum ada master data.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="mt-3 text-center text-xs text-slate-500 dark:text-zinc-400">
		{daftar.length} jenis master data &middot; {totalData} baris
	</p>
</div>
