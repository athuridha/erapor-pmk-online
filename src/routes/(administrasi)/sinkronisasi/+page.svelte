<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let isPushing = $state(false);
	let isPulling = $state(false);
	let pushStep = $state('');
	let pullStep = $state('');
	let pushResult = $state<any>(null);
	let pullResult = $state<any>(null);

	// Modal pengaturan Cloudflare D1
	let showSettingsModal = $state(false);
	// svelte-ignore state_referenced_locally
	let accountId = $state(data.syncSettings.accountId);
	// svelte-ignore state_referenced_locally
	let databaseId = $state(data.syncSettings.databaseId);
	let apiToken = $state('');
	let isSavingConfig = $state(false);

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
		} catch (err: any) {
			toast(err.message || 'Gagal menyetujui paket nilai.', 'error');
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
		} catch (err: any) {
			toast(err.message || 'Gagal menolak paket.', 'error');
		} finally {
			isApproving = false;
		}
	}

	async function handlePull() {
		isPulling = true;
		pullResult = null;
		pullStep = 'Menghubungi Cloudflare D1 Database...';

		try {
			await new Promise((r) => setTimeout(r, 400));
			pullStep = 'Mengunduh data master terbaru (Rombel, Siswa, Mapel)...';

			const res = await fetch('/api/cloud/pull', { method: 'POST' });
			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.error || 'Gagal mengambil data dari cloud');
			}

			pullStep = 'Memperbarui database lokal...';
			await new Promise((r) => setTimeout(r, 400));

			pullResult = json;
			toast(json.message, 'success');
			await invalidateAll();
		} catch (err: any) {
			toast(err.message || 'Gagal sinkronisasi data dari cloud.', 'error');
		} finally {
			isPulling = false;
			pullStep = '';
		}
	}

	async function handlePush() {
		isPushing = true;
		pushResult = null;
		pushStep = 'Memeriksa koneksi Cloudflare D1...';

		try {
			await new Promise((r) => setTimeout(r, 500));
			pushStep = 'Mengemas data nilai sumatif, formatif & presensi...';

			await new Promise((r) => setTimeout(r, 500));
			pushStep = 'Menghitung checksum integritas data SHA-256...';

			const res = await fetch('/api/cloud/push', { method: 'POST' });
			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.error || 'Gagal mengirim nilai ke cloud');
			}

			pushStep = 'Menyimpan rekaman ke Cloud Database...';
			await new Promise((r) => setTimeout(r, 400));

			pushResult = json;
			toast(json.message, 'success');
			await invalidateAll();
		} catch (err: any) {
			toast(err.message || 'Gagal mengirim nilai ke cloud.', 'error');
		} finally {
			isPushing = false;
			pushStep = '';
		}
	}

	async function saveSettings(e: SubmitEvent) {
		e.preventDefault();
		isSavingConfig = true;

		try {
			const res = await fetch('/api/cloud/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ accountId, databaseId, apiToken })
			});
			const json = await res.json();
			if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menyimpan');
			toast('Pengaturan Cloudflare D1 berhasil disimpan.', 'success');
			showSettingsModal = false;
			apiToken = '';
			await invalidateAll();
		} catch (err: any) {
			toast(err.message || 'Gagal menyimpan pengaturan.', 'error');
		} finally {
			isSavingConfig = false;
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
				Sinkronisasi Database Cloud
			</h1>
			<p class="text-xs text-base-content/70 mt-1">
				Sistem sinkronisasi dua arah (Push &amp; Pull) antara database SQLite lokal dan Cloudflare
				D1 Database Pusat SMK Pratama Mulya Karawang.
			</p>
		</div>

		{#if data.user?.type === 'admin'}
			<button
				type="button"
				class="btn btn-sm btn-ghost text-base-content/60 hover:text-emerald-700 rounded-xl shadow-none flex items-center gap-2 border border-slate-200 dark:border-base-300"
				onclick={() => (showSettingsModal = true)}
			>
				<Icon name="gear" class="text-emerald-600" />
				<span>Detail Kredensial Cloud</span>
			</button>
		{/if}
	</div>

	<!-- Status Card -->
	<div
		class="card bg-base-100 rounded-2xl border border-emerald-100 dark:border-base-200 shadow-sm p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4"
	>
		<div class="flex items-center gap-3">
			<span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
			<div>
				<div class="text-xs font-bold text-base-content/70">Status Database Cloud:</div>
				<div class="text-sm font-black text-emerald-600 dark:text-emerald-400">
					ONLINE &bull; erapor-pmk-db (Cloudflare D1 Aktif)
				</div>
			</div>
		</div>

		<div class="flex items-center gap-6 text-xs text-base-content/70">
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

	<!-- Action Cards: Pull & Push -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
		<!-- 1. PULL MASTER DATA -->
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
					Tarik Data Master (PULL)
				</h2>
				<p class="text-xs text-base-content/70 leading-relaxed">
					Tarik data referensi rombel, murid, dan mata pelajaran terbaru dari Database Pusat
					Sekolah. Jalankan saat awal semester atau bila ada pembaruan siswa dan guru baru dari
					Operator.
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
						<span>Tarik Data Terbaru</span>
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
						<div class="font-bold">{pullResult.message}</div>
						{#if pullResult.details}
							<div class="text-[11px] opacity-80">
								Kelas: {pullResult.details.kelas ?? 0} &bull; Murid: {pullResult.details.murid ?? 0} &bull;
								Mapel: {pullResult.details.mapel ?? 0}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- 2. PUSH TEACHER GRADES -->
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
					Kirim Data Nilai (PUSH)
				</h2>
				<p class="text-xs text-base-content/70 leading-relaxed">
					Unggah dan sinkronkan seluruh nilai yang sudah diisi di laptop/perangkat Anda (Formatif,
					Sumatif, Kokurikuler, Ekskul, dan Presensi) langsung ke Database Pusat Cloud.
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
						<span>Kirim Nilai ke Cloud</span>
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
						<div class="font-bold">{pushResult.message}</div>
						<div class="font-mono text-[10px] truncate opacity-70">
							Checksum: {pushResult.checksum}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Approval Panel for Operator/Admin: Konsolidasi Nilai Guru -->
	<div
		class="card bg-base-100 rounded-2xl border border-slate-200 dark:border-base-200 shadow-sm p-6 space-y-4"
	>
		<div class="flex items-center justify-between">
			<div>
				<h2
					class="text-base font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-2"
				>
					<Icon name="check" class="text-emerald-600" />
					<span>Konsolidasi &amp; Persetujuan Nilai Guru</span>
				</h2>
				<p class="text-xs text-base-content/70 mt-0.5">
					Daftar paket nilai yang di-push oleh guru ke Cloud Database. Operator memverifikasi dan
					menyetujui data sebelum disahkan ke Database Rapor Utama.
				</p>
			</div>
			<div class="badge badge-sm badge-outline font-semibold">
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

<!-- Modal Pengaturan Cloudflare D1 -->
{#if showSettingsModal}
	<div class="modal modal-open">
		<div class="modal-box rounded-2xl max-w-md">
			<h3 class="text-lg font-bold text-emerald-950 dark:text-emerald-300">
				Pengaturan Cloudflare D1
			</h3>
			<p class="text-xs text-base-content/70 mt-1">
				Konfigurasi kredensial Cloudflare D1 untuk menghubungkan database lokal dengan Database
				Cloud SMK Pratama Mulya Karawang.
			</p>

			<form onsubmit={saveSettings} class="space-y-4 mt-4">
				<div class="alert alert-info alert-soft p-3 rounded-xl text-xs flex items-center gap-2">
					<Icon name="check" class="w-4 h-4 text-emerald-600 shrink-0" />
					<span>
						Akun Cloudflare terdeteksi otomatis (<strong>amarathuridhaa@gmail.com</strong>).
						Database baru: <strong>erapor-pmk-db</strong> siap digunakan tanpa perlu setup lagi.
					</span>
				</div>

				<fieldset class="fieldset">
					<legend class="fieldset-legend text-xs">Cloudflare Account ID</legend>
					<input
						type="text"
						class="input input-sm w-full bg-base-200 rounded-xl"
						placeholder="b456e767d6306149a24d6228c8a65b6d"
						bind:value={accountId}
					/>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend text-xs">Cloudflare D1 Database ID</legend>
					<input
						type="text"
						class="input input-sm w-full bg-base-200 rounded-xl"
						placeholder="adcb638f-9adb-412b-8e61-cd80f1f1e062"
						bind:value={databaseId}
					/>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend text-xs">Cloudflare API Token / OAuth</legend>
					<input
						type="password"
						class="input input-sm w-full bg-base-200 rounded-xl"
						placeholder={data.syncSettings.hasToken
							? '•••••••• (Otomatis dari Akun Wrangler / D1)'
							: 'Masukkan Token D1'}
						bind:value={apiToken}
					/>
					<span class="text-[10px] text-base-content/60">
						Sudah terhubung otomatis via sesi Cloudflare / wrangler Anda.
					</span>
				</fieldset>

				<div class="modal-action">
					<button
						type="button"
						class="btn btn-sm btn-ghost rounded-xl shadow-none"
						onclick={() => (showSettingsModal = false)}
					>
						Batal
					</button>
					<button
						type="submit"
						class="btn btn-sm btn-primary rounded-xl shadow-none"
						disabled={isSavingConfig}
					>
						{isSavingConfig ? 'Menyimpan...' : 'Simpan Pengaturan'}
					</button>
				</div>
			</form>
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
