<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { invalidate } from '$app/navigation';

	interface Props {
		open?: boolean;
		onSuccess?: () => void;
		adaDataDapodik?: boolean;
	}

	let { open = $bindable(false), onSuccess, adaDataDapodik = false }: Props = $props();

	const fileInputId = 'import-mapel-file';
	let fileInput: HTMLInputElement | null = null;
	let hasFile = $state(false);
	let fileName = $state('');
	let submitting = $state(false);
	let dialogRef: HTMLDialogElement | null = $state(null);

	$effect(() => {
		if (open && dialogRef && !dialogRef.open) {
			dialogRef.showModal?.();
		} else if (!open && dialogRef?.open) {
			dialogRef.close();
		}
	});

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
		open = false;
	}
</script>

<dialog
	bind:this={dialogRef}
	class="modal bg-slate-950/45 backdrop-blur-[2px]"
	aria-modal="true"
	onclose={() => (open = false)}
>
	<div
		class="modal-box flex max-h-[85vh] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:max-w-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<div class="mb-3 flex shrink-0 items-center justify-between gap-3">
			<h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
				Impor Mata Pelajaran
			</h3>
			<button
				type="button"
				class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
				onclick={handleClose}
				aria-label="Tutup"
			>
				<Icon name="close" class="h-4 w-4" />
			</button>
		</div>

		<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-0.5">
			{#if adaDataDapodik}
				<div
					role="alert"
					class="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
				>
					<Icon name="alert" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
					<span>
						Terdeteksi mata pelajaran dari dapodik. Hati-hati dalam mengimpor mapel, jika ditemukan
						mapel yang tidak sesuai dengan kriteria dapodik akan menyebabkan gagal kirim ke dapodik
					</span>
				</div>
			{/if}
			<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
				Unggah file Excel (.xlsx) sesuai format di bawah. Baris kosong akan diabaikan. <br />Jenis
				terdiri atas: wajib, pilihan, dan mulok.
			</p>

			<div
				class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white text-xs dark:border-zinc-800 dark:bg-zinc-900"
			>
				<table class="w-full border-collapse text-left">
					<thead
						class="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400"
					>
						<tr>
							<th class="px-3 py-2">Mata Pelajaran</th>
							<th class="px-3 py-2">Kode</th>
							<th class="px-3 py-2">Jenis</th>
							<th class="px-3 py-2">KKM</th>
							<th class="px-3 py-2">Lingkup Materi</th>
							<th class="px-3 py-2">Tujuan Pembelajaran</th>
						</tr>
					</thead>
					<tbody
						class="divide-y divide-slate-200/70 text-slate-700 dark:divide-zinc-800 dark:text-zinc-300"
					>
						<tr>
							<td class="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100">Mapel 1</td>
							<td class="px-3 py-2 font-mono">MP001</td>
							<td class="px-3 py-2">wajib</td>
							<td class="px-3 py-2">70</td>
							<td class="px-3 py-2">Lingkup A</td>
							<td class="px-3 py-2">Tujuan A</td>
						</tr>
						<tr class="bg-slate-50/50 dark:bg-zinc-800/30">
							<td class="px-3 py-2"></td>
							<td class="px-3 py-2"></td>
							<td class="px-3 py-2"></td>
							<td class="px-3 py-2"></td>
							<td class="px-3 py-2"></td>
							<td class="px-3 py-2">Tujuan B</td>
						</tr>
						<tr>
							<td class="px-3 py-2 font-medium text-slate-900 dark:text-zinc-100">Mapel 2</td>
							<td class="px-3 py-2 font-mono">MP002</td>
							<td class="px-3 py-2">pilihan</td>
							<td class="px-3 py-2">70</td>
							<td class="px-3 py-2">Lingkup 1</td>
							<td class="px-3 py-2">Tujuan 1</td>
						</tr>
						<tr class="bg-slate-50/50 dark:bg-zinc-800/30">
							<td class="px-3 py-2"></td>
							<td class="px-3 py-2"></td>
							<td class="px-3 py-2"></td>
							<td class="px-3 py-2"></td>
							<td class="px-3 py-2"></td>
							<td class="px-3 py-2">Tujuan 2</td>
						</tr>
					</tbody>
				</table>
			</div>

			<FormEnhance
				id="import-mapel-form"
				action="?/import_mapel"
				enctype="multipart/form-data"
				showToast={true}
				submitStateChange={(v) => (submitting = v)}
				onsuccess={async ({ form }) => {
					await Promise.all([invalidate('app:mapel'), invalidate('app:asesmen-sumatif')]);
					onSuccess?.();
					resetForm(form);
					open = false;
				}}
			>
				<fieldset class="space-y-1.5">
					<label
						class="block text-xs font-medium text-slate-700 dark:text-zinc-300"
						for={fileInputId}>Pilih File Excel (.xlsx)</label
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
						Maksimal 2MB. Pastikan kolom Nama, Kode (opsional), Jenis
						(wajib/pilihan/mulok/kejuruan), dan KKM tersedia.
					</p>
					{#if fileName}
						<p class="text-[11px] text-slate-600 dark:text-zinc-300">
							File dipilih: <strong>{fileName}</strong>
						</p>
					{/if}
				</fieldset>
			</FormEnhance>
		</div>

		<div
			class="sticky bottom-0 z-10 mt-4 flex shrink-0 items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-zinc-800"
		>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={handleClose}
				disabled={submitting}>Batal</button
			>
			<button
				type="submit"
				form="import-mapel-form"
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
	</div>
	<form method="dialog" class="modal-backdrop bg-transparent">
		<button>close</button>
	</form>
</dialog>
