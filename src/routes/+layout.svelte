<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- layout contains many intentional href links for navigation */
	import { page } from '$app/state';
	import { dev } from '$app/environment';
	import { invalidate, onNavigate } from '$app/navigation';
	import GlobalModal, { showModal } from '$lib/components/global-modal.svelte';
	import Icon from '$lib/components/icon.svelte';
	import Menu from '$lib/components/menu.svelte';
	import Navbar from '$lib/components/navbar.svelte';
	import Task from '$lib/components/tasks.svelte';
	import FavoriteMenusSidebar from '$lib/components/dashboard/favorite-menus-sidebar.svelte';
	import KodeKegiatan from '$lib/components/jadwal-bell/kode-kegiatan.svelte';
	import TambahKegiatanModal from '$lib/components/jadwal-bell/tambah-kegiatan-modal.svelte';
	import Toast, { toast } from '$lib/components/toast.svelte';
	import { jadwalIsEditing } from '$lib/stores/jadwal-edit';
	import { get } from 'svelte/store';

	import NavIndicator from '$lib/components/nav-indicator.svelte';
	import ScrollToTop from '$lib/components/scroll-to-top.svelte';
	import FavoriteMenusFab from '$lib/components/dashboard/favorite-menus-fab.svelte';
	import PresensiGuruModal from '$lib/components/presensi-guru/presensi-guru-modal.svelte';
	import '../app.css';

	let { data, children } = $props();

	const appName = 'e-Rapor SMK Pratama Mulya';
	let stoppingServer = $state(false);
	let loggingOut = $state(false);

	// Close the mobile drawer when a menu item triggers client-side navigation.
	// The toggle checkbox lives in the layout (survives soft navigation), so
	// without this the drawer + overlay stay open on the target page and block
	// all clicks until a manual reload.
	onNavigate(() => {
		const drawerToggle = document.getElementById('my-drawer-2') as HTMLInputElement | null;
		if (drawerToggle) drawerToggle.checked = false;
	});

	const isLoginPage = $derived(page.url.pathname === '/login');
	const isTamuPage = $derived(page.url.pathname === '/tamu');
	const isJadwalPublikPage = $derived(page.url.pathname === '/jadwal-pelajaran');
	// When not authenticated, never render the drawer/navbar shell — not even for
	// error pages (e.g. 404 on an unknown URL). This avoids exposing the app menu
	// structure to anonymous visitors.
	const isUnauthenticatedError = $derived(!!page.error && !data.user);
	let isJadwalPage = $derived(page.url.pathname === '/akademik/jadwal-pelajaran');

	const skipPresensiGuruPrompt = $derived(
		isLoginPage ||
			isTamuPage ||
			isJadwalPublikPage ||
			page.url.pathname.startsWith('/logout') ||
			data.presensiGuruEnabled === false
	);
	let presensiGuruPromptChecked = $state(false);
	let presensiGuruShown = $state(false);

	const SIMULASI_STORAGE_KEY = 'erapor-pmk-simulasi-tanggal-jam';
	let simulasiTanggalJam = $state<string | null>(null);

	$effect(() => {
		if (!dev) return;
		const fromUrl = page.url.searchParams.get('tanggal-jam');
		if (fromUrl) {
			sessionStorage.setItem(SIMULASI_STORAGE_KEY, fromUrl);
		}
		simulasiTanggalJam = fromUrl ?? sessionStorage.getItem(SIMULASI_STORAGE_KEY) ?? null;
	});

	function resetSimulasi() {
		sessionStorage.removeItem(SIMULASI_STORAGE_KEY);
		simulasiTanggalJam = null;
	}

	$effect(() => {
		const user = data.user;
		if (!user || skipPresensiGuruPrompt || presensiGuruPromptChecked || presensiGuruShown) return;

		const override =
			page.url.searchParams.get('tanggal-jam') ??
			(dev ? sessionStorage.getItem(SIMULASI_STORAGE_KEY) : null);
		if (override) {
			sessionStorage.setItem(SIMULASI_STORAGE_KEY, override);
		}

		presensiGuruPromptChecked = true;

		const today = new Date().toISOString().slice(0, 10);
		const simulatedDate = override ? override.slice(0, 10) : null;
		const effectiveDate =
			simulatedDate && /^\d{4}-\d{2}-\d{2}$/.test(simulatedDate) ? simulatedDate : today;
		const storageKey = `erapor-pmk-presensi-guru-prompted-${user.id}-${effectiveDate}`;
		if (sessionStorage.getItem(storageKey)) return;

		const apiUrl = `/api/presensi-guru${override ? `?tanggal-jam=${encodeURIComponent(override)}` : ''}`;

		fetch(apiUrl)
			.then((res) => (res.ok ? res.json() : null))
			.then((status) => {
				if (!status?.shouldPrompt) return;
				presensiGuruShown = true;
				sessionStorage.setItem(storageKey, '1');
				showModal({
					title: 'Presensi Guru',
					body: PresensiGuruModal,
					bodyProps: {
						jamMasuk: status.jamMasuk ?? null,
						jamPulang: status.jamPulang ?? null,
						tanggalJam: override
					},
					dismissible: false
				});
			})
			.catch(() => {
				presensiGuruPromptChecked = false;
			});
	});
	const jadwalCanManage = $derived(
		((page.data.user as { permissions?: string[] })?.permissions ?? []).includes(
			'informasi_umum_akademik'
		)
	);

	async function handleHapusKegiatan(kode: string) {
		if (!jadwalCanManage || !get(jadwalIsEditing)) return;
		const formData = new FormData();
		formData.append('kode', kode);

		try {
			const res = await fetch('?/hapusKegiatan', {
				method: 'POST',
				body: formData,
				redirect: 'error'
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ fail: 'Gagal menghapus kegiatan' }));
				throw new Error(err.fail ?? `Error ${res.status}`);
			}

			toast('Kegiatan berhasil dihapus', 'success');
			await invalidate('app:jadwal-bell');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menghapus kegiatan', 'error');
		}
	}

	function openEditKegiatan(kegiatan: { kode: string; nama: string; durasi: number | null }) {
		let actions: { submit: () => Promise<void>; cancel: () => void };
		showModal({
			title: 'Edit Kegiatan',
			body: TambahKegiatanModal,
			bodyProps: {
				onAction: (a: typeof actions) => {
					actions = a;
				},
				existingKegiatan: kegiatan
			},
			onPositive: {
				label: 'Simpan',
				action: () => actions!.submit()
			},
			onNegative: { label: 'Batal' },
			dismissible: false
		});
	}

	const readonlyRoutes = [
		'/keasramaan',
		'/asesmen-keasramaan',
		'/catatan-wali-kelas',
		'/keputusan'
	];

	let kodeKegiatanOpen = $state(true);
	const isReadonlyPage = $derived(
		readonlyRoutes.some((r) => page.url.pathname === r || page.url.pathname.startsWith(r + '/'))
	);

	// User (guru) hanya read-only pada catatan wali kelas dan keputusan kelulusan/kenaikan
	const disableInteraction = $derived(data.user?.type === 'user' && isReadonlyPage);

	async function stopServer() {
		if (stoppingServer) return;
		stoppingServer = true;

		const showSuccess = () =>
			toast({
				message:
					'Server dihentikan. Tutup jendela aplikasi ini lalu jalankan ulang bila diperlukan.',
				type: 'info',
				persist: true
			});

		try {
			const response = await fetch('/api/runtime/stop', { method: 'POST', keepalive: true });
			if (response.ok) {
				showSuccess();
			} else {
				const details = await response.text().catch(() => '');
				console.error('Gagal menghentikan server', response.status, details);
				toast({ message: 'Gagal menghentikan server. Coba lagi.', type: 'error' });
			}
		} catch (error) {
			console.warn(
				'Permintaan stop server berakhir sebelum respons diterima. Diasumsikan berhasil.',
				error
			);
			showSuccess();
		} finally {
			stoppingServer = false;
		}
	}

	async function logout() {
		if (loggingOut) return;
		loggingOut = true;

		try {
			const response = await fetch('/logout', { method: 'POST' });
			if (response.redirected) {
				window.location.href = response.url;
				return;
			}

			if (response.ok) {
				window.location.href = '/login';
				return;
			}

			console.error('Gagal logout', response.status, await response.text().catch(() => ''));
			toast({ message: 'Gagal keluar. Coba lagi.', type: 'error' });
		} catch (error) {
			console.error('Gagal logout', error);
			toast({ message: 'Gagal keluar. Coba lagi.', type: 'error' });
		} finally {
			loggingOut = false;
		}
	}
</script>

<svelte:head>
	<script>
		(function () {
			try {
				var stored = localStorage.getItem('dark-mode');
				var theme;
				if (stored === 'dark' || stored === 'emerald') {
					theme = stored;
				} else if (stored === 'light') {
					theme = 'emerald';
				} else if (stored === 'true' || stored === 'false') {
					theme = stored === 'true' ? 'dark' : 'emerald';
				} else if (stored) {
					try {
						var parsed = JSON.parse(stored);
						theme = parsed ? 'dark' : 'emerald';
					} catch (err) {
						theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'emerald';
					}
				} else {
					theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'emerald';
				}
				document.documentElement.setAttribute('data-theme', theme);
			} catch (e) {
				console.error('failed initialize dark mode:', e);
			}
		})();
	</script>
	<title>{appName}{page.data.meta.title ? ' - ' + page.data.meta.title : ''}</title>
</svelte:head>

{#if isLoginPage || isTamuPage || isUnauthenticatedError}
	<div
		class="bg-gradient-to-br from-slate-100 via-emerald-50/50 to-slate-200 dark:from-slate-950 dark:via-emerald-950/30 dark:to-slate-900 flex min-h-screen flex-col items-center justify-center p-6"
	>
		{#if isUnauthenticatedError}
			<div class="w-full max-w-lg">
				{@render children()}
			</div>
		{:else}
			{@render children()}
		{/if}
	</div>
{:else if isJadwalPublikPage}
	<div class="bg-base-200 flex min-h-screen flex-col p-6">
		{@render children()}
	</div>
{:else}
	<main class="drawer lg:drawer-open">
		<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
		<div class="drawer-content flex min-h-screen flex-col">
			<Navbar {stopServer} {stoppingServer} {logout} {loggingOut} />

			{#if data.impersonator}
				<div
					class="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-xs font-bold shadow-sm border-b border-amber-600/30"
				>
					<div class="flex items-center gap-2">
						<Icon name="warning" class="w-4 h-4 text-amber-900" />
						<span>
							Mode Beralih Akun: Anda sedang masuk sebagai <strong class="underline"
								>{(data.user as { pegawaiName?: string | null })?.pegawaiName ||
									data.user?.username}</strong
							>
							(Sesi Asli: @{data.impersonator.username}).
						</span>
					</div>
					<button
						type="button"
						class="btn btn-xs bg-amber-950 text-white hover:bg-black border-none rounded-lg font-bold shadow-none"
						onclick={async () => {
							try {
								const res = await fetch('/api/auth/switch-user/stop', { method: 'POST' });
								const json = await res.json();
								if (res.ok && json.success) {
									toast(json.message || 'Kembali ke akun Admin.', 'success');
									window.location.href = '/';
								} else {
									toast(json.message || 'Gagal kembali.', 'error');
								}
							} catch {
								toast('Terjadi kesalahan.', 'error');
							}
						}}
					>
						<Icon name="repeat" class="w-3 h-3" />
						<span>Kembali ke Admin</span>
					</button>
				</div>
			{/if}

			<div
				class="bg-base-300 dark:bg-base-200 dark:border-base-200 border-base-300 flex flex-1 flex-col border lg:mr-2 lg:mb-2 lg:rounded-xl"
			>
				<div
					class="max-h-[calc(100vh-4.2rem)] min-h-[calc(100vh-4.2rem)] max-w-none overflow-y-auto md:max-h-[calc(100vh-4.6rem)] md:min-h-[calc(100vh-4.6rem)]"
				>
					<div class="m-4 flex min-w-0 flex-col xl:flex-row xl:gap-4">
						<div class="w-full max-w-7xl min-w-0 flex-1">
							<ScrollToTop />
							<FavoriteMenusFab />
							<div class={disableInteraction ? 'is-readonly' : ''}>
								{@render children()}
							</div>
						</div>
						<div class="sticky top-4 self-start">
							{#if isJadwalPage && page.data.daftarKodeMapel}
								<div class="hidden xl:block">
									<div class="card bg-base-100 rounded-box mb-4 max-w-70 min-w-70 shadow-md">
										<div class="p-4">
											<div class="flex flex-row items-center gap-2">
												<h2 class="text-sm font-bold">Kode Kegiatan</h2>
												<div class="flex-1"></div>
												<div class="join">
													<button
														type="button"
														class="btn btn-sm join-item px-2 shadow-none"
														onclick={() => (kodeKegiatanOpen = !kodeKegiatanOpen)}
														title={kodeKegiatanOpen ? 'Tutup daftar kode' : 'Buka daftar kode'}
													>
														<Icon name={kodeKegiatanOpen ? 'up' : 'down'} />
													</button>
												</div>
											</div>
										</div>
										{#if kodeKegiatanOpen}
											<div class="p-4 pt-0">
												<KodeKegiatan
													kodeMapelPerKelas={(page.data.kodeMapelPerKelas as Array<{
														kelasId: number;
														namaKelas: string;
														kodeMapel: string[];
													}>) ?? []}
													kodeTambahan={['UPB', 'IST', 'PLG']}
													kodeKokurikuler={(page.data.daftarKodeKokurikuler as string[]) ?? []}
													kegiatanCustom={(page.data.kegiatanCustom as Array<{
														kode: string;
														nama: string;
														durasi: number | null;
													}>) ?? []}
													canManage={jadwalCanManage && $jadwalIsEditing}
													onHapusKegiatan={handleHapusKegiatan}
													onEditKegiatan={openEditKegiatan}
												/>
											</div>
										{/if}
									</div>
								</div>
							{/if}
							<Task variant="sidebar" />
							<FavoriteMenusSidebar />
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="drawer-side z-40">
			<label for="my-drawer-2" aria-label="close sidebar" class="drawer-overlay"></label>
			<aside
				class="flex h-dvh min-h-0 w-72 shrink-0 flex-col overflow-hidden bg-[#064e3b] text-emerald-100 border-r border-[#065f46] p-4 shadow-2xl"
			>
				<div
					class="mt-14 lg:mt-0 flex items-center gap-3 p-3 mb-3 rounded-2xl bg-[#053d2e] border border-[#065f46]/70 shadow-md"
				>
					<div
						class="w-11 h-11 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-sm"
					>
						<img
							class="w-full h-full object-contain"
							src="/logo.png"
							alt="Logo SMK Pratama Mulya"
						/>
					</div>
					<div class="overflow-hidden">
						<a href="/"
							><h2 class="text-sm font-black text-white tracking-tight leading-tight truncate">
								SMK Pratama Mulya
							</h2></a
						>
						<p class="text-[11px] text-emerald-300 font-semibold truncate">e-Rapor Terpadu</p>
					</div>
				</div>

				<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
					<Menu />
				</div>
				<div class="mt-auto shrink-0 pt-3 border-t border-[#065f46]/70 flex flex-col gap-1 text-xs">
					<a
						href="/pengaturan"
						class="flex items-center gap-2.5 px-3 py-2 rounded-xl font-semibold text-emerald-200 hover:text-white hover:bg-[#075e46] transition-colors"
					>
						<Icon name="gear" class="text-emerald-300" />
						<span>Pengaturan</span>
					</a>
					<a
						href="/tentang"
						class="flex items-center gap-2.5 px-3 py-2 rounded-xl font-semibold text-emerald-200 hover:text-white hover:bg-[#075e46] transition-colors"
					>
						<Icon name="info" class="text-emerald-300" />
						<span>Tentang Aplikasi</span>
					</a>
				</div>
			</aside>
		</div>
	</main>
{/if}

<Toast />
<GlobalModal />
<NavIndicator />
{#if dev && simulasiTanggalJam && data.user}
	<div class="fixed right-4 bottom-4 z-40 flex items-center gap-2">
		<div class="alert alert-soft alert-warning shadow-lg">
			<Icon name="calendar" class="h-5 w-5 shrink-0" />
			<div class="text-xs leading-tight">
				<div class="font-bold">Mode simulasi presensi aktif</div>
				<div>{simulasiTanggalJam}</div>
			</div>
			<button
				type="button"
				class="btn btn-soft btn-warning btn-sm shadow-none"
				onclick={resetSimulasi}
			>
				Reset
			</button>
		</div>
	</div>
{/if}

<style>
	:global(
		.is-readonly :is(button, input, select, textarea, a, [role='button']):not(.pointer-events-auto)
	) {
		opacity: var(--btn-disabled-opacity, 0.5) !important;
		cursor: not-allowed !important;
		pointer-events: none !important;
	}
</style>
