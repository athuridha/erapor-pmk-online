<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import ImportDatabaseModal from '$lib/components/modals/import-database-modal.svelte';
	import ResetDatabaseModal from '$lib/components/modals/reset-database-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { browser } from '$app/environment';

	// Database management (admin/kepala_sekolah). Backup & import mirror the
	// dashboard quick actions; reset wipes the whole database server-side.
	let downloadingBackup = $state(false);

	async function handleBackupDownload() {
		if (!browser || downloadingBackup) return;
		downloadingBackup = true;

		try {
			const response = await fetch('/api/database/backup');
			if (!response.ok) {
				const errorText = (await response.text()) || 'Gagal mengunduh backup database.';
				toast({ message: errorText, type: 'error' });
				return;
			}

			const blob = await response.blob();
			let filename = 'erapor-pmk-backup.sqlite3';
			const disposition = response.headers.get('content-disposition');
			const matched = disposition?.match(/filename="?([^";]+)"?/i);
			if (matched?.[1]) {
				filename = matched[1];
			} else {
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				filename = `erapor-pmk-backup-${timestamp}.sqlite3`;
			}

			const blobUrl = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			document.body.appendChild(anchor);
			anchor.href = blobUrl;
			anchor.download = filename;
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(blobUrl);
			toast({ message: 'Backup database berhasil diunduh.', type: 'success' });
		} catch (error) {
			console.error(error);
			toast({ message: 'Gagal mengunduh backup database.', type: 'error' });
		} finally {
			downloadingBackup = false;
		}
	}

	function handleImportDatabase() {
		showModal({
			title: 'Import Database',
			body: ImportDatabaseModal,
			dismissible: true
		});
	}

	function handleResetDatabase() {
		showModal({
			title: 'Reset Data',
			body: ResetDatabaseModal,
			dismissible: true
		});
	}
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<header class="mb-4 border-b border-slate-200 pb-3 dark:border-zinc-800">
		<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Database</h2>
		<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
			Kelola isi database aplikasi: unduh salinan backup, pulihkan dari berkas backup, atau
			kosongkan seluruh data untuk memulai dari awal.
		</p>
	</header>

	<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
		<button
			type="button"
			class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
			onclick={handleBackupDownload}
			disabled={downloadingBackup}
			aria-busy={downloadingBackup}
		>
			{#if downloadingBackup}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<Icon name="database" class="h-4 w-4" />
			{/if}
			<span>{downloadingBackup ? 'Mengunduh...' : 'Backup Data'}</span>
		</button>

		<button
			type="button"
			class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			onclick={handleImportDatabase}
		>
			<Icon name="import" class="h-4 w-4" />
			Import Data
		</button>

		<button
			type="button"
			class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/80"
			onclick={handleResetDatabase}
		>
			<Icon name="del" class="h-4 w-4" />
			Reset Data
		</button>
	</div>

	<p class="mt-4 text-xs text-slate-500 dark:text-zinc-400">
		Reset Data mengosongkan seluruh isi database dan mengembalikan aplikasi ke kondisi awal.
	</p>
</section>
