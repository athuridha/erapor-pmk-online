<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { onDestroy, onMount } from 'svelte';
	import type { GroupFormState } from './types';

	interface Props {
		rowNumber: number;
		form: GroupFormState;
		onLingkupMateriInput: (value: string) => void;
		onEntryInput: (index: number, value: string) => void;
		onOpenDeleteEntry: (index: number) => void;
		onSubmitSuccess: () => void;
		onFormRegistered: (formId: string) => void;
		onSubmittingChange: (submitting: boolean) => void;
		kelasDiampuLain?: Array<{ mapelId: number; kelasNama: string }>;
	}

	let {
		rowNumber,
		form,
		onLingkupMateriInput,
		onEntryInput,
		onOpenDeleteEntry,
		onSubmitSuccess,
		onFormRegistered,
		onSubmittingChange,
		kelasDiampuLain = []
	}: Props = $props();

	function createFormId() {
		const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
		if (cryptoApi) {
			if (typeof cryptoApi.randomUUID === 'function') {
				try {
					return cryptoApi.randomUUID();
				} catch (error) {
					console.warn('crypto.randomUUID failed, using fallback.', error);
				}
			}
			if (typeof cryptoApi.getRandomValues === 'function') {
				const buffer = new Uint8Array(16);
				cryptoApi.getRandomValues(buffer);
				buffer[6] = (buffer[6] & 0x0f) | 0x40;
				buffer[8] = (buffer[8] & 0x3f) | 0x80;
				const hex = Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0'));
				return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
					.slice(6, 8)
					.join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
			}
		}
		const timePart = Date.now().toString(36);
		const randomPart = Math.random().toString(36).slice(2, 10);
		return `form-${timePart}-${randomPart}`;
	}

	const formId = createFormId();

	onMount(() => {
		onFormRegistered(formId);
		onSubmittingChange(false);
	});

	onDestroy(() => {
		onFormRegistered('');
		onSubmittingChange(false);
	});

	function shouldShowDeleteButton(entry: GroupFormState['entries'][number]) {
		if (entry.deleted) return false;
		const trimmedDeskripsi = entry.deskripsi.trim();
		if (form.mode === 'edit') {
			return !(entry.id === undefined && trimmedDeskripsi === '');
		}
		return trimmedDeskripsi.length > 0;
	}
</script>

<tr>
	<td class="align-top"><input type="checkbox" class="checkbox" disabled /></td>
	<td class="text-primary animate-pulse align-top font-semibold">{rowNumber}</td>
	<td class="align-top" colspan="2">
		<textarea
			form={formId}
			class="textarea validator bg-base-200 dark:bg-base-300 dark:border-none h-30 w-full"
			value={form.lingkupMateri}
			name="lingkupMateri"
			aria-label="Lingkup materi"
			placeholder="Tuliskan lingkup materi"
			required
			oninput={(event) => onLingkupMateriInput((event.currentTarget as HTMLTextAreaElement).value)}
		></textarea>
	</td>
	<td class="align-top" colspan="2">
		<div class="flex flex-col gap-2">
			{#each form.entries as entry, entryIndex (`${entry.id ?? 'new'}-${entryIndex}`)}
				<input
					type="hidden"
					form={formId}
					name={`entries.${entryIndex}.id`}
					value={entry.id ?? ''}
				/>
				{#if entry.deleted}
					<input type="hidden" form={formId} name={`entries.${entryIndex}.deskripsi`} value="" />
				{:else}
					<div class="flex flex-col gap-2 sm:flex-row">
						<textarea
							form={formId}
							class="textarea validator bg-base-200 dark:bg-base-300 w-full dark:border-none"
							value={entry.deskripsi}
							name={`entries.${entryIndex}.deskripsi`}
							aria-label={`Tujuan pembelajaran ${entryIndex + 1}`}
							placeholder="Tuliskan tujuan pembelajaran"
							required={form.mode === 'create' && entryIndex === 0}
							oninput={(event) =>
								onEntryInput(entryIndex, (event.currentTarget as HTMLTextAreaElement).value)}
						></textarea>
						{#if shouldShowDeleteButton(entry)}
							<button
								type="button"
								class="btn btn-sm btn-soft btn-error shadow-none"
								title="Hapus tujuan pembelajaran ini"
								onclick={() => onOpenDeleteEntry(entryIndex)}
							>
								<Icon name="del" />
							</button>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
		{#if kelasDiampuLain && kelasDiampuLain.length > 0}
			<div
				class="mt-2 rounded-xl bg-base-100/80 p-2.5 border border-base-200 dark:border-base-300 shadow-2xs"
			>
				<label class="label cursor-pointer justify-start gap-2 py-0">
					<input
						type="checkbox"
						class="checkbox checkbox-xs checkbox-primary"
						form={formId}
						name="terapkanSemuaKelas"
						value="1"
						checked
					/>
					<span class="label-text text-xs font-semibold text-base-content">
						Terapkan juga ke <strong>{kelasDiampuLain.length} kelas lain</strong> yang Anda ampu
						<span class="opacity-70 font-normal"
							>(
							{kelasDiampuLain.map((k) => k.kelasNama).join(', ')}
							)</span
						>
					</span>
				</label>
			</div>
		{/if}

		<FormEnhance
			id={formId}
			action="?/save"
			onsuccess={onSubmitSuccess}
			submitStateChange={onSubmittingChange}
		>
			{#snippet children({ submitting })}
				<input name="mode" value={form.mode} hidden />
				<button type="submit" class="hidden" aria-hidden="true" disabled={submitting}></button>
			{/snippet}
		</FormEnhance>
	</td>
</tr>
