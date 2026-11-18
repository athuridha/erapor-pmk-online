<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { TaskRecord } from './types';

	let {
		tasks = [],
		isProcessing = false,
		showInitialSpinner = false,
		canManage = true,
		onRestore = (_id: number) => {},
		onRemove = (_id: number) => {}
	} = $props<{
		tasks?: TaskRecord[];
		isProcessing?: boolean;
		showInitialSpinner?: boolean;
		canManage?: boolean;
		onRestore?: (id: number) => void;
		onRemove?: (id: number) => void;
	}>();

	let open = $state(false);
</script>

<div
	class="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50"
>
	<button
		type="button"
		aria-expanded={open}
		onclick={() => (open = !open)}
		class="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
	>
		<span class="flex items-center gap-2">
			<span>Tugas selesai</span>
			<span
				class="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 tabular-nums dark:bg-zinc-700 dark:text-zinc-200"
			>
				{tasks.length}
			</span>
		</span>
		<span
			aria-hidden="true"
			class="text-slate-500 transition-transform duration-150 {open
				? 'rotate-180'
				: ''} dark:text-zinc-400"
		>
			<Icon name="down" class="h-3.5 w-3.5" />
		</span>
	</button>

	{#if open}
		<div class="border-t border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
			{#if showInitialSpinner}
				<div class="flex items-center justify-center gap-2 p-4 text-xs">
					<span
						class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"
						aria-hidden="true"
					></span>
					<span class="text-slate-600 dark:text-zinc-400">Memuat tugas selesai...</span>
				</div>
			{:else if !tasks.length}
				<p class="p-4 text-center text-xs text-slate-600 dark:text-zinc-400">
					Belum ada tugas yang selesai.
				</p>
			{:else}
				<div class="divide-y divide-slate-200 dark:divide-zinc-800">
					{#each tasks as task (task.id)}
						<div class="flex items-center gap-3 px-3.5 py-2.5">
							<input
								type="checkbox"
								class="h-4 w-4 shrink-0 rounded border-[#7e8b9b] accent-blue-600 dark:border-slate-500"
								checked
								onchange={() => onRestore(task.id)}
								title="Kembalikan ke tugas aktif"
								aria-label={`Kembalikan tugas "${task.title}" ke aktif`}
								disabled={isProcessing || !canManage}
								aria-disabled={isProcessing || !canManage}
							/>
							<p
								class="min-w-0 flex-1 text-xs leading-snug break-words text-slate-500 line-through dark:text-zinc-400"
							>
								{task.title}
							</p>
							<button
								type="button"
								class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-red-950/50 dark:hover:text-red-400"
								title="Hapus tugas"
								aria-label={`Hapus tugas "${task.title}"`}
								onclick={() => onRemove(task.id)}
								disabled={isProcessing || !canManage}
								aria-disabled={isProcessing || !canManage}
							>
								<span aria-hidden="true"><Icon name="del" class="h-3.5 w-3.5" /></span>
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
