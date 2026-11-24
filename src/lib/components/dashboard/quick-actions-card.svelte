<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import ImportDatabaseModal from '$lib/components/modals/import-database-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';

	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { isAdminUser, isAuthorizedUser } from '../../../routes/pengguna/permissions';

	const user = $derived(page.data.user ?? null);
	const activeModul = $derived(
		(
			page.data as {
				activeModul?: 'admin' | 'wali_kelas' | 'guru' | 'pembina_eskul';
			} | null
		)?.activeModul ??
			(isAdminUser(user)
				? 'admin'
				: user?.type === 'wali_kelas'
					? 'wali_kelas'
					: user?.type === 'pembina_eskul'
						? 'pembina_eskul'
						: 'guru')
	);

	let canDashboardManage = $derived.by(() => {
		const perms = (user ?? { permissions: [] }).permissions ?? [];
		return (perms as string[]).includes('dashboard_manage');
	});

	let canDownloadBackup = $derived(isAdminUser(user));

	let canImportPokok = $derived.by(() => {
		const perms = (user ?? { permissions: [] }).permissions ?? [];
		return (perms as string[]).includes('informasi_umum_sekolah');
	});

	type RoleQuickLink = {
		title: string;
		desc: string;
		href:
			| '/presensi-murid'
			| '/catatan-wali-kelas'
			| '/legger'
			| '/cetak'
			| '/jurnal-mengajar'
			| '/asesmen-sumatif'
			| '/ekstrakurikuler'
			| '/nilai-ekstrakurikuler';
		icon: IconName;
		permission: UserPermission;
	};

	const WALI_QUICK_LINKS: RoleQuickLink[] = [
		{
			title: 'Presensi Murid',
			desc: 'Catat dan pantau kehadiran murid perwalian',
			href: '/presensi-murid',
			icon: 'check-square',
			permission: 'administrasi_absen'
		},
		{
			title: 'Catatan Wali Kelas',
			desc: 'Isi catatan perkembangan dan motivasi rapor murid',
			href: '/catatan-wali-kelas',
			icon: 'edit',
			permission: 'administrasi_catatan_wali_kelas'
		},
		{
			title: 'Legger Siswa',
			desc: 'Pantau rekap nilai murid dari kelas X sampai XII',
			href: '/legger',
			icon: 'table',
			permission: 'administrasi_legger'
		},
		{
			title: 'Daftar & Cetak Rapor',
			desc: 'Cetak cover, biodata, rapor, dan piagam kelas',
			href: '/cetak',
			icon: 'print',
			permission: 'cetak_dokumen'
		}
	];

	const GURU_QUICK_LINKS: RoleQuickLink[] = [
		{
			title: 'Presensi Murid',
			desc: 'Isi daftar hadir siswa pada pertemuan mapel',
			href: '/presensi-murid',
			icon: 'check-square',
			permission: 'administrasi_absen'
		},
		{
			title: 'Jurnal Mengajar',
			desc: 'Catat materi ajar dan aktivitas pembelajaran',
			href: '/jurnal-mengajar',
			icon: 'book-open',
			permission: 'administrasi_jurnal_mengajar'
		},
		{
			title: 'Penilaian Mapel',
			desc: 'Input nilai formatif, sumatif, AS, dan revisi',
			href: '/asesmen-sumatif',
			icon: 'pen',
			permission: 'input_nilai_asesmen_sumatif'
		},
		{
			title: 'Cetak Jurnal Mengajar',
			desc: 'Pratinjau dan unduh rekap jurnal mengajar PDF',
			href: '/cetak',
			icon: 'print',
			permission: 'cetak_dokumen'
		}
	];

	const PEMBINA_QUICK_LINKS: RoleQuickLink[] = [
		{
			title: 'Ekstrakurikuler & TP',
			desc: 'Kelola tujuan pembelajaran ekstrakurikuler binaan',
			href: '/ekstrakurikuler',
			icon: 'layers',
			permission: 'mata_pelajaran_ekstrakurikuler'
		},
		{
			title: 'Input Nilai Ekstrakurikuler',
			desc: 'Isi penilaian atau impor Excel anggota eskul lintas kelas',
			href: '/nilai-ekstrakurikuler',
			icon: 'check-square',
			permission: 'input_nilai_nilai_ekstrakurikuler'
		}
	];

	const roleQuickLinks = $derived(
		activeModul === 'pembina_eskul'
			? PEMBINA_QUICK_LINKS
			: activeModul === 'wali_kelas'
				? WALI_QUICK_LINKS
				: GURU_QUICK_LINKS
	);

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

<section
	class="rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="flex items-center justify-between gap-2 px-4 pt-4 pb-1 sm:px-5 sm:pt-5">
		<div class="flex items-center gap-2.5">
			<span
				aria-hidden="true"
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
			>
				<Icon name="activity" class="h-4 w-4" />
			</span>
			<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Tindakan Cepat
			</h2>
		</div>
		<span aria-hidden="true" class="text-slate-400 dark:text-zinc-500">
			<Icon name="gear" class="h-4 w-4" />
		</span>
	</div>

	<div class="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 sm:p-5">
		{#if activeModul === 'admin'}
			<a
				href={resolve('/pengaturan')}
				onclick={(e) => {
					if (!canDashboardManage) {
						e.preventDefault();
					}
				}}
				aria-disabled={!canDashboardManage}
				title={!canDashboardManage ? 'Anda tidak memiliki izin untuk melakukan tindakan cepat' : ''}
				class="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/75 p-3 transition-colors {canDashboardManage
					? 'hover:border-blue-200 hover:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-800/45 dark:hover:border-blue-800 dark:hover:bg-blue-950/30'
					: 'cursor-not-allowed opacity-50 dark:border-zinc-800 dark:bg-zinc-800/45'}"
			>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
				>
					<span aria-hidden="true"><Icon name="gear" class="h-4 w-4" /></span>
				</div>
				<div class="min-w-0 flex-1">
					<div class="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">
						Pengaturan
					</div>
					<p class="truncate text-[11px] text-slate-500 dark:text-zinc-400">Konfigurasi aplikasi</p>
				</div>
			</a>

			<button
				type="button"
				onclick={() => (canDownloadBackup ? handleBackupDownload() : undefined)}
				disabled={downloadingBackup || !canDownloadBackup}
				aria-disabled={!canDownloadBackup}
				aria-busy={downloadingBackup}
				title={!canDownloadBackup ? 'Anda tidak memiliki izin untuk melakukan tindakan cepat' : ''}
				class="flex w-full items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/75 p-3 text-left transition-colors {canDownloadBackup &&
				!downloadingBackup
					? 'hover:border-blue-200 hover:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-800/45 dark:hover:border-blue-800 dark:hover:bg-blue-950/30'
					: 'cursor-not-allowed opacity-50 dark:border-zinc-800 dark:bg-zinc-800/45'}"
			>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
				>
					{#if downloadingBackup}
						<span
							class="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"
							aria-hidden="true"
						></span>
					{:else}
						<span aria-hidden="true"><Icon name="database" class="h-4 w-4" /></span>
					{/if}
				</div>
				<div class="min-w-0 flex-1">
					<div class="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">
						{downloadingBackup ? 'Mengunduh...' : 'Backup Data'}
					</div>
					<p class="truncate text-[11px] text-slate-500 dark:text-zinc-400">Simpan cadangan</p>
				</div>
			</button>

			<button
				type="button"
				onclick={() => (canDashboardManage ? handleImport() : undefined)}
				disabled={!canDashboardManage}
				aria-disabled={!canDashboardManage}
				title={!canDashboardManage ? 'Anda tidak memiliki izin untuk melakukan tindakan cepat' : ''}
				class="flex w-full items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/75 p-3 text-left transition-colors {canDashboardManage
					? 'hover:border-blue-200 hover:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-800/45 dark:hover:border-blue-800 dark:hover:bg-blue-950/30'
					: 'cursor-not-allowed opacity-50 dark:border-zinc-800 dark:bg-zinc-800/45'}"
			>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
				>
					<span aria-hidden="true"><Icon name="import" class="h-4 w-4" /></span>
				</div>
				<div class="min-w-0 flex-1">
					<div class="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">
						Import Database
					</div>
					<p class="truncate text-[11px] text-slate-500 dark:text-zinc-400">Pulihkan database</p>
				</div>
			</button>

			<a
				href={resolve('/import-data')}
				onclick={(e) => {
					if (!canImportPokok) {
						e.preventDefault();
					}
				}}
				aria-disabled={!canImportPokok}
				title={!canImportPokok ? 'Anda tidak memiliki izin untuk mengimpor data pokok' : ''}
				class="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/75 p-3 transition-colors {canImportPokok
					? 'hover:border-blue-200 hover:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-800/45 dark:hover:border-blue-800 dark:hover:bg-blue-950/30'
					: 'cursor-not-allowed opacity-50 dark:border-zinc-800 dark:bg-zinc-800/45'}"
			>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
				>
					<span aria-hidden="true"><Icon name="table" class="h-4 w-4" /></span>
				</div>
				<div class="min-w-0 flex-1">
					<div class="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">
						Impor Data Pokok
					</div>
					<p class="truncate text-[11px] text-slate-500 dark:text-zinc-400">Unggah dari Excel</p>
				</div>
			</a>
		{:else}
			{#each roleQuickLinks as link (link.title)}
				{@const allowed = isAuthorizedUser([link.permission], user ?? undefined)}
				<a
					href={resolve(link.href)}
					onclick={(e) => {
						if (!allowed) {
							e.preventDefault();
						}
					}}
					aria-disabled={!allowed}
					title={!allowed ? 'Anda tidak memiliki izin untuk mengakses halaman ini' : ''}
					class="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/75 p-3 transition-colors {allowed
						? 'hover:border-blue-200 hover:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-800/45 dark:hover:border-blue-800 dark:hover:bg-blue-950/30'
						: 'cursor-not-allowed opacity-50 dark:border-zinc-800 dark:bg-zinc-800/45'}"
				>
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
					>
						<span aria-hidden="true"><Icon name={link.icon} class="h-4 w-4" /></span>
					</div>
					<div class="min-w-0 flex-1">
						<div class="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">
							{link.title}
						</div>
						<p class="truncate text-[11px] text-slate-500 dark:text-zinc-400">
							{link.desc}
						</p>
					</div>
				</a>
			{/each}
		{/if}
	</div>
</section>
