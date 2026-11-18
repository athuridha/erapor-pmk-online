<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	type MapelStat = {
		total: number;
		baris?: number;
		wajib: number;
		mulok: number;
		kokurikuler?: number;
		lainnya: number;
	};

	type EkstrakurikulerStat = {
		total: number;
	};

	let {
		mapel,
		ekstrakurikuler,
		mapelBaris = 0
	}: {
		mapel: MapelStat;
		ekstrakurikuler: EkstrakurikulerStat;
		mapelBaris?: number;
	} = $props();

	function mapelParts(m: MapelStat): string {
		const parts: string[] = [];
		if (m.wajib) parts.push(`${m.wajib} Wajib`);
		if (m.mulok) parts.push(`${m.mulok} Mulok`);
		if (m.lainnya) parts.push(`${m.lainnya} Pilihan`);

		if (parts.length === 0) return 'Belum ada mapel';
		if (parts.length === 1) return parts[0];
		if (parts.length === 2) return parts.join(' & ');

		return parts.slice(0, -1).join(', ') + ' & ' + parts[parts.length - 1];
	}
</script>

<div
	class="flex items-start gap-3.5 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		aria-hidden="true"
		class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400"
	>
		<Icon name="book-open" class="h-5 w-5" />
	</div>
	<div class="min-w-0 flex-1">
		<span class="block text-xs font-medium text-slate-500 dark:text-zinc-400">
			Mapel Intrakurikuler
		</span>
		<p
			class="mt-1 text-2xl leading-none font-bold tracking-tight text-slate-900 tabular-nums dark:text-zinc-100"
		>
			{mapel.total}
		</p>
		<p class="mt-2.5 text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
			{mapelParts(mapel)}{mapelBaris > 0 ? ` (${mapelBaris} baris)` : ''}
		</p>
	</div>
</div>

<div
	class="flex items-start gap-3.5 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		aria-hidden="true"
		class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
	>
		<Icon name="check-square" class="h-5 w-5" />
	</div>
	<div class="min-w-0 flex-1">
		<span class="block text-xs font-medium text-slate-500 dark:text-zinc-400">
			Ekskul &amp; Kokurikuler
		</span>
		<div class="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
			<div>
				<span
					class="text-2xl leading-none font-bold tracking-tight text-slate-900 tabular-nums dark:text-zinc-100"
				>
					{ekstrakurikuler.total}
				</span>
				<span class="ml-1 text-xs font-medium text-slate-600 dark:text-zinc-400">Ekskul</span>
			</div>
			<span aria-hidden="true" class="text-slate-300 dark:text-zinc-700">&bull;</span>
			<div>
				<span
					class="text-2xl leading-none font-bold tracking-tight text-slate-900 tabular-nums dark:text-zinc-100"
				>
					{mapel.kokurikuler ?? 0}
				</span>
				<span class="ml-1 text-xs font-medium text-slate-600 dark:text-zinc-400">Kokurikuler</span>
			</div>
		</div>
		<p class="mt-2.5 text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
			{ekstrakurikuler.total || mapel.kokurikuler ? 'Aktif pada konteks ini' : 'Belum ada data'}
		</p>
	</div>
</div>
