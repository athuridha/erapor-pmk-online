<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { hideModal } from '$lib/components/global-modal.svelte';
	import { invalidate } from '$app/navigation';
	import {
		profilPelajarPancasilaDimensionLabelByKey,
		type DimensiProfilLulusanKey
	} from '$lib/statics';

	interface Props {
		onSuccess?: () => void;
	}

	let { onSuccess }: Props = $props();

	const fileInputId = 'import-kokurikuler-file';
	let fileInput: HTMLInputElement | null = null;
	let hasFile = $state(false);
	let fileName = $state('');

	const dimensiKeys = Object.keys(
		profilPelajarPancasilaDimensionLabelByKey
	) as DimensiProfilLulusanKey[];
	const dimensiExample = dimensiKeys.slice(0, 3).join(', ');

	function handleFileChange(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		hasFile = Boolean(file);
		fileName = file ? file.name : '';
	}

	function resetForm(form?: HTMLFormElement | null) {
		hasFile = false;
		fileName = '';
		if (fileInput) fileInput.value = '';
		form?.reset();
	}

	function handleClose() {
		resetForm();
		hideModal();
	}
</script>

<div class="space-y-4">
	<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
		Unggah file Excel (.xlsx) sesuai format di bawah. Baris kosong akan diabaikan.
	</p>

	<div
		class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white text-xs dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full border-collapse text-left">
			<thead
				class="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
			>
				<tr>
					<th class="px-3 py-2">Kode</th>
					<th class="px-3 py-2">Dimensi</th>
					<th class="px-3 py-2">Kegiatan</th>
				</tr>
			</thead>
			<tbody
				class="divide-y divide-slate-200/70 text-slate-700 dark:divide-zinc-800 dark:text-zinc-300"
			>
				<tr>
					<td class="px-3 py-2 font-mono text-[11px] text-slate-900 dark:text-zinc-100">KOK1</td>
					<td class="px-3 py-2">{dimensiExample}</td>
					<td class="px-3 py-2">Menulis cerita tentang profile pelajar pancasila</td>
				</tr>
				<tr class="bg-slate-50/50 dark:bg-zinc-800/30">
					<td class="px-3 py-2 font-mono text-[11px] text-slate-900 dark:text-zinc-100">KOK2</td>
					<td class="px-3 py-2">{dimensiExample}</td>
					<td class="px-3 py-2">Presentasi hasil diskusi kelompok</td>
				</tr>
			</tbody>
		</table>
	</div>

	<p class="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
		<strong>Dimensi</strong> dipisahkan koma. Gunakan salah satu dari:
		{#each dimensiKeys as key, i (key)}{#if i > 0},
			{/if}<code
				class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
				>{key}</code
			>{/each}.
	</p>

	<FormEnhance
		action="?/import_kokurikuler"
		enctype="multipart/form-data"
		showToast={true}
		onsuccess={async ({ form }) => {
			await invalidate('app:kokurikuler');
			onSuccess?.();
			resetForm(form);
			hideModal();
		}}
	>
		{#snippet children({ submitting })}
			<fieldset class="space-y-1.5">
				<label class="block text-xs font-medium text-slate-700 dark:text-zinc-300" for={fileInputId}
					>Pilih File Excel (.xlsx)</label
				>
				<input
					id={fileInputId}
					bind:this={fileInput}
					onchange={handleFileChange}
					required
					name="file"
					type="file"
					accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					class="file-input file-input-bordered w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				/>
				<p class="text-[11px] text-slate-500 dark:text-zinc-400">
					Maksimal 2MB. Kolom Kode, Dimensi, dan Kegiatan wajib ada.
				</p>
				{#if fileName}
					<p class="text-[11px] text-slate-600 dark:text-zinc-300">
						File dipilih: <strong>{fileName}</strong>
					</p>
				{/if}
			</fieldset>

			<div
				class="mt-5 flex justify-end gap-2 border-t border-slate-200/70 pt-4 dark:border-zinc-800"
			>
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={handleClose}
					disabled={submitting}>Batal</button
				>
				<button
					type="submit"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={submitting || !hasFile}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon name="import" class="h-3.5 w-3.5" /> Import
					{/if}
				</button>
			</div>
		{/snippet}
	</FormEnhance>
</div>
