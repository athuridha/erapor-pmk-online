<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { createEventDispatcher, onDestroy } from 'svelte';

	let {
		open,
		currentVersion,
		canManage = false
	}: { open: boolean; currentVersion: string; canManage?: boolean } = $props();

	const dispatch = createEventDispatcher<{ close: void }>();

	type DownloadPhase = UpdateDownloadState | 'idle';

	interface DownloadUiState {
		id: string | null;
		version: string;
		assetName: string;
		status: DownloadPhase;
		downloadedBytes: number;
		totalBytes: number | null;
		error: string | null;
		installScheduled: boolean;
	}

	interface AutoSettings {
		enabled: boolean;
		autoDownload: boolean;
		autoInstall: boolean;
		intervalMinutes: number;
		idleMinutes: number;
		windowStartHour: number;
		windowEndHour: number;
	}

	interface AutoState {
		lastCheckAt: string | null;
		lastError: string | null;
		latestVersion: string | null;
		latestPublishedAt: string | null;
		downloadId: string | null;
		installStartedAt: string | null;
	}

	let checkingUpdate = $state(false);
	let checkError = $state<string | null>(null);
	let latestRelease = $state<ReleaseSummary | null>(null);
	let updateAvailable = $state(false);
	let downloadState = $state<DownloadUiState>(createInitialDownloadState());
	let installingUpdate = $state(false);

	let autoSettings = $state<AutoSettings>({
		enabled: false,
		autoDownload: false,
		autoInstall: false,
		intervalMinutes: 360,
		idleMinutes: 15,
		windowStartHour: 19,
		windowEndHour: 5
	});
	let autoState = $state<AutoState>({
		lastCheckAt: null,
		lastError: null,
		latestVersion: null,
		latestPublishedAt: null,
		downloadId: null,
		installStartedAt: null
	});
	let autoLoaded = $state(false);
	let autoDownloaded = $state(false);
	let savingAuto = $state(false);

	let downloadPollHandle: ReturnType<typeof setInterval> | null = null;

	const intervalOptions = [
		{ minutes: 60, label: 'Setiap 1 jam' },
		{ minutes: 180, label: 'Setiap 3 jam' },
		{ minutes: 360, label: 'Setiap 6 jam' },
		{ minutes: 720, label: 'Setiap 12 jam' },
		{ minutes: 1440, label: 'Setiap 24 jam' }
	];

	const hourOptions = Array.from({ length: 24 }, (_, index) => index);

	const selectedAsset = $derived.by(() => pickPreferredAsset(latestRelease));
	const downloadProgress = $derived.by(() => {
		if (!downloadState.totalBytes || downloadState.totalBytes <= 0) return null;
		if (!Number.isFinite(downloadState.downloadedBytes)) return null;
		return Math.min(1, Math.max(0, downloadState.downloadedBytes / downloadState.totalBytes));
	});
	const downloadProgressPercent = $derived.by(() =>
		downloadProgress === null ? null : Math.round(downloadProgress * 100)
	);

	onDestroy(() => {
		clearDownloadPolling();
	});

	$effect(() => {
		if (open) {
			if (!latestRelease && !checkingUpdate) {
				void checkForUpdate(true);
			}
			void loadAutoState();
			return;
		}

		clearDownloadPolling();
	});

	function createInitialDownloadState(): DownloadUiState {
		return {
			id: null,
			version: '',
			assetName: '',
			status: 'idle',
			downloadedBytes: 0,
			totalBytes: null,
			error: null,
			installScheduled: false
		};
	}

	function pickPreferredAsset(release: ReleaseSummary | null): UpdateAsset | null {
		if (!release || !release.assets?.length) return null;
		const exe = release.assets.find((asset) => asset.name.toLowerCase().endsWith('.exe'));
		return exe ?? release.assets[0] ?? null;
	}

	function formatBytes(bytes: number) {
		if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		let value = bytes;
		let index = 0;
		while (value >= 1024 && index < units.length - 1) {
			value /= 1024;
			index += 1;
		}
		const precision = value < 10 && index > 0 ? 1 : 0;
		return `${value.toFixed(precision)} ${units[index]}`;
	}

	function formatDateTime(value: string | null | undefined) {
		if (!value) return '-';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return date.toLocaleString('id-ID', {
			dateStyle: 'medium',
			timeStyle: 'short',
			hour12: false
		});
	}

	function formatHour(hour: number) {
		return `${String(hour).padStart(2, '0')}:00`;
	}

	async function loadAutoState() {
		try {
			const response = await fetch('/api/updates/state', {
				cache: 'no-store',
				credentials: 'same-origin'
			});
			if (!response.ok) return;
			const payload = await response.json();
			if (payload?.settings) autoSettings = { ...autoSettings, ...payload.settings };
			if (payload?.state) autoState = { ...autoState, ...payload.state };
			autoDownloaded = Boolean(payload?.downloaded);
			autoLoaded = true;
		} catch (error) {
			console.error('Gagal memuat status pembaruan otomatis', error);
		}
	}

	async function saveAutoSettings() {
		savingAuto = true;
		try {
			const response = await fetch('/api/updates/auto', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(autoSettings),
				credentials: 'same-origin'
			});
			if (!response.ok) {
				const message = await response.text().catch(() => '');
				throw new Error(message || 'Gagal menyimpan pengaturan pembaruan.');
			}
			const payload = await response.json();
			if (payload?.settings) autoSettings = { ...autoSettings, ...payload.settings };
			if (payload?.state) autoState = { ...autoState, ...payload.state };
			toast({ message: 'Pengaturan pembaruan otomatis disimpan.', type: 'success' });
		} catch (error) {
			toast({
				message: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan pembaruan.',
				type: 'error'
			});
		} finally {
			savingAuto = false;
		}
	}

	function clearDownloadPolling() {
		if (downloadPollHandle) {
			clearInterval(downloadPollHandle);
			downloadPollHandle = null;
		}
	}

	function resetDownloadState(release: ReleaseSummary | null) {
		const asset = pickPreferredAsset(release);
		downloadState = {
			id: null,
			version: release?.version ?? '',
			assetName: asset?.name ?? '',
			status: 'idle',
			downloadedBytes: 0,
			totalBytes: asset?.size ?? null,
			error: null,
			installScheduled: false
		};
	}

	async function checkForUpdate(force = false) {
		if (checkingUpdate) return;
		if (!force && latestRelease) return;

		checkingUpdate = true;
		checkError = null;

		try {
			const response = await fetch('/api/updates/latest', {
				method: 'GET',
				credentials: 'same-origin',
				cache: 'no-store'
			});

			if (!response.ok) {
				const message = await response.text().catch(() => '');
				throw new Error(message || 'Gagal memeriksa pembaruan.');
			}

			const payload = (await response.json()) as UpdateCheckResponse;
			latestRelease = payload.latest ?? null;
			updateAvailable = Boolean(payload.updateAvailable && latestRelease);

			if (!updateAvailable) {
				resetDownloadState(null);
			} else if (!downloadState.id || payload.latest?.version !== downloadState.version) {
				resetDownloadState(payload.latest);
			}
		} catch (error) {
			checkError = error instanceof Error ? error.message : 'Gagal memeriksa pembaruan.';
			updateAvailable = false;
		} finally {
			checkingUpdate = false;
		}
	}

	function startDownloadPolling(id: string) {
		clearDownloadPolling();
		downloadPollHandle = setInterval(async () => {
			try {
				const response = await fetch(`/api/updates/status/${id}`, {
					cache: 'no-store',
					credentials: 'same-origin'
				});

				if (!response.ok) {
					if (response.status === 404) {
						clearDownloadPolling();
						downloadState = {
							...downloadState,
							status: 'failed',
							error: 'Status unduhan tidak ditemukan.'
						};
					}
					return;
				}

				const status = (await response.json()) as UpdateDownloadStatus;
				downloadState = {
					...downloadState,
					id: status.id,
					version: status.version,
					assetName: status.assetName,
					status: status.status,
					downloadedBytes: status.downloadedBytes,
					totalBytes: status.totalBytes,
					error: status.error,
					installScheduled: status.installScheduled
				};

				if (status.status === 'completed' || status.status === 'failed') {
					clearDownloadPolling();
				}
			} catch (error) {
				console.error('Gagal memeriksa status unduhan', error);
			}
		}, 1000);
	}

	async function downloadUpdate() {
		if (!latestRelease) return;
		const asset = selectedAsset;
		if (!asset) {
			toast({ message: 'Berkas rilis tidak tersedia. Unduh manual di GitHub.', type: 'warning' });
			return;
		}

		clearDownloadPolling();
		downloadState = {
			id: null,
			version: latestRelease.version,
			assetName: asset.name,
			status: 'pending',
			downloadedBytes: 0,
			totalBytes: asset.size ?? null,
			error: null,
			installScheduled: false
		};

		try {
			const response = await fetch('/api/updates/download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ version: latestRelease.version, assetId: asset.id }),
				credentials: 'same-origin'
			});

			if (!response.ok) {
				const message = await response.text().catch(() => '');
				throw new Error(message || 'Gagal memulai unduhan pembaruan.');
			}

			const payload = (await response.json()) as UpdateDownloadStatus;
			downloadState = {
				id: payload.id,
				version: payload.version,
				assetName: payload.assetName,
				status: payload.status,
				downloadedBytes: payload.downloadedBytes,
				totalBytes: payload.totalBytes,
				error: payload.error,
				installScheduled: payload.installScheduled
			};
			startDownloadPolling(payload.id);
		} catch (error) {
			downloadState = {
				...downloadState,
				status: 'failed',
				error: error instanceof Error ? error.message : 'Gagal mengunduh pembaruan.'
			};
			toast({
				message: downloadState.error ?? 'Gagal mengunduh pembaruan.',
				type: 'error'
			});
		}
	}

	async function stopServerForInstaller() {
		const showSuccess = () =>
			toast({
				message:
					'Server dihentikan. Tutup jendela e-Rapor SMK Pratama Mulya ini lalu jalankan ulang bila diperlukan.',
				type: 'info',
				persist: true
			});

		try {
			const response = await fetch('/api/runtime/stop', { method: 'POST', keepalive: true });
			if (response.ok) {
				showSuccess();
				return;
			}

			const details = await response.text().catch(() => '');
			console.error(
				'Gagal menghentikan server setelah menjalankan installer',
				response.status,
				details
			);
			toast({
				message:
					'Gagal menghentikan server otomatis. Tutup e-Rapor SMK Pratama Mulya secara manual sebelum melanjutkan pemasangan.',
				type: 'warning',
				persist: true
			});
		} catch (error) {
			console.warn(
				'Permintaan penghentian server untuk pemasangan mungkin berhasil walau tanpa respons.',
				error
			);
			showSuccess();
		}
	}

	async function installUpdate() {
		if (!downloadState.id) {
			toast({ message: 'Unduh pembaruan terlebih dahulu.', type: 'warning' });
			return;
		}
		if (downloadState.status !== 'completed') {
			toast({ message: 'Unduhan pembaruan belum selesai.', type: 'warning' });
			return;
		}
		if (installingUpdate || downloadState.installScheduled) return;

		installingUpdate = true;
		try {
			const response = await fetch('/api/updates/install', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ downloadId: downloadState.id }),
				credentials: 'same-origin'
			});

			if (!response.ok) {
				const message = await response.text().catch(() => '');
				throw new Error(message || 'Gagal menjadwalkan pemasangan pembaruan.');
			}

			downloadState = {
				...downloadState,
				installScheduled: true
			};
			toast({
				message:
					'Installer dijalankan. Ikuti petunjuk untuk menyelesaikan pembaruan. Server akan dimatikan otomatis.',
				type: 'success',
				persist: true
			});
			void stopServerForInstaller();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Gagal memasang pembaruan.';
			downloadState = {
				...downloadState,
				error: message
			};
			toast({ message, type: 'error' });
		} finally {
			installingUpdate = false;
		}
	}

	function requestClose() {
		dispatch('close');
	}

	function handleCancel(event: Event) {
		event.preventDefault();
		requestClose();
	}
</script>

{#if open}
	<dialog
		class="modal modal-open modal-middle"
		open
		aria-modal="true"
		oncancel={handleCancel}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				requestClose();
			}
		}}
	>
		<div class="modal-box max-w-2xl">
			<div class="space-y-1">
				<h2 class="text-xl font-semibold">Cek Pembaruan</h2>
				<p class="text-base-content/70 text-sm">Versi terpasang: v{currentVersion}</p>
			</div>

			<div class="mt-4 space-y-4">
				{#if checkError}
					<div class="alert alert-error">
						<Icon name="error" />
						<div>
							<p class="font-semibold">Gagal memeriksa pembaruan</p>
							<p class="text-sm">{checkError}</p>
						</div>
						<button class="btn btn-sm" type="button" onclick={() => checkForUpdate(true)}>
							Coba lagi
						</button>
					</div>
				{/if}

				{#if checkingUpdate}
					<div class="rounded-box bg-base-200/60 p-4">
						<p class="text-sm font-medium">Memeriksa pembaruan…</p>
						<progress class="progress progress-primary mt-3 w-full"></progress>
					</div>
				{/if}

				{#if updateAvailable && latestRelease}
					<section class="space-y-3">
						<div>
							<p class="text-base-content/70 text-sm">Versi terbaru</p>
							<h3 class="text-lg font-semibold">
								e-Rapor SMK Pratama Mulya v{latestRelease.version}
							</h3>
							<p class="text-base-content/60 text-xs">
								Dirilis {formatDateTime(latestRelease.publishedAt)}
							</p>
						</div>
						{#if selectedAsset}
							<div class="rounded-box bg-base-200/60 p-3 text-sm leading-5">
								<p class="font-medium">Berkas: {selectedAsset.name}</p>
								<p class="text-base-content/70">
									Ukuran: {formatBytes(selectedAsset.size)}
								</p>
							</div>
						{:else}
							<div class="alert alert-warning">
								<Icon name="warning" />
								<span>Berkas rilis tidak ditemukan. Unduh manual di GitHub.</span>
							</div>
						{/if}
						{#if latestRelease.notes}
							<div class="rounded-box bg-base-200/40 p-3 text-sm">
								<p class="font-medium">Catatan rilis</p>
								<p class="text-base-content/80 whitespace-pre-wrap">
									{latestRelease.notes}
								</p>
							</div>
						{/if}
					</section>
				{:else if !checkingUpdate}
					<div class="rounded-box bg-base-200/60 space-y-1 p-4 text-sm">
						<p class="font-medium">
							Anda sudah menggunakan versi terbaru e-Rapor SMK Pratama Mulya.
						</p>
						<p class="text-base-content/70 text-xs">Tetap cek berkala untuk fitur terbaru.</p>
					</div>
				{/if}

				{#if updateAvailable && selectedAsset}
					<section class="space-y-3">
						{#if downloadState.status === 'downloading' || downloadState.status === 'pending'}
							<div class="rounded-box bg-base-200/50 space-y-2 p-3 text-sm">
								<p class="font-medium">Mengunduh pembaruan…</p>
								{#if downloadProgressPercent !== null}
									<progress
										class="progress progress-primary w-full"
										max="100"
										value={downloadProgressPercent}
									></progress>
								{:else}
									<progress class="progress progress-primary w-full"></progress>
								{/if}
								<p class="text-base-content/70 text-xs">
									{formatBytes(downloadState.downloadedBytes)}
									dari
									{downloadState.totalBytes
										? formatBytes(downloadState.totalBytes)
										: 'ukuran tidak diketahui'}
								</p>
							</div>
						{/if}

						{#if downloadState.status === 'failed' && downloadState.error}
							<div class="alert alert-error">
								<Icon name="error" />
								<span>{downloadState.error}</span>
							</div>
						{/if}

						{#if downloadState.installScheduled}
							<div class="alert alert-info">
								<Icon name="info" />
								<span>
									Installer telah dibuka. Ikuti petunjuk pemasangan, lalu jalankan ulang e-Rapor SMK
									Pratama Mulya.
								</span>
							</div>
						{/if}

						<div class="flex flex-wrap gap-2">
							<button
								class="btn btn-primary"
								type="button"
								onclick={downloadUpdate}
								disabled={checkingUpdate ||
									downloadState.status === 'downloading' ||
									downloadState.status === 'pending'}
							>
								{#if downloadState.status === 'downloading' || downloadState.status === 'pending'}
									<span class="loading loading-spinner loading-sm"></span>
									Mengunduh…
								{:else}
									<Icon name="download" />
									Download
								{/if}
							</button>

							{#if downloadState.status === 'completed'}
								<button
									class="btn btn-success"
									type="button"
									onclick={installUpdate}
									disabled={installingUpdate || downloadState.installScheduled}
								>
									{#if installingUpdate}
										<span class="loading loading-spinner loading-sm"></span>
										Menyiapkan…
									{:else if downloadState.installScheduled}
										<Icon name="check" />
										Installer Dibuka
									{:else}
										<Icon name="check" />
										Install Update
									{/if}
								</button>
							{/if}
						</div>
					</section>
				{/if}

				{#if autoLoaded}
					<section class="space-y-3 border-t border-base-300 pt-4">
						<div>
							<h3 class="font-semibold">Pembaruan otomatis</h3>
							<p class="text-base-content/60 text-xs">
								Server memeriksa GitHub Releases sendiri, mengunduh installer di latar belakang,
								lalu memasangnya saat aplikasi menganggur. Data siswa tetap aman karena data berada
								di folder terpisah.
							</p>
						</div>

						<div class="rounded-box bg-base-200/60 space-y-1 p-3 text-xs">
							<p>Pemeriksaan terakhir: {formatDateTime(autoState.lastCheckAt)}</p>
							{#if autoState.lastError}
								<p class="text-error">Gagal memeriksa: {autoState.lastError}</p>
							{/if}
							{#if autoState.installStartedAt}
								<p>
									Pemasangan otomatis dijalankan {formatDateTime(autoState.installStartedAt)}.
									Aplikasi dijalankan ulang setelah pemasangan selesai.
								</p>
							{:else if autoDownloaded}
								<p>
									Installer versi {autoState.latestVersion} sudah terunduh dan menunggu dipasang otomatis.
								</p>
							{:else if autoState.latestVersion}
								<p>Installer versi {autoState.latestVersion} akan diunduh otomatis.</p>
							{/if}
						</div>

						{#if canManage}
							<label class="label cursor-pointer justify-start gap-3">
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									bind:checked={autoSettings.enabled}
								/>
								<span class="label-text">Periksa pembaruan otomatis</span>
							</label>
							<label class="label cursor-pointer justify-start gap-3">
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									bind:checked={autoSettings.autoDownload}
									disabled={!autoSettings.enabled}
								/>
								<span class="label-text">Unduh installer di latar belakang</span>
							</label>
							<label class="label cursor-pointer justify-start gap-3">
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									bind:checked={autoSettings.autoInstall}
									disabled={!autoSettings.enabled}
								/>
								<span class="label-text">Pasang otomatis saat aplikasi menganggur</span>
							</label>

							<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<fieldset class="fieldset">
									<legend class="fieldset-legend">Interval pemeriksaan</legend>
									<select
										class="select select-bordered w-full"
										bind:value={autoSettings.intervalMinutes}
										disabled={!autoSettings.enabled}
									>
										{#each intervalOptions as option (option.minutes)}
											<option value={option.minutes}>{option.label}</option>
										{/each}
									</select>
								</fieldset>
								<fieldset class="fieldset">
									<legend class="fieldset-legend">Menit menganggur sebelum dipasang</legend>
									<input
										type="number"
										min="1"
										max="1440"
										class="input w-full"
										bind:value={autoSettings.idleMinutes}
										disabled={!autoSettings.enabled || !autoSettings.autoInstall}
									/>
								</fieldset>
								<fieldset class="fieldset">
									<legend class="fieldset-legend">Jam mulai pemasangan</legend>
									<select
										class="select select-bordered w-full"
										bind:value={autoSettings.windowStartHour}
										disabled={!autoSettings.enabled || !autoSettings.autoInstall}
									>
										{#each hourOptions as hour (hour)}
											<option value={hour}>{formatHour(hour)}</option>
										{/each}
									</select>
								</fieldset>
								<fieldset class="fieldset">
									<legend class="fieldset-legend">Jam selesai pemasangan</legend>
									<select
										class="select select-bordered w-full"
										bind:value={autoSettings.windowEndHour}
										disabled={!autoSettings.enabled || !autoSettings.autoInstall}
									>
										{#each hourOptions as hour (hour)}
											<option value={hour}>{formatHour(hour)}</option>
										{/each}
									</select>
								</fieldset>
							</div>

							<p class="text-base-content/60 text-xs">
								Jam mulai dan jam selesai yang sama berarti pemasangan boleh berjalan kapan saja.
								Pemasangan otomatis hanya tersedia di Windows.
							</p>

							<div class="flex justify-end">
								<button
									class="btn btn-primary btn-sm"
									type="button"
									onclick={saveAutoSettings}
									disabled={savingAuto}
								>
									{#if savingAuto}
										<span class="loading loading-spinner loading-sm"></span>
										Menyimpan…
									{:else}
										<Icon name="save" />
										Simpan Pengaturan
									{/if}
								</button>
							</div>
						{:else}
							<p class="text-base-content/60 text-xs">
								Pengaturan pembaruan otomatis hanya dapat diubah oleh admin atau kepala sekolah.
							</p>
						{/if}
					</section>
				{/if}

				<div class="flex justify-end">
					<button
						class="btn btn-outline btn-sm"
						type="button"
						onclick={() => checkForUpdate(true)}
						disabled={checkingUpdate}
					>
						<Icon name="activity" />
						Periksa ulang
					</button>
				</div>
			</div>
		</div>
		<form
			method="dialog"
			class="modal-backdrop"
			onsubmit={(event) => {
				event.preventDefault();
				requestClose();
			}}
		>
			<button type="submit">tutup</button>
		</form>
	</dialog>
{/if}
