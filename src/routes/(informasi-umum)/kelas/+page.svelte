<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { faseBadgeClass } from '$lib/components/kelas/fase';
	import type { KelasCard } from '$lib/components/kelas/types';

	let { data } = $props();
	const daftarKelas = $derived((data.daftarKelas ?? []) as KelasCard[]);
	const academicContext = $derived(data.academicContext ?? null);
	const activeSemester = $derived.by(() => {
		const context = academicContext;
		if (!context?.activeSemesterId) return null;
		for (const tahun of context.tahunAjaranList ?? []) {
			const match = tahun.semester.find((item) => item.id === context.activeSemesterId);
			if (match) {
				return {
					...match,
					tahunAjaranNama: tahun.nama
				};
			}
		}
		return null;
	});

	import { page } from '$app/state';
	// single permission to manage kelas actions
	let canKelasManage = $derived.by(() => {
		const perms = (page.data.user ?? { permissions: [] }).permissions ?? [];
		return (perms as string[]).includes('informasi_umum_kelas');
	});
</script>

{#if academicContext}
	{#if academicContext.activeSemesterId}
		<div
			class="mb-4 flex items-center gap-2.5 rounded-2xl border border-blue-200/80 bg-blue-50/75 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0" />
			<span>
				Menampilkan kelas untuk
				{#if activeSemester}
					<strong>{activeSemester.nama}</strong>
					({activeSemester.tahunAjaranNama})
				{:else}
					semester aktif
				{/if}.
			</span>
		</div>
	{:else}
		<div
			class="mb-4 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="warning" class="h-4 w-4 shrink-0" />
			<span>Setel semester aktif di menu Rapor untuk mulai mengelola data kelas per periode.</span>
		</div>
	{/if}
{/if}

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
	{#each daftarKelas as kelas (kelas.id)}
		<section
			class="flex flex-col overflow-hidden rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div
				class="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-zinc-800"
			>
				<div>
					<h2 class="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
						{kelas.nama}
					</h2>
					<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
						{kelas.tahunAjaran?.nama ?? 'Tahun ajaran belum ditetapkan'} &middot;
						{kelas.semester?.nama ?? 'Semester belum ditetapkan'}
					</p>
				</div>
				<span
					class={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap ${faseBadgeClass(kelas.fase)}`}
				>
					{kelas.fase || 'Belum diatur'}
				</span>
			</div>
			<div class="flex flex-1 flex-col justify-between gap-4 p-4">
				<div class="flex items-center gap-3">
					<span
						class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/60"
					>
						<Icon name="user" class="h-5 w-5" />
					</span>
					<div class="min-w-0">
						<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Wali Kelas</div>
						<div class="truncate text-sm font-bold text-slate-900 dark:text-zinc-100">
							{kelas.waliKelas?.nama ?? '-'}
						</div>
						{#if kelas.waliKelas?.nip}
							<p class="text-xs text-slate-500 tabular-nums dark:text-zinc-400">
								{kelas.waliKelas.nip}
							</p>
						{/if}
					</div>
				</div>
				<div
					class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800"
				>
					<p class="text-xs text-slate-500 dark:text-zinc-400">
						Tampilan baca-saja. CRUD kelas ada di Master Data.
					</p>
					<div class="flex items-center gap-2">
						<a
							class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							href="/master-data/kelas"
						>
							<Icon name="layers" class="h-3.5 w-3.5" />
							Master Data
						</a>
						<a
							href={`/kelas/form/${kelas.id}`}
							class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 {!canKelasManage
								? 'pointer-events-none opacity-50'
								: ''}"
							aria-disabled={!canKelasManage}
							title={!canKelasManage ? 'Anda tidak memiliki izin untuk mengedit kelas' : ''}
						>
							<Icon name="edit" class="h-3.5 w-3.5" />
							Edit
						</a>
					</div>
				</div>
			</div>
		</section>
	{:else}
		<div
			class="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200/75 bg-white p-6 text-center shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900"
		>
			{#if academicContext && !academicContext.activeSemesterId}
				<p class="text-sm text-slate-500 dark:text-zinc-400">
					Tentukan semester aktif untuk melihat atau menambahkan data kelas.
				</p>
			{:else}
				<p class="text-sm text-slate-500 dark:text-zinc-400">
					Belum ada data kelas untuk semester ini.
				</p>
			{/if}
		</div>
	{/each}
</div>
