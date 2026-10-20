<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import ImportDatabaseModal from '$lib/components/modals/import-database-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';

	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	// single permission to manage dashboard quick actions
	let canDashboardManage = $derived.by(() => {
		const perms = (page.data.user ?? { permissions: [] }).permissions ?? [];
		return (perms as string[]).includes('dashboard_manage');
	});

	// Backup endpoint is admin-only server-side; mirror that so the button is not
	// shown enabled to a non-admin who merely has dashboard_manage.
	let canDownloadBackup = $derived.by(() => {
		const type = page.data.user?.type;
		return type === 'admin' || type === 'kepala_sekolah';
	});

	// Impor data pokok (Excel) memakai izin data sekolah, sama seperti
	// halamannya di /sinkronisasi/import-data.
	let canImportPokok = $derived.by(() => {
		const perms = (page.data.user ?? { permissions: [] }).permissions ?? [];
		return (perms as string[]).includes('informasi_umum_sekolah');
	});

	let downloadingBackup = $state(false);

	const handleBackupDownload = async () => {
		if (typeof window === 'undefined' || downloadingBackup) return;
		downloadingBackup = true;

		try {
			const response = await fetch('/api/database/backup');
			if (!response.ok) {
				const errorText = (await response.text()) || 'Gagal mengunduh backup database.';
				toast(errorText, 'error');
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
			toast('Backup database berhasil diunduh.', 'success');
		} catch (error) {
			console.error(error);
			toast('Gagal mengunduh backup database.', 'error');
		} finally {
			downloadingBackup = false;
		}
	};

	const handleImport = () => {
		showModal({
			title: 'Import Database',
			body: ImportDatabaseModal,
			dismissible: true
		});
	};
</script>

<div class="card bg-base-100 rounded-box shadow-md">
	<div class="card-body">
		<h2 class="card-title mb-4">
			<span class="text-xl">
				<Icon name="gear" />
			</span>
			Tindakan Cepat
		</h2>
		<div class="grid grid-cols-1 gap-2">
			<a href={resolve('/sinkronisasi')} class="btn btn-primary w-full shadow-none font-bold">
				<Icon name="repeat" />
				Sinkronisasi Data
			</a>
			<a
				href={resolve('/pengaturan')}
				onclick={(e) => {
					if (!canDashboardManage) {
						e.preventDefault();
					}
				}}
				class="btn btn-outline btn-accent w-full shadow-none"
				class:btn-disabled={!canDashboardManage}
				aria-disabled={!canDashboardManage}
				title={!canDashboardManage ? 'Anda tidak memiliki izin untuk melakukan tindakan cepat' : ''}
			>
				<Icon name="gear" />
				Pengaturan
			</a>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
				<button
					type="button"
					onclick={() => (canDownloadBackup ? handleBackupDownload() : undefined)}
					class="btn btn-outline btn-accent w-full shadow-none"
					disabled={downloadingBackup || !canDownloadBackup}
					aria-disabled={!canDownloadBackup}
					aria-busy={downloadingBackup}
					title={!canDownloadBackup
						? 'Anda tidak memiliki izin untuk melakukan tindakan cepat'
						: ''}
				>
					{#if downloadingBackup}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<Icon name="database" />
					{/if}
					<span>{downloadingBackup ? 'Mengunduh…' : 'Backup Data'}</span>
				</button>
				<button
					type="button"
					onclick={() => (canDashboardManage ? handleImport() : undefined)}
					class="btn btn-outline btn-accent w-full shadow-none"
					disabled={!canDashboardManage}
					aria-disabled={!canDashboardManage}
					title={!canDashboardManage
						? 'Anda tidak memiliki izin untuk melakukan tindakan cepat'
						: ''}
				>
					<Icon name="import" />
					Import Data
				</button>
			</div>
			<a
				href={resolve('/sinkronisasi/import-data')}
				onclick={(e) => {
					if (!canImportPokok) {
						e.preventDefault();
					}
				}}
				class="btn btn-outline btn-accent w-full shadow-none"
				class:btn-disabled={!canImportPokok}
				aria-disabled={!canImportPokok}
				title={!canImportPokok ? 'Anda tidak memiliki izin untuk mengimpor data pokok' : ''}
			>
				<Icon name="table" />
				Impor Data Pokok (Excel)
			</a>
		</div>
	</div>
</div>
