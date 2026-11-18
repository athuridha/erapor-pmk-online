<script lang="ts">
	import Task from '$lib/components/tasks.svelte';

	let dialogEl: HTMLDialogElement;

	export function open() {
		dialogEl?.showModal();
	}

	export function close() {
		dialogEl?.close();
	}

	function handleDialogClick(event: MouseEvent) {
		if (event.target === dialogEl) {
			close();
		}
	}
</script>

<dialog
	bind:this={dialogEl}
	onclick={handleDialogClick}
	aria-label="Panel Daftar Tugas"
	class="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md border-l border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/45 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
>
	<div class="h-full w-full">
		<Task variant="drawer" onClose={close} />
	</div>
</dialog>
