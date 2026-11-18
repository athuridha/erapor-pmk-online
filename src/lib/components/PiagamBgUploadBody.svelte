<script lang="ts">
	import { toast } from '$lib/components/toast.svelte';
	import { hideModal } from '$lib/components/global-modal.svelte';

	let {
		template = '1',
		onUploaded = null
	}: {
		template: '1' | '2';
		onUploaded: (() => Promise<void> | void) | null;
	} = $props();

	let fileInput: HTMLInputElement | null = $state(null);
	let previewUrl: string | null = $state(null);
	let uploading = $state(false);

	async function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (file.type !== 'image/png') {
			toast('File harus berformat PNG.', 'warning');
			input.value = '';
			return;
		}

		previewUrl = URL.createObjectURL(file);
	}

	async function upload() {
		if (!fileInput) return;
		const file = fileInput.files?.[0];
		if (!file) {
			toast('Pilih file terlebih dahulu.', 'warning');
			return;
		}
		uploading = true;

		try {
			const fd = new FormData();
			fd.append('bg', file);
			const res = await fetch(`/api/sekolah/piagam-bg/${template}`, {
				method: 'POST',
				body: fd
			});
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new Error(text || `HTTP ${res.status}`);
			}
			toast('Background piagam berhasil diunggah.', 'success');
			if (onUploaded) await onUploaded();
			hideModal();
		} catch (err) {
			console.error(err);
			toast('Gagal mengunggah background. Coba lagi.', 'error');
		} finally {
			uploading = false;
		}
	}
</script>

<div class="w-full space-y-4">
	<p class="text-xs text-slate-600 dark:text-zinc-300">
		Pastikan gambar berorientasi landscape dan berformat PNG.
	</p>

	<div class="flex flex-col gap-3">
		<input
			bind:this={fileInput}
			type="file"
			accept="image/png"
			class="file-input file-input-bordered w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
			onchange={handleFileChange}
		/>

		{#if previewUrl}
			<div
				class="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/50"
			>
				<img src={previewUrl} alt="Preview" class="w-full rounded-lg object-contain" />
			</div>
		{/if}
	</div>

	<div class="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
		<button
			class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			type="button"
			onclick={() => hideModal()}
			disabled={uploading}>Batal</button
		>
		<button
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
			type="button"
			onclick={upload}
			disabled={uploading}
		>
			{#if uploading}
				<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
			{/if}
			Unggah
		</button>
	</div>
</div>
