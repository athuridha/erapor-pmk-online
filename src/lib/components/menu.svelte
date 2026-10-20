<script lang="ts">
	import { page } from '$app/state';
	import { StorageState } from '$lib/state.svelte';
	import { searchQueryMarker } from '$lib/utils';
	import Icon from './icon.svelte';
	import { appMenuItems } from './menu';
	import {
		isAuthorizedUser,
		resolveRoutePermission,
		WALI_KELAS_ONLY_PERMISSIONS
	} from '../../routes/pengguna/permissions';

	const expanded = new StorageState<boolean>('menu-expanded');

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

	function isHiddenForUser(path?: string): boolean {
		// Menu items without a path (parent groups) are filtered recursively via subMenu
		if (!path) return false;
		if (path === '/presensi-guru' && !presensiGuruEnabled) return true;
		// /dinas-luar is the permohonan feature for non-admin roles; admin & kepala
		// sekolah manage perjalanan dinas via the full /sppd page instead.
		if (
			path === '/dinas-luar' &&
			user &&
			(user.type === 'admin' || user.type === 'kepala_sekolah')
		) {
			return true;
		}
		// Tanda tangan: admin/kepala sekolah mengunggah untuk semua orang, wali kelas
		// hanya untuk tanda tangannya sendiri.
		if (path === '/tanda-tangan') {
			const type = user?.type;
			return type !== 'admin' && type !== 'kepala_sekolah' && type !== 'wali_kelas';
		}
		// Guru on non-own class: sembunyikan menu khusus wali kelas
		if (user && user.type !== 'admin' && user.type !== 'kepala_sekolah' && kelasAktif?.id != null) {
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
					// Reuse the original item reference when nothing changed so the
					// keyed {#each} doesn't recreate <details> (preserves manual open/close).
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
					// Reuse the original item reference when nothing changed so the
					// keyed {#each} doesn't recreate <details> (preserves manual open/close).
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

	function filterMenu(menu: MenuItem[], search: string): MenuItem[] {
		const lowerSearch = search.toLowerCase();
		return menu
			.map((item) => {
				if (!filterByCondition(item, activeSemesterTipe)) return null;

				const isMatch =
					item.title.toLowerCase().includes(lowerSearch) ||
					item.tags?.some((t) => t.toLocaleLowerCase().includes(lowerSearch));

				// if it has subMenu, filter recursively
				const filteredSubMenu = item.subMenu ? filterMenu(item.subMenu, search) : [];

				// keep this item if it matches or has matching children
				if (isMatch || filteredSubMenu.length > 0) {
					return {
						...item,
						subMenu: filteredSubMenu.length > 0 ? filteredSubMenu : undefined
					};
				}

				// discard
				return null;
			})
			.filter((item) => item !== null);
	}

	let menuItems = $derived(
		filterMenuByUserType(
			search
				? filterMenu(appMenuItems, search)
				: filterMenuByCondition(appMenuItems, activeSemesterTipe)
		)
	);

	function isMenuActive(currentPath: string, menuPath?: string, siblingPaths: string[] = []) {
		if (!menuPath) return false;

		// match to sub paths
		const normalizedPath = currentPath.replace(/\/+$/, '');
		const normalizedItemPath = menuPath.replace(/\/+$/, '');
		// Beranda ("/") hanya aktif di halaman beranda. Tanpa ini, path kosong
		// membuat semua halaman dianggap turunan "/" sehingga Beranda selalu aktif.
		if (normalizedItemPath === '') return normalizedPath === '';
		// Item yang lebih spesifik menang: di /sinkronisasi/import-data, menu
		// "Database Pusat" (/sinkronisasi) tidak boleh ikut ditandai aktif.
		const adaYangLebihSpesifik = siblingPaths.some((path) => {
			if (!path) return false;
			const normalizedSibling = path.replace(/\/+$/, '');
			return normalizedSibling !== normalizedItemPath && normalizedPath === normalizedSibling;
		});
		if (adaYangLebihSpesifik) return false;

		const active =
			normalizedPath === normalizedItemPath || normalizedPath.startsWith(normalizedItemPath + '/');
		return active;
	}
</script>

{#snippet menu_item(item: MenuItem, siblingPaths: string[] = [])}
	{@const active = isMenuActive(page.url.pathname, item.path, siblingPaths)}
	<li>
		{#if item.subMenu}
			<details open={expanded.value || !!search}>
				<summary>
					{@render menu_item_label(item)}
				</summary>
				<ul>
					{#each item.subMenu as menu (menu.path ?? menu.title)}
						{@render menu_item(
							menu,
							item.subMenu.map((entry) => entry.path ?? '')
						)}
					{/each}
				</ul>
			</details>
		{:else}
			<!-- `class:menu-active` is shorthand for `class="{active ? 'menu-active': ''}"` -->
			<a class:menu-active={active} href={item.path}>
				{@render menu_item_label(item)}
			</a>
		{/if}
	</li>
{/snippet}

{#snippet menu_item_label(item: MenuItem)}
	{#if item.icon}
		<Icon name={item.icon} />
	{/if}
	<span>{@html searchQueryMarker(search, item.title)}</span>
	{#if search && item.tags?.length}
		<div class="badge badge-xs badge-accent" title="Termasuk di dalam menu">tag</div>
	{/if}
{/snippet}

<div class="flex min-h-0 min-w-0 flex-1 flex-col">
	<div class="mb-3 flex shrink-0 gap-1">
		<label
			class="input bg-[#053d2e] border border-[#065f46] text-white rounded-xl flex items-center gap-2 grow px-3 py-1.5 focus-within:border-emerald-400"
		>
			<Icon name="search" class="text-emerald-300" />
			<input
				type="search"
				class="grow bg-transparent text-xs text-white placeholder:text-emerald-300/60 focus:outline-none"
				bind:value={search}
				placeholder="Cari menu"
			/>
		</label>
		<label
			class="btn swap btn-square rounded-xl bg-[#053d2e] border border-[#065f46] text-emerald-200 hover:text-white hover:bg-[#075e46] shadow-none"
			title={expanded.value ? 'Sempitkan menu' : 'Luaskan menu'}
		>
			<input type="checkbox" bind:checked={expanded.value} />
			<span class="swap-on"><Icon name="expand-all" /></span>
			<span class="swap-off"><Icon name="collapse-all" /></span>
		</label>
	</div>
	<div class="sidebar-menu-scroll min-h-0 flex-1 overflow-y-auto rounded-xl space-y-0.5 pr-0.5">
		<ul class="menu w-full p-0 text-emerald-100 font-medium text-xs space-y-0.5">
			{#each menuItems as menu (menu.path ?? menu.title)}
				{@render menu_item(menu)}
			{:else}
				<li>
					<span class="italic text-emerald-300/60 text-xs"> Tidak ada hasil pencarian </span>
				</li>
			{/each}
		</ul>
	</div>
</div>
