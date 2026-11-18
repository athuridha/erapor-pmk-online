<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	interface DinasLuarPermohonanDetail {
		nama: string;
		maksud: string;
		undanganFile: string | null;
		tanggal: string;
	}

	let { permohonan }: { permohonan: DinasLuarPermohonanDetail } = $props();

	function formatTanggal(value: string | null | undefined): string {
		if (!value) return '-';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	const undanganUrl = $derived(
		permohonan.undanganFile?.startsWith('undangan/')
			? `/api/dinas-luar/undangan/${permohonan.undanganFile.slice('undangan/'.length)}`
			: null
	);

	const undanganName = $derived(permohonan.undanganFile?.split('/').pop() ?? null);
</script>

<div class="not-prose space-y-4">
	<div
		class="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-800/50"
	>
		<p
			class="text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			Maksud Perjalanan Dinas
		</p>
		<p class="mt-1 text-sm font-bold leading-snug text-slate-900 dark:text-zinc-100">
			{permohonan.maksud}
		</p>
		<div class="mt-3 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
			>
				<Icon name="user" class="h-3.5 w-3.5" />
				{permohonan.nama}
			</span>
			<span
				class="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
			>
				<Icon name="calendar" class="h-3.5 w-3.5" />
				{formatTanggal(permohonan.tanggal)}
			</span>
		</div>
	</div>

	<section>
		<h4
			class="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			<Icon name="book" class="h-3.5 w-3.5" />
			Undangan Kegiatan
		</h4>
		{#if undanganUrl && undanganName}
			<div
				class="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div class="flex min-w-0 items-center gap-3">
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
					>
						<Icon name="book" class="h-4 w-4" />
					</span>
					<span class="truncate text-xs font-medium text-slate-900 dark:text-zinc-100"
						>{undanganName}</span
					>
				</div>
				<a
					class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-blue-200/80 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
					href={undanganUrl}
					target="_blank"
					rel="noopener"
					title="Lihat file undangan"
				>
					<Icon name="download" class="h-3.5 w-3.5" />
					Lihat
				</a>
			</div>
		{:else}
			<p class="text-xs text-slate-500 dark:text-zinc-400">Tidak ada file undangan.</p>
		{/if}
	</section>
</div>
