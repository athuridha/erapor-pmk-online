<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';

	type DashboardStatistik = App.DashboardStatistik;

	let { rombel, murid } = $props<{
		rombel: DashboardStatistik['rombel'];
		murid: DashboardStatistik['murid'];
	}>();

	const activeModul = $derived(
		(
			page.data as {
				activeModul?: 'admin' | 'wali_kelas' | 'guru' | 'pembina_eskul';
			} | null
		)?.activeModul ?? 'guru'
	);
	const rombelLabel = $derived(
		activeModul === 'admin'
			? 'Total Rombel'
			: activeModul === 'wali_kelas'
				? 'Kelas Binaan'
				: activeModul === 'pembina_eskul'
					? 'Eskul Binaan'
					: 'Rombel Diampu'
	);
	const muridLabel = $derived(activeModul === 'pembina_eskul' ? 'Total Anggota' : 'Total Murid');
	const muridSubtitle = $derived(
		!murid.total
			? activeModul === 'pembina_eskul'
				? 'Belum ada anggota eskul terdaftar'
				: 'Belum ada data murid'
			: activeModul === 'admin'
				? 'Terdaftar pada semester aktif'
				: activeModul === 'wali_kelas'
					? 'Murid di kelas perwalian Anda'
					: activeModul === 'pembina_eskul'
						? 'Anggota ekstrakurikuler binaan Anda'
						: 'Murid pada rombel yang Anda ampu'
	);
	const rombelBadges = $derived.by(() => rombel.perFase);
</script>

<div
	class="flex items-start gap-3.5 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		aria-hidden="true"
		class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
	>
		<Icon name="users" class="h-5 w-5" />
	</div>
	<div class="min-w-0 flex-1">
		<span class="block text-xs font-medium text-slate-500 dark:text-zinc-400">{rombelLabel}</span>
		<p
			class="mt-1 text-2xl leading-none font-bold tracking-tight text-slate-900 tabular-nums dark:text-zinc-100"
		>
			{rombel.total}
		</p>
		<div class="mt-2.5 flex flex-wrap gap-1.5">
			{#if rombelBadges.length}
				{#each rombelBadges as badge (badge.label)}
					<span
						class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
					>
						{badge.jumlah}
						{badge.label}
					</span>
				{/each}
			{:else}
				<span class="text-[11px] text-slate-500 dark:text-zinc-400">Belum ada data</span>
			{/if}
		</div>
	</div>
</div>

<div
	class="flex items-start gap-3.5 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		aria-hidden="true"
		class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400"
	>
		<Icon name="user" class="h-5 w-5" />
	</div>
	<div class="min-w-0 flex-1">
		<span class="block text-xs font-medium text-slate-500 dark:text-zinc-400">{muridLabel}</span>
		<p
			class="mt-1 text-2xl leading-none font-bold tracking-tight text-slate-900 tabular-nums dark:text-zinc-100"
		>
			{murid.total}
		</p>
		<p class="mt-2.5 text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
			{muridSubtitle}
		</p>
	</div>
</div>
