<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { SelectedGroupState } from './types';

	interface Props {
		groups: SelectedGroupState[];
		onCancel: () => void;
		onSuccess: () => void;
	}

	let { groups, onCancel, onSuccess }: Props = $props();

	const idsToDelete = $derived(groups.flatMap((group) => group.ids));
	const totalLingkup = $derived(groups.length);
	const totalTujuan = $derived(groups.reduce((total, group) => total + group.ids.length, 0));
	let submitting = $state(false);
</script>

<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open onclose={onCancel}>
	<div
		class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<FormEnhance
			id="form-bulk-delete"
			action="?/delete"
			onsuccess={onSuccess}
			submitStateChange={(v) => (submitting = v)}
		>
			{#each idsToDelete as idValue (idValue)}
				<input name="ids" value={idValue} hidden />
			{/each}

			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
			>
				<Icon name="warning" class="h-5 w-5" />
			</div>
			<h3 class="mt-3 text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
				Hapus beberapa lingkup materi?
			</h3>
			<p class="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
				{totalLingkup} lingkup materi berikut akan dihapus beserta tujuan pembelajarannya:
			</p>
			<ul
				class="mt-2.5 mb-3 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-slate-700 dark:text-zinc-300"
			>
				{#each groups as group (group.lingkupMateri)}
					<li>
						<span class="font-semibold text-slate-900 dark:text-zinc-100"
							>{group.lingkupMateri}</span
						>
						<span class="text-slate-500 dark:text-zinc-400">
							- {group.ids.length} tujuan pembelajaran</span
						>
					</li>
				{/each}
			</ul>
			<p class="text-xs text-slate-500 dark:text-zinc-400">
				Total tujuan pembelajaran: <strong class="text-slate-700 dark:text-zinc-200"
					>{totalTujuan}</strong
				>
			</p>
		</FormEnhance>

		<div class="mt-5 flex items-center justify-end gap-2">
			<button
				class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				type="button"
				onclick={onCancel}
			>
				Batal
			</button>
			<button
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-4 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
				type="submit"
				form="form-bulk-delete"
				disabled={submitting || idsToDelete.length === 0}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Icon name="del" class="h-3.5 w-3.5" />
				{/if}
				Hapus
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop bg-transparent">
		<button onclick={onCancel}>close</button>
	</form>
</dialog>
