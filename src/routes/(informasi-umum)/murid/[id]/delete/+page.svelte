<script lang="ts">
	import { invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	const handleDeleteSuccess = async ({ data: payload }: { data?: Record<string, unknown> }) => {
		await invalidate('app:murid');
		history.back();
		const message =
			typeof payload?.message === 'string' ? payload.message : 'Data murid berhasil dihapus';
		toast({ message, type: 'success', persist: true });
	};
</script>

<FormEnhance action="?/delete" onsuccess={handleDeleteSuccess} showToast={false}>
	{#snippet children({ submitting })}
		<h2 class="mb-3 text-lg font-bold tracking-tight text-red-700 dark:text-red-400">
			Hapus data murid?
		</h2>
		<div
			class="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300"
		>
			<p><span class="font-medium text-slate-500 dark:text-zinc-400">NIS:</span> {data.murid.nis ?? '-'}</p>
			<p><span class="font-medium text-slate-500 dark:text-zinc-400">NISN:</span> {data.murid.nisn ?? '-'}</p>
			<p>
				<span class="font-medium text-slate-500 dark:text-zinc-400">Nama:</span>
				<strong class="text-slate-900 dark:text-zinc-100">{data.murid.nama}</strong>
			</p>
		</div>

		<div
			class="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800"
		>
			<button
				class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				type="button"
				onclick={() => history.back()}
			>
				<Icon name="close" class="h-3.5 w-3.5" />
				Batal
			</button>

			<button
				class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={submitting}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					<Icon name="del" class="h-3.5 w-3.5" />
				{/if}
				Hapus
			</button>
		</div>
	{/snippet}
</FormEnhance>
