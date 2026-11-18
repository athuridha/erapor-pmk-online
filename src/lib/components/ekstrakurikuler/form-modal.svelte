<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { EkstrakurikulerRow } from './types';

	let {
		open,
		title,
		action,
		kelasId,
		tableReady,
		canManage,
		isEditMode,
		modalItem,
		namaInput,
		onNamaChange,
		onClose,
		onSuccess
	} = $props<{
		open: boolean;
		title: string;
		action: string;
		kelasId: number | null;
		tableReady: boolean;
		canManage: boolean;
		isEditMode: boolean;
		modalItem: EkstrakurikulerRow | null;
		namaInput: string;
		onNamaChange: (value: string) => void;
		onClose: () => void;
		onSuccess: (payload: { form: HTMLFormElement }) => void;
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
			<div class="flex items-start justify-between gap-3">
				<div>
					<h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
						{title}
					</h3>
					<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
						Isi nama ekstrakurikuler sesuai kegiatan yang berjalan di kelas.
					</p>
				</div>
				<button
					type="button"
					class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
					onclick={onClose}
					aria-label="Tutup"
				>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>

			<FormEnhance
				id="form-ekstrakurikuler"
				{action}
				onsuccess={onSuccess}
				submitStateChange={(v) => (submitting = v)}
			>
				<input name="kelasId" value={kelasId ?? ''} hidden />
				{#if isEditMode && modalItem}
					<input name="id" value={modalItem.id} hidden />
				{/if}

				<label class="mt-4 flex flex-col gap-1.5">
					<span class="text-xs font-medium text-slate-700 dark:text-zinc-300"
						>Nama Ekstrakurikuler</span
					>
					<input
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:disabled:bg-zinc-800/50"
						placeholder="Masukkan nama ekstrakurikuler"
						name="nama"
						value={namaInput}
						oninput={(event) => onNamaChange((event.currentTarget as HTMLInputElement).value)}
						required
						disabled={!canManage}
					/>
				</label>
			</FormEnhance>

			<div
				class="mt-5 flex items-center justify-end gap-2 border-t border-slate-200/70 pt-4 dark:border-zinc-800"
			>
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="button"
					onclick={onClose}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					Batal
				</button>
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					type="submit"
					form="form-ekstrakurikuler"
					disabled={submitting || !namaInput.trim() || !kelasId || !tableReady}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon name="save" class="h-3.5 w-3.5" />
					{/if}
					{isEditMode ? 'Simpan Perubahan' : 'Simpan'}
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
