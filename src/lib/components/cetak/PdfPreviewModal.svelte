<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	let {
		pdfUrl = '',
		pdfTitle = '',
		open = $bindable(false),
		hasPrev = false,
		hasNext = false,
		loading = false,
		onPrev = () => {},
		onNext = () => {},
		onDownload = undefined,
		onClose = () => {}
	}: {
		pdfUrl: string;
		pdfTitle: string;
		open: boolean;
		hasPrev?: boolean;
		hasNext?: boolean;
		loading?: boolean;
		onPrev?: () => void;
		onNext?: () => void;
		onDownload?: (() => void) | undefined;
		onClose?: () => void;
	} = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (open && dialogEl) {
			dialogEl.showModal();
		}
	});

	function handleClose() {
		onClose();
	}
</script>

{#if open}
	<dialog
		bind:this={dialogEl}
		class="modal bg-slate-950/55 backdrop-blur-[2px]"
		onclose={handleClose}
	>
		<div
			class="modal-box relative flex h-dvh max-h-dvh w-screen max-w-screen flex-col rounded-none bg-white p-0 dark:bg-zinc-950"
		>
			<div class="min-h-0 flex-1">
				<embed src={pdfUrl} type="application/pdf" class="h-full w-full" title={pdfTitle} />
			</div>
			<div class="absolute right-8 bottom-4 flex items-center gap-2">
				{#if onDownload}
					<button
						class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						type="button"
						title="Unduh PDF"
						aria-label="Unduh PDF"
						onclick={onDownload}
						disabled={loading}
						aria-disabled={loading}
					>
						<Icon name="download" class="h-4 w-4" />
					</button>
				{/if}
				<div
					class="inline-flex items-center divide-x divide-blue-500 overflow-hidden rounded-full bg-blue-600 text-white shadow-lg"
				>
					<button
						class="inline-flex h-9 w-9 items-center justify-center transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						type="button"
						onclick={onPrev}
						title="Murid sebelumnya"
						aria-label="Murid sebelumnya"
						disabled={loading || !hasPrev}
						aria-disabled={loading || !hasPrev}
					>
						<Icon name="left" class="h-4 w-4" />
					</button>
					<button
						class="inline-flex h-9 w-9 items-center justify-center transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						type="button"
						onclick={onNext}
						title="Murid berikutnya"
						aria-label="Murid berikutnya"
						disabled={loading || !hasNext}
						aria-disabled={loading || !hasNext}
					>
						<Icon name="right" class="h-4 w-4" />
					</button>
				</div>
				<button
					class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-colors hover:bg-red-700"
					type="button"
					aria-label="Tutup"
					onclick={handleClose}
				>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button type="submit" aria-label="Tutup">close</button>
		</form>
	</dialog>
{/if}
