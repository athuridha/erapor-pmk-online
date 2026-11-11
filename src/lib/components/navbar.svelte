<script lang="ts">
	import { page } from '$app/state';
	import DarkMode from '$lib/components/dark-mode.svelte';
	import Icon from '$lib/components/icon.svelte';
	import TasksModal from '$lib/components/modal-tasks.svelte';
	import SwitchUserModal from '$lib/components/switch-user-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import { favoritesStore } from '$lib/stores/favorites.svelte';
	import { isAdminUser } from '../../routes/pengguna/permissions';
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';

	type NavbarProps = {
		logout?: () => void;
		loggingOut?: boolean;
	};

	// Minimal local type for the user object shape we reference here.
	type UserLike = {
		id?: number;
		pegawaiName?: string;
		username?: string;
		permissions?: string[];
		type?: 'admin' | 'kepala_sekolah' | 'user' | 'wali_kelas';
		operatorLevel?: 'admin' | 'kepala_sekolah' | null;
		kelasId?: number | null;
		ownKelasIds?: number[] | null;
	};

	let { logout = () => {}, loggingOut = false }: NavbarProps = $props();

	let tasksModalRef: { open: () => void } | null = null;
	let showSwitchModal = $state(false);
	let profileDropdownOpen = $state(false);

	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const user = $derived(page.data.user ?? null);
	const impersonator = $derived(page.data.impersonator ?? null);

	const canSwitchUser = $derived.by(() => {
		if (!user) return false;
		if (impersonator) return true;
		const u = user as UserLike;
		return isAdminUser(u);
	});

	const bolehSemuaKelas = $derived(isAdminUser(user as UserLike | null));

	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return bolehSemuaKelas ? 'Semua Kelas' : 'Pilih Kelas';
		return kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
	});

	// Human-readable display name for current user (prefer pegawaiName if available)
	const displayUserName = $derived.by(() => {
		if (!user) return 'Pengguna';
		return (user as UserLike)?.pegawaiName ?? (user as UserLike)?.username ?? 'Pengguna';
	});

	import { resolveHelpFile } from '$lib/help-maps';

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
		const page = await import(`../../docs/help/${fileName}.md`);
		return {
			meta: page.metadata as { title: string },
			ContentPage: page.default as Component
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
		};
		window.addEventListener('click', handleDocumentClick);
		return () => window.removeEventListener('click', handleDocumentClick);
	});

	const isFavorited = $derived(favoritesStore.items.some((f) => f.path === page.url.pathname));
	const currentTitle = $derived(page.data.meta?.title || '');

	async function toggleFavorite() {
		if (loadingFav) return;
		const path = page.url.pathname;
		const title = currentTitle;
		if (!title) return;

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
					favoritesStore.items = [...favoritesStore.items, data.favorite];
				}
			}
		} catch {
			// ignore
		}
	}

	async function showHelp() {
		const pathname = page.url.pathname.replace(/\/+$/, '') || '/';
		const fileName = resolveHelpFile(pathname);
		if (!fileName) {
			toast(
				`Tombol ini berfungsi untuk menampilkan petunjuk penggunaan.<br />` +
					`Silakan klik salah satu menu lalu klik lagi tombol ini.`
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

<div
	class="navbar bg-base-100/95 backdrop-blur border-b border-emerald-100 dark:border-base-200 sticky top-0 z-30 shadow-xs"
>
	<div class="flex-none lg:hidden">
		<label
			for="my-drawer-2"
			class="btn btn-square btn-ghost text-emerald-800 dark:text-emerald-300 drawer-button"
		>
			<span class="text-lg">
				<Icon name="menu-drawer" />
			</span>
		</label>
	</div>

	{#if currentTitle && page.url.pathname !== '/'}
		<button
			class="btn btn-ghost btn-circle shadow-none text-emerald-800 dark:text-emerald-300"
			title={isFavorited ? 'Hapus dari favorit' : 'Tambah ke favorit'}
			onclick={toggleFavorite}
			disabled={loadingFav}
		>
			<span class="text-xl">
				<Icon name="star" class={isFavorited ? 'text-success fill-current' : ''} />
			</span>
		</button>
	{/if}
	<span
		class="mx-2 flex-1 truncate px-2 text-lg font-black tracking-tight text-emerald-950 dark:text-emerald-300"
		>{currentTitle}</span
	>
	<div class="ml-auto flex-none">
		<ul class="flex items-center px-1">
			<!-- tasks modal for mobile -->
			<li>
				<button
					class="btn btn-ghost btn-circle shadow-none xl:hidden text-emerald-800 dark:text-emerald-300"
					aria-label="Daftar Tugas"
					title="Daftar Tugas"
					onclick={() => tasksModalRef?.open()}
				>
					<Icon name="check" class="text-lg" />
				</button>
			</li>

			<!-- Dark Mode -->
			<li>
				<DarkMode />
			</li>

			<!-- Switch User Button (Admin only) -->
			{#if canSwitchUser}
				<li>
					<button
						class="btn btn-ghost btn-circle shadow-none text-emerald-800 dark:text-emerald-300"
						aria-label="Beralih Akun"
						title="Beralih Akun (Switch User)"
						onclick={() => (showSwitchModal = true)}
					>
						<span class="text-xl">
							<Icon name="repeat" />
						</span>
					</button>
				</li>
			{/if}

			<!-- Help -->
			<li>
				<button
					class="btn btn-ghost btn-circle shadow-none text-emerald-800 dark:text-emerald-300"
					aria-label="Bantuan"
					title="Petunjuk"
					onclick={showHelp}
				>
					<span class="text-xl">
						<Icon name="question" />
					</span>
				</button>
			</li>

			<!-- Badge statis konteks kelas (pemilihan kelas dilakukan per halaman) -->
			{#if kelasAktif || bolehSemuaKelas}
				<li class="ml-2">
					<div
						class="btn btn-sm rounded-full shadow-none bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-base-200 dark:text-emerald-200 dark:border-emerald-700 font-bold gap-1.5 px-3 h-9 cursor-default pointer-events-none"
						title={kelasAktif
							? `Konteks kelas saat ini: ${kelasAktifLabel}. Ganti kelas lewat pemilih di halaman.`
							: 'Mode Semua Kelas — pilih kelas lewat pemilih di halaman bila perlu.'}
					>
						<Icon name="users" class="text-emerald-600 dark:text-emerald-400 text-sm" />
						<span class="max-w-[130px] truncate">{kelasAktifLabel}</span>
					</div>
				</li>
			{/if}

			<!-- Dropdown Profil & Akun Pengguna -->
			<li class="ml-1 navbar-profile-dropdown relative">
				<div class="dropdown dropdown-end {profileDropdownOpen ? 'dropdown-open' : ''}">
					<button
						type="button"
						title="Profil & Akun Pengguna"
						class="btn btn-ghost btn-circle shadow-none text-emerald-800 dark:text-emerald-300"
						onclick={(e) => {
							e.stopPropagation();
							profileDropdownOpen = !profileDropdownOpen;
						}}
					>
						<div
							class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-sm border border-emerald-300 dark:border-emerald-700"
						>
							{displayUserName.charAt(0).toUpperCase()}
						</div>
					</button>
					{#if profileDropdownOpen}
						<ul
							class="dropdown-content menu bg-base-100 dark:bg-base-200 rounded-2xl z-50 w-72 p-3 shadow-2xl border border-base-200 dark:border-base-300 mt-2 flex flex-col gap-2"
						>
							<!-- Info user card -->
							<div
								class="flex items-center gap-3 p-2.5 bg-base-200/60 dark:bg-base-300/60 rounded-xl"
							>
								<div
									class="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shrink-0"
								>
									{displayUserName.charAt(0).toUpperCase()}
								</div>
								<div class="flex flex-col min-w-0">
									<p class="font-bold text-sm text-base-content truncate" title={displayUserName}>
										{displayUserName}
									</p>
									<p class="text-xs text-base-content/70 capitalize">
										{#if user?.type === 'admin'}
											Administrator
										{:else if user?.type === 'kepala_sekolah'}
											Kepala Sekolah
										{:else if user?.type === 'wali_kelas'}
											Wali Kelas {kelasAktif?.nama ? `• ${kelasAktif.nama}` : ''}
										{:else}
											Guru Mapel
										{/if}
									</p>
								</div>
							</div>

							{#if impersonator}
								<li>
									<button
										type="button"
										class="btn btn-sm btn-warning w-full shadow-none font-bold justify-start rounded-xl"
										onclick={stopImpersonation}
									>
										<Icon name="repeat" />
										Kembali ke Admin (@{impersonator.username})
									</button>
								</li>
							{/if}

							{#if canSwitchUser}
								<li>
									<button
										type="button"
										class="btn btn-sm btn-soft btn-primary w-full shadow-none justify-start rounded-xl font-medium"
										onclick={() => {
											profileDropdownOpen = false;
											showSwitchModal = true;
										}}
									>
										<Icon name="repeat" />
										Switch Akun (Beralih User)
									</button>
								</li>
							{/if}

							<li>
								<a
									class="flex items-center gap-2 py-2 rounded-xl font-medium"
									href="/tentang"
									onclick={() => (profileDropdownOpen = false)}
								>
									<Icon name="info" />
									Tentang Aplikasi
								</a>
							</li>

							<div class="divider my-0.5"></div>

							<!-- Tombol Keluar (Logout) saja tanpa Stop Server -->
							<li>
								<button
									class="btn btn-sm btn-error btn-soft w-full shadow-none justify-start font-semibold rounded-xl text-error hover:bg-error hover:text-white"
									type="button"
									onclick={() => {
										profileDropdownOpen = false;
										logout();
									}}
									disabled={loggingOut}
								>
									<Icon name="export" />
									{loggingOut ? 'Keluar…' : 'Keluar'}
								</button>
							</li>
						</ul>
					{/if}
				</div>
			</li>
		</ul>
	</div>
</div>

<!-- Tempel instance modal di bawah navbar dan bind ref -->
<TasksModal bind:this={tasksModalRef} />
<SwitchUserModal bind:open={showSwitchModal} currentUserId={user?.id} {impersonator} />
