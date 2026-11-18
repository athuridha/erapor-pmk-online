<script lang="ts">
	import { onMount } from 'svelte';

	type Props = {
		setUploader?: (fn: () => File | null) => void;
	};

	let { setUploader }: Props = $props();

	let fileInput: HTMLInputElement | undefined;
	let selectedFile: File | undefined;

	function onFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			selectedFile = file;
		}
	}

	onMount(() => {
		if (setUploader && typeof setUploader === 'function') {
			setUploader(() => selectedFile ?? null);
		}
	});

	$effect(() => {
		if (setUploader && typeof setUploader === 'function') {
			setUploader(() => selectedFile ?? null);
		}
	});
</script>

<div class="space-y-2 p-1">
	<span class="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
		Import file excel
	</span>
	<input
		type="file"
		class="file-input file-input-bordered w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
		accept=".xlsx"
		bind:this={fileInput}
		onchange={onFileChange}
		aria-label="Pilih file Excel"
	/>
	<p class="text-[11px] text-slate-500 dark:text-zinc-400">
		Pilih file Excel (.xlsx) sesuai format "Unduh Template"
	</p>
</div>
