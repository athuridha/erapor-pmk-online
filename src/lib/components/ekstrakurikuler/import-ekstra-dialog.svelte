<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { hideModal } from '$lib/components/global-modal.svelte';
	import { invalidate } from '$app/navigation';

	interface Props {
		onSuccess?: () => void;
		lingkupUmum?: boolean;
	}

	let { onSuccess, lingkupUmum = false }: Props = $props();

	const fileInputId = 'import-ekstra-file';
	let fileInput: HTMLInputElement | null = null;
	let hasFile = $state(false);
	let fileName = $state('');

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
					<th class="px-3 py-2">Ekstrakurikuler</th>
					<th class="px-3 py-2">Tujuan</th>
				</tr>
			</thead>
			<tbody
				class="divide-y divide-slate-200/70 text-slate-700 dark:divide-zinc-800 dark:text-zinc-300"
			>
				<!-- Ekstrakurikuler 1 with two tujuan rows -->
				<tr>
					<td class="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100">Pramuka</td>
					<td class="px-3 py-2">Mengamalkan dasa darma pramuka</td>
				</tr>
				<tr class="bg-slate-50/50 dark:bg-zinc-800/30">
					<td class="px-3 py-2"></td>
					<td class="px-3 py-2">Membuat simpul sederhana</td>
				</tr>

				<!-- Ekstrakurikuler 2 with two tujuan rows -->
				<tr>
					<td class="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100">Sepak bola</td>
					<td class="px-3 py-2">Memperagakan cara menggiring bola dengan benar</td>
				</tr>
				<tr class="bg-slate-50/50 dark:bg-zinc-800/30">
					<td class="px-3 py-2"></td>
					<td class="px-3 py-2">Memperagakan cara shot</td>
				</tr>
			</tbody>
		</table>
	</div>

	<FormEnhance
		action="?/import_ekstra"
		enctype="multipart/form-data"
		showToast={true}
		onsuccess={async ({ form }) => {
			// revalidate the same dependency token used in the page load (depends('app:ekstrakurikuler'))
			await invalidate('app:ekstrakurikuler');
			onSuccess?.();
			resetForm(form);
			hideModal();
		}}
	>
		{#snippet children({ submitting })}
			{#if lingkupUmum}
				<div
					class="mb-4 flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3.5 py-2.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
				>
					<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
					<span>Mode Semua Kelas - hasil impor berlaku untuk semua kelas.</span>
				</div>
			{/if}
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
					Maksimal 2MB. Pastikan kolom Ekstrakurikuler dan Tujuan tersedia.
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
