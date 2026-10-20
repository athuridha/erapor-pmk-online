<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { toast } from '$lib/components/toast.svelte';

	/**
	 * Pemberi tahu versi baru. Memeriksa status pembaruan dari server secara
	 * berkala dan menampilkan notifikasi sekali per versi.
	 */
	const STORAGE_KEY = 'erapor-pmk.update-notified-version';
	const POLL_INTERVAL_MS = 60_000;

	let lastSeenVersion = $state<string | null>(null);

	const canCheck = $derived.by(() => {
		const user = page.data.user as { type?: string; permissions?: string[] } | undefined;
		if (!user) return false;
		if (user.type === 'admin' || user.type === 'kepala_sekolah') return true;
		return (user.permissions ?? []).includes('app_check_update');
	});

	onMount(() => {
		if (!browser) return;

		lastSeenVersion = localStorage.getItem(STORAGE_KEY);

		const poll = async () => {
			if (!canCheck) return;
			try {
				const response = await fetch('/api/updates/state', {
					cache: 'no-store',
					credentials: 'same-origin'
				});
				if (!response.ok) return;
				const payload = await response.json();
				if (!payload?.updateAvailable) return;
				const version = payload?.state?.latestVersion as string | undefined;
				if (!version || version === lastSeenVersion) return;

				lastSeenVersion = version;
				localStorage.setItem(STORAGE_KEY, version);
				toast({
					message: `Pembaruan e-Rapor v${version} tersedia. Buka Pengaturan → Cek Pembaruan.`,
					type: 'info',
					persist: true
				});
			} catch (error) {
				console.warn('Gagal memeriksa status pembaruan', error);
			}
		};

		void poll();
		const handle = setInterval(() => {
			void poll();
		}, POLL_INTERVAL_MS);

		return () => clearInterval(handle);
	});
</script>
