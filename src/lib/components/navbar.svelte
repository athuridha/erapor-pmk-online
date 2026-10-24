<script lang="ts">
	import { page } from '$app/state';
	import DarkMode from '$lib/components/dark-mode.svelte';
	import Icon from '$lib/components/icon.svelte';
	import TasksModal from '$lib/components/modal-tasks.svelte';
	import SwitchUserModal from '$lib/components/switch-user-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import { favoritesStore } from '$lib/stores/favorites.svelte';
	import { isAdminUser, isFullAdmin } from '../../routes/pengguna/permissions';
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';

	type NavbarProps = {
		stopServer?: () => void;
		stoppingServer?: boolean;
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

	let {
		stopServer = () => {},
		stoppingServer = false,
		logout = () => {},
		loggingOut = false
	}: NavbarProps = $props();

	let tasksModalRef: { open: () => void } | null = null;
	let showSwitchModal = $state(false);

	const daftarKelas = $derived(page.data.daftarKelas ?? []);
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
		if (!user) return null;
		// use runtime field `pegawaiName` if the server provided it, otherwise fall back to username
		return (user as UserLike)?.pegawaiName ?? (user as UserLike)?.username ?? null;
	});

	const isNonOwnClass = $derived.by(() => {
		if (!user || (user.type !== 'wali_kelas' && user.type !== 'user') || !kelasAktif?.id)
			return false;
		const u = user as UserLike;
		const ownIds = u.ownKelasIds?.length ? u.ownKelasIds : u.kelasId != null ? [u.kelasId] : [];
		return ownIds.length > 0 && !ownIds.includes(kelasAktif.id);
	});

	// Whether current user can stop the server (client-side guard)
	// Allow users who explicitly have the `server_stop` permission, or
	// any user of type 'admin' (administrators can stop the server by default).
	const canStopServer = $derived.by(() => {
		if (!user) return false;
		// Admins should be allowed regardless of explicit permissions
		if (isFullAdmin(user)) return true;
		const perms = (user as UserLike)?.permissions ?? [];
		return Array.isArray(perms) ? perms.includes('server_stop') : false;
	});

	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';
	import { resolveHelpFile } from '$lib/help-maps';

	function buildKelasHref(kelasId: number) {
		const params = new SvelteURLSearchParams(page.url.search);
		params.set('kelas_id', String(kelasId));
		const query = params.toString();
		return query ? `${page.url.pathname}?${query}` : page.url.pathname;
	}

	/** Link "keluar kelas": admin/kepala sekolah kembali ke mode semua kelas. */
	function buildSemuaKelasHref() {
		const params = new SvelteURLSearchParams(page.url.search);
		params.set('kelas_id', 'semua');
		const query = params.toString();
		return query ? `${page.url.pathname}?${query}` : page.url.pathname;
	}

	function hasPindahPermission() {
		if (user?.type === 'wali_asuh') return true;
		const perms = user?.permissions ?? [];
		return perms.includes('kelas_pindah');
	}

	function handleKelasClick(e: MouseEvent) {
		if (hasPindahPermission()) {
			// allow navigation
			return;
		}
		// prevent navigation and show logout confirmation modal
		e.preventDefault();
		showModal({
			title: 'Konfirmasi Keluar',
			body: 'Anda tidak mempunyai akses untuk Pindah Kelas secara langsung, silakan masuk ulang ke kelas yang dituju. Keluar sekarang?',
			dismissible: true,
			onPositive: {
				label: 'Keluar',
				icon: 'export',
				action: ({ close }: { close: () => void }) => {
					close();
					logout();
				}
			},
			onNegative: { label: 'Batal', icon: 'close' }
		});
	}

	/**
	 * Return an excerpt of `text` limited to `limit` characters.
	 * If text is shorter than or equal to limit, return it unchanged.
	 */
	function excerpt(text: string | null | undefined, limit = 16) {
		if (!text) return text;
		return text.length > limit ? text.slice(0, limit) + '…' : text;
	}

	async function getHelpPage(fileName: string) {
		const page = await import(`../../docs/help/${fileName}.md`);
		return {
			meta: page.metadata as { title: string },
			ContentPage: page.default as Component
		};
	}

	let loadingFav = $state(true);

	onMount(async () => {
		loadingFav = true;
		const ssrFavorites = page.data.favorites;
		if (Array.isArray(ssrFavorites) && ssrFavorites.length > 0) {
			favoritesStore.items = ssrFavorites;
			loadingFav = false;
			return;
		}
		try {
			const res = await fetch('/api/favorites');
			if (res.ok) {
				const data = await res.json();
				favoritesStore.items = data.favorites;
			}
		} catch {
			// ignore
		} finally {
			loadingFav = false;
		}
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

			<!-- Dropdown ganti kelas -->
			<li class="ml-2">
				<div class="dropdown dropdown-end">
					<div
						tabindex="0"
						role="button"
						title="Ganti kelas"
						class="btn rounded-full shadow-none bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-base-200 dark:text-emerald-200 dark:border-emerald-800"
					>
						<span class="hidden sm:block font-bold">{excerpt(kelasAktifLabel, 16)}</span>
						<Icon name="users" class="sm:hidden text-emerald-600" />
						<Icon name="select" class="hidden sm:block text-emerald-600" />
					</div>
					<ul
						class="border-base-300 menu dropdown-content bg-base-100 ring-opacity-5 z-1 mt-5 mr-1 w-72 origin-top-right rounded-xl border p-4 shadow-xl focus:outline-none"
					>
						<!-- alert akun admin -->
						{#if user?.type === 'admin'}
							<div role="alert" class="alert alert-info mb-4">
								<Icon name="info" />
								<span>Masuk sebagai <strong>Admin</strong></span>
							</div>
						{:else if user?.type === 'kepala_sekolah'}
							<div role="alert" class="alert alert-info mb-4">
								<Icon name="info" />
								<span>
									<strong>{displayUserName}</strong> - Kepala Sekolah
								</span>
							</div>
						{:else if user?.type === 'user' || user?.type === 'wali_kelas'}
							<div role="alert" class="alert alert-info mb-4">
								<Icon name="info" />
								<span>
									<strong>{displayUserName}</strong> - {!isNonOwnClass &&
									(user as UserLike)?.ownKelasIds?.length
										? `Wali Kelas ${kelasAktif?.nama ?? ''}`
										: 'Guru'}
								</span>
							</div>
						{/if}

						<div class="flex items-center gap-4">
							<div
								class="bg-base-300 dark:bg-base-200 flex h-14 w-14 items-center justify-center rounded-full"
							>
								<Icon name="user" class="text-4xl" />
							</div>
							<div class="flex flex-col gap-1">
								<!-- Nama wali kelas -->
								<p class="text-base-content text-sm font-semibold">
									{kelasAktif?.waliKelas?.nama ?? 'Belum ada wali kelas'}
								</p>
								<!-- Nama kelas -->
								<p class="text-base-content/70 text-xs">{kelasAktifLabel}</p>
							</div>
						</div>

						{#if daftarKelas.length}
							<details
								class="bg-base-300 dark:bg-base-200 collapse-plus collapse mt-6 rounded-b-none"
							>
								<!-- opsi pindah kelas -->
								<summary class="collapse-title font-semibold">Pindah Kelas</summary>
								<div
									class="border-base-100 flex max-h-[30vh] flex-col overflow-y-auto border-t-3 p-1"
								>
									{#if bolehSemuaKelas}
										<a
											class="btn btn-ghost btn-sm justify-start text-left shadow-none"
											href={buildSemuaKelasHref()}
											class:active={!kelasAktif}
										>
											<Icon name="layers" />
											Semua Kelas (keluar kelas)
										</a>
									{/if}
									{#each daftarKelas as kelas (kelas.id)}
										{@const label = kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama}
										<a
											class="btn btn-ghost btn-sm justify-start text-left shadow-none"
											href={buildKelasHref(kelas.id)}
											onclick={handleKelasClick}
											class:active={kelasAktif?.id === kelas.id}
										>
											{label}
										</a>
									{/each}
								</div>
							</details>
						{:else}
							<p class="text-base-content/70 mt-6 text-sm">
								Belum ada data kelas yang dapat dipilih.
							</p>
						{/if}

						{#if canSwitchUser}
							<li class="mt-1">
								<button
									type="button"
									class="btn btn-sm btn-soft btn-primary rounded-none shadow-none justify-start"
									onclick={() => (showSwitchModal = true)}
								>
									<Icon name="repeat" />
									Switch Akun (Beralih User)
								</button>
							</li>
						{/if}

						<li class="mt-1">
							<a class="btn btn-sm rounded-none shadow-none" href="/tentang">
								<Icon name="info" />
								Tentang Aplikasi
							</a>
						</li>
						{#if user}{/if}
						<li class="mt-1 flex flex-row">
							<button
								class="btn btn-sm hover:btn-warning flex-1 rounded-tl-none rounded-r-none rounded-bl-lg shadow-none"
								type="button"
								title="Keluar dari aplikasi"
								onclick={logout}
								disabled={loggingOut}
							>
								<Icon name="export" />
								{loggingOut ? 'Keluar…' : 'Keluar'}
							</button>
							<button
								class="btn btn-sm hover:btn-error flex-1 rounded-l-none rounded-tr-none rounded-br-lg shadow-none"
								type="button"
								onclick={stopServer}
								disabled={stoppingServer || !canStopServer}
							>
								<Icon name="power" />
								{stoppingServer ? 'Menghentikan server…' : 'Stop Server'}
							</button>
						</li>
					</ul>
				</div>
			</li>
		</ul>
	</div>
</div>

<!-- Tempel instance modal di bawah navbar dan bind ref -->
<TasksModal bind:this={tasksModalRef} />
<SwitchUserModal bind:open={showSwitchModal} currentUserId={user?.id} />
