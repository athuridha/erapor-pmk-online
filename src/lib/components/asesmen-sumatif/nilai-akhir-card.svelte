<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { NilaiAkhirCategory } from './types';

	interface Props {
		title?: string;
		nilaiAkhir: number | null;
		nilaiAkhirCategory: NilaiAkhirCategory | null;
		kkm: number;
		formatScore: (value: number | null) => string;
		// optional sekolah-level weights (sas optional for RTS display)
		sumatifWeights?: { lingkup: number; sts: number; sas?: number };
	}

	let {
		title = 'Nilai Rapor Semester',
		nilaiAkhir,
		nilaiAkhirCategory,
		kkm,
		formatScore,
		sumatifWeights
	}: Props = $props();

	function cardTone(cls: string | undefined) {
		if (cls === 'alert-success') {
			return 'border-emerald-200/80 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100';
		}
		if (cls === 'alert-error') {
			return 'border-red-200/80 bg-red-50/80 text-red-950 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100';
		}
		if (cls === 'alert-info') {
			return 'border-blue-200/80 bg-blue-50/70 text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100';
		}
		return 'border-amber-200/80 bg-amber-50/80 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100';
	}

	function iconTone(cls: string | undefined) {
		if (cls === 'alert-success') {
			return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300';
		}
		if (cls === 'alert-error') {
			return 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300';
		}
		if (cls === 'alert-info') {
			return 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300';
		}
		return 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300';
	}
</script>

<div
	class="mt-5 flex items-start gap-3 rounded-xl border p-4 text-xs {cardTone(
		nilaiAkhirCategory?.className
	)}"
>
	<span
		class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl {iconTone(
			nilaiAkhirCategory?.className
		)}"
	>
		<Icon name={nilaiAkhirCategory ? nilaiAkhirCategory.icon : 'alert'} class="h-4 w-4" />
	</span>
	<span>
		<p class="text-xs font-semibold opacity-90">{title}</p>
		<p class="mt-0.5 text-xl font-bold">{formatScore(nilaiAkhir)}</p>
		<p class="mt-0.5 text-xs opacity-85">
			{#if sumatifWeights}
				Pembobotan dipakai: Formatif {sumatifWeights.lingkup}%{#if sumatifWeights.sts > 0}, Sumatif
					{sumatifWeights.sts}%{/if}{#if sumatifWeights.sas != null && sumatifWeights.sas > 0},
					Sumatif AS {sumatifWeights.sas}%{/if}
				(nilai akhir = jumlah kontribusi tiap komponen; komponen kosong dihitung 0)
			{:else}
				Rata-rata dari NA Sumatif Lingkup Materi dan NA Sumatif Akhir Semester
			{/if}
		</p>
		<p class="mt-1 text-xs font-semibold">
			KKM {kkm} ·
			{#if nilaiAkhir == null}
				Lengkapi penilaian untuk menghitung nilai akhir
			{:else}
				{nilaiAkhirCategory?.label}
			{/if}
		</p>
		{#if nilaiAkhirCategory}
			<p class="mt-0.5 text-xs opacity-85">{nilaiAkhirCategory.description}</p>
		{/if}
	</span>
</div>
