<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { page } from '$app/state';

	let { data } = $props();
	const status = $derived(data.status ?? 'empty');
	const murid = $derived(data.murid ?? null);
	const daftarEkstrakurikuler = $derived(
		status === 'ready' ? (data.daftarEkstrakurikuler ?? []) : []
	);
	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return null;
		return kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
	});

	function formatScore(value: number | null) {
		if (value == null) return '&mdash;';
		return value.toLocaleString('id-ID', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="mb-4 flex flex-col gap-2 sm:flex-row">
		<a
			href="/nilai-akhir/"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
		>
			<Icon name="left" class="h-4 w-4" />
			Kembali
		</a>
	</div>

	{#if status === 'ready' && murid}
		<div
			class="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center dark:border-zinc-800"
		>
			<div>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Nilai Ekstrakurikuler
				</h1>
				<p class="mt-0.5 text-sm font-medium text-slate-700 dark:text-zinc-300">{murid.nama}</p>
				{#if kelasAktifLabel}
					<p class="text-xs text-slate-500 dark:text-zinc-400">Kelas {kelasAktifLabel}</p>
				{/if}
			</div>
		</div>

		<div
			class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th style="width: 50px; min-width: 40px;" class="px-3 py-2.5">No</th>
						<th class="w-full px-3 py-2.5" style="min-width: 200px;">Ekstrakurikuler</th>
						<th style="min-width: 120px;" class="px-3 py-2.5">Nilai Akhir</th>
						<th style="min-width: 200px;" class="px-3 py-2.5">Kriteria</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
					{#if daftarEkstrakurikuler.length}
						{#each daftarEkstrakurikuler as item (item.id)}
							<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
								<td class="px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-400">{item.no}</td
								>
								<td class="px-3 py-2.5">
									<div class="font-semibold text-slate-900 dark:text-zinc-100">
										{item.nama ?? '-'}
									</div>
									<div class="text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
										{item.tujuanCount ?? 0} tujuan
									</div>
								</td>
								<td
									class="px-3 py-2.5 font-semibold tabular-nums {item.sudahDinilai
										? 'text-slate-900 dark:text-zinc-100'
										: 'italic text-slate-500 dark:text-zinc-400'}"
								>
									{@html formatScore(item.nilaiAkhir)}
								</td>
								<td class="px-3 py-2.5">
									{#if item.kriteria}
										<span
											class="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
										>
											{item.kriteria}
										</span>
									{:else}
										<span class="italic text-slate-400 dark:text-zinc-500">Belum dinilai</span>
									{/if}
								</td>
							</tr>
						{/each}
					{:else}
						<tr>
							<td
								colspan="4"
								class="p-8 text-center text-xs italic text-slate-500 dark:text-zinc-400"
							>
								Belum ada data ekstrakurikuler untuk kelas ini atau murid belum dinilai.
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	{:else}
		<div
			class="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>
				<p class="font-semibold">Pilih murid terlebih dahulu.</p>
				<p class="mt-0.5 text-amber-900/80 dark:text-amber-200/80">
					Gunakan tombol "Lihat" pada halaman Rekap Nilai Akhir untuk membuka rincian.
				</p>
			</span>
		</div>
	{/if}
</div>
