<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { cookieNames, searchQueryMarker } from '$lib/utils';
	import Icon from './icon.svelte';
	import { appMenuItems, menuModulGuru, menuModulPembinaEskul, menuModulWaliKelas } from './menu';
	import { tick } from 'svelte';

	let { collapsed = false }: { collapsed?: boolean } = $props();
	let openKey = $state<string | null>(null);
	let railSearch = $state('');
	let modulDropdownOpen = $state(false);
	let modulMenuFocusIdx = $state(-1);

	const modulOptions = $derived.by(() => {
		const list: Array<{
			value: 'admin' | 'wali_kelas' | 'guru';
			label: string;
			desc: string;
			icon: 'layers' | 'users' | 'book-open';
		}> = [];
		if (canAccessAdmin) {
			list.push({
				value: 'admin',
				label: 'Mode Admin / Operator',
				desc: 'Kelola sistem & semua kelas',
				icon: 'layers'
			});
		}
		if (canAccessWaliKelas) {
			list.push({
				value: 'wali_kelas',
				label: 'Modul Wali Kelas',
				desc: 'Kelola kelas perwalian',
				icon: 'users'
			});
		}
		list.push({
			value: 'guru',
			label: 'Modul Guru',
			desc: 'Input nilai & mata pelajaran',
			icon: 'book-open'
		});
		return list;
	});

	const activeModulOption = $derived(
		modulOptions.find((m) => m.value === activeDisplayModul) ?? modulOptions[0]
	);

	async function toggleRailSearch() {
		if (openKey === '__search') {
			openKey = null;
			return;
		}
		openKey = '__search';
		await tick();
		const input = document.getElementById('sidebar-rail-search') as HTMLInputElement | null;
		input?.focus();
		input?.select();
	}

	$effect(() => {
		if (openKey !== '__search' && railSearch) {
			railSearch = '';
		}
	});

	function pilihModul(modul: 'admin' | 'wali_kelas' | 'guru') {
		openKey = null;
		modulDropdownOpen = false;
		void switchModul(modul);
	}

	async function openModulMenuWithFocus(idx: number) {
		if (isSwitchingModul || modulOptions.length === 0) return;
		const bounded = ((idx % modulOptions.length) + modulOptions.length) % modulOptions.length;
		modulDropdownOpen = true;
		modulMenuFocusIdx = bounded;
		await tick();
		document.getElementById(`sidebar-modul-opt-${bounded}`)?.focus();
	}

	function handleModulTriggerKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const activeIdx = modulOptions.findIndex((m) => m.value === activeDisplayModul);
			const startIdx =
				activeIdx >= 0 ? activeIdx : event.key === 'ArrowUp' ? modulOptions.length - 1 : 0;
			void openModulMenuWithFocus(startIdx);
		}
	}

	async function handleModulOptionKeydown(event: KeyboardEvent, idx: number) {
		const total = modulOptions.length;
		if (total === 0) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			const next = (idx + 1) % total;
			modulMenuFocusIdx = next;
			document.getElementById(`sidebar-modul-opt-${next}`)?.focus();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			const prev = (idx - 1 + total) % total;
			modulMenuFocusIdx = prev;
			document.getElementById(`sidebar-modul-opt-${prev}`)?.focus();
		} else if (event.key === 'Home') {
			event.preventDefault();
			modulMenuFocusIdx = 0;
			document.getElementById('sidebar-modul-opt-0')?.focus();
		} else if (event.key === 'End') {
			event.preventDefault();
			modulMenuFocusIdx = total - 1;
			document.getElementById(`sidebar-modul-opt-${total - 1}`)?.focus();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			modulDropdownOpen = false;
			await tick();
			document.getElementById('sidebar-modul-select')?.focus();
		}
	}

	$effect(() => {
		if (collapsed) {
			modulDropdownOpen = false;
		} else {
			openKey = null;
		}
	});

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
	function toggleSemua() {
		const next = !semuaTerbuka;
		terbuka = Object.fromEntries(grupKeys.map((key) => [key, next]));
	}

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

			// Murid dipakai modul guru & wali, jadi jangan dianggap admin-only.
			const diMurid = isMatchPrefix(['/master-data/murid']);
			const isAdminOnly =
				!diMurid &&
				isMatchPrefix([
					'/master-data/kelas',
					'/pengaturan',
					'/pengguna',
					'/sekolah',
					'/akademik',
					'/master-data/pengampu',
					'/master-data/bobot',
					'/master-data/tahun_ajaran',
					'/master-data/semester',
					'/master-data/mata_pelajaran',
					'/master-data/pegawai',
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
				const params = new URLSearchParams(window.location.search);
				const hadClassParam =
					params.has('kelas_id') ||
					params.has('kelas') ||
					params.has('murid_id') ||
					params.has('mapel_id');
				if (hadClassParam) {
					params.delete('kelas_id');
					params.delete('kelas');
					params.delete('murid_id');
					params.delete('mapel_id');
					params.delete('page');
					const query = params.toString();
					await goto(`${pathname}${query ? `?${query}` : ''}`, {
						replaceState: true,
						invalidateAll: true
					});
				} else {
					await invalidateAll();
				}
			}
		} finally {
			isSwitchingModul = false;
			selectedModul = null;
		}
	}

	function isHiddenForUser(path?: string): boolean {
		if (!path) return false;
		const kelasOperis = isAdminUser(user ?? undefined);
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

	type RailSearchEntry = {
		title: string;
		path: string;
		groupTitle?: string;
		icon?: IconName;
	};

	const railSearchResults = $derived.by(() => {
		const q = railSearch.trim();
		const filtered = filterMenuByUserType(
			q ? filterMenu(baseMenuItems, q) : filterMenuByCondition(baseMenuItems, activeSemesterTipe)
		);
		const flat: RailSearchEntry[] = [];
		for (const item of filtered) {
			if (item.path) {
				flat.push({ title: item.title, path: item.path, icon: item.icon });
			}
			if (item.subMenu?.length) {
				for (const child of item.subMenu) {
					if (child.path) {
						flat.push({
							title: child.title,
							path: child.path,
							groupTitle: item.title,
							icon: item.icon
						});
					}
				}
			}
		}
		return flat;
	});

	const railSearchSiblingPaths = $derived(railSearchResults.map((item) => item.path));

	async function handleRailSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			if (railSearchResults.length > 0) {
				event.preventDefault();
				const target = railSearchResults[0].path;
				openKey = null;
				railSearch = '';
				await goto(target);
			}
		} else if (event.key === 'Escape') {
			event.preventDefault();
			openKey = null;
			await tick();
			document.getElementById('sidebar-rail-search-trigger')?.focus();
		}
	}

	const grupKeys = $derived(
		menuItems.filter((item) => item.subMenu?.length).map((item) => item.path ?? item.title)
	);
	const semuaTerbuka = $derived(
		grupKeys.length > 0 && grupKeys.every((key) => terbuka[key] === true)
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

<svelte:window
	onpointerdown={(event) => {
		const target = event.target as Element | null;
		if (!target?.closest('[data-sidebar-rail]')) openKey = null;
		if (!target?.closest('[data-modul-dropdown]')) modulDropdownOpen = false;
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape') {
			openKey = null;
			modulDropdownOpen = false;
		}
	}}
/>

{#snippet menu_item(item: MenuItem, siblingPaths: string[] = [])}
	{@const active = isMenuActive(page.url.pathname, item.path, siblingPaths)}
	<li>
		{#if item.subMenu}
			{@const groupKey = item.path ?? item.title}
			{@const groupPaths = item.subMenu.map((entry) => entry.path ?? '')}
			{@const groupActive = item.subMenu.some((entry) =>
				isMenuActive(page.url.pathname, entry.path, groupPaths)
			)}
			{@const isOpen = search ? true : (terbuka[groupKey] ?? groupActive)}
			<details
				class="group/nav"
				open={isOpen}
				ontoggle={(event) => {
					if (search) return;
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

<div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
	<div
		class="flex min-h-0 min-w-0 flex-1 flex-col transition-opacity duration-200 {collapsed
			? 'lg:pointer-events-none lg:opacity-0'
			: ''}"
	>
		{#if hasMultipleModules && activeModulOption}
			<div class="relative mb-2.5 shrink-0" data-modul-dropdown>
				<span id="sidebar-modul-label" class="sr-only">Pilih modul kerja</span>
				<button
					id="sidebar-modul-select"
					type="button"
					aria-haspopup="listbox"
					aria-labelledby="sidebar-modul-label sidebar-modul-select"
					aria-expanded={modulDropdownOpen}
					aria-controls="sidebar-modul-listbox"
					disabled={isSwitchingModul}
					onclick={() => {
						if (!modulDropdownOpen) {
							modulMenuFocusIdx = Math.max(
								0,
								modulOptions.findIndex((m) => m.value === activeDisplayModul)
							);
						}
						modulDropdownOpen = !modulDropdownOpen;
					}}
					onkeydown={handleModulTriggerKeydown}
					class="flex h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200/90 bg-slate-50/90 px-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-100/80 disabled:cursor-wait disabled:opacity-70 lg:h-10 dark:border-zinc-700/90 dark:bg-zinc-800/80 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
				>
					<span
						aria-hidden="true"
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400"
					>
						<Icon name={activeModulOption.icon} class="h-4 w-4" />
					</span>
					<span
						class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900 dark:text-zinc-100"
					>
						{activeModulOption.label}
					</span>
					<span
						aria-hidden="true"
						class="flex shrink-0 items-center text-slate-400 dark:text-zinc-400"
					>
						{#if isSwitchingModul}
							<span
								class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"
							></span>
						{:else}
							<Icon name="chevron-up-down" class="h-4 w-4" />
						{/if}
					</span>
				</button>

				{#if modulDropdownOpen}
					<div
						id="sidebar-modul-listbox"
						role="listbox"
						aria-label="Pilih modul kerja"
						class="absolute inset-x-0 top-full z-50 mt-1.5 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40 dark:ring-white/5"
					>
						<p
							class="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-400"
						>
							Pilih modul kerja
						</p>
						<div class="space-y-0.5">
							{#each modulOptions as opt, idx (opt.value)}
								{@const isSelected = opt.value === activeDisplayModul}
								<button
									id={`sidebar-modul-opt-${idx}`}
									type="button"
									role="option"
									aria-selected={isSelected}
									tabindex={idx === modulMenuFocusIdx || (modulMenuFocusIdx < 0 && isSelected)
										? 0
										: -1}
									disabled={isSwitchingModul}
									onclick={() => pilihModul(opt.value)}
									onkeydown={(e) => handleModulOptionKeydown(e, idx)}
									class="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors disabled:opacity-60 lg:min-h-10 {isSelected
										? 'bg-blue-50/90 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
										: 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
								>
									<span
										aria-hidden="true"
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg {isSelected
											? 'bg-blue-100/90 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
											: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'}"
									>
										<Icon name={opt.icon} class="h-4 w-4" />
									</span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-xs font-semibold leading-tight">
											{opt.label}
										</span>
										<span class="mt-0.5 block truncate text-[11px] font-normal opacity-75">
											{opt.desc}
										</span>
									</span>
									{#if isSelected}
										<span aria-hidden="true" class="shrink-0 text-blue-600 dark:text-blue-400">
											<Icon name="check" class="h-4 w-4" />
										</span>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<div class="mb-2.5 flex shrink-0 items-center gap-1.5">
			<div
				class="flex h-10 grow items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 lg:h-8.5 transition-colors focus-within:border-blue-600 focus-within:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-blue-400 dark:focus-within:bg-zinc-900"
			>
				<label for="sidebar-menu-search" class="sr-only">Cari menu</label>
				<span
					aria-hidden="true"
					class="flex shrink-0 items-center text-slate-400 dark:text-zinc-400"
				>
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
				onclick={toggleSemua}
				aria-pressed={semuaTerbuka}
				title={semuaTerbuka ? 'Tutup semua kelompok menu' : 'Buka semua kelompok menu'}
				aria-label={semuaTerbuka ? 'Tutup semua kelompok menu' : 'Buka semua kelompok menu'}
				class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white lg:h-8.5 lg:w-8.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
			>
				<span aria-hidden="true">
					<Icon name={semuaTerbuka ? 'collapse-all' : 'expand-all'} class="h-4 w-4" />
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
	<nav
		data-sidebar-rail
		aria-label="Menu utama ringkas"
		class="absolute inset-0 z-10 hidden flex-col items-center gap-1 py-0.5 transition-opacity duration-200 lg:flex {collapsed
			? 'pointer-events-auto opacity-100'
			: 'pointer-events-none opacity-0'}"
	>
		{#if hasMultipleModules}
			<div class="group/rail relative" role="none">
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors {openKey ===
					'__modul'
						? 'bg-[#ebf3fe] text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
						: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}"
					aria-label="Ganti modul kerja"
					aria-haspopup="menu"
					aria-expanded={openKey === '__modul'}
					onclick={() => (openKey = openKey === '__modul' ? null : '__modul')}
				>
					<Icon name="layers" class="h-[18px] w-[18px]" />
				</button>
				{#if openKey !== '__modul'}
					<span
						aria-hidden="true"
						class="pointer-events-none invisible absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 opacity-0 shadow-md transition-opacity duration-150 group-hover/rail:visible group-hover/rail:opacity-100 group-focus-within/rail:visible group-focus-within/rail:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
					>
						Ganti modul kerja
					</span>
				{/if}
				<div
					class="absolute top-0 left-full z-50 ml-3 w-64 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 transition duration-150 ease-out dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40 dark:ring-white/5 {openKey ===
					'__modul'
						? 'pointer-events-auto visible translate-x-0 opacity-100'
						: 'pointer-events-none invisible -translate-x-1 opacity-0'}"
					role="menu"
					aria-label="Pilih modul kerja"
				>
					<p class="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
						Pilih modul kerja
					</p>
					<div class="space-y-0.5">
						{#each modulOptions as opt (opt.value)}
							{@const isSelected = opt.value === activeDisplayModul}
							<button
								type="button"
								role="menuitemradio"
								aria-checked={isSelected}
								class="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors disabled:opacity-50 {isSelected
									? 'bg-blue-50/90 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
									: 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
								disabled={isSwitchingModul}
								onclick={() => pilihModul(opt.value)}
							>
								<span
									aria-hidden="true"
									class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg {isSelected
										? 'bg-blue-100/90 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
										: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'}"
								>
									<Icon name={opt.icon} class="h-4 w-4" />
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-xs font-semibold leading-tight">{opt.label}</span
									>
									<span class="mt-0.5 block truncate text-[11px] font-normal opacity-75">
										{opt.desc}
									</span>
								</span>
								{#if isSelected}
									<span aria-hidden="true" class="shrink-0 text-blue-600 dark:text-blue-400">
										<Icon name="check" class="h-4 w-4" />
									</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<div class="group/rail relative" role="none">
			<button
				id="sidebar-rail-search-trigger"
				type="button"
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors {openKey ===
				'__search'
					? 'bg-[#ebf3fe] text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
					: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}"
				aria-label="Cari menu"
				aria-haspopup="dialog"
				aria-expanded={openKey === '__search'}
				aria-controls="sidebar-rail-search-panel"
				onclick={toggleRailSearch}
			>
				<Icon name="search" class="h-[18px] w-[18px]" />
			</button>
			{#if openKey !== '__search'}
				<span
					aria-hidden="true"
					class="pointer-events-none invisible absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 opacity-0 shadow-md transition-opacity duration-150 group-hover/rail:visible group-hover/rail:opacity-100 group-focus-within/rail:visible group-focus-within/rail:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
				>
					Cari menu
				</span>
			{/if}
			<div
				id="sidebar-rail-search-panel"
				role="dialog"
				aria-label="Cari menu"
				class="absolute top-0 left-full z-50 ml-3 w-72 rounded-xl border border-slate-200/90 bg-white p-2 shadow-xl shadow-slate-900/12 ring-1 ring-slate-900/5 transition duration-150 ease-out dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50 dark:ring-white/5 {openKey ===
				'__search'
					? 'pointer-events-auto visible translate-x-0 opacity-100'
					: 'pointer-events-none invisible -translate-x-1 opacity-0'}"
			>
				<div
					class="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 transition-colors focus-within:border-blue-600 focus-within:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-blue-400 dark:focus-within:bg-zinc-900"
				>
					<label for="sidebar-rail-search" class="sr-only">Cari menu</label>
					<span
						aria-hidden="true"
						class="flex shrink-0 items-center text-slate-400 dark:text-zinc-400"
					>
						<Icon name="search" class="h-3.5 w-3.5" />
					</span>
					<input
						id="sidebar-rail-search"
						type="search"
						bind:value={railSearch}
						onkeydown={handleRailSearchKeydown}
						placeholder="Cari menu..."
						class="min-w-0 grow bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
					/>
					{#if railSearch}
						<button
							type="button"
							aria-label="Hapus pencarian"
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
							onclick={() => {
								railSearch = '';
								document.getElementById('sidebar-rail-search')?.focus();
							}}
						>
							<Icon name="close" class="h-3.5 w-3.5" />
						</button>
					{/if}
				</div>
				<div class="sidebar-menu-scroll mt-1.5 max-h-72 space-y-0.5 overflow-y-auto pr-0.5">
					{#each railSearchResults as entry (entry.path)}
						{@const entryActive = isMenuActive(
							page.url.pathname,
							entry.path,
							railSearchSiblingPaths
						)}
						<a
							href={entry.path}
							aria-current={entryActive ? 'page' : undefined}
							onclick={() => {
								openKey = null;
							}}
							class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors {entryActive
								? 'bg-[#ebf3fe] text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
								: 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
						>
							<span
								aria-hidden="true"
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md {entryActive
									? 'bg-blue-100/90 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
									: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'}"
							>
								<Icon name={entry.icon ?? 'home'} class="h-3.5 w-3.5" />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-xs font-medium">
									{@html searchQueryMarker(railSearch, entry.title)}
								</span>
								{#if entry.groupTitle}
									<span class="block truncate text-[11px] text-slate-400 dark:text-zinc-500">
										{entry.groupTitle}
									</span>
								{/if}
							</span>
						</a>
					{:else}
						<div class="px-2 py-4 text-center">
							<p class="text-xs text-slate-600 dark:text-zinc-400">
								Menu "{railSearch}" tidak ditemukan.
							</p>
							<button
								type="button"
								class="mt-2 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
								onclick={() => {
									railSearch = '';
									document.getElementById('sidebar-rail-search')?.focus();
								}}
							>
								Reset pencarian
							</button>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div aria-hidden="true" class="my-1 h-px w-7 bg-slate-200 dark:bg-zinc-700"></div>

		{#each menuItems as menu (menu.path ?? menu.title)}
			{@const groupPaths = menu.subMenu?.map((entry) => entry.path ?? '') ?? []}
			{@const active = menu.subMenu?.length
				? groupPaths.some((path) => isMenuActive(page.url.pathname, path, groupPaths))
				: isMenuActive(page.url.pathname, menu.path)}
			{#if menu.subMenu?.length}
				<div class="group/rail relative" role="none">
					<button
						type="button"
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors {active
							? 'bg-[#ebf3fe] text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
							: openKey === menu.title
								? 'bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100'
								: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}"
						aria-label={menu.title}
						aria-haspopup="menu"
						aria-expanded={openKey === menu.title}
						onclick={() => (openKey = openKey === menu.title ? null : menu.title)}
					>
						<Icon name={menu.icon ?? 'grid'} class="h-[18px] w-[18px]" />
					</button>
					{#if openKey !== menu.title}
						<span
							aria-hidden="true"
							class="pointer-events-none invisible absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 opacity-0 shadow-md transition-opacity duration-150 group-hover/rail:visible group-hover/rail:opacity-100 group-focus-within/rail:visible group-focus-within/rail:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						>
							{menu.title}
						</span>
					{/if}
					<div
						class="absolute top-0 left-full z-50 ml-3 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg transition duration-150 ease-out dark:border-zinc-700 dark:bg-zinc-900 {openKey ===
						menu.title
							? 'pointer-events-auto visible translate-x-0 opacity-100'
							: 'pointer-events-none invisible -translate-x-1 opacity-0'}"
						role="menu"
						aria-label={menu.title}
					>
						<p class="px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
							{menu.title}
						</p>
						{#each menu.subMenu as child (child.path ?? child.title)}
							{#if child.path}
								<a
									href={child.path}
									role="menuitem"
									class="block rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
									onclick={() => (openKey = null)}
								>
									{child.title}
								</a>
							{/if}
						{/each}
					</div>
				</div>
			{:else if menu.path}
				<div class="group/rail relative" role="none">
					<a
						href={menu.path}
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors {active
							? 'bg-[#ebf3fe] text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
							: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}"
						aria-label={menu.title}
						aria-current={active ? 'page' : undefined}
					>
						<Icon name={menu.icon ?? 'home'} class="h-[18px] w-[18px]" />
					</a>
					<span
						aria-hidden="true"
						class="pointer-events-none invisible absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 opacity-0 shadow-md transition-opacity duration-150 group-hover/rail:visible group-hover/rail:opacity-100 group-focus-within/rail:visible group-focus-within/rail:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
					>
						{menu.title}
					</span>
				</div>
			{/if}
		{/each}
	</nav>
</div>
