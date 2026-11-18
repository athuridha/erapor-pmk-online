<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { onDestroy, onMount } from 'svelte';
	import type { GroupFormState } from './types';

	interface Props {
		rowNumber: number;
		form: GroupFormState;
		teknikPenilaianList?: Array<{ id: number; nama: string; singkatan: string }>;
		onLingkupMateriInput: (value: string) => void;
		onEntryInput: (index: number, value: string) => void;
		onTeknikInput?: (index: number, value: number | null) => void;
		onOpenDeleteEntry: (index: number) => void;
		onSubmitSuccess: () => void;
		onFormRegistered: (formId: string) => void;
		onSubmittingChange: (submitting: boolean) => void;
		kelasDiampuLain?: Array<{ mapelId: number; kelasNama: string }>;
	}

	let {
		rowNumber,
		form,
		teknikPenilaianList = [],
		onLingkupMateriInput,
		onEntryInput,
		onTeknikInput,
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
	<td class="align-top"
		><input
			type="checkbox"
			class="checkbox checkbox-sm rounded border-[#7e8b9b] dark:border-zinc-600"
			disabled
		/></td
	>
	<td class="animate-pulse align-top text-xs font-semibold text-blue-600 dark:text-blue-400"
		>{rowNumber}</td
	>
	<td class="align-top" colspan="2">
		<textarea
			form={formId}
			class="min-h-30 w-full rounded-xl border border-[#7e8b9b] bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			value={form.lingkupMateri}
			name="lingkupMateri"
			aria-label="Lingkup materi"
			placeholder="Tuliskan lingkup materi"
			required
			oninput={(event) => onLingkupMateriInput((event.currentTarget as HTMLTextAreaElement).value)}
		></textarea>
	</td>
	<td class="align-top" colspan="2">
		<div class="flex flex-col gap-3">
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
					<div
						class="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/65 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/45"
					>
						<div class="flex flex-col gap-2 sm:flex-row sm:items-start">
							<textarea
								form={formId}
								class="min-h-20 w-full rounded-xl border border-[#7e8b9b] bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
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
									class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
									title="Hapus tujuan pembelajaran ini"
									onclick={() => onOpenDeleteEntry(entryIndex)}
								>
									<Icon name="del" class="h-3.5 w-3.5" />
								</button>
							{/if}
						</div>
						{#if teknikPenilaianList && teknikPenilaianList.length > 0}
							<div class="flex items-center gap-2 pt-0.5">
								<label
									class="shrink-0 text-xs font-medium text-slate-600 dark:text-zinc-400"
									for={`tp-teknik-${entryIndex}`}
								>
									Teknik Penilaian:
								</label>
								<div class="relative flex max-w-xs flex-1 items-center">
									<select
										id={`tp-teknik-${entryIndex}`}
										form={formId}
										name={`entries.${entryIndex}.teknikPenilaianId`}
										class="h-8 w-full appearance-none truncate rounded-lg border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
										value={entry.teknikPenilaianId ? String(entry.teknikPenilaianId) : ''}
										onchange={(e) => {
											const val = (e.currentTarget as HTMLSelectElement).value;
											onTeknikInput?.(entryIndex, val ? Number(val) : null);
										}}
									>
										<option value="">-- Pilih Teknik (Opsional) --</option>
										{#each teknikPenilaianList as teknik (teknik.id)}
											<option value={String(teknik.id)}>
												{teknik.nama} ({teknik.singkatan})
											</option>
										{/each}
									</select>
									<span
										aria-hidden="true"
										class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
									>
										<Icon name="down" class="h-3 w-3" />
									</span>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
		{#if kelasDiampuLain && kelasDiampuLain.length > 0}
			<div
				class="mt-2 rounded-xl border border-blue-200/80 bg-blue-50/70 p-2.5 dark:border-blue-900/60 dark:bg-blue-950/35"
			>
				<label class="flex cursor-pointer items-center justify-start gap-2">
					<input
						type="checkbox"
						class="checkbox checkbox-xs rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
						form={formId}
						name="terapkanSemuaKelas"
						value="1"
						checked
					/>
					<span class="text-xs font-semibold text-slate-800 dark:text-zinc-100">
						Terapkan juga ke <strong>{kelasDiampuLain.length} kelas lain</strong> yang Anda ampu
						<span class="font-normal text-slate-600 dark:text-zinc-400"
							>({kelasDiampuLain.map((k) => k.kelasNama).join(', ')})</span
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
