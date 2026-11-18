<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { TaskRecord } from './types';
	import { tick } from 'svelte';

	let {
		tasks = [],
		isAdding = false,
		isProcessing = false,
		newTaskTitle = '',
		canManage = true,
		onUpdateTitle = (_title: string) => {},
		onSave = () => {},
		onCancel = () => {},
		onComplete = (_id: number) => {},
		onRemove = (_id: number) => {}
	} = $props<{
		tasks?: TaskRecord[];
		isAdding?: boolean;
		isProcessing?: boolean;
		newTaskTitle?: string;
		canManage?: boolean;
		onUpdateTitle?: (title: string) => void;
		onSave?: () => void;
		onCancel?: () => void;
		onComplete?: (id: number) => void;
		onRemove?: (id: number) => void;
	}>();

	let newTaskInput = $state<HTMLInputElement | null>(null);

	export async function focusInput() {
		await tick();
		newTaskInput?.focus();
	}

	const handleInput = (event: Event) => {
		const target = event.currentTarget as HTMLInputElement | null;
		onUpdateTitle(target?.value ?? '');
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			onSave();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			onCancel();
		}
	};
</script>

{#if isAdding || tasks.length}
	<div class="divide-y divide-slate-200 dark:divide-zinc-800">
		{#if isAdding}
			<div class="bg-slate-50 p-3 dark:bg-zinc-800/60">
				<label for="new-task-title-input" class="sr-only">Nama tugas baru</label>
				<div class="flex items-center gap-2">
					<input
						id="new-task-title-input"
						bind:this={newTaskInput}
						value={newTaskTitle}
						placeholder="Tulis pengingat atau tugas kelas..."
						class="h-8 min-w-0 flex-1 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						oninput={handleInput}
						onkeydown={handleKeydown}
						autocomplete="off"
					/>
					<button
						type="button"
						class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
						onclick={onSave}
						title="Simpan tugas"
						aria-label="Simpan tugas"
						disabled={isProcessing || !newTaskTitle.trim() || !canManage}
						aria-disabled={isProcessing || !newTaskTitle.trim() || !canManage}
					>
						<span aria-hidden="true"><Icon name="save" class="h-3.5 w-3.5" /></span>
						<span>Simpan</span>
					</button>
				</div>
			</div>
		{/if}
		{#each tasks as task (task.id)}
			<div
				class="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50"
			>
				<input
					type="checkbox"
					class="h-4 w-4 shrink-0 rounded border-[#7e8b9b] accent-blue-600 dark:border-slate-500"
					onchange={() => onComplete(task.id)}
					title="Tandai selesai"
					aria-label={`Tandai tugas "${task.title}" selesai`}
					disabled={isProcessing || !canManage}
					aria-disabled={isProcessing || !canManage}
				/>
				<p
					class="min-w-0 flex-1 text-sm leading-snug break-words text-slate-900 dark:text-zinc-100"
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
