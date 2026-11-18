<script lang="ts">
	import { page } from '$app/state';
	import Icon from './icon.svelte';
	import TaskActiveList from './tasks/task-active-list.svelte';
	import TaskCompletedList from './tasks/task-completed-list.svelte';
	import TaskHeader from './tasks/task-header.svelte';
	import {
		createTask,
		deleteTasks,
		listTasks,
		splitTaskBuckets,
		updateTaskStatus
	} from './tasks/task-service';
	import type { TaskRecord } from './tasks/types';

	let {
		variant = 'drawer',
		onClose = () => {}
	}: {
		variant?: 'sidebar' | 'modal' | 'drawer';
		onClose?: () => void;
	} = $props();

	const isDrawer = $derived(variant === 'drawer' || variant === 'modal');

	const kelasAktifId = $derived(page.data.kelasAktif?.id ?? null);
	const kelasLabel = $derived.by(() => {
		const kelas = page.data.kelasAktif ?? null;
		if (!kelas) return null;
		return kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama;
	});

	let activeTasks = $state<TaskRecord[]>([]);
	let completedTasks = $state<TaskRecord[]>([]);
	let isAdding = $state(false);
	let newTaskTitle = $state('');
	let isLoading = $state(false);
	let hasLoaded = $state(false);
	let isProcessing = $state(false);
	let errorMessage = $state('');
	let previousKelasId = $state<number | null>(null);
	let activeListRef = $state<{ focusInput: () => Promise<void> | void } | null>(null);

	const showInitialSpinner = $derived(isLoading && !hasLoaded);
	const hasActiveTasks = $derived(Boolean(activeTasks.length));
	const hasCompletedTasks = $derived(Boolean(completedTasks.length));
	const hasAnyTasks = $derived(hasActiveTasks || hasCompletedTasks);
	const canManageTasks = $derived(Boolean(kelasAktifId));
	const hasAnyTasksLoaded = $derived(canManageTasks && hasLoaded);
	const showEmptyState = $derived(hasAnyTasksLoaded && !isAdding && !hasActiveTasks);
	const showNoClass = $derived(!canManageTasks);

	const resetBuckets = () => {
		activeTasks = [];
		completedTasks = [];
	};

	const resetInput = () => {
		newTaskTitle = '';
		isAdding = false;
	};

	const assignBuckets = (tasks: TaskRecord[]) => {
		const { active, completed } = splitTaskBuckets(tasks);
		activeTasks = active;
		completedTasks = completed;
	};

	const ensureKelasAvailable = () => {
		if (!kelasAktifId) {
			errorMessage = 'Pilih kelas untuk mengelola tugas.';
			return false;
		}
		return true;
	};

	const loadTasks = async ({
		kelasId = kelasAktifId,
		showSpinner = false
	}: { kelasId?: number | null; showSpinner?: boolean } = {}) => {
		const targetKelasId = kelasId ?? null;
		if (!targetKelasId) {
			resetBuckets();
			hasLoaded = false;
			isLoading = false;
			return;
		}
		if (showSpinner) isLoading = true;
		errorMessage = '';
		try {
			const tasks = await listTasks(targetKelasId);
			if (kelasAktifId !== targetKelasId) return;
			assignBuckets(tasks);
		} catch (error) {
			console.error(error);
			if (kelasAktifId !== targetKelasId) return;
			resetBuckets();
			errorMessage = error instanceof Error ? error.message : 'Gagal memuat tugas.';
		} finally {
			if (kelasAktifId === targetKelasId) {
				hasLoaded = true;
				isLoading = false;
			}
		}
	};

	$effect(() => {
		if (kelasAktifId === previousKelasId) return;
		previousKelasId = kelasAktifId;
		resetInput();
		if (!kelasAktifId) {
			resetBuckets();
			hasLoaded = false;
			isLoading = false;
			errorMessage = '';
			return;
		}
		hasLoaded = false;
		void loadTasks({ kelasId: kelasAktifId, showSpinner: true });
	});

	const toggleAddTask = async () => {
		if (isProcessing) return;
		if (isAdding) {
			resetInput();
			return;
		}
		if (!ensureKelasAvailable()) return;
		isAdding = true;
		await activeListRef?.focusInput();
	};

	const saveTask = async () => {
		const title = newTaskTitle.trim();
		if (!title || isProcessing) return;
		if (!ensureKelasAvailable()) return;
		const kelasId = kelasAktifId!;
		isProcessing = true;
		errorMessage = '';
		try {
			await createTask(kelasId, title);
			resetInput();
			await loadTasks({ kelasId, showSpinner: false });
		} catch (error) {
			console.error(error);
			errorMessage = error instanceof Error ? error.message : 'Gagal menyimpan tugas.';
		} finally {
			isProcessing = false;
		}
	};

	const updateTask = async (taskId: number, status: 'active' | 'completed') => {
		if (isProcessing) return;
		if (!ensureKelasAvailable()) return;
		const kelasId = kelasAktifId!;
		isProcessing = true;
		errorMessage = '';
		try {
			await updateTaskStatus(kelasId, taskId, status);
			await loadTasks({ kelasId, showSpinner: false });
		} catch (error) {
			console.error(error);
			errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui tugas.';
		} finally {
			isProcessing = false;
		}
	};

	const moveToCompleted = (taskId: number) => {
		void updateTask(taskId, 'completed');
	};

	const moveToActive = (taskId: number) => {
		void updateTask(taskId, 'active');
	};

	const removeTasks = async (payload: { id?: number; scope?: 'completed' | 'all' }) => {
		if (isProcessing) return;
		if (!ensureKelasAvailable()) return;
		const kelasId = kelasAktifId!;
		isProcessing = true;
		errorMessage = '';
		try {
			await deleteTasks(kelasId, payload);
			await loadTasks({ kelasId, showSpinner: false });
		} catch (error) {
			console.error(error);
			errorMessage = error instanceof Error ? error.message : 'Gagal menghapus tugas.';
		} finally {
			isProcessing = false;
		}
	};

	const removeTask = (taskId: number) => {
		void removeTasks({ id: taskId });
	};

	const clearCompleted = () => {
		if (!hasCompletedTasks) return;
		void removeTasks({ scope: 'completed' });
	};

	const clearAll = () => {
		if (!hasAnyTasks) return;
		void removeTasks({ scope: 'all' });
	};
</script>

<div class="flex h-full w-full flex-col bg-white dark:bg-zinc-900">
	<TaskHeader
		{isAdding}
		{isProcessing}
		canManage={canManageTasks}
		{showInitialSpinner}
		{hasCompletedTasks}
		{hasAnyTasks}
		{kelasLabel}
		showCloseButton={isDrawer}
		onToggleAdd={toggleAddTask}
		onClearCompleted={clearCompleted}
		onClearAll={clearAll}
		{onClose}
	/>

	{#if errorMessage}
		<div class="px-4 pt-3">
			<div
				class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
				role="alert"
			>
				<span aria-hidden="true"><Icon name="error" class="h-4 w-4 shrink-0" /></span>
				<span class="flex-1">{errorMessage}</span>
			</div>
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
		{#if showInitialSpinner}
			<div class="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-xs">
				<span
					class="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"
					aria-hidden="true"
				></span>
				<span class="text-slate-600 dark:text-zinc-400">Memuat daftar tugas...</span>
			</div>
		{:else if showNoClass}
			<div class="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 py-8 text-center">
				<p class="text-sm font-semibold text-slate-900 dark:text-zinc-100">Belum ada kelas aktif</p>
				<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Pilih satu kelas terlebih dahulu untuk melihat atau menambah daftar tugas kelas.
				</p>
			</div>
		{:else}
			<TaskActiveList
				bind:this={activeListRef}
				tasks={activeTasks}
				{isAdding}
				{isProcessing}
				{newTaskTitle}
				canManage={canManageTasks}
				onUpdateTitle={(title) => (newTaskTitle = title)}
				onSave={() => void saveTask()}
				onCancel={resetInput}
				onComplete={(id) => void moveToCompleted(id)}
				onRemove={(id) => void removeTask(id)}
			/>
			{#if showEmptyState}
				<div class="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 py-8 text-center">
					<p class="text-sm font-semibold text-slate-900 dark:text-zinc-100">
						Belum ada tugas aktif
					</p>
					<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
						Tekan tombol Tambah di atas untuk mencatat pengingat kelas.
					</p>
				</div>
			{/if}
		{/if}

		{#if !showNoClass}
			<div class="mt-auto p-3">
				<TaskCompletedList
					tasks={completedTasks}
					{isProcessing}
					{showInitialSpinner}
					canManage={canManageTasks}
					onRestore={(id) => void moveToActive(id)}
					onRemove={(id) => void removeTask(id)}
				/>
			</div>
		{/if}
	</div>
</div>
