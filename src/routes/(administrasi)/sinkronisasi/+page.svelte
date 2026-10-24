<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { invalidateAll } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { isFullAdmin } from '../../pengguna/permissions';

	let { data } = $props();

	let isPushing = $state(false);
	let pushStep = $state('');
	let pushResult = $state<{ message?: string; checksum?: string } | null>(null);
	let pushError = $state('');

	// Pesan hasil sinkron (tarik pusat & kirim pusat)
	let pullMessage = $state('');
	let pullError = $state('');
	let syncMessage = $state('');
	let syncError = $state('');

	// Modal pilih cakupan (tarik & kirim)
	let pullModalOpen = $state(false);
	let pushModalOpen = $state(false);

	const MASTER_SCOPE_OPTIONS = [
		{ value: 'master:sekolah', label: 'Identitas sekolah, tahun ajaran & semester' },
		{ value: 'master:guru', label: 'Guru & pegawai' },
		{ value: 'master:kelas', label: 'Kelas & rombongan belajar' },
		{ value: 'master:mapel', label: 'Mata pelajaran' },
		{ value: 'master:murid', label: 'Murid, wali murid & relasi' },
		{ value: 'master:akun', label: 'Akun pengguna' }
	];
	const AKADEMIK_SCOPE_OPTIONS = [
		{ value: 'nilai', label: 'Nilai (sumatif, formatif & tujuan)' },
		{ value: 'presensi', label: 'Presensi murid & guru, absensi' },
		{ value: 'jadwal', label: 'Jadwal, jurnal & tujuan pembelajaran' },
		{ value: 'ekstra', label: 'Ekstrakurikuler & kokurikuler' },
		{ value: 'catatan', label: 'Catatan wali kelas & keputusan' }
	];

	// Status koneksi (uji nyata ke Database Pusat)
	let isTestingConnection = $state(false);
	let connectionResult = $state<{ ok: boolean; message: string } | null>(null);

	const tokenSourceLabel: Record<string, string> = {
		proxy: 'API Database Pusat (worker)',
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
	<!-- Surface entry for the local Dapodik WebService integration. -->
	<div
		class="card bg-base-100 rounded-2xl border border-emerald-100 dark:border-base-200 shadow-sm p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex items-start gap-3 min-w-0">
			<span
				class="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"
			>
				<Icon name="info" class="w-5 h-5" />
			</span>
			<div class="min-w-0 space-y-1">
				<h2
					class="text-base font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-2"
				>
					Tarik Data dari Dapodik
				</h2>
				<p class="text-xs text-base-content/70 leading-relaxed">
					Sinkronkan sekolah, pegawai, kelas, murid, dan mata pelajaran langsung dari WebService
					Dapodik lokal. Setelah nilai selesai diisi, kirim kembali ke Dapodik.
				</p>
				<a
					href="/nilai-akhir/kirim-dapodik"
					class="link link-hover text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1"
				>
					<Icon name="export" class="w-3.5 h-3.5" />
					Kirim Nilai ke Dapodik
				</a>
			</div>
		</div>
		<a
			href="/sekolah/form/sync-dapodik"
			class="btn btn-primary w-full shadow-none font-bold text-sm rounded-xl flex items-center justify-center gap-2 sm:w-auto shrink-0"
		>
			<Icon name="download" />
			<span>Buka Sinkronisasi Dapodik</span>
		</a>
	</div>

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

		{#if isFullAdmin(data.user)}
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
					Tarik dari Pusat (Pull)
				</h2>
				<p class="text-xs text-base-content/70 leading-relaxed">
					UNDUH pembaruan dari Database Pusat sesuai pilihan anda: data induk, nilai, presensi,
					jadwal, ekstra, atau catatan. Data digabung LWW ("perubahan terbaru menang") dan TIDAK
					PERNAH MENGHAPUS baris lokal.
				</p>
			</div>
			<div class="space-y-3 pt-2">
				<button
					type="button"
					class="btn btn-primary w-full shadow-none font-bold text-sm rounded-xl flex items-center justify-center gap-2"
					onclick={() => {
						pullError = '';
						pullModalOpen = true;
					}}
				>
					<Icon name="repeat" />
					<span>Tarik dari Pusat (Pull)</span>
				</button>

				<div class="text-[11px] text-base-content/60 flex items-center justify-between">
					<span>Terakhir ditarik:</span>
					<span class="font-semibold text-emerald-700 dark:text-emerald-400">
						{formatDate(data.syncSettings.lastPulledAt)}
					</span>
				</div>

				{#if pullMessage}
					<div class="alert alert-success alert-soft p-3 rounded-xl text-xs items-start">
						<div class="font-bold break-words">{pullMessage}</div>
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
					disabled={isPushing}
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

		<!-- 3. Kirim ke pusat (push) -->
		<div
			class="card bg-base-100 rounded-2xl border border-slate-200 dark:border-base-200 shadow-sm p-6 flex flex-col justify-between space-y-4"
		>
			<div class="space-y-2">
				<div
					class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold"
				>
					<Icon name="export" class="w-5 h-5" />
				</div>
				<h2 class="text-lg font-bold text-emerald-950 dark:text-emerald-300">
					Kirim ke Pusat (Push)
				</h2>
				<p class="text-xs text-base-content/70 leading-relaxed">
					UNGAH perubahan lokal ke Database Pusat sesuai pilihan anda: data induk penuh + baris yang
					berubah sejak kirim terakhir. Konflik antar operator diselesaikan dengan "waktu perubahan
					terbaru" per baris, dan TIDAK PERNAH MENGHAPUS baris di pusat.
				</p>
			</div>

			<div class="space-y-3 pt-2">
				<button
					type="button"
					class="btn btn-primary w-full shadow-none font-bold text-sm rounded-xl flex items-center justify-center gap-2"
					onclick={() => {
						syncError = '';
						pushModalOpen = true;
					}}
				>
					<Icon name="export" />
					<span>Kirim ke Pusat (Push)</span>
				</button>

				<div class="text-[11px] text-base-content/60 flex items-center justify-between">
					<span>Terakhir dikirim:</span>
					<span class="font-semibold text-emerald-700 dark:text-emerald-400">
						{formatDate(data.syncSettings.lastPushedAt)}
					</span>
				</div>

				{#if syncMessage}
					<div class="alert alert-success alert-soft p-3 rounded-xl text-xs items-start">
						<div class="font-bold break-words">{syncMessage}</div>
					</div>
				{:else if syncError}
					<div class="alert alert-error alert-soft p-3 rounded-xl text-xs items-start">
						<div class="font-bold break-words">{syncError}</div>
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

<!-- Modal pilih cakupan: Tarik dari pusat (Pull) -->
{#if pullModalOpen}
	<div class="modal modal-open">
		<div class="modal-box rounded-2xl max-w-md">
			<h3 class="text-base font-bold">Tarik Data dari Pusat</h3>
			<p class="text-xs text-base-content/70 mt-1">
				Pilih data apa saja yang mau ditarik dari Database Pusat.
			</p>

			<FormEnhance
				action="?/tarikPusat"
				showToast={false}
				onsuccess={({ data: result }) => {
					pullModalOpen = false;
					pullError = '';
					pullMessage = (result?.message as string | undefined) || 'Sinkron dari pusat selesai.';
					toast(pullMessage, 'success');
				}}
				onfailure={({ data }) => {
					pullError = (data?.message as string | undefined) ?? 'Tarik dari pusat gagal.';
					toast(pullError, 'error');
				}}
			>
				{#snippet children({ submitting })}
					<div class="mt-3 bg-base-200/60 rounded-xl p-3 space-y-1.5">
						<p class="text-[11px] font-semibold text-base-content/70">Data induk</p>
						{#each MASTER_SCOPE_OPTIONS as option (option.value)}
							<label class="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="scope"
									value={option.value}
									checked
									class="checkbox checkbox-xs checkbox-primary"
								/>
								<span>{option.label}</span>
							</label>
						{/each}
						<p class="text-[11px] font-semibold text-base-content/70 pt-1.5">Data pembelajaran</p>
						{#each AKADEMIK_SCOPE_OPTIONS as option (option.value)}
							<label class="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="scope"
									value={option.value}
									checked
									class="checkbox checkbox-xs checkbox-primary"
								/>
								<span>{option.label}</span>
							</label>
						{/each}
					</div>

					<div class="modal-action">
						<button
							type="button"
							class="btn btn-sm btn-ghost rounded-xl shadow-none"
							onclick={() => (pullModalOpen = false)}
						>
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-sm btn-primary text-white rounded-xl shadow-none"
							disabled={submitting}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs"></span>
								<span>Menarik...</span>
							{:else}
								<Icon name="download" />
								<span>Mulai Tarik</span>
							{/if}
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
	</div>
{/if}

<!-- Modal pilih cakupan: Kirim ke pusat (Push) -->
{#if pushModalOpen}
	<div class="modal modal-open">
		<div class="modal-box rounded-2xl max-w-md">
			<h3 class="text-base font-bold">Kirim Data ke Pusat</h3>
			<p class="text-xs text-base-content/70 mt-1">
				Pilih data apa saja yang mau dikirim ke Database Pusat.
			</p>

			<FormEnhance
				action="?/pushPusat"
				showToast={false}
				onsuccess={({ data: result }) => {
					pushModalOpen = false;
					syncError = '';
					syncMessage = (result?.message as string | undefined) || 'Kirim ke pusat selesai.';
					toast(syncMessage, 'success');
				}}
				onfailure={({ data }) => {
					syncError = (data?.message as string | undefined) ?? 'Kirim ke pusat gagal.';
					toast(syncError, 'error');
				}}
			>
				{#snippet children({ submitting })}
					<div class="mt-3 bg-base-200/60 rounded-xl p-3 space-y-1.5">
						<p class="text-[11px] font-semibold text-base-content/70">Data induk</p>
						{#each MASTER_SCOPE_OPTIONS as option (option.value)}
							<label class="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="scope"
									value={option.value}
									checked
									class="checkbox checkbox-xs checkbox-primary"
								/>
								<span>{option.label}</span>
							</label>
						{/each}
						<p class="text-[11px] font-semibold text-base-content/70 pt-1.5">Data pembelajaran</p>
						{#each AKADEMIK_SCOPE_OPTIONS as option (option.value)}
							<label class="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="scope"
									value={option.value}
									checked
									class="checkbox checkbox-xs checkbox-primary"
								/>
								<span>{option.label}</span>
							</label>
						{/each}
					</div>

					<div class="modal-action">
						<button
							type="button"
							class="btn btn-sm btn-ghost rounded-xl shadow-none"
							onclick={() => (pushModalOpen = false)}
						>
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-sm btn-primary text-white rounded-xl shadow-none"
							disabled={submitting}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs"></span>
								<span>Mengirim...</span>
							{:else}
								<Icon name="export" />
								<span>Mulai Kirim</span>
							{/if}
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
	</div>
{/if}

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
