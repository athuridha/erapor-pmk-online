<script lang="ts">
	/* eslint-disable svelte/valid-prop-names-in-kit-pages -- komponen ini juga dipakai di modal. */
	import { goto } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { defaultPermissionsByType, userPermissions } from '../../permissions';
	import type { PageData } from './$types';

	let {
		data,
		modal = false,
		onclose
	}: { data: PageData; modal?: boolean; onclose?: () => void } = $props();

	const isEditMode = $derived(!!data.userDetail);
	const guruName = $derived(
		(data.userDetail?.namaLengkap ?? data.userDetail?.pegawaiName ?? '').trim()
	);
	const pageTitle = $derived(
		isEditMode ? `Edit Pengguna${guruName ? `: ${guruName}` : ''}` : 'Tambah Pengguna'
	);
	const pageDesc = $derived(
		isEditMode
			? 'Atur akun, peran, dan kata sandi. Penugasan mapel/kelas diatur di menu masing-masing.'
			: 'Buat akun baru dan tentukan perannya.'
	);

	const ROLE_OPTIONS = [
		{
			value: 'pembina_eskul',
			label: 'Pembina Eskul (Eksternal)',
			desc: 'Mengelola TP & nilai ekstrakurikuler binaan tanpa masuk daftar pegawai.'
		},
		{
			value: 'operator',
			label: 'Operator',
			desc: 'Mengelola data master dan administrasi sekolah.'
		},
		{
			value: 'admin',
			label: 'Admin',
			desc: 'Akses mutlak seluruh aplikasi, termasuk pengaturan sistem.'
		}
	] as const;

	// svelte-ignore state_referenced_locally
	let nama = $state(data.userDetail?.namaLengkap ?? data.userDetail?.pegawaiName ?? '');
	// svelte-ignore state_referenced_locally
	let nik = $state(data.userDetail?.pegawaiNik ?? '');
	// svelte-ignore state_referenced_locally
	let username = $state(data.userDetail?.username ?? '');
	let password = $state('');
	// svelte-ignore state_referenced_locally
	let roles = $state<string[]>(
		(data.userDetail?.roles ?? []).filter(
			(r: string) => r !== 'guru' && r !== 'wali_kelas' && r !== 'kepala_sekolah'
		)
	);
	// svelte-ignore state_referenced_locally
	let sekolahId = $state<string | number | null>(data.userDetail?.sekolahId ?? '');
	let showPassword = $state(false);

	// Akun existing memakai izin tersimpan; akun baru mulai dari template role.
	// svelte-ignore state_referenced_locally
	let permissions = $state(
		new Set<string>(
			data.userDetail?.permissions ??
				defaultPermissionsByType[(data.userDetail?.type ?? 'user') as AuthUser['type']] ??
				[]
		)
	);

	const rolesSet = $derived(new Set(roles));
	const derivedGuru = $derived(!!data.userDetail?.derived?.guru);
	const derivedWali = $derived(!!data.userDetail?.derived?.waliKelas);
	const derivedKepsek = $derived(!!data.userDetail?.derived?.kepalaSekolah);
	const hasEducator = $derived(derivedGuru || derivedWali);
	// Admin & kepala sekolah murni selalu memegang seluruh izin.
	const isAdminRole = $derived(rolesSet.has('admin') || (derivedKepsek && !hasEducator));
	const adminRoleLabel = $derived(rolesSet.has('admin') ? 'Admin' : 'Kepala Sekolah');

	const effectivePermissions = $derived.by(() => {
		if (isAdminRole) return new Set<string>(userPermissions);
		return new Set(permissions);
	});

	function handleRoleChange(changedRole: string, checked: boolean) {
		if (changedRole === 'pembina_eskul' && checked) {
			roles = ['pembina_eskul'];
		} else if (changedRole !== 'pembina_eskul' && checked) {
			roles = roles.filter((r) => r !== 'pembina_eskul');
		}
		applyRoleTemplates();
	}

	function applyRoleTemplates() {
		const templateKeys: string[] = [];
		if (rolesSet.has('admin')) templateKeys.push('admin');
		if (derivedKepsek) templateKeys.push('kepala_sekolah');
		if (rolesSet.has('operator')) templateKeys.push('admin');
		if (derivedWali) templateKeys.push('wali_kelas');
		if (derivedGuru || derivedWali) templateKeys.push('user');
		if (!rolesSet.size && !derivedGuru && !derivedWali) templateKeys.push('user');
		if (rolesSet.has('pembina_eskul')) templateKeys.push('pembina_eskul');
		const merged = new Set<string>();
		for (const key of templateKeys) {
			for (const permission of defaultPermissionsByType[key as AuthUser['type']] ?? []) {
				merged.add(permission);
			}
		}
		permissions = merged;
	}

	const isFormValid = $derived.by(() => {
		const hasNama = nama.trim().length > 0;
		const hasUsername = username.trim().length > 0;
		const hasPassword = isEditMode ? true : password.trim().length > 0;
		return hasNama && hasUsername && hasPassword;
	});

	function handleSaved() {
		goto('/master-data/pengguna');
	}
</script>

<section
	class={modal
		? 'w-full'
		: 'mx-auto w-full rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900'}
>
	{#if modal}
		<div
			class="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-zinc-800"
		>
			<div>
				<h2 class="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					{pageTitle}
				</h2>
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">{pageDesc}</p>
			</div>
			<button
				type="button"
				class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
				onclick={onclose}
				aria-label="Tutup"
			>
				<Icon name="close" class="h-4 w-4" />
			</button>
		</div>
	{:else}
		<header class="mb-5 border-b border-slate-200 pb-4 dark:border-zinc-800">
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				{pageTitle}
			</h1>
			<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">{pageDesc}</p>
		</header>
	{/if}

	<FormEnhance action="?/save" onsuccess={handleSaved}>
		{#snippet children({ submitting })}
			<div class="space-y-4">
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Sekolah</span>
					<select
						name="sekolahId"
						bind:value={sekolahId}
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					>
						<option value="">Pilih Sekolah</option>
						{#each data.sekolahList as s (s.id)}
							<option value={s.id}>{s.nama}</option>
						{/each}
					</select>
				</label>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="flex flex-col gap-1.5 sm:col-span-2">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nama</span>
						<input
							required
							name="nama"
							bind:value={nama}
							placeholder="Nama lengkap dan gelar"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						/>
					</label>

					<div class="flex flex-col gap-1.5 sm:col-span-2">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Peran otomatis
						</span>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<div
								class="rounded-xl border px-3 py-2.5 {derivedGuru
									? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30'
									: 'border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-800/40'}"
							>
								<div class="flex items-center gap-1.5">
									<Icon
										name="check"
										class="h-3.5 w-3.5 {derivedGuru
											? 'text-emerald-600 dark:text-emerald-400'
											: 'text-slate-400 dark:text-zinc-500'}"
									/>
									<span class="text-xs font-bold text-slate-900 dark:text-zinc-100">Guru</span>
								</div>
								<p class="mt-0.5 text-[11px] text-slate-600 dark:text-zinc-400">
									{derivedGuru ? 'Aktif dari mapel yang diampu.' : 'Belum ada mapel yang diampu.'}
									Atur di <strong>Guru Pengampu</strong>.
								</p>
							</div>
							<div
								class="rounded-xl border px-3 py-2.5 {derivedWali
									? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30'
									: 'border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-800/40'}"
							>
								<div class="flex items-center gap-1.5">
									<Icon
										name="check"
										class="h-3.5 w-3.5 {derivedWali
											? 'text-emerald-600 dark:text-emerald-400'
											: 'text-slate-400 dark:text-zinc-500'}"
									/>
									<span class="text-xs font-bold text-slate-900 dark:text-zinc-100">Wali Kelas</span
									>
								</div>
								<p class="mt-0.5 text-[11px] text-slate-600 dark:text-zinc-400">
									{derivedWali
										? 'Aktif dari penugasan wali kelas.'
										: 'Belum ditugaskan sebagai wali kelas.'}
									Atur di halaman <strong>Wali Kelas</strong>.
								</p>
								<div
									class="rounded-xl border px-3 py-2.5 {derivedKepsek
										? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30'
										: 'border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-800/40'}"
								>
									<div class="flex items-center gap-1.5">
										<Icon
											name="check"
											class="h-3.5 w-3.5 {derivedKepsek
												? 'text-emerald-600 dark:text-emerald-400'
												: 'text-slate-400 dark:text-zinc-500'}"
										/>
										<span class="text-xs font-bold text-slate-900 dark:text-zinc-100"
											>Kepala Sekolah</span
										>
									</div>
									<p class="mt-0.5 text-[11px] text-slate-600 dark:text-zinc-400">
										{derivedKepsek
											? 'Aktif dari data sekolah.'
											: 'Belum dipilih sebagai kepala sekolah.'}
										Atur di <strong>Sekolah</strong>.
									</p>
								</div>
							</div>
						</div>
						<span class="mt-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Role tambahan
						</span>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{#each ROLE_OPTIONS as role (role.value)}
								<label
									class="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition-colors hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-blue-800"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-sm mt-0.5 rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
										name="roles"
										bind:group={roles}
										value={role.value}
										onchange={(e) => handleRoleChange(role.value, e.currentTarget.checked)}
									/>
									<span>
										<span class="text-xs font-bold text-slate-900 dark:text-zinc-100"
											>{role.label}</span
										>
										<span
											class="mt-0.5 block text-[11px] leading-snug text-slate-600 dark:text-zinc-400"
											>{role.desc}</span
										>
									</span>
								</label>
							{/each}
						</div>
						<p class="text-xs text-slate-500 dark:text-zinc-400">
							Centang lebih dari satu untuk peran tambahan (contoh: operator yang juga kepala
							sekolah).
						</p>
					</div>
				</div>

				{#if rolesSet.has('pembina_eskul')}
					<div
						class="flex items-start gap-2 rounded-xl border border-blue-200/80 bg-blue-50/75 px-3.5 py-2.5 text-xs text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
					>
						<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
						<span>
							Akun <strong>Pembina Eskul (Eksternal)</strong> masuk memakai
							<strong>Nama Pengguna</strong>, tanpa NIK/pegawai sekolah.
						</span>
					</div>
				{:else}
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NIK Guru</span>
						<input
							inputmode="numeric"
							maxlength="16"
							name="nik"
							bind:value={nik}
							placeholder="16 digit NIK, opsional"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							Dipakai guru untuk masuk. Kosongkan jika akun hanya memakai nama pengguna.
						</span>
					</label>
				{/if}

				<div class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Akun</span>
					<div class="flex flex-col gap-2 sm:flex-row">
						<div
							class="flex h-9 flex-1 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
						>
							<span class="pl-3 text-slate-500 dark:text-zinc-400">
								<Icon name="user" class="h-4 w-4" />
							</span>
							<input
								type="text"
								required
								name="username"
								bind:value={username}
								placeholder="Nama pengguna"
								class="h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
							/>
						</div>
						<div
							class="flex h-9 flex-1 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
						>
							<span class="pl-3 text-slate-500 dark:text-zinc-400">
								<Icon name="lock" class="h-4 w-4" />
							</span>
							<input
								type={showPassword ? 'text' : 'password'}
								name="password"
								bind:value={password}
								placeholder={isEditMode ? 'Kata sandi baru (opsional)' : 'Kata sandi'}
								class="h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
							/>
							<button
								type="button"
								class="cursor-pointer pr-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
								onclick={() => (showPassword = !showPassword)}
								aria-label="Lihat atau sembunyikan kata sandi"
							>
								<Icon name={showPassword ? 'eye-off' : 'eye'} class="h-4 w-4" />
							</button>
						</div>
					</div>
					<p class="text-xs text-slate-500 dark:text-zinc-400">
						{isEditMode
							? 'Kosongkan kata sandi jika tidak ingin mengubahnya.'
							: 'Dipakai untuk masuk pertama kali.'}
					</p>
				</div>

				<details
					class="collapse-arrow collapse rounded-xl border border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-800/40"
				>
					<summary class="collapse-title text-sm font-semibold text-slate-900 dark:text-zinc-100">
						Hak Akses
						<span
							class="ml-1.5 inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 tabular-nums dark:bg-blue-950/60 dark:text-blue-300"
						>
							{effectivePermissions.size}
						</span>
					</summary>
					<div class="collapse-content text-xs">
						<div class="space-y-3 pt-1">
							<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
								Rincian izin diatur di halaman <strong>Kelola izin</strong>. Mengubah role akan
								menerapkan template izin role tersebut saat disimpan.
							</p>
							{#if isAdminRole}
								<p class="text-xs font-medium text-sky-700 dark:text-sky-400">
									{adminRoleLabel} selalu memegang seluruh izin.
								</p>
							{:else}
								<p class="text-xs text-slate-700 dark:text-zinc-300">
									<strong>{effectivePermissions.size}</strong> dari {userPermissions.length} izin aktif.
								</p>
							{/if}
							{#if isEditMode}
								<a
									class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
									href={`/pengguna/${data.userDetail?.id}`}
								>
									<Icon name="lock" class="h-3.5 w-3.5" /> Kelola izin
								</a>
							{/if}
						</div>
					</div>
				</details>

				<input
					type="hidden"
					name="permissions"
					value={JSON.stringify(Array.from(effectivePermissions))}
				/>
			</div>

			<div
				class="mt-5 flex items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800"
			>
				{#if modal}
					<button
						type="button"
						class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						onclick={onclose}
					>
						Batal
					</button>
				{:else}
					<a
						href="/master-data/pengguna"
						class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						><Icon name="left" class="h-4 w-4" /> Kembali</a
					>
				{/if}
				<button
					type="submit"
					class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!isFormValid || submitting}
				>
					<Icon name="save" class="h-4 w-4" />
					{submitting ? 'Menyimpan...' : 'Simpan'}
				</button>
			</div>
		{/snippet}
	</FormEnhance>
</section>
