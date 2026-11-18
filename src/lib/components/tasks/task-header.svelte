<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { onMount } from 'svelte';

	let {
		isAdding = false,
		isProcessing = false,
		canManage = true,
		showInitialSpinner = false,
		hasCompletedTasks = false,
		hasAnyTasks = false,
		kelasLabel = null,
		showCloseButton = false,
		onToggleAdd = () => {},
		onClearCompleted = () => {},
		onClearAll = () => {},
		onClose = () => {}
	} = $props<{
		isAdding?: boolean;
		isProcessing?: boolean;
		canManage?: boolean;
		showInitialSpinner?: boolean;
		hasCompletedTasks?: boolean;
		hasAnyTasks?: boolean;
		kelasLabel?: string | null;
		showCloseButton?: boolean;
		onToggleAdd?: () => void;
		onClearCompleted?: () => void;
		onClearAll?: () => void;
		onClose?: () => void;
	}>();

	let menuOpen = $state(false);

	onMount(() => {
		const closeOnOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target?.closest('.task-header-menu')) {
				menuOpen = false;
			}
		};
		window.addEventListener('click', closeOnOutside);
		return () => window.removeEventListener('click', closeOnOutside);
	});
</script>

<div class="flex flex-col gap-1.5 border-b border-slate-200 px-4 py-3.5 dark:border-zinc-800">
	<div class="flex items-center gap-2">
		<h2 class="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
			Daftar Tugas
		</h2>
		{#if showInitialSpinner}
			<span
				class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"
				aria-hidden="true"
			></span>
		{/if}
		<div class="flex-1"></div>
		<div class="flex items-center gap-1.5">
			<button
				type="button"
				class="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:opacity-50 {isAdding
					? 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300'
					: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'}"
				onclick={onToggleAdd}
				title={isAdding ? 'Batalkan tambah tugas' : 'Tambah tugas baru'}
				aria-label={isAdding ? 'Batalkan tambah tugas' : 'Tambah tugas baru'}
				disabled={isProcessing || !canManage}
				aria-disabled={isProcessing || !canManage}
			>
				<span aria-hidden="true">
					<Icon name={isAdding ? 'close' : 'plus'} class="h-3.5 w-3.5" />
				</span>
				<span>{isAdding ? 'Batal' : 'Tambah'}</span>
			</button>

			<div class="task-header-menu relative">
				<button
					type="button"
					title="Opsi hapus tugas"
					aria-label="Opsi hapus tugas"
					aria-expanded={menuOpen}
					disabled={!hasAnyTasks || isProcessing || !canManage}
					aria-disabled={!hasAnyTasks || isProcessing || !canManage}
					onclick={(e) => {
						e.stopPropagation();
						menuOpen = !menuOpen;
					}}
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
				>
					<span aria-hidden="true">
						<Icon name="more-vertical" class="h-4 w-4" />
					</span>
				</button>

				{#if menuOpen}
					<div
						class="absolute right-0 z-20 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
						role="menu"
					>
						<button
							type="button"
							role="menuitem"
							class="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:text-zinc-200 dark:hover:bg-zinc-800"
							onclick={() => {
								menuOpen = false;
								onClearCompleted();
							}}
							disabled={!hasCompletedTasks || isProcessing || !canManage}
						>
							Hapus tugas selesai
						</button>
						<button
							type="button"
							role="menuitem"
							class="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/50"
							onclick={() => {
								menuOpen = false;
								onClearAll();
							}}
							disabled={!hasAnyTasks || isProcessing || !canManage}
						>
							Hapus semua tugas
						</button>
					</div>
				{/if}
			</div>

			{#if showCloseButton}
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
					onclick={onClose}
					title="Tutup panel tugas"
					aria-label="Tutup panel tugas"
				>
					<span aria-hidden="true"><Icon name="close" class="h-4 w-4" /></span>
				</button>
			{/if}
		</div>
	</div>
	{#if kelasLabel}
		<p class="truncate text-xs text-slate-600 dark:text-zinc-400" title={kelasLabel}>
			Kelas aktif: <span class="font-semibold text-slate-900 dark:text-zinc-100">{kelasLabel}</span>
		</p>
	{/if}
</div>
