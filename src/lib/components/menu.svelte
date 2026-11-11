<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { cookieNames, searchQueryMarker } from '$lib/utils';
	import Icon from './icon.svelte';
	import { appMenuItems, menuModulGuru, menuModulWaliKelas } from './menu';
	import {
		isAdminUser,
		isAuthorizedUser,
		resolveRoutePermission,
		WALI_KELAS_ONLY_PERMISSIONS
	} from '../../routes/pengguna/permissions';

	/**
	 * Status buka tiap kelompok submenu (diisi oleh pengguna, tidak dipaksa
	 * terbuka). Tanpa ini, setiap render ulang menu membuka semua submenu.
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
		(page.data as { activeModul?: 'admin' | 'wali_kelas' | 'guru' } | null)?.activeModul ?? 'guru'
	);
	const canAccessAdmin = $derived(
		(page.data as { canAccessAdmin?: boolean } | null)?.canAccessAdmin ?? false
	);
	const canAccessWaliKelas = $derived(
		(page.data as { canAccessWaliKelas?: boolean } | null)?.canAccessWaliKelas ?? false
	);
	const activeSemesterNama = $derived(
		(page.data as { activeSemesterNama?: string | null } | null)?.activeSemesterNama ?? null
	);

	let currentModul = $derived(serverActiveModul);
	let selectedModul = $state<'admin' | 'wali_kelas' | 'guru' | null>(null);
	let isSwitchingModul = $state(false);
	const activeDisplayModul = $derived(selectedModul ?? currentModul);

	async function switchModul(modul: 'admin' | 'wali_kelas' | 'guru') {
		if (isSwitchingModul) return;
		isSwitchingModul = true;
		selectedModul = modul;
		try {
			document.cookie = `${cookieNames.ACTIVE_MODUL}=${modul}; path=/; max-age=31536000; SameSite=Lax`;
			if (modul === 'admin') {
				document.cookie = `${cookieNames.ACTIVE_KELAS_ID}=semua; path=/; max-age=31536000; SameSite=Lax`;
			} else {
				// Hapus active-kelas-id lama agar server otomatis memilih kelas yang tepat untuk modul baru
				document.cookie = `${cookieNames.ACTIVE_KELAS_ID}=; path=/; max-age=0; SameSite=Lax`;
			}

			// Bila user sedang berada di halaman yang khusus untuk modul tertentu,
			// arahkan ke Beranda (/) agar tidak memuat ulang halaman lama yang tidak relevan / lambat
			const pathname = window.location.pathname;
			const isWaliOnly = ['/murid', '/catatan-wali-kelas', '/keputusan', '/cetak/rapor'].some((p) =>
				pathname.startsWith(p)
			);
			const isAdminOnly = ['/master-data', '/semua-kelas', '/pengaturan', '/pengguna'].some((p) =>
				pathname.startsWith(p)
			);

			if (
				(modul === 'guru' && (isWaliOnly || isAdminOnly)) ||
				(modul === 'wali_kelas' && isAdminOnly)
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
		// Menu items without a path (parent groups) are filtered recursively via subMenu
		if (!path) return false;
		const kelasOperis = isAdminUser(user ?? undefined);
		// Presensi Guru hanya untuk pemegang izin `administrasi_presensi_guru`
		// (sama dengan guard halaman, B8) dan bila fiturnya diaktifkan sekolah.
		if (path === '/presensi-guru') {
			if (!presensiGuruEnabled) return true;
			if (!kelasOperis && !(user?.permissions ?? []).includes('administrasi_presensi_guru')) {
				return true;
			}
		}
		// /dinas-luar is the permohonan feature for non-admin roles; admin & kepala
		// sekolah manage perjalanan dinas via the full /sppd page instead.
		if (path === '/dinas-luar' && user && kelasOperis) {
			return true;
		}
		// Tanda tangan: admin/kepala sekolah mengunggah untuk semua orang, wali kelas
		// hanya untuk tanda tangannya sendiri.
		if (path === '/tanda-tangan') {
			return !kelasOperis && user?.type !== 'wali_kelas';
		}
		// Guru on non-own class: sembunyikan menu khusus wali kelas
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

	const baseMenuItems = $derived.by(() => {
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

		// match to sub paths
		const normalizedPath = currentPath.replace(/\/+$/, '');
		const normalizedItemPath = menuPath.replace(/\/+$/, '');
		// Beranda ("/") hanya aktif di halaman beranda. Tanpa ini, path kosong
		// membuat semua halaman dianggap turunan "/" sehingga Beranda selalu aktif.
		if (normalizedItemPath === '') return normalizedPath === '';
		// Item yang lebih spesifik menang: jika ada sibling dengan path yang cocok persis,
		// path induk yang lebih pendek tidak boleh ikut ditandai aktif.
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
			{@const groupKey = item.path ?? item.title}
			{@const groupPaths = item.subMenu.map((entry) => entry.path ?? '')}
			{@const groupActive = item.subMenu.some((entry) =>
				isMenuActive(page.url.pathname, entry.path, groupPaths)
			)}
			{@const isOpen = search ? true : bukaSemua ? true : (terbuka[groupKey] ?? groupActive)}
			<details
				open={isOpen}
				ontoggle={(event) => {
					if (search) return;
					bukaSemua = false;
					terbuka[groupKey] = (event.currentTarget as HTMLDetailsElement).open;
				}}
			>
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
	<!-- Selector Modul Guru / Modul Wali-Kelas / Mode Admin -->
	<div class="mb-3 flex shrink-0 flex-col gap-1.5">
		<div class="relative flex items-center">
			<select
				class="select select-sm w-full rounded-xl bg-[#053d2e] border border-[#065f46] text-white font-bold text-xs focus:border-emerald-400 focus:outline-none pr-8 {isSwitchingModul
					? 'opacity-70 cursor-wait'
					: ''}"
				value={activeDisplayModul}
				disabled={isSwitchingModul}
				onchange={(e) => switchModul(e.currentTarget.value as 'admin' | 'wali_kelas' | 'guru')}
			>
				{#if canAccessAdmin}
					<option value="admin">Mode Admin / Operator</option>
				{/if}
				{#if canAccessWaliKelas}
					<option value="wali_kelas">Modul Wali-Kelas</option>
				{/if}
				<option value="guru">Modul Guru</option>
			</select>
			{#if isSwitchingModul}
				<div class="absolute right-2.5 pointer-events-none flex items-center">
					<span class="loading loading-spinner loading-xs text-emerald-300"></span>
				</div>
			{/if}
		</div>

		{#if activeSemesterNama}
			<div
				class="px-2.5 py-1 text-[11px] font-medium text-emerald-200/90 bg-[#042f23] rounded-lg border border-[#065f46]/60 truncate flex items-center gap-1.5"
				title={activeSemesterNama}
			>
				<Icon name="calendar" />
				<span class="truncate">{activeSemesterNama}</span>
			</div>
		{/if}
	</div>

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
			title={bukaSemua ? 'Tutup semua submenu' : 'Buka semua submenu'}
		>
			<input type="checkbox" bind:checked={bukaSemua} />
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
