<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	let {
		sekolah,
		activeSemesterNama = null,
		kelasAktifLabel = null,
		bellActive = false,
		hariIni = '',
		nextEventMessage = ''
	}: {
		sekolah: Sekolah | null;
		activeSemesterNama?: string | null;
		kelasAktifLabel?: string | null;
		bellActive?: boolean;
		hariIni?: string;
		nextEventMessage?: string;
	} = $props();

	const sekolahLogo = $derived(sekolah?.id ? `/sekolah/logo/${sekolah.id}` : '/sekolah.png');
	const sekolahNama = $derived(sekolah?.nama ?? 'Belum ada sekolah aktif');
	const sekolahNpsn = $derived(sekolah?.npsn ?? '-');
</script>

<section
	class="relative overflow-hidden rounded-2xl border border-blue-200/70 bg-linear-to-r from-[#dbeafe]/90 via-[#eaf3fe] to-[#f4f8ff] p-4 shadow-[0_2px_10px_-4px_rgba(37,99,235,0.12)] sm:px-6 sm:py-5 dark:border-blue-900/50 dark:from-blue-950/60 dark:via-slate-900 dark:to-zinc-900"
>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute -top-12 right-24 h-40 w-72 rotate-12 rounded-full bg-white/55 blur-2xl dark:bg-blue-500/10"
	></div>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute -right-10 -bottom-12 h-36 w-56 rotate-12 rounded-full bg-sky-200/35 blur-2xl dark:bg-sky-400/5"
	></div>

	{#if sekolah}
		<div class="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex min-w-0 flex-wrap items-center gap-3.5 sm:gap-4">
				<img
					src={sekolahLogo}
					alt={`Logo ${sekolahNama}`}
					width="52"
					height="52"
					class="h-12 w-12 shrink-0 object-contain sm:h-13 sm:w-13"
				/>
				<div class="min-w-0">
					<h2
						class="text-base leading-snug font-bold tracking-tight text-slate-900 sm:text-lg dark:text-zinc-100"
					>
						{sekolahNama}
					</h2>
					<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
						NPSN: <strong class="font-semibold text-slate-800 dark:text-zinc-200"
							>{sekolahNpsn}</strong
						>
						{#if activeSemesterNama}
							<span class="mx-1.5 text-slate-400 dark:text-zinc-600">&bull;</span>
							<span>{activeSemesterNama}</span>
						{/if}
					</p>
				</div>

				{#if kelasAktifLabel}
					<div class="hidden h-7 w-px bg-blue-200/80 md:block dark:bg-zinc-700"></div>
					<span
						class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100/90 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
					>
						<span
							aria-hidden="true"
							class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white"
						>
							<Icon name="check" class="h-2.5 w-2.5" />
						</span>
						<span>{kelasAktifLabel}</span>
					</span>
				{/if}
			</div>

			{#if bellActive && nextEventMessage}
				<div
					class="text-xs font-medium text-blue-700 sm:text-right dark:text-blue-300"
					title={hariIni}
				>
					Bel aktif: {nextEventMessage}
				</div>
			{/if}
		</div>
	{:else}
		<div class="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Belum ada sekolah aktif
				</h2>
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Pilih atau buat data sekolah di menu Identitas Sekolah untuk mulai mengelola rapor.
				</p>
			</div>
			<a
				href="/sekolah"
				class="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
			>
				Buka Identitas Sekolah
			</a>
		</div>
	{/if}
</section>
