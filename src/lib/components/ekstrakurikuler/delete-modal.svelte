<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { EkstrakurikulerRow } from './types';

	let { open, title, action, ids, mode, item, canManage, disabled, onClose, onSuccess } = $props<{
		open: boolean;
		title: string;
		action: string;
		ids: number[];
		mode: 'single' | 'bulk';
		item: EkstrakurikulerRow | null;
		canManage: boolean;
		disabled: boolean;
		onClose: () => void;
		onSuccess: () => void;
	}>();

	let submitting = $state(false);
</script>

{#if open}
	<div
		class="modal modal-open bg-slate-950/45 backdrop-blur-[2px]"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		onkeydown={(event) => {
			if (event.key === 'Escape') onClose();
		}}
	>
		<dialog
			class="modal-box relative z-10 max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
			open
			aria-modal="true"
		>
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
			>
				<Icon name="warning" class="h-5 w-5" />
			</div>
			<h3 class="mt-3 text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
				{title}
			</h3>
			{#if mode === 'single' && item}
				<p class="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Yakin ingin menghapus ekstrakurikuler
					<span class="font-semibold text-slate-900 dark:text-zinc-100">{item.nama}</span>?
				</p>
			{:else if mode === 'bulk'}
				<p class="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Yakin ingin menghapus {ids.length} ekstrakurikuler terpilih?
				</p>
			{/if}

			<FormEnhance
				id="form-delete-ekstrakurikuler"
				{action}
				onsuccess={() => {
					onSuccess();
				}}
				submitStateChange={(v) => (submitting = v)}
			>
				{#each ids as id (id)}
					<input name="ids" value={id} hidden />
				{/each}
			</FormEnhance>

			<div class="mt-5 flex items-center justify-end gap-2">
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="button"
					onclick={onClose}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					Batal
				</button>
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-4 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
					type="submit"
					form="form-delete-ekstrakurikuler"
					disabled={submitting || disabled || !canManage}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon name="del" class="h-3.5 w-3.5" />
					{/if}
					Hapus
				</button>
			</div>
		</dialog>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button
				type="submit"
				onclick={(event) => {
					event.preventDefault();
					onClose();
				}}
			>
				tutup
			</button>
		</form>
	</div>
{/if}
