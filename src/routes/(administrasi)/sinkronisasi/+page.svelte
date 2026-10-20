<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let isPushing = $state(false);
	let isPulling = $state(false);
	let pushStep = $state('');
	let pullStep = $state('');
	let pushResult = $state<{ message?: string; checksum?: string } | null>(null);
	let pullResult = $state<{
		message?: string;
		count?: number;
		details?: { kelas?: number; murid?: number; mapel?: number };
		mode?: 'replace' | 'merge';
		merge?: { inserted?: number; updated?: number; unchanged?: number };
	} | null>(null);
	let pullError = $state('');
	let pushError = $state('');
	let isPushingMaster = $state(false);
	let pushMasterResult = $state<{
		message?: string;
		counts?: { murid?: number; kelas?: number; auth_user?: number };
	} | null>(null);
	let pushMasterError = $state('');

	// Status koneksi (uji nyata ke Database Pusat)
	let isTestingConnection = $state(false);
	let connectionResult = $state<{ ok: boolean; message: string } | null>(null);

	const tokenSourceLabel: Record<string, string> = {
		database: 'API Token yang tersimpan di aplikasi',
		env: 'variabel lingkungan server',
		wrangler: 'sesi wrangler lokal',
		none: 'belum ada token'
	};

	let cloudState = $derived.by(() => {
		const { hasToken, tokenSource, wranglerTokenExpired } = data.syncSettings;

		if (!hasToken) {
			if (wranglerTokenExpired) {
				return {
					dot: 'bg-amber-500',
					text: 'text-amber-600 dark:text-amber-400',
					label: 'PERLU TOKEN BARU',
					hint: 'Sesi otentikasi cloud kedaluwarsa. Hubungi administrator/pengembang sistem.'
				};
			}
			return {
				dot: 'bg-slate-400',
				text: 'text-base-content/70',
				label: 'BELUM DIKONFIGURASI',
				hint: 'Kredensial belum dikonfigurasi. Hubungi administrator/pengembang sistem.'
			};
		}

		return {
			dot: 'bg-emerald-500',
			text: 'text-emerald-600 dark:text-emerald-400',
			label: 'KREDENSIAL SIAP',
			hint: `Token dari ${tokenSourceLabel[tokenSource] ?? 'sumber tidak dikenal'}. Tekan Tes Koneksi untuk memastikan.`
		};
	});

	// Modal & status approval paket
	let isApproving = $state(false);
	let rejectModalOpen = $state(false);
	let rejectingPackageId = $state<string | null>(null);
	let rejectReason = $state('');

	async function handleApprovePackage(packageId: string) {
		if (isApproving) return;
		isApproving = true;
		try {
			const res = await fetch('/api/cloud/approve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ packageId, action: 'APPROVE' })
			});
			const json = await res.json();
			if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menyetujui');
			toast(json.message || 'Paket nilai berhasil disetujui (APPROVED).', 'success');
			await invalidateAll();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Gagal menyetujui paket nilai.';
			toast(msg, 'error');
		} finally {
			isApproving = false;
		}
	}

	function openRejectModal(packageId: string) {
		rejectingPackageId = packageId;
		rejectReason = '';
		rejectModalOpen = true;
	}

	async function confirmRejectPackage() {
		if (!rejectingPackageId || isApproving) return;
		isApproving = true;
		try {
			const res = await fetch('/api/cloud/approve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					packageId: rejectingPackageId,
					action: 'REJECT',
					notes: rejectReason
				})
			});
			const json = await res.json();
			if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menolak');
			toast(json.message || 'Paket nilai telah ditolak.', 'info');
			rejectModalOpen = false;
			rejectingPackageId = null;
			await invalidateAll();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Gagal menolak paket.';
			toast(msg, 'error');
		} finally {
			isApproving = false;
		}
	}

	async function handlePull() {
		isPulling = true;
		pullResult = null;
		pullError = '';
		pullStep = 'Menghubungi Database Pusat...';

		try {
			await new Promise((r) => setTimeout(r, 400));
			pullStep = 'Mengunduh data master terbaru (Rombel, Siswa, Mapel)...';

			const res = await fetch('/api/cloud/pull', { method: 'POST' });
			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.error || 'Gagal menyinkronkan data dari Database Pusat');
			}

			pullStep = 'Memperbarui database lokal...';
			await new Promise((r) => setTimeout(r, 400));

			pullResult = json;
			toast(json.message, 'success');
			await invalidateAll();
		} catch (err: unknown) {
			pullError =
				err instanceof Error ? err.message : 'Gagal menyinkronkan data dari Database Pusat.';
			toast(pullError, 'error');
		} finally {
			isPulling = false;
			pullStep = '';
		}
	}

	async function handlePush() {
		isPushing = true;
		pushResult = null;
		pushError = '';
		pushStep = 'Memeriksa koneksi Database Pusat...';

		try {
			await new Promise((r) => setTimeout(r, 500));
			pushStep = 'Mengemas data nilai sumatif, formatif & presensi...';

			await new Promise((r) => setTimeout(r, 500));
			pushStep = 'Menghitung checksum integritas data SHA-256...';

			const res = await fetch('/api/cloud/push', { method: 'POST' });
			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.error || 'Gagal mengirim nilai ke Database Pusat');
			}

			pushStep = 'Menyimpan rekaman ke Database Pusat...';
			await new Promise((r) => setTimeout(r, 400));

			pushResult = json;
			toast(json.message, 'success');
			await invalidateAll();
		} catch (err: unknown) {
			pushError = err instanceof Error ? err.message : 'Gagal mengirim nilai ke Database Pusat.';
			toast(pushError, 'error');
		} finally {
			isPushing = false;
			pushStep = '';
		}
	}

	async function handlePushMaster() {
		isPushingMaster = true;
		pushMasterResult = null;
		pushMasterError = '';

		try {
			const res = await fetch('/api/cloud/push-master', { method: 'POST' });
			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.message || 'Gagal mengirim master data ke Database Pusat');
			}

			pushMasterResult = json;
			toast(json.message, 'success');
			await invalidateAll();
		} catch (err: unknown) {
			pushMasterError =
				err instanceof Error ? err.message : 'Gagal mengirim master data ke Database Pusat.';
			toast(pushMasterError, 'error');
		} finally {
			isPushingMaster = false;
		}
	}

	async function handleTestConnection() {
		if (isTestingConnection) return;
		isTestingConnection = true;
		connectionResult = null;

		try {
			const res = await fetch('/api/cloud/test', { method: 'POST' });
			const json = await res.json();
			connectionResult = { ok: Boolean(json.ok), message: json.message || 'Tidak ada respons.' };
			toast(json.message || 'Uji koneksi selesai.', json.ok ? 'success' : 'error');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Uji koneksi gagal.';
			connectionResult = { ok: false, message: msg };
			toast(msg, 'error');
		} finally {
			isTestingConnection = false;
		}
	}

	function formatDate(val?: string | null) {
		if (!val) return 'Belum pernah';
		return new Date(val).toLocaleString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-6 max-w-5xl mx-auto">
	<!-- Header & Status Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-black text-emerald-950 dark:text-emerald-300">
				Sinkronisasi Database Pusat
			</h1>
			<p class="text-xs text-base-content/70 mt-1">
				Sistem sinkronisasi dua arah antara database lokal dan Database Pusat SMK Pratama Mulya
				Karawang.
			</p>
		</div>

		{#if data.user?.type === 'admin'}
			<div class="flex flex-wrap items-center gap-2 shrink-0">
				<button
					type="button"
					class="btn btn-sm btn-ghost text-base-content/60 hover:text-emerald-700 rounded-xl shadow-none flex items-center gap-2 border border-slate-200 dark:border-base-300"
					disabled={isTestingConnection}
					onclick={handleTestConnection}
				>
					{#if isTestingConnection}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon name="repeat" class="text-emerald-600" />
					{/if}
					<span>Tes Koneksi</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- Status Card -->
	<div
		class="card bg-base-100 rounded-2xl border border-emerald-100 dark:border-base-200 shadow-sm p-4 sm:p-5 space-y-4"
	>
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="flex items-center gap-3 min-w-0">
				<span class="w-3 h-3 rounded-full shrink-0 {cloudState.dot}"></span>
				<div class="min-w-0">
					<div class="text-xs font-bold text-base-content/70">Status Database Pusat:</div>
					<div class="text-sm font-black {cloudState.text}">{cloudState.label}</div>
					<div class="text-[11px] text-base-content/60 mt-0.5">{cloudState.hint}</div>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-base-content/70">
				<div>
					<span class="font-medium">Total Nilai Lokal:</span>
					<span class="font-bold text-base-content ml-1">{data.totalGrades} Nilai</span>
				</div>
				<div>
					<span class="font-medium">Rombel:</span>
					<span class="font-bold text-base-content ml-1">{data.totalClasses} Kelas</span>
				</div>
				<div>
					<span class="font-medium">Mapel:</span>
					<span class="font-bold text-base-content ml-1">{data.totalSubjects} Mapel</span>
				</div>
			</div>
		</div>

		{#if connectionResult}
			<div
				class="alert {connectionResult.ok
					? 'alert-success'
					: 'alert-error'} alert-soft p-3 rounded-xl text-xs items-start"
			>
				<div class="font-bold break-words">{connectionResult.message}</div>
			</div>
		{/if}
	</div>

	<!-- Kartu tindakan sinkronisasi -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
		<!-- 1. Sinkronisasi data master -->
		<div
			class="card bg-base-100 rounded-2xl border border-slate-200 dark:border-base-200 shadow-sm p-6 flex flex-col justify-between space-y-4"
		>
			<div class="space-y-2">
				<div
					class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold"
				>
					<Icon name="download" class="w-5 h-5" />
				</div>
				<h2 class="text-lg font-bold text-emerald-950 dark:text-emerald-300">
					Sinkron Data Master
				</h2>
				<p class="text-xs text-base-content/70 leading-relaxed">
					Sinkronkan data referensi rombel, murid, dan mata pelajaran terbaru dari Database Pusat
					Sekolah. Jalankan saat awal semester atau bila ada pembaruan siswa dan guru baru dari
					Operator. Pada instalasi yang sudah berisi data, data master digabung: baris baru
					ditambahkan, baris yang berubah diperbarui, dan pekerjaan guru (nilai, absensi, jadwal)
					tidak ikut tersentuh.
				</p>
			</div>

			<div class="space-y-3 pt-2">
				<button
					type="button"
					class="btn btn-primary w-full shadow-none font-bold text-sm rounded-xl flex items-center justify-center gap-2"
					onclick={handlePull}
					disabled={isPulling || isPushing}
				>
					{#if isPulling}
						<span class="loading loading-spinner loading-xs"></span>
						<span>{pullStep || 'Mengunduh data...'}</span>
					{:else}
						<Icon name="repeat" />
						<span>Sinkron Data Terbaru</span>
					{/if}
				</button>

				<div class="text-[11px] text-base-content/60 flex items-center justify-between">
					<span>Terakhir ditarik:</span>
					<span class="font-semibold text-emerald-700 dark:text-emerald-400">
						{formatDate(data.syncSettings.lastPulledAt)}
					</span>
				</div>

				{#if pullResult}
					<div class="alert alert-success alert-soft p-3 rounded-xl text-xs space-y-0.5">
						<div class="font-bold break-words">{pullResult.message}</div>
						{#if pullResult.merge}
							<div class="text-[11px] opacity-80">
								Baris baru: {pullResult.merge.inserted} · Diperbarui: {pullResult.merge.updated} · Tetap:
								{pullResult.merge.unchanged}
							</div>
						{:else if pullResult.details}
							<div class="text-[11px] opacity-80">
								Kelas: {pullResult.details.kelas ?? 0} &bull; Murid: {pullResult.details.murid ?? 0} &bull;
								Mapel: {pullResult.details.mapel ?? 0}
							</div>
						{/if}
					</div>
				{:else if pullError}
					<div class="alert alert-error alert-soft p-3 rounded-xl text-xs items-start">
						<div class="font-bold break-words">{pullError}</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- 2. Kirim nilai guru -->
		<div
			class="card bg-base-100 rounded-2xl border border-slate-200 dark:border-base-200 shadow-sm p-6 flex flex-col justify-between space-y-4"
		>
			<div class="space-y-2">
				<div
					class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold"
				>
					<Icon name="export" class="w-5 h-5" />
				</div>
				<h2 class="text-lg font-bold text-emerald-950 dark:text-emerald-300">Kirim Data Nilai</h2>
				<p class="text-xs text-base-content/70 leading-relaxed">
					Unggah dan sinkronkan seluruh nilai yang sudah diisi di laptop/perangkat Anda (Formatif,
					Sumatif, Kokurikuler, Ekskul, dan Presensi) langsung ke Database Pusat.
				</p>
			</div>

			<div class="space-y-3 pt-2">
				<button
					type="button"
					class="btn btn-primary w-full shadow-none font-bold text-sm rounded-xl flex items-center justify-center gap-2"
					onclick={handlePush}
					disabled={isPushing || isPulling}
				>
					{#if isPushing}
						<span class="loading loading-spinner loading-xs"></span>
						<span>{pushStep || 'Mengunggah nilai...'}</span>
					{:else}
						<Icon name="save" />
						<span>Kirim Nilai</span>
					{/if}
				</button>

				<div class="text-[11px] text-base-content/60 flex items-center justify-between">
					<span>Terakhir dikirim:</span>
					<span class="font-semibold text-emerald-700 dark:text-emerald-400">
						{formatDate(data.syncSettings.lastPushedAt)}
					</span>
				</div>

				{#if pushResult}
					<div class="alert alert-success alert-soft p-3 rounded-xl text-xs space-y-0.5">
						<div class="font-bold break-words">{pushResult.message}</div>
						<div class="font-mono text-[10px] truncate opacity-70">
							Checksum: {pushResult.checksum}
						</div>
					</div>
				{:else if pushError}
					<div class="alert alert-error alert-soft p-3 rounded-xl text-xs items-start">
						<div class="font-bold break-words">{pushError}</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- 3. Kirim data master -->
		<div
			class="card bg-base-100 rounded-2xl border border-slate-200 dark:border-base-200 shadow-sm p-6 flex flex-col justify-between space-y-4"
		>
			<div class="space-y-2">
				<div
					class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold"
				>
					<Icon name="database" class="w-5 h-5" />
				</div>
				<h2 class="text-lg font-bold text-emerald-950 dark:text-emerald-300">Kirim Master Data</h2>
				<p class="text-xs text-base-content/70 leading-relaxed">
					Unggah data induk ke Database Pusat: identitas sekolah, pegawai, kelas, mata pelajaran,
					siswa, dan akun pengguna. Komputer baru menarik data ini dari halaman penyiapan sebelum
					login, jadi jalankan setiap kali ada perubahan data induk.
				</p>
			</div>

			<div class="space-y-3 pt-2">
				<button
					type="button"
					class="btn btn-primary w-full shadow-none font-bold text-sm rounded-xl flex items-center justify-center gap-2"
					onclick={handlePushMaster}
					disabled={isPushingMaster || isPushing || isPulling}
				>
					{#if isPushingMaster}
						<span class="loading loading-spinner loading-xs"></span>
						<span>Mengirim master data...</span>
					{:else}
						<Icon name="database" />
						<span>Kirim Master</span>
					{/if}
				</button>

				{#if pushMasterResult}
					<div class="alert alert-success alert-soft p-3 rounded-xl text-xs space-y-0.5">
						<div class="font-bold break-words">{pushMasterResult.message}</div>
						<div class="text-[11px] opacity-80">
							Murid: {pushMasterResult.counts?.murid ?? 0} &bull; Kelas: {pushMasterResult.counts
								?.kelas ?? 0} &bull; Akun: {pushMasterResult.counts?.auth_user ?? 0}
						</div>
					</div>
				{:else if pushMasterError}
					<div class="alert alert-error alert-soft p-3 rounded-xl text-xs items-start">
						<div class="font-bold break-words">{pushMasterError}</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Approval Panel for Operator/Admin: Konsolidasi Nilai Guru -->
	<div
		class="card bg-base-100 rounded-2xl border border-slate-200 dark:border-base-200 shadow-sm p-6 space-y-4"
	>
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0 flex-1">
				<h2
					class="text-base font-bold text-emerald-950 dark:text-emerald-300 flex flex-wrap items-center gap-2"
				>
					<Icon name="check" class="text-emerald-600 shrink-0" />
					<span>Konsolidasi &amp; Persetujuan Nilai Guru</span>
				</h2>
				<p class="text-xs text-base-content/70 mt-0.5">
					Daftar paket nilai yang dikirim guru ke Database Pusat. Operator memverifikasi dan
					menyetujui data sebelum disahkan ke Database Rapor Utama.
				</p>
			</div>
			<div class="badge badge-sm badge-outline font-semibold shrink-0 whitespace-nowrap">
				{data.packages?.length ?? 0} Paket Terdata
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr class="text-xs text-base-content/70">
						<th>Waktu Kirim</th>
						<th>Guru Pengunggah</th>
						<th>Rincian Data Nilai</th>
						<th>Status</th>
						<th>Aksi Operator</th>
					</tr>
				</thead>
				<tbody>
					{#each data.packages as pkg (pkg.id)}
						<tr>
							<td class="text-xs font-mono">{formatDate(pkg.createdAt)}</td>
							<td>
								<div class="font-bold text-xs text-base-content">{pkg.teacherName}</div>
								<div class="text-[10px] text-base-content/60 font-mono">@{pkg.teacherUsername}</div>
							</td>
							<td class="text-xs">
								{#if pkg.summary && Object.keys(pkg.summary).length}
									<div class="flex flex-wrap gap-1 text-[10px]">
										<span class="badge badge-xs badge-soft badge-primary font-mono">
											Formatif: {pkg.summary.formatif_count ?? 0}
										</span>
										<span class="badge badge-xs badge-soft badge-secondary font-mono">
											Sumatif: {pkg.summary.sumatif_count ?? 0}
										</span>
										<span class="badge badge-xs badge-soft font-mono">
											Presensi: {pkg.summary.absen_count ?? 0}
										</span>
									</div>
								{:else}
									<span class="text-base-content/50 italic text-[11px]">Tidak ada rincian</span>
								{/if}
							</td>
							<td>
								<span
									class="badge badge-sm font-bold {pkg.status === 'APPROVED'
										? 'badge-success'
										: pkg.status === 'PENDING'
											? 'badge-warning'
											: 'badge-error'}"
								>
									{pkg.status === 'PENDING'
										? 'MENUNGGU PERSETUJUAN'
										: pkg.status === 'APPROVED'
											? 'DISETUJUI (APPROVED)'
											: 'DITOLAK (REJECTED)'}
								</span>
								{#if pkg.notes}
									<div class="text-[10px] text-error mt-0.5 max-w-xs truncate" title={pkg.notes}>
										Catatan: {pkg.notes}
									</div>
								{/if}
							</td>
							<td>
								{#if pkg.status === 'PENDING'}
									<div class="flex items-center gap-1.5">
										<button
											type="button"
											class="btn btn-xs btn-primary rounded-lg font-bold shadow-none"
											disabled={isApproving}
											onclick={() => handleApprovePackage(pkg.id)}
										>
											<Icon name="check" class="w-3 h-3" />
											<span>Setujui</span>
										</button>
										<button
											type="button"
											class="btn btn-xs btn-ghost text-error hover:bg-error/10 rounded-lg font-bold shadow-none"
											disabled={isApproving}
											onclick={() => openRejectModal(pkg.id)}
										>
											<Icon name="close" class="w-3 h-3" />
											<span>Tolak</span>
										</button>
									</div>
								{:else if pkg.status === 'APPROVED'}
									<span class="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
										<Icon name="check" class="w-3.5 h-3.5" />
										<span>Telah Diterapkan</span>
									</span>
								{:else}
									<span class="text-[11px] text-base-content/50 italic">Ditolak</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="text-center text-xs text-base-content/50 py-4">
								Belum ada paket nilai yang dikirim oleh guru untuk diverifikasi.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Sync Log Table -->
	<div
		class="card bg-base-100 rounded-2xl border border-slate-200 dark:border-base-200 shadow-sm p-6 space-y-4"
	>
		<h2 class="text-base font-bold text-emerald-950 dark:text-emerald-300">
			Riwayat Sinkronisasi Terakhir
		</h2>

		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr class="text-xs text-base-content/70">
						<th>Waktu</th>
						<th>Aksi</th>
						<th>Status</th>
						<th>Jumlah Data</th>
						<th>Keterangan</th>
					</tr>
				</thead>
				<tbody>
					{#each data.syncLogs as log (log.id)}
						<tr>
							<td class="text-xs font-mono">{formatDate(log.createdAt)}</td>
							<td>
								<span
									class="badge badge-sm font-bold {log.action === 'PUSH'
										? 'badge-primary'
										: 'badge-secondary'}"
								>
									{log.action}
								</span>
							</td>
							<td>
								<span
									class="badge badge-sm {log.status === 'SUCCESS'
										? 'badge-success'
										: 'badge-error'}"
								>
									{log.status}
								</span>
							</td>
							<td class="text-xs font-semibold">{log.totalRecords} Rekaman</td>
							<td class="text-xs text-base-content/70 truncate max-w-xs">
								{log.errorMessage || log.summary || '-'}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="text-center text-xs text-base-content/50 py-4">
								Belum ada riwayat aktivitas sinkronisasi.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Modal Tolak Paket Nilai -->
{#if rejectModalOpen}
	<div class="modal modal-open">
		<div class="modal-box rounded-2xl max-w-sm">
			<h3 class="text-base font-bold text-error">Tolak Paket Nilai Guru</h3>
			<p class="text-xs text-base-content/70 mt-1">
				Berikan catatan alasan penolakan agar guru dapat merevisi nilai sebelum mengirim ulang.
			</p>

			<div class="mt-3">
				<textarea
					class="textarea textarea-bordered w-full text-xs rounded-xl"
					rows="3"
					placeholder="Contoh: Nilai sumatif belum lengkap untuk kelas X RPL 1..."
					bind:value={rejectReason}></textarea>
			</div>

			<div class="modal-action">
				<button
					type="button"
					class="btn btn-sm btn-ghost rounded-xl shadow-none"
					onclick={() => {
						rejectModalOpen = false;
						rejectingPackageId = null;
					}}
				>
					Batal
				</button>
				<button
					type="button"
					class="btn btn-sm btn-error text-white rounded-xl shadow-none"
					disabled={isApproving}
					onclick={confirmRejectPackage}
				>
					Tolak Paket
				</button>
			</div>
		</div>
	</div>
{/if}
