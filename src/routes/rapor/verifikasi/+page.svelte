<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	const payload = $derived(data.payload ?? null);
	const valid = $derived(Boolean(data.valid));
</script>

<svelte:head>
	<title>Verifikasi Rapor - e-Rapor SMK Pratama Mulya</title>
</svelte:head>

<div class="app-canvas-bg flex min-h-screen items-center justify-center p-4">
	<div
		class="w-full max-w-lg rounded-2xl border border-slate-200/75 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<header
			class="mb-5 flex items-center gap-3.5 border-b border-slate-100 pb-4 dark:border-zinc-800"
		>
			<div
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl {valid
					? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
					: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'}"
			>
				<Icon name={valid ? 'success' : 'error'} class="h-6 w-6" />
			</div>
			<div>
				<h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					{valid ? 'Rapor ini sah' : 'Rapor tidak dapat diverifikasi'}
				</h1>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					{valid
						? 'Tanda tangan digital pada QR cocok dengan data rapor.'
						: 'QR code tidak dikenali atau sudah diubah.'}
				</p>
			</div>
		</header>

		{#if payload}
			<div class="mb-4 divide-y divide-slate-100 text-xs dark:divide-zinc-800">
				<div class="flex justify-between gap-4 py-2.5">
					<span class="text-slate-500 dark:text-zinc-400">Nama Murid</span>
					<span class="text-right font-semibold text-slate-900 dark:text-zinc-100"
						>{payload.nama}</span
					>
				</div>
				<div class="flex justify-between gap-4 py-2.5">
					<span class="text-slate-500 dark:text-zinc-400">Kelas</span>
					<span class="text-right font-semibold text-slate-900 dark:text-zinc-100">
						{payload.kelas}
						{#if payload.fase}
							· {payload.fase}{/if}
					</span>
				</div>
				<div class="flex justify-between gap-4 py-2.5">
					<span class="text-slate-500 dark:text-zinc-400">Sekolah</span>
					<span class="text-right font-semibold text-slate-900 dark:text-zinc-100"
						>{payload.sekolah}</span
					>
				</div>
				<div class="flex justify-between gap-4 py-2.5">
					<span class="text-slate-500 dark:text-zinc-400">Semester / Tahun Ajaran</span>
					<span class="text-right font-semibold text-slate-900 dark:text-zinc-100">
						{payload.semester}
						{payload.tahunAjaran ? ` · ${payload.tahunAjaran}` : ''}
					</span>
				</div>
				{#if payload.periode}
					<div class="flex justify-between gap-4 py-2.5">
						<span class="text-slate-500 dark:text-zinc-400">Periode</span>
						<span class="text-right font-semibold text-slate-900 dark:text-zinc-100">
							{payload.periode === 'rts' ? 'Rapor Tengah Semester' : 'Rapor Akhir Semester'}
						</span>
					</div>
				{/if}
				{#if payload.tanggal}
					<div class="flex justify-between gap-4 py-2.5">
						<span class="text-slate-500 dark:text-zinc-400">Tanggal Rapor</span>
						<span class="text-right font-semibold text-slate-900 dark:text-zinc-100"
							>{payload.tanggal}</span
						>
					</div>
				{/if}
			</div>
		{/if}

		<p class="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
			Verifikasi dilakukan secara offline dari tanda tangan digital pada QR code. Data yang
			ditampilkan berasal dari rapor itu sendiri, bukan dari database sekolah.
		</p>
	</div>
</div>
