<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import DeleteMurid from '../../../routes/(admin)/master-data/murid/[id]/delete/+page.svelte';
	import DetailMurid from '../../../routes/(admin)/master-data/murid/[id]/+page.svelte';
	import FormMurid from '../../../routes/(admin)/master-data/murid/form/[[id]]/+page.svelte';
	import MuridBulkPhotoUploadModal from '$lib/components/murid-bulk-photo-upload-modal.svelte';

	type BulkModalData = {
		type: 'bulk';
		selectedMurids: {
			id: number;
			nama: string;
			nis: string;
			nisn: string;
		}[];
	};

	let {
		formSubmitting,
		submitBulkDelete,
		isBulkPhotoUploadOpen = $bindable(false)
	} = $props<{
		formSubmitting: boolean;
		submitBulkDelete: (event: Event) => void;
		isBulkPhotoUploadOpen?: boolean;
	}>();

	const bulkModalData = $derived.by(() => {
		const modal = page.state.modal;
		if (modal?.name === 'delete-murid' && modal.data?.type === 'bulk') {
			return modal.data as BulkModalData;
		}
		return null;
	});

	function handleBulkPhotoUploadSuccess() {
		console.debug('[MuridModals] Bulk photo upload success');
		invalidate('app:murid');
		isBulkPhotoUploadOpen = false;
	}
</script>

{#if ['add-murid', 'edit-murid'].includes(page.state.modal?.name)}
	<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open>
		<div
			class="modal-box rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:w-full sm:max-w-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<FormMurid data={page.state.modal?.data} />
		</div>
	</dialog>
{/if}

{#if page.state.modal?.name === 'detail-murid'}
	<dialog
		class="modal bg-slate-950/45 backdrop-blur-[2px]"
		onclose={() => history.back()}
		onclick={(e) => {
			// Close only when the actual hit target is outside the modal box.
			// Coordinate checks break here: checking a tab swaps the tab-content
			// before this handler runs, the box shrinks/re-centers, and stale
			// click coordinates can land outside the new rect (falsely closing).
			const box = e.currentTarget.querySelector('.modal-box');
			if (box && e.target instanceof Node && !box.contains(e.target)) {
				e.currentTarget.close();
			}
		}}
		open
	>
		<div
			class="modal-box rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:w-full sm:max-w-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<DetailMurid data={page.state.modal?.data} />
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button>close</button>
		</form>
	</dialog>
{/if}

{#if page.state.modal?.name === 'delete-murid'}
	{#if bulkModalData}
		<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" onclose={() => history.back()} open>
			<div
				class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
			>
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
				>
					<Icon name="warning" class="h-5 w-5" />
				</div>
				<h3 class="mt-3 text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
					Hapus data murid terpilih?
				</h3>
				<p class="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Anda akan menghapus <b class="text-slate-900 dark:text-zinc-100"
						>{bulkModalData.selectedMurids.length}</b
					> murid secara permanen.
				</p>
				<ul class="mt-2.5 list-disc space-y-1 pl-5 text-xs text-slate-700 dark:text-zinc-300">
					{#each bulkModalData.selectedMurids.slice(0, 5) as murid (murid.id)}
						<li>{murid.nama}</li>
					{/each}
				</ul>
				{#if bulkModalData.selectedMurids.length > 5}
					<p class="mt-2 text-xs text-slate-500 dark:text-zinc-400">
						dan {bulkModalData.selectedMurids.length - 5} murid lainnya
					</p>
				{/if}
				<p class="mt-3 text-xs text-slate-500 dark:text-zinc-400">
					Tindakan ini tidak bisa dibatalkan.
				</p>
				<div class="mt-5 flex items-center justify-end gap-2">
					<button
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						type="button"
						onclick={() => history.back()}
					>
						<Icon name="close" class="h-3.5 w-3.5" />
						Batal
					</button>
					<button
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-4 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
						type="button"
						onclick={submitBulkDelete}
						disabled={formSubmitting}
					>
						{#if formSubmitting}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<Icon name="del" class="h-3.5 w-3.5" />
						{/if}
						Hapus
					</button>
				</div>
			</div>
			<form method="dialog" class="modal-backdrop bg-transparent">
				<button>close</button>
			</form>
		</dialog>
	{:else}
		<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" onclose={() => history.back()} open>
			<div
				class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
			>
				<DeleteMurid data={page.state.modal?.data} />
			</div>
			<form method="dialog" class="modal-backdrop bg-transparent">
				<button>close</button>
			</form>
		</dialog>
	{/if}
{/if}

<MuridBulkPhotoUploadModal
	bind:isOpen={isBulkPhotoUploadOpen}
	onSuccess={handleBulkPhotoUploadSuccess}
/>
