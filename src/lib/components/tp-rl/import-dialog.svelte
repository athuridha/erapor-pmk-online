<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	interface Props {
		onCancel: () => void;
		onSuccess: (data?: Record<string, unknown>) => void;
	}

	let { onCancel, onSuccess }: Props = $props();

	const fileInputId = 'tp-rl-import-file';
	let fileInput: HTMLInputElement | null = null;
	let hasFile = $state(false);
	let fileName = $state('');
	let submitting = $state(false);

	function handleFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		hasFile = Boolean(file);
		fileName = file ? file.name : '';
	}

	function resetForm(form?: HTMLFormElement | null) {
		hasFile = false;
		fileName = '';
		if (fileInput) {
			fileInput.value = '';
		}
		form?.reset();
	}

	function handleCancel() {
		resetForm();
		onCancel();
	}
</script>

<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open onclose={handleCancel}>
	<div
		class="modal-box max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<div class="mb-3 flex items-start justify-between gap-3">
			<div>
				<h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
					Import Tujuan Pembelajaran
				</h3>
				<p class="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
					Unggah file Excel berekstensi
					<code
						class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
						>.xlsx</code
					>
					dengan format seperti contoh berikut. Baris kosong akan diabaikan otomatis.
				</p>
			</div>
			<button
				type="button"
				class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
				onclick={handleCancel}
				disabled={submitting}
				aria-label="Tutup"
			>
				<Icon name="close" class="h-4 w-4" />
			</button>
		</div>

		<div
			class="mb-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white text-xs dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full border-collapse text-left">
				<thead
					class="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
				>
					<tr>
						<th class="px-3 py-2">Lingkup Materi</th>
						<th class="px-3 py-2">Tujuan Pembelajaran</th>
					</tr>
				</thead>
				<tbody
					class="divide-y divide-slate-200/70 text-slate-700 dark:divide-zinc-800 dark:text-zinc-300"
				>
					<tr>
						<td class="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100">Lingkup Materi 1</td
						>
						<td class="px-3 py-2">Tujuan 1</td>
					</tr>
					<tr class="bg-slate-50/50 dark:bg-zinc-800/30">
						<td class="px-3 py-2"></td>
						<td class="px-3 py-2">Tujuan 2</td>
					</tr>
					<tr>
						<td class="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100">Lingkup Materi 2</td
						>
						<td class="px-3 py-2">Tujuan A</td>
					</tr>
					<tr class="bg-slate-50/50 dark:bg-zinc-800/30">
						<td class="px-3 py-2"></td>
						<td class="px-3 py-2">Tujuan B</td>
					</tr>
				</tbody>
			</table>
		</div>

		<FormEnhance
			id="form-import-tp"
			action="?/import"
			enctype="multipart/form-data"
			showToast={true}
			onsuccess={({ form, data }) => {
				onSuccess(data);
				resetForm(form);
			}}
			submitStateChange={(v) => (submitting = v)}
		>
			<fieldset class="space-y-1.5">
				<label class="block text-xs font-medium text-slate-700 dark:text-zinc-300" for={fileInputId}
					>Pilih File Excel (.xlsx)</label
				>
				<input
					type="file"
					name="file"
					accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					class="file-input file-input-bordered w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					id={fileInputId}
					required
					onchange={handleFileChange}
					bind:this={fileInput}
				/>
				<p class="text-[11px] text-slate-500 dark:text-zinc-400">
					Maksimal 2MB. Pastikan kolom <strong class="text-slate-700 dark:text-zinc-200"
						>Lingkup Materi</strong
					>
					dan
					<strong class="text-slate-700 dark:text-zinc-200">Tujuan Pembelajaran</strong> tersedia.
				</p>
				{#if fileName}
					<p class="text-[11px] text-slate-600 dark:text-zinc-300">
						File dipilih: <span class="font-semibold text-slate-900 dark:text-zinc-100"
							>{fileName}</span
						>
					</p>
				{/if}
			</fieldset>
		</FormEnhance>

		<div
			class="mt-5 flex items-center justify-end gap-2 border-t border-slate-200/70 pt-3 dark:border-zinc-800"
		>
			<button
				class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				type="button"
				onclick={handleCancel}
				disabled={submitting}
			>
				Batal
			</button>
			<button
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				type="submit"
				form="form-import-tp"
				disabled={submitting || !hasFile}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Icon name="import" class="h-3.5 w-3.5" />
				{/if}
				Import
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop bg-transparent">
		<button onclick={handleCancel}>close</button>
	</form>
</dialog>
