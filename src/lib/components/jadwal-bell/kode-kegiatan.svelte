<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { touchDragSource } from '$lib/touch-drag.svelte';

	const badgeColors = [
		'border-slate-200/80 bg-slate-100 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
		'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300',
		'border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/50 dark:text-indigo-300',
		'border-violet-200/80 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/50 dark:text-violet-300',
		'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-300',
		'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
		'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
		'border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
	];

	let {
		kodeMapelPerKelas = [],
		kodeTambahan,
		kodeKokurikuler,
		kegiatanCustom,
		canManage,
		onHapusKegiatan,
		onEditKegiatan,
		onDrag,
		onDragEnd
	}: {
		kodeMapelPerKelas?: Array<{ kelasId: number; namaKelas: string; kodeMapel: string[] }>;
		kodeTambahan: string[];
		kodeKokurikuler: string[];
		kegiatanCustom: Array<{
			kode: string;
			nama: string;
			durasi: number | null;
			soundFileName?: string | null;
		}>;
		canManage: boolean;
		onHapusKegiatan: (kode: string) => void;
		onEditKegiatan?: (kegiatan: {
			kode: string;
			nama: string;
			durasi: number | null;
			soundFileName?: string | null;
		}) => void;
		onDrag?: () => void;
		onDragEnd?: () => void;
	} = $props();

	const allKodeMapel = $derived(kodeMapelPerKelas.flatMap((k) => k.kodeMapel));

	let kodeColorMap = $state<Record<string, string>>({});
	$effect(() => {
		void allKodeMapel;
		void kegiatanCustom;
		void kodeKokurikuler;
		const allKodes = [
			...new Set([
				...kodeTambahan,
				...kegiatanCustom.map((k) => k.kode),
				...allKodeMapel,
				...kodeKokurikuler
			])
		].sort();
		const map: Record<string, string> = {};
		allKodes.forEach((kode, i) => {
			if (kode === 'UPB') {
				map[kode] =
					'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300';
			} else if (kode === 'IST') {
				map[kode] =
					'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300';
			} else if (kode === 'PLG') {
				map[kode] =
					'border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300';
			} else {
				map[kode] = badgeColors[i % badgeColors.length];
			}
		});
		kodeColorMap = map;
	});

	function handleDragStart(e: DragEvent, kode: string, kelasId?: number) {
		onDrag?.();
		const dt = e.dataTransfer;
		if (!dt) return;
		dt.setData('text/plain', kode);
		if (kelasId !== undefined) {
			dt.setData('application/x-kelas-id', String(kelasId));
		}
		const el = e.currentTarget as HTMLElement;
		if (el) dt.setDragImage(el, 0, 0);
	}

	let activeTab = $state<string | number>('umum');
</script>

<div class="relative mb-3 flex items-center">
	<select
		class="h-8 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
		bind:value={activeTab}
	>
		<option value="umum">Umum</option>
		{#each kodeMapelPerKelas as kelasGroup (kelasGroup.kelasId)}
			<option value={kelasGroup.kelasId}>{kelasGroup.namaKelas}</option>
		{/each}
		{#if kodeKokurikuler.length > 0}
			<option value="ekstra">Ekstra</option>
		{/if}
	</select>
	<span
		aria-hidden="true"
		class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
	>
		<Icon name="down" class="h-3.5 w-3.5" />
	</span>
</div>

{#if activeTab === 'umum'}
	<div class="flex flex-wrap gap-1.5">
		{#each kodeTambahan as kode (kode)}
			<span
				role="button"
				tabindex="-1"
				class="inline-flex cursor-grab items-center rounded-lg border px-2 py-1 text-xs font-semibold {kodeColorMap[
					kode
				] ??
					'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-300'}"
				draggable="true"
				ondragstart={(e) => handleDragStart(e, kode)}
				ondragend={() => onDragEnd?.()}
				use:touchDragSource={{ dragData: () => ({ kode }), onDragStart: () => onDrag?.() }}
			>
				{kode}
			</span>
		{/each}
		{#each kegiatanCustom as kegiatan (kegiatan.kode)}
			<span
				role="button"
				tabindex="-1"
				class="inline-flex cursor-grab items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold {kodeColorMap[
					kegiatan.kode
				] ??
					'border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/50 dark:text-indigo-300'}"
				draggable="true"
				ondragstart={(e) => handleDragStart(e, kegiatan.kode)}
				ondragend={() => onDragEnd?.()}
				use:touchDragSource={{
					dragData: () => ({ kode: kegiatan.kode }),
					onDragStart: () => onDrag?.()
				}}
			>
				{kegiatan.kode}
				{#if canManage}
					<button
						type="button"
						class="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-black/10 hover:text-blue-600 dark:hover:bg-white/10"
						onclick={() => onEditKegiatan?.(kegiatan)}
						aria-label="Edit {kegiatan.kode}"
					>
						<Icon name="edit" class="h-3 w-3" />
					</button>
					<button
						type="button"
						class="inline-flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-black/10 hover:text-red-600 dark:hover:bg-white/10"
						onclick={() => onHapusKegiatan(kegiatan.kode)}
						aria-label="Hapus {kegiatan.kode}"
					>
						<Icon name="close-sm" class="h-3 w-3" />
					</button>
				{/if}
			</span>
		{/each}
	</div>
{:else if activeTab === 'ekstra'}
	<div class="flex flex-wrap gap-1.5">
		{#each kodeKokurikuler as kode (kode)}
			<span
				role="button"
				tabindex="-1"
				class="inline-flex cursor-grab items-center rounded-lg border px-2 py-1 text-xs font-semibold {kodeColorMap[
					kode
				] ??
					'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'}"
				draggable="true"
				ondragstart={(e) => handleDragStart(e, kode)}
				ondragend={() => onDragEnd?.()}
				use:touchDragSource={{ dragData: () => ({ kode }), onDragStart: () => onDrag?.() }}
			>
				{kode}
			</span>
		{/each}
	</div>
{:else}
	{#each kodeMapelPerKelas as kelasGroup (kelasGroup.kelasId)}
		{#if activeTab === kelasGroup.kelasId}
			<div class="flex flex-wrap gap-1.5">
				{#each kelasGroup.kodeMapel as kode (kode)}
					<span
						role="button"
						tabindex="-1"
						class="inline-flex cursor-grab items-center rounded-lg border px-2 py-1 text-xs font-semibold {kodeColorMap[
							kode
						] ??
							'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300'}"
						draggable="true"
						ondragstart={(e) => handleDragStart(e, kode, kelasGroup.kelasId)}
						ondragend={() => onDragEnd?.()}
						use:touchDragSource={{
							dragData: () => ({ kode, kelasId: kelasGroup.kelasId }),
							onDragStart: () => onDrag?.()
						}}
					>
						{kode}
					</span>
				{/each}
			</div>
		{/if}
	{/each}
{/if}
