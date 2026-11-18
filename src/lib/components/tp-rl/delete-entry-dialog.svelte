<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { GroupEntry } from './types';

	interface Props {
		entry?: GroupEntry;
		onCancel: () => void;
		onConfirm: () => void;
	}

	let { entry, onCancel, onConfirm }: Props = $props();

	const label = $derived(entry?.deskripsi.trim() || 'Tujuan pembelajaran tanpa deskripsi');
	const canDelete = $derived(Boolean(entry));
</script>

<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open onclose={onCancel}>
	<div
		class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<div
			class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
		>
			<Icon name="warning" class="h-5 w-5" />
		</div>
		<h3 class="mt-3 text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
			Hapus tujuan pembelajaran?
		</h3>
		<p class="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
			"<span class="font-medium text-slate-900 dark:text-zinc-100">{label}</span>" akan dihapus.
		</p>
		<div class="mt-5 flex items-center justify-end gap-2">
			<button
				class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				type="button"
				onclick={onCancel}
			>
				Batal
			</button>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-4 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
				disabled={!canDelete}
				onclick={onConfirm}
			>
				<Icon name="del" class="h-3.5 w-3.5" />
				Hapus
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop bg-transparent">
		<button onclick={onCancel}>close</button>
	</form>
</dialog>
