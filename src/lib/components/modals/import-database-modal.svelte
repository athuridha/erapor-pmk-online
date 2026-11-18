<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { hideModal } from '$lib/components/global-modal.svelte';
	import Icon from '../icon.svelte';
	import { toast } from '../toast.svelte';

	const inputId = 'import-database-file';

	let submitting = $state(false);
	let fileInput: HTMLInputElement | null = null;

	async function handleSubmit() {
		if (!fileInput?.files?.[0]) return;

		submitting = true;
		const formData = new FormData();
		formData.append('database', fileInput.files[0]);

		try {
			const response = await fetch('/api/database/import', {
				method: 'POST',
				body: formData,
				redirect: 'error'
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({ message: 'Gagal mengimpor database' }));
				throw new Error(err.message ?? `Error ${response.status}`);
			}

			const data = await response.json();
			hideModal();
			toast(data.message || 'Database berhasil diimport.', 'success');

			if (data.logout) {
				setTimeout(() => {
					window.location.href = data.loginPath ?? '/login';
				}, 1400);
			} else {
				invalidateAll().catch((error) => {
					console.warn('Gagal melakukan refresh data setelah import', error);
					toast('Database berhasil diimport, tetapi data tidak berhasil dimuat ulang.', 'warning');
				});
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Gagal mengimpor database';
			toast(message, 'error');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="space-y-4">
	<div>
		<label
			class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
			for={inputId}
		>
			Pilih berkas database
		</label>
		<input
			required
			bind:this={fileInput}
			name="database"
			type="file"
			accept=".sqlite3"
			class="file-input file-input-bordered w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
			id={inputId}
		/>
		<p class="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
			Contoh file: <code class="font-mono font-semibold">file-backup.sqlite3</code>
		</p>
	</div>

	<div
		role="alert"
		class="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
	>
		<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
		<span>
			Berkas yang diunggah akan menggantikan database saat ini. Backup otomatis dibuat sebelum
			proses import.
		</span>
	</div>

	<div class="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
		<button
			type="button"
			class="mr-auto inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			onclick={hideModal}
			disabled={submitting}
		>
			Batal
		</button>
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
			onclick={handleSubmit}
			disabled={submitting}
		>
			{submitting ? 'Mengunggah...' : 'Import'}
		</button>
	</div>
</div>
