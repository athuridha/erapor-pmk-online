<script lang="ts">
	import { browser } from '$app/environment';
	import Icon from '$lib/components/icon.svelte';

	let { onOnline }: { onOnline?: () => void } = $props();

	let checking = $state(false);
	let checkMessage = $state<string | null>(null);
	let isError = $state(false);

	async function checkConnection() {
		if (!browser) return;
		checking = true;
		checkMessage = null;
		isError = false;

		// Berikan jeda sejenak untuk feedback visual yang jelas
		await new Promise((resolve) => setTimeout(resolve, 400));

		if (navigator.onLine) {
			checkMessage = 'Koneksi internet terdeteksi. Memuat halaman...';
			isError = false;
			if (onOnline) {
				onOnline();
			} else {
				window.location.reload();
			}
		} else {
			checkMessage =
				'Perangkat masih belum terhubung ke internet. Pastikan kabel LAN atau Wi-Fi aktif.';
			isError = true;
			checking = false;
		}
	}

	function reloadPage() {
		if (browser) {
			window.location.reload();
		}
	}
</script>

<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
	<div class="card bg-base-100 w-full max-w-lg shadow-xl border border-base-300">
		<div class="card-body items-center text-center p-6 sm:p-8">
			<div class="bg-error/10 text-error rounded-full p-4 mb-2 flex items-center justify-center">
				<Icon name="wifi-off" class="w-12 h-12" />
			</div>

			<h1 class="card-title text-2xl font-bold text-base-content">Koneksi Internet Diperlukan</h1>

			<div
				class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-error/10 text-error mt-1"
			>
				<span class="w-2 h-2 rounded-full bg-error animate-pulse"></span>
				Status: Belum Terhubung
			</div>

			<p class="text-sm text-base-content/80 mt-3 leading-relaxed">
				Komputer ini belum memiliki data sekolah. Koneksi internet dibutuhkan satu kali untuk
				penyiapan awal dan sinkronisasi master data dari Database Pusat.
			</p>

			<div
				class="alert alert-info bg-info/10 border-info/20 text-info-content text-left text-xs mt-4 w-full"
			>
				<Icon name="info" class="w-5 h-5 shrink-0 text-info" />
				<div>
					<p class="font-semibold text-base-content">Informasi Akses Luring</p>
					<p class="text-base-content/75 mt-0.5">
						Setelah penyiapan awal berhasil disinkronkan, seluruh administrasi dan fitur aplikasi
						dapat digunakan secara luring tanpa memerlukan koneksi internet.
					</p>
				</div>
			</div>

			<div
				class="w-full bg-base-200/70 rounded-lg p-4 text-left text-xs space-y-2 mt-4 border border-base-300"
			>
				<p class="font-medium text-base-content">Langkah yang perlu dilakukan:</p>
				<ol class="list-decimal list-inside space-y-1 text-base-content/70">
					<li>
						Sambungkan komputer ke jaringan Wi-Fi atau kabel LAN yang memiliki akses internet.
					</li>
					<li>Setelah terhubung, tekan tombol <strong>Periksa koneksi</strong> di bawah.</li>
				</ol>
			</div>

			{#if checkMessage}
				<div
					class="alert {isError
						? 'alert-warning bg-warning/10 text-warning-content border-warning/20'
						: 'alert-success bg-success/10 text-success-content border-success/20'} text-xs mt-4 w-full"
				>
					<Icon name={isError ? 'warning' : 'check'} class="w-4 h-4 shrink-0" />
					<span>{checkMessage}</span>
				</div>
			{/if}

			<div class="card-actions flex-col sm:flex-row w-full justify-center gap-2 mt-6">
				<button
					type="button"
					class="btn btn-primary w-full sm:w-auto shadow-none"
					onclick={checkConnection}
					disabled={checking}
				>
					{#if checking}
						<span class="loading loading-spinner loading-xs"></span>
						Memeriksa...
					{:else}
						<Icon name="repeat" class="w-4 h-4 mr-1" />
						Periksa koneksi
					{/if}
				</button>
				<button
					type="button"
					class="btn btn-ghost w-full sm:w-auto"
					onclick={reloadPage}
					disabled={checking}
				>
					Muat ulang
				</button>
			</div>
		</div>
	</div>
</div>
