<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import DarkMode from '$lib/components/dark-mode.svelte';
	import Icon from '$lib/components/icon.svelte';
	import TasksModal from '$lib/components/modal-tasks.svelte';
	import SwitchUserModal from '$lib/components/switch-user-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import { favoritesStore } from '$lib/stores/favorites.svelte';
	import { isAdminUser } from '../../routes/pengguna/permissions';
	import { resolveHelpFile } from '$lib/help-maps';
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';

	type NavbarProps = {
		logout?: () => void;
		loggingOut?: boolean;
		onOpenMobileMenu?: () => void;
	};

	type UserLike = {
		id?: number;
		pegawaiName?: string;
		namaLengkap?: string | null;
		username?: string;
		permissions?: string[];
		type?: 'admin' | 'kepala_sekolah' | 'user' | 'wali_kelas' | 'wali_asuh' | 'pembina_eskul';
		operatorLevel?: 'admin' | 'kepala_sekolah' | null;
		kelasId?: number | null;
		ownKelasIds?: number[] | null;
	};

	let {
		logout = () => {},
		loggingOut = false,
		onOpenMobileMenu = () => {}
	}: NavbarProps = $props();

	let tasksModalRef: { open: () => void } | null = null;
	let showSwitchModal = $state(false);
	let profileDropdownOpen = $state(false);
	let favoritesOpen = $state(false);
	let editingFavorites = $state(false);

	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const user = $derived(page.data.user ?? null);
	const impersonator = $derived(page.data.impersonator ?? null);
	const canSwitchUser = $derived.by(() => {
		if (!user) return false;
		if (impersonator) return true;
		return isAdminUser(user as UserLike);
	});

	const displayUserName = $derived.by(() => {
		if (!user) return 'Pengguna';
		return (
			(user as UserLike)?.pegawaiName ??
			(user as UserLike)?.namaLengkap ??
			(user as UserLike)?.username ??
			'Pengguna'
		);
	});

	const roleLabel = $derived.by(() => {
		const u = user as UserLike | null;
		if (u?.type === 'admin') return 'Administrator';
		if (u?.type === 'kepala_sekolah') return 'Kepala Sekolah';
		if (u?.type === 'wali_kelas') {
			return kelasAktif?.nama ? `Wali Kelas (${kelasAktif.nama})` : 'Wali Kelas';
		}
		if (u?.type === 'wali_asuh') return 'Wali Asuh';
		if (u?.type === 'pembina_eskul') return 'Pembina Eskul';
		return 'Guru Mapel';
	});

	onNavigate(() => {
		profileDropdownOpen = false;
		favoritesOpen = false;
		editingFavorites = false;
	});

	async function stopImpersonation() {
		profileDropdownOpen = false;
		try {
			await fetch('/api/auth/switch-user/stop', { method: 'POST' });
			window.location.href = '/';
		} catch {
			window.location.href = '/';
		}
	}

	async function getHelpPage(fileName: string) {
		const helpModule = await import(`../../docs/help/${fileName}.md`);
		return {
			meta: helpModule.metadata as { title: string },
			ContentPage: helpModule.default as Component
		};
	}

	let loadingFav = $state(true);

	onMount(() => {
		loadingFav = true;
		const ssrFavorites = page.data.favorites;
		if (Array.isArray(ssrFavorites) && ssrFavorites.length > 0) {
			favoritesStore.items = ssrFavorites;
			loadingFav = false;
		} else {
			fetch('/api/favorites')
				.then((res) => (res.ok ? res.json() : null))
				.then((data) => {
					if (data?.favorites) favoritesStore.items = data.favorites;
				})
				.catch(() => {})
				.finally(() => {
					loadingFav = false;
				});
		}

		const handleDocumentClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target?.closest('.navbar-profile-dropdown')) {
				profileDropdownOpen = false;
			}
			if (!target?.closest('.navbar-favorites-dropdown')) {
				favoritesOpen = false;
				editingFavorites = false;
			}
		};

		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				profileDropdownOpen = false;
				favoritesOpen = false;
				editingFavorites = false;
			}
		};

		window.addEventListener('click', handleDocumentClick);
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('click', handleDocumentClick);
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	const isFavorited = $derived(favoritesStore.items.some((f) => f.path === page.url.pathname));
	const currentTitle = $derived(page.data.meta?.title || '');
	const navbarTitle = $derived(page.url.pathname === '/' ? 'Beranda' : currentTitle);

	async function toggleFavorite() {
		if (loadingFav) return;
		const path = page.url.pathname;
		const title = currentTitle;
		if (!title) return;

		loadingFav = true;
		try {
			if (isFavorited) {
				const res = await fetch('/api/favorites', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ path })
				});
				if (res.ok) {
					favoritesStore.items = favoritesStore.items.filter((f) => f.path !== path);
				}
			} else {
				const res = await fetch('/api/favorites', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ path, title })
				});
				if (res.ok) {
					const data = await res.json();
					if (data?.favorite) {
						favoritesStore.items = [...favoritesStore.items, data.favorite];
					}
				} else if (res.status === 409) {
					const listRes = await fetch('/api/favorites');
					if (listRes.ok) {
						const listJson = await listRes.json().catch(() => null);
						if (listJson?.favorites) favoritesStore.items = listJson.favorites;
					}
				}
			}
		} catch {
			// ignore
		} finally {
			loadingFav = false;
		}
	}

	async function removeFavorite(id: number) {
		const fav = favoritesStore.items.find((f) => f.id === id);
		if (!fav) return;
		try {
			const res = await fetch('/api/favorites', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: fav.path })
			});
			if (res.ok) {
				favoritesStore.items = favoritesStore.items.filter((f) => f.id !== id);
			}
		} catch {
			// ignore
		}
	}

	async function showHelp() {
		profileDropdownOpen = false;
		const pathname = page.url.pathname.replace(/\/+$/, '') || '/';
		const fileName = resolveHelpFile(pathname);
		if (!fileName) {
			toast(
				'Tombol ini menampilkan petunjuk halaman aktif.<br />Buka salah satu menu terlebih dahulu lalu tekan Petunjuk.'
			);
			return;
		}
		const result = await getHelpPage(fileName);
		showModal({
			title: result.meta.title,
			body: result.ContentPage,
			typography: true,
			dismissible: true
		});
	}
</script>

<header
	class="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/85"
>
	<div class="flex h-13 items-center gap-2 px-3 sm:px-6">
		<button
			type="button"
			onclick={onOpenMobileMenu}
			aria-label="Buka menu navigasi"
			class="app-mobile-menu-trigger inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-0 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
		>
			<span aria-hidden="true"><Icon name="menu-drawer" class="h-4 w-4" /></span>
			<span class="hidden sm:inline">Menu</span>
		</button>

		<div class="flex min-w-0 flex-1 items-center gap-1.5">
			{#if currentTitle && page.url.pathname !== '/'}
				<button
					type="button"
					class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors max-sm:hidden hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-zinc-800 {isFavorited
						? 'text-blue-600 dark:text-blue-400'
						: 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100'}"
					title={isFavorited ? 'Hapus halaman dari favorit' : 'Simpan halaman ke favorit'}
					aria-label={isFavorited ? 'Hapus halaman dari favorit' : 'Simpan halaman ke favorit'}
					aria-pressed={isFavorited}
					onclick={toggleFavorite}
					disabled={loadingFav}
				>
					<span aria-hidden="true">
						<Icon name="star" class="h-4 w-4 {isFavorited ? 'fill-current' : ''}" />
					</span>
				</button>
			{/if}
			{#if page.url.pathname !== '/'}
				<span
					class="truncate text-sm font-semibold tracking-tight text-slate-900 sm:text-base dark:text-zinc-100"
				>
					{navbarTitle}
				</span>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-1 sm:gap-1.5">
			<!-- Menu Favorit Popover -->
			<div class="navbar-favorites-dropdown relative">
				<button
					type="button"
					class="inline-flex h-10 items-center gap-1.5 rounded-xl px-2 text-slate-500 transition-colors hover:bg-slate-100/80 hover:text-slate-900 sm:h-8.5 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
					title="Menu Favorit"
					aria-label="Menu Favorit"
					aria-expanded={favoritesOpen}
					onclick={(e) => {
						e.stopPropagation();
						profileDropdownOpen = false;
						favoritesOpen = !favoritesOpen;
					}}
				>
					<span aria-hidden="true">
						<Icon
							name="star"
							class="h-4 w-4 {favoritesStore.items.length > 0
								? 'text-blue-600 dark:text-blue-400'
								: ''}"
						/>
					</span>
					<span class="hidden text-xs font-medium md:inline">Favorit</span>
					{#if favoritesStore.items.length > 0}
						<span
							class="hidden rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 tabular-nums sm:inline dark:bg-blue-950/60 dark:text-blue-300"
						>
							{favoritesStore.items.length}
						</span>
					{/if}
				</button>

				{#if favoritesOpen}
					<div
						class="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
						role="region"
						aria-label="Daftar menu favorit"
					>
						<div
							class="flex items-center justify-between border-b border-slate-200 px-3.5 py-2.5 dark:border-zinc-800"
						>
							<span class="text-xs font-semibold text-slate-900 dark:text-zinc-100">
								Menu Favorit
							</span>
							{#if favoritesStore.items.length > 0}
								<button
									type="button"
									class="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
									onclick={() => (editingFavorites = !editingFavorites)}
								>
									{editingFavorites ? 'Selesai' : 'Ubah'}
								</button>
							{/if}
						</div>

						{#if favoritesStore.items.length === 0}
							<div class="p-4 text-center">
								<p class="text-xs font-semibold text-slate-900 dark:text-zinc-100">
									Belum ada menu favorit
								</p>
								<p class="mt-1 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
									Klik ikon bintang di sebelah judul halaman untuk menyematkan jalan pintas ke sini.
								</p>
							</div>
						{:else}
							<ul
								class="max-h-64 divide-y divide-slate-200 overflow-y-auto py-1 dark:divide-zinc-800"
							>
								{#each favoritesStore.items as fav (fav.id)}
									<li
										class="flex items-center gap-2 px-3.5 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60"
									>
										<span aria-hidden="true" class="shrink-0 text-blue-600 dark:text-blue-400">
											<Icon name="star" class="h-3.5 w-3.5 fill-current" />
										</span>
										<a
											href={fav.path}
											class="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 hover:text-blue-700 dark:text-zinc-200 dark:hover:text-blue-400"
											onclick={() => {
												favoritesOpen = false;
												editingFavorites = false;
											}}
										>
											{fav.title}
										</a>
										{#if editingFavorites}
											<button
												type="button"
												class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-red-700 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
												title={`Hapus ${fav.title} dari favorit`}
												aria-label={`Hapus ${fav.title} dari favorit`}
												onclick={() => removeFavorite(fav.id)}
											>
												<span aria-hidden="true"><Icon name="del" class="h-3.5 w-3.5" /></span>
											</button>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Daftar Tugas Slide-over Drawer Trigger -->
			<button
				type="button"
				class="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-slate-500 transition-colors hover:bg-slate-100/80 hover:text-slate-900 max-sm:justify-center max-sm:px-0 sm:h-8.5 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
				aria-label="Buka panel daftar tugas"
				title="Daftar Tugas"
				onclick={() => tasksModalRef?.open()}
			>
				<span aria-hidden="true"><Icon name="check-square" class="h-4 w-4" /></span>
				<span class="hidden text-xs font-medium md:inline">Tugas</span>
			</button>

			<!-- Petunjuk Penggunaan (Desktop) -->
			<button
				type="button"
				class="hidden h-8.5 w-8.5 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100/80 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:inline-flex"
				aria-label="Petunjuk penggunaan"
				title="Petunjuk penggunaan"
				onclick={showHelp}
			>
				<span aria-hidden="true"><Icon name="question" class="h-4 w-4" /></span>
			</button>

			<!-- Dark / Light Mode -->
			<DarkMode />

			<!-- Profil & Akun Pengguna -->
			<div class="navbar-profile-dropdown relative ml-0.5">
				<button
					type="button"
					title="Profil dan akun pengguna"
					aria-label="Menu akun pengguna"
					aria-expanded={profileDropdownOpen}
					class="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200/80 bg-white pr-2.5 pl-1 shadow-2xs transition-colors hover:bg-slate-50 sm:h-8.5 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700/70"
					onclick={(e) => {
						e.stopPropagation();
						favoritesOpen = false;
						profileDropdownOpen = !profileDropdownOpen;
					}}
				>
					<div
						class="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white"
					>
						{displayUserName.charAt(0).toUpperCase()}
					</div>
					<span
						class="hidden max-w-[110px] truncate text-xs font-semibold text-slate-800 lg:inline dark:text-zinc-200"
					>
						{displayUserName}
					</span>
					<span aria-hidden="true" class="hidden text-slate-400 lg:inline dark:text-zinc-400">
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</button>

				{#if profileDropdownOpen}
					<div
						class="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
						role="region"
						aria-label="Menu akun"
					>
						<div
							class="mb-2 flex items-center gap-3 rounded-lg bg-slate-100/80 p-2.5 dark:bg-zinc-800"
						>
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white"
							>
								{displayUserName.charAt(0).toUpperCase()}
							</div>
							<div class="min-w-0 flex-1">
								<p
									class="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100"
									title={displayUserName}
								>
									{displayUserName}
								</p>
								<p class="truncate text-xs text-slate-600 dark:text-zinc-400" title={roleLabel}>
									{roleLabel}
								</p>
							</div>
						</div>

						<ul class="w-full space-y-0.5 text-xs">
							{#if impersonator}
								<li>
									<button
										type="button"
										class="flex w-full items-center gap-2.5 rounded-lg bg-amber-50 px-2.5 py-2 text-left font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-950"
										onclick={stopImpersonation}
									>
										<span aria-hidden="true"><Icon name="repeat" class="h-4 w-4" /></span>
										<span>Kembali ke Admin (@{impersonator.username})</span>
									</button>
								</li>
							{/if}

							<li>
								<a
									class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
									href="/pengaturan/profil"
									onclick={() => (profileDropdownOpen = false)}
								>
									<span aria-hidden="true" class="text-slate-500 dark:text-zinc-400">
										<Icon name="user" class="h-4 w-4" />
									</span>
									<span>Profil Saya</span>
								</a>
							</li>

							{#if canSwitchUser}
								<li>
									<button
										type="button"
										class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
										onclick={() => {
											profileDropdownOpen = false;
											showSwitchModal = true;
										}}
									>
										<span aria-hidden="true" class="text-slate-500 dark:text-zinc-400">
											<Icon name="repeat" class="h-4 w-4" />
										</span>
										<span>Beralih Akun</span>
									</button>
								</li>
							{/if}

							<li class="sm:hidden">
								<button
									type="button"
									class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
									onclick={showHelp}
								>
									<span aria-hidden="true" class="text-slate-500 dark:text-zinc-400">
										<Icon name="question" class="h-4 w-4" />
									</span>
									<span>Petunjuk Halaman</span>
								</button>
							</li>

							<li>
								<a
									class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
									href="/tentang"
									onclick={() => (profileDropdownOpen = false)}
								>
									<span aria-hidden="true" class="text-slate-500 dark:text-zinc-400">
										<Icon name="info" class="h-4 w-4" />
									</span>
									<span>Tentang Aplikasi</span>
								</a>
							</li>

							<li class="mt-1 border-t border-slate-200 pt-1 dark:border-zinc-800">
								<button
									class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/50"
									type="button"
									onclick={() => {
										profileDropdownOpen = false;
										logout();
									}}
									disabled={loggingOut}
								>
									<span aria-hidden="true"><Icon name="export" class="h-4 w-4" /></span>
									<span>{loggingOut ? 'Keluar...' : 'Keluar'}</span>
								</button>
							</li>
						</ul>
					</div>
				{/if}
			</div>
		</div>
	</div>
</header>

<TasksModal bind:this={tasksModalRef} />
<SwitchUserModal bind:open={showSwitchModal} currentUserId={user?.id} {impersonator} />
