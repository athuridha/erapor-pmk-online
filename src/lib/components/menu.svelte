<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { cookieNames, searchQueryMarker } from '$lib/utils';
	import Icon from './icon.svelte';
	import { appMenuItems, menuModulGuru, menuModulPembinaEskul, menuModulWaliKelas } from './menu';
	import {
		isAdminUser,
		isAuthorizedUser,
		resolveRoutePermission,
		WALI_KELAS_ONLY_PERMISSIONS
	} from '../../routes/pengguna/permissions';

	/**
	 * Track open/closed state per submenu group manually so filtering or
	 * navigation updates never force every accordion open unexpectedly.
	 */
	let terbuka = $state<Record<string, boolean>>({});
	let bukaSemua = $state(false);

	let search = $state('');
	const activeSemesterTipe = $derived(
		(page.data as { activeSemesterTipe?: string | null } | null)?.activeSemesterTipe ?? null
	);

	const user = $derived(
		(
			page.data as {
				user?:
					| (Pick<AuthUser, 'permissions' | 'type'> & {
							kelasId?: number | null;
							ownKelasIds?: number[] | null;
					  })
					| null;
			} | null
		)?.user ?? null
	);

	const presensiGuruEnabled = $derived(
		(page.data as { presensiGuruEnabled?: boolean } | null)?.presensiGuruEnabled ?? true
	);

	const kelasAktif = $derived(
		(page.data as { kelasAktif?: { id: number } | null } | null)?.kelasAktif ?? null
	);

	const serverActiveModul = $derived(
		(
			page.data as {
				activeModul?: 'admin' | 'wali_kelas' | 'guru' | 'pembina_eskul';
			} | null
		)?.activeModul ?? 'guru'
	);
	const canAccessAdmin = $derived(
		(page.data as { canAccessAdmin?: boolean } | null)?.canAccessAdmin ?? false
	);
	const canAccessWaliKelas = $derived(
		(page.data as { canAccessWaliKelas?: boolean } | null)?.canAccessWaliKelas ?? false
	);
	const hasMultipleModules = $derived(canAccessAdmin || canAccessWaliKelas);

	let currentModul = $derived(serverActiveModul);
	let selectedModul = $state<'admin' | 'wali_kelas' | 'guru' | 'pembina_eskul' | null>(null);
	let isSwitchingModul = $state(false);
	const activeDisplayModul = $derived(selectedModul ?? currentModul);

	async function switchModul(modul: 'admin' | 'wali_kelas' | 'guru') {
		if (isSwitchingModul) return;
		isSwitchingModul = true;
		selectedModul = modul;
		try {
			const res = await fetch('/api/modul', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ modul })
			});
			if (!res.ok) {
				document.cookie = `${cookieNames.ACTIVE_MODUL}=${modul}; path=/; max-age=31536000; SameSite=Lax`;
			}

			const pathname = window.location.pathname;
			const isMatchPrefix = (prefixes: string[]) =>
				prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));

			const isAdminOnly = isMatchPrefix([
				'/master-data',
				'/semua-kelas',
				'/pengaturan',
				'/pengguna',
				'/sekolah',
				'/akademik',
				'/kelas',
				'/import-data',
				'/impor',
				'/portal-orang-tua',
				'/buku-tamu',
				'/sppd',
				'/kunci-nilai',
				'/audit',
				'/cetak/kustomisasi'
			]);
			const isWaliOnly = isMatchPrefix([
				'/murid',
				'/catatan-wali-kelas',
				'/keputusan',
				'/legger',
				'/tanda-tangan',
				'/p5',
				'/prakerin',
				'/kokurikuler',
				'/asesmen-kokurikuler',
				'/ekstrakurikuler',
				'/nilai-ekstrakurikuler',
				'/cetak/rapor',
				'/cetak/cover',
				'/cetak/biodata',
				'/cetak/piagam'
			]);
			const isGuruFocusedOnly = isMatchPrefix([
				'/asesmen-formatif',
				'/asesmen-sumatif',
				'/teknik-penilaian',
				'/jurnal-mengajar',
				'/rpm'
			]);

			if (
				(modul === 'guru' && (isWaliOnly || isAdminOnly)) ||
				(modul === 'wali_kelas' && (isAdminOnly || isGuruFocusedOnly))
			) {
				await goto('/', { invalidateAll: true });
			} else {
				await invalidateAll();
			}
		} finally {
			isSwitchingModul = false;
			selectedModul = null;
		}
	}

	function isHiddenForUser(path?: string): boolean {
		if (!path) return false;
		const kelasOperis = isAdminUser(user ?? undefined);
		if (path === '/presensi-guru') {
			if (!presensiGuruEnabled) return true;
			if (!kelasOperis && !(user?.permissions ?? []).includes('administrasi_presensi_guru')) {
				return true;
			}
		}
		if (path === '/dinas-luar' && user && kelasOperis) {
			return true;
		}
		if (path === '/tanda-tangan') {
			return !kelasOperis && user?.type !== 'wali_kelas' && !canAccessWaliKelas;
		}
		if (user && !kelasOperis && kelasAktif?.id != null) {
			const ownIds = user.ownKelasIds?.length
				? user.ownKelasIds
				: user.kelasId != null
					? [user.kelasId]
					: [];
			if (!ownIds.includes(kelasAktif.id)) {
				const required = resolveRoutePermission(path);
				if (required && WALI_KELAS_ONLY_PERMISSIONS.has(required)) {
					return true;
				}
			}
		}
		const required = resolveRoutePermission(path);
		if (!required) return false;
		return !isAuthorizedUser([required], user ?? undefined);
	}

	function filterMenuByUserType(items: MenuItem[]): MenuItem[] {
		return items
			.map((item) => {
				if (isHiddenForUser(item.path)) return null;
				if (item.subMenu) {
					const subMenu = item.subMenu;
					const filtered = filterMenuByUserType(subMenu);
					if (filtered.length === 0 && !item.path) return null;
					if (
						filtered.length === subMenu.length &&
						filtered.every((child, i) => child === subMenu[i])
					) {
						return item;
					}
					return { ...item, subMenu: filtered };
				}
				return item;
			})
			.filter((item): item is MenuItem => item !== null);
	}

	function filterByCondition(item: MenuItem, semesterTipe: string | null): boolean {
		if (item.condition && item.condition !== semesterTipe) return false;
		if (item.subMenu) {
			const hasVisibleChild = item.subMenu.some((child) => filterByCondition(child, semesterTipe));
			if (!hasVisibleChild) return false;
		}
		return true;
	}

	function filterMenuByCondition(items: MenuItem[], semesterTipe: string | null): MenuItem[] {
		return items
			.map((item) => {
				if (item.condition && item.condition !== semesterTipe) return null;
				if (item.subMenu) {
					const subMenu = item.subMenu;
					const filtered = filterMenuByCondition(subMenu, semesterTipe);
					if (filtered.length === 0) return null;
					if (
						filtered.length === subMenu.length &&
						filtered.every((child, i) => child === subMenu[i])
					) {
						return item;
					}
					return { ...item, subMenu: filtered };
				}
				return item;
			})
			.filter((item): item is MenuItem => item !== null);
	}

	function filterMenu(menu: MenuItem[], searchQuery: string): MenuItem[] {
		const lowerSearch = searchQuery.toLowerCase();
		return menu
			.map((item) => {
				if (!filterByCondition(item, activeSemesterTipe)) return null;

				const isMatch =
					item.title.toLowerCase().includes(lowerSearch) ||
					item.tags?.some((t) => t.toLocaleLowerCase().includes(lowerSearch));

				const filteredSubMenu = item.subMenu ? filterMenu(item.subMenu, searchQuery) : [];

				if (isMatch || filteredSubMenu.length > 0) {
					return {
						...item,
						subMenu: filteredSubMenu.length > 0 ? filteredSubMenu : undefined
					};
				}

				return null;
			})
			.filter((item) => item !== null);
	}

	const baseMenuItems = $derived.by(() => {
		if (currentModul === 'pembina_eskul') return menuModulPembinaEskul;
		if (currentModul === 'guru') return menuModulGuru;
		if (currentModul === 'wali_kelas') return menuModulWaliKelas;
		return appMenuItems;
	});

	let menuItems = $derived(
		filterMenuByUserType(
			search
				? filterMenu(baseMenuItems, search)
				: filterMenuByCondition(baseMenuItems, activeSemesterTipe)
		)
	);

	function isMenuActive(currentPath: string, menuPath?: string, siblingPaths: string[] = []) {
		if (!menuPath) return false;

		const normalizedPath = currentPath.replace(/\/+$/, '');
		const normalizedItemPath = menuPath.replace(/\/+$/, '');
		if (normalizedItemPath === '') return normalizedPath === '';

		const adaYangLebihSpesifik = siblingPaths.some((path) => {
			if (!path) return false;
			const normalizedSibling = path.replace(/\/+$/, '');
			return normalizedSibling !== normalizedItemPath && normalizedPath === normalizedSibling;
		});
		if (adaYangLebihSpesifik) return false;

		return (
			normalizedPath === normalizedItemPath || normalizedPath.startsWith(normalizedItemPath + '/')
		);
	}
</script>

{#snippet menu_item(item: MenuItem, siblingPaths: string[] = [])}
	{@const active = isMenuActive(page.url.pathname, item.path, siblingPaths)}
	<li>
		{#if item.subMenu}
			{@const groupKey = item.path ?? item.title}
			{@const groupPaths = item.subMenu.map((entry) => entry.path ?? '')}
			{@const groupActive = item.subMenu.some((entry) =>
				isMenuActive(page.url.pathname, entry.path, groupPaths)
			)}
			{@const isOpen = search ? true : bukaSemua ? true : (terbuka[groupKey] ?? groupActive)}
			<details
				class="group/nav"
				open={isOpen}
				ontoggle={(event) => {
					if (search) return;
					bukaSemua = false;
					terbuka[groupKey] = (event.currentTarget as HTMLDetailsElement).open;
				}}
			>
				<summary
					class="flex list-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium lg:py-2 lg:text-[13px] text-slate-600 transition-colors select-none hover:bg-slate-100/80 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 [&::-webkit-details-marker]:hidden"
				>
					<span class="flex min-w-0 items-center gap-2.5">
						{#if item.icon}
							<span
								aria-hidden="true"
								class="flex shrink-0 items-center text-slate-400 dark:text-zinc-400"
							>
								<Icon name={item.icon} class="h-4 w-4" />
							</span>
						{/if}
						<span class="truncate">{@html searchQueryMarker(search, item.title)}</span>
					</span>
					<span
						aria-hidden="true"
						class="shrink-0 text-slate-400 transition-transform duration-150 group-open/nav:rotate-90 dark:text-zinc-400"
					>
						<Icon name="right" class="h-3.5 w-3.5" />
					</span>
				</summary>
				<ul
					class="mt-0.5 ml-4 space-y-0.5 border-l border-slate-200/80 pl-2.5 dark:border-zinc-800"
				>
					{#each item.subMenu as menu (menu.path ?? menu.title)}
						{@render menu_item(
							menu,
							item.subMenu.map((entry) => entry.path ?? '')
						)}
					{/each}
				</ul>
			</details>
		{:else}
			<a
				href={item.path}
				aria-current={active ? 'page' : undefined}
				class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors lg:py-2 lg:text-[13px] {active
					? 'bg-[#ebf3fe] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
					: 'font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}"
			>
				{#if item.icon}
					<span
						aria-hidden="true"
						class="flex shrink-0 items-center {active
							? 'text-blue-600 dark:text-blue-400'
							: 'text-slate-400 dark:text-zinc-400'}"
					>
						<Icon name={item.icon} class="h-4 w-4" />
					</span>
				{/if}
				<span class="truncate">{@html searchQueryMarker(search, item.title)}</span>
			</a>
		{/if}
	</li>
{/snippet}

<div class="flex min-h-0 min-w-0 flex-1 flex-col">
	{#if hasMultipleModules}
		<div class="mb-2 shrink-0">
			<label for="sidebar-modul-select" class="sr-only">Pilih modul kerja</label>
			<div class="relative flex items-center">
				<select
					id="sidebar-modul-select"
					class="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/90 pr-8 pl-3 text-sm font-semibold lg:h-8.5 lg:text-xs text-slate-800 transition-colors hover:bg-slate-100 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80 dark:focus:border-blue-400 {isSwitchingModul
						? 'cursor-wait opacity-70'
						: ''}"
					value={activeDisplayModul}
					disabled={isSwitchingModul}
					onchange={(e) => switchModul(e.currentTarget.value as 'admin' | 'wali_kelas' | 'guru')}
				>
					{#if canAccessAdmin}
						<option value="admin">Mode Admin / Operator</option>
					{/if}
					{#if canAccessWaliKelas}
						<option value="wali_kelas">Modul Wali Kelas</option>
					{/if}
					<option value="guru">Modul Guru</option>
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					{#if isSwitchingModul}
						<span
							class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"
						></span>
					{:else}
						<Icon name="down" class="h-3.5 w-3.5" />
					{/if}
				</span>
			</div>
		</div>
	{/if}

	<div class="mb-2.5 flex shrink-0 items-center gap-1.5">
		<div
			class="flex h-10 grow items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 lg:h-8.5 transition-colors focus-within:border-blue-600 focus-within:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-blue-400 dark:focus-within:bg-zinc-900"
		>
			<label for="sidebar-menu-search" class="sr-only">Cari menu</label>
			<span aria-hidden="true" class="flex shrink-0 items-center text-slate-400 dark:text-zinc-400">
				<Icon name="search" class="h-3.5 w-3.5" />
			</span>
			<input
				id="sidebar-menu-search"
				type="search"
				class="min-w-0 grow bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
				bind:value={search}
				placeholder="Cari menu..."
			/>
		</div>
		<button
			type="button"
			onclick={() => (bukaSemua = !bukaSemua)}
			aria-pressed={bukaSemua}
			title={bukaSemua ? 'Tutup semua kelompok menu' : 'Buka semua kelompok menu'}
			aria-label={bukaSemua ? 'Tutup semua kelompok menu' : 'Buka semua kelompok menu'}
			class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white lg:h-8.5 lg:w-8.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
		>
			<span aria-hidden="true">
				<Icon name={bukaSemua ? 'expand-all' : 'collapse-all'} class="h-4 w-4" />
			</span>
		</button>
	</div>

	<nav aria-label="Menu utama" class="sidebar-menu-scroll min-h-0 flex-1 overflow-y-auto pr-0.5">
		<ul class="w-full space-y-0.5">
			{#each menuItems as menu (menu.path ?? menu.title)}
				{@render menu_item(menu)}
			{:else}
				<li class="px-2 py-5 text-center">
					<p class="text-xs text-slate-600 dark:text-zinc-400">
						Menu "{search}" tidak ditemukan.
					</p>
					{#if search}
						<button
							type="button"
							class="mt-2 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
							onclick={() => (search = '')}
						>
							Reset pencarian
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>
</div>
