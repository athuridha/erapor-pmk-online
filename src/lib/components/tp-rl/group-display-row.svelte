<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { TujuanPembelajaranGroup } from './types';

	interface Props {
		rowNumber: number;
		group: TujuanPembelajaranGroup;
		isSelected: boolean;
		isEditingBobot: boolean;
		bobotDraftValue: string;
		bobotDisplayValue: string;
		onToggleSelection: (checked: boolean) => void;
		onBobotInput: (value: string) => void;
		onEdit: () => void;
		onDelete: () => void;
		areActionsDisabled: boolean;
	}

	let {
		rowNumber,
		group,
		isSelected,
		isEditingBobot,
		bobotDraftValue,
		bobotDisplayValue,
		onToggleSelection,
		onBobotInput,
		onEdit,
		onDelete,
		areActionsDisabled
	}: Props = $props();

	function handleSelectionChange(event: Event) {
		onToggleSelection((event.currentTarget as HTMLInputElement).checked);
	}

	function handleBobotChange(event: Event) {
		onBobotInput((event.currentTarget as HTMLInputElement).value);
	}
</script>

<tr>
	<td class="align-top">
		<input
			type="checkbox"
			class="checkbox checkbox-sm rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
			aria-label={`Pilih lingkup materi ${group.lingkupMateri}`}
			checked={isSelected}
			onchange={handleSelectionChange}
			disabled={areActionsDisabled}
		/>
	</td>
	<td class="align-top text-xs text-slate-500 dark:text-zinc-400">{rowNumber}</td>
	<td class="align-top text-xs font-medium text-slate-900 dark:text-zinc-100">
		{group.lingkupMateri}
	</td>
	<td class="align-top">
		{#if isEditingBobot}
			<input
				type="number"
				class="h-8 w-full rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				min="0"
				max="100"
				step="0.01"
				value={bobotDraftValue}
				oninput={handleBobotChange}
			/>
		{:else}
			<span class="text-xs font-semibold text-slate-800 dark:text-zinc-200"
				>{bobotDisplayValue}</span
			>
		{/if}
	</td>
	<td class="align-top">
		<div class="flex flex-col gap-2.5">
			{#each group.items as item, itemIndex (item.id)}
				<div class="flex items-start gap-2">
					<span class="w-5 shrink-0 pt-0.5 text-xs font-semibold text-slate-500 dark:text-zinc-400">
						{itemIndex + 1}.
					</span>
					<div class="flex flex-1 flex-col gap-1">
						<span class="text-xs leading-snug text-slate-700 dark:text-zinc-300"
							>{item.deskripsi}</span
						>
						{#if item.teknikPenilaian}
							<div class="flex items-center gap-1.5 pt-0.5">
								<span
									class="inline-flex items-center gap-1 rounded-full border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300"
									title={`Teknik Penilaian: ${item.teknikPenilaian.nama}`}
								>
									<span class="font-semibold">{item.teknikPenilaian.singkatan}</span>
									<span class="opacity-60">•</span>
									<span>{item.teknikPenilaian.nama}</span>
								</span>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</td>
	<td class="align-top">
		<div class="flex flex-col gap-1.5">
			<button
				class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#7e8b9b] bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
				type="button"
				title="Edit lingkup dan tujuan pembelajaran"
				onclick={onEdit}
				disabled={areActionsDisabled}
				aria-disabled={areActionsDisabled}
			>
				<Icon name="edit" class="h-3.5 w-3.5" />
			</button>
			<button
				class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
				type="button"
				title="Hapus lingkup dan tujuan pembelajaran"
				onclick={onDelete}
				disabled={areActionsDisabled}
				aria-disabled={areActionsDisabled}
			>
				<Icon name="del" class="h-3.5 w-3.5" />
			</button>
		</div>
	</td>
</tr>
