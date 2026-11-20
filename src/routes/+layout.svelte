<script lang="ts">
	import { page } from '$app/state';
	import { dev } from '$app/environment';
	import { invalidate, invalidateAll, onNavigate } from '$app/navigation';
	import GlobalModal, { showModal, hideModal } from '$lib/components/global-modal.svelte';
	import Icon from '$lib/components/icon.svelte';
	import ForcedPasswordChangeBody from '$lib/components/settings/forced-password-change-body.svelte';
	import Menu from '$lib/components/menu.svelte';
	import KelasPickerLokal from '$lib/components/kelas-picker-lokal.svelte';
	import Navbar from '$lib/components/navbar.svelte';
	import KodeKegiatan from '$lib/components/jadwal-bell/kode-kegiatan.svelte';
	import TambahKegiatanModal from '$lib/components/jadwal-bell/tambah-kegiatan-modal.svelte';
	import Toast, { toast } from '$lib/components/toast.svelte';
	import { jadwalIsEditing } from '$lib/stores/jadwal-edit';
	import { get } from 'svelte/store';

	import NavIndicator from '$lib/components/nav-indicator.svelte';
	import ScrollToTop from '$lib/components/scroll-to-top.svelte';
	import PresensiGuruModal from '$lib/components/presensi-guru/presensi-guru-modal.svelte';
	import { isAdminUser } from './pengguna/permissions';
	import '../app.css';

	let { data, children } = $props();

	const appName = 'e-Rapor SMK Pratama Mulya';
	let loggingOut = $state(false);
	let isStoppingImpersonation = $state(false);
	let mobileMenuOpen = $state(false);

	let _isOnline = $state(true);

	$effect(() => {
		if (typeof window === 'undefined') return;
		_isOnline = navigator.onLine;

		const handleOnline = () => {
			_isOnline = true;
		};
		const handleOffline = () => {
			_isOnline = false;
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});

	$effect(() => {
		if (!mobileMenuOpen) return;
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				mobileMenuOpen = false;
			}
		};
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});

	onNavigate(() => {
		mobileMenuOpen = false;
	});

	const isLoginPage = $derived(page.url.pathname === '/login');
	const isTamuPage = $derived(page.url.pathname === '/tamu');
	const isJadwalPublikPage = $derived(page.url.pathname === '/jadwal-pelajaran');
	const isVerifikasiRapor = $derived(page.url.pathname === '/rapor/verifikasi');
	const isLimitPage = $derived(
		page.url.pathname === '/server-limit' || page.url.pathname === '/limit'
	);
	const isUnauthenticatedError = $derived(!!page.error && !data.user);
	let isJadwalPage = $derived(page.url.pathname === '/akademik/jadwal-pelajaran');

	const activeSemesterNama = $derived(
		(page.data as { activeSemesterNama?: string | null } | null)?.activeSemesterNama ?? null
	);

	const skipPresensiGuruPrompt = $derived(
		isLoginPage ||
			isTamuPage ||
			isJadwalPublikPage ||
			isLimitPage ||
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

	let forcedPasswordModalDismissed = $state(false);
	const forcedPasswordModalShown = $derived(
		!!data.user && !data.impersonator && data.user.mustChangePassword === true
	);
	$effect(() => {
		if (!forcedPasswordModalShown || forcedPasswordModalDismissed) return;
		forcedPasswordModalDismissed = true;
		showModal({
			title: 'Ganti Kata Sandi',
			body: ForcedPasswordChangeBody,
			bodyProps: {
				onPasswordChanged: async () => {
					await invalidateAll();
					hideModal();
				}
			},
			dismissible: false
		});
	});

	const hideTaskRail = $derived(page.data.meta?.hideTaskRail === true);
	const showJadwalSidebar = $derived(
		!hideTaskRail && isJadwalPage && Boolean(page.data.daftarKodeMapel)
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

	const readonlyRoutes = ['/catatan-wali-kelas', '/keputusan'];

	let kodeKegiatanOpen = $state(true);
	const isReadonlyPage = $derived(
		readonlyRoutes.some((r) => page.url.pathname === r || page.url.pathname.startsWith(r + '/'))
	);

	const isOwnClass = $derived.by(() => {
		const ownIds = (data.user as { ownKelasIds?: number[] })?.ownKelasIds ?? [];
		return data.kelasAktif?.id != null && ownIds.includes(data.kelasAktif.id);
	});
	const disableInteraction = $derived(!isAdminUser(data.user) && !isOwnClass && isReadonlyPage);
	const isPengaturanActive = $derived(page.url.pathname.startsWith('/pengaturan'));

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
		class="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 dark:bg-zinc-950"
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
	<div class="flex min-h-screen flex-col bg-slate-50 p-6 dark:bg-zinc-950">
		{@render children()}
	</div>
{:else if isVerifikasiRapor}
	{@render children()}
{:else if isLimitPage}
	{@render children()}
{:else}
	<div class="app-canvas-bg relative isolate flex min-h-screen text-slate-900 dark:text-zinc-100">
		<div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
			<div class="app-canvas-blob-a absolute -top-32 -right-32 h-96 w-96 rounded-full"></div>
			<div class="app-canvas-blob-b absolute -bottom-32 -left-32 h-80 w-80 rounded-full"></div>
		</div>

		{#if mobileMenuOpen}
			<button
				type="button"
				aria-label="Tutup menu navigasi"
				onclick={() => (mobileMenuOpen = false)}
				class="app-sidebar-backdrop fixed inset-0 z-40 bg-slate-950/45"
			></button>
		{/if}

		<aside
			aria-label="Navigasi samping"
			class="app-sidebar-panel fixed inset-y-0 left-0 z-50 flex h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-white px-3.5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-200 lg:visible lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 lg:shadow-none dark:border-zinc-800 dark:bg-zinc-900 {mobileMenuOpen
				? 'visible translate-x-0 shadow-xl'
				: 'invisible -translate-x-full'}"
		>
			<div class="relative mb-4 flex items-center justify-center px-1 pt-1">
				<a
					href="/"
					class="flex flex-col items-center rounded-xl px-3 py-1.5 text-center transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60"
				>
					<img
						class="h-11 w-11 shrink-0 object-contain"
						src="/logo.png"
						alt="Logo SMK Pratama Mulya"
						width="44"
						height="44"
					/>
					<p
						class="mt-1.5 text-[14px] leading-tight font-bold tracking-tight text-slate-900 dark:text-zinc-100"
					>
						SMK Pratama Mulya
					</p>
					<p
						class="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-zinc-400"
						title={activeSemesterNama ?? 'Karawang'}
					>
						{activeSemesterNama ?? 'Karawang'}
					</p>
				</a>

				<button
					type="button"
					onclick={() => (mobileMenuOpen = false)}
					aria-label="Tutup menu navigasi"
					class="app-mobile-menu-trigger absolute -top-1 -right-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
				>
					<span aria-hidden="true"><Icon name="close" class="h-4 w-4" /></span>
				</button>
			</div>

			<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
				<Menu />
			</div>

			<div class="mt-3 shrink-0 border-t border-slate-200/80 pt-3 dark:border-zinc-800">
				<a
					href="/pengaturan"
					aria-current={isPengaturanActive ? 'page' : undefined}
					class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors {isPengaturanActive
						? 'bg-[#ebf3fe] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
						: 'font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}"
				>
					<span
						aria-hidden="true"
						class={isPengaturanActive
							? 'text-blue-600 dark:text-blue-400'
							: 'text-slate-400 dark:text-zinc-400'}
					>
						<Icon name="gear" class="h-4 w-4" />
					</span>
					<span>Pengaturan</span>
				</a>
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col">
			<a
				href="#main-content"
				class="sr-only rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
			>
				Langsung ke konten utama
			</a>

			<Navbar {logout} {loggingOut} onOpenMobileMenu={() => (mobileMenuOpen = true)} />

			{#if data.impersonator}
				<div
					class="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
				>
					<div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
						<div class="flex items-center gap-2">
							<span aria-hidden="true" class="text-amber-700 dark:text-amber-400">
								<Icon name="warning" class="h-4 w-4" />
							</span>
							<span>
								Mode Beralih Akun: masuk sebagai
								<strong class="font-semibold">
									{(data.user as { pegawaiName?: string | null })?.pegawaiName ||
										data.user?.username}
								</strong>
								(Sesi asal: @{data.impersonator.username}).
							</span>
						</div>
						<form
							method="POST"
							action="/api/auth/switch-user/stop"
							onsubmit={async (e) => {
								e.preventDefault();
								if (isStoppingImpersonation) return;
								isStoppingImpersonation = true;
								try {
									await fetch('/api/auth/switch-user/stop', { method: 'POST' });
									window.location.href = '/';
								} catch {
									window.location.href = '/';
								}
							}}
						>
							<button
								type="submit"
								disabled={isStoppingImpersonation}
								class="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-950 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
							>
								<span aria-hidden="true">
									<Icon
										name="repeat"
										class="h-3 w-3 {isStoppingImpersonation ? 'animate-spin' : ''}"
									/>
								</span>
								<span>{isStoppingImpersonation ? 'Kembali...' : 'Kembali ke Admin'}</span>
							</button>
						</form>
					</div>
				</div>
			{/if}

			<main
				id="main-content"
				class="flex-1 px-3 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5 lg:px-8"
			>
				<div class="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 sm:gap-5 xl:flex-row">
					<div class="min-w-0 flex-1 {disableInteraction ? 'is-readonly' : ''}">
						{#if data.kelasPicker?.tampil}
							<div
								class="mb-3 flex items-center gap-2 rounded-xl border border-slate-200/75 bg-white px-2.5 py-1.5 shadow-2xs sm:max-w-sm dark:border-zinc-800 dark:bg-zinc-900"
							>
								<KelasPickerLokal variant="mobile" />
							</div>
						{/if}
						{@render children()}
					</div>

					{#if showJadwalSidebar}
						<aside class="hidden w-72 shrink-0 self-start xl:sticky xl:top-20 xl:block">
							<div
								class="rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
							>
								<div
									class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800"
								>
									<h2 class="text-sm font-semibold text-slate-900 dark:text-zinc-100">
										Kode Kegiatan
									</h2>
									<button
										type="button"
										class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
										onclick={() => (kodeKegiatanOpen = !kodeKegiatanOpen)}
										title={kodeKegiatanOpen ? 'Tutup daftar kode' : 'Buka daftar kode'}
										aria-label={kodeKegiatanOpen ? 'Tutup daftar kode' : 'Buka daftar kode'}
									>
										<span aria-hidden="true">
											<Icon name={kodeKegiatanOpen ? 'up' : 'down'} class="h-3.5 w-3.5" />
										</span>
									</button>
								</div>
								{#if kodeKegiatanOpen}
									<div class="p-4">
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
						</aside>
					{/if}
				</div>
			</main>

			<ScrollToTop />
		</div>
	</div>
{/if}

<Toast />
<GlobalModal />
<NavIndicator />
{#if dev && simulasiTanggalJam && data.user}
	<div class="fixed right-4 bottom-4 z-40">
		<div
			class="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-100"
		>
			<span aria-hidden="true"><Icon name="calendar" class="h-4 w-4 shrink-0" /></span>
			<div class="text-xs leading-tight">
				<div class="font-semibold">Mode simulasi presensi aktif</div>
				<div class="opacity-80">{simulasiTanggalJam}</div>
			</div>
			<button
				type="button"
				class="rounded-lg bg-amber-900 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
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
