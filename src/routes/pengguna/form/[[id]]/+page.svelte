<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Kembali link back to list is intentional */
	import { goto } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import {
		defaultPermissionsByType,
		groupedUserPermissions,
		userPermissions
	} from '../../permissions';

	let { data } = $props();

	const isEditMode = $derived(!!data.userDetail);
	const guruName = $derived(data.userDetail?.pegawaiName?.trim() ?? '');
	const pageTitle = $derived(
		isEditMode ? `Edit Pengguna${guruName ? `: ${guruName}` : ''}` : 'Tambah Pengguna'
	);
	const pageDesc = $derived(
		isEditMode
			? 'Perbarui informasi pengguna dan hak akses.'
			: 'Buat akun pengguna baru dan tentukan hak aksesnya.'
	);

	// svelte-ignore state_referenced_locally
	let nama = $state(data.userDetail?.pegawaiName ?? '');
	// svelte-ignore state_referenced_locally
	let username = $state(data.userDetail?.username ?? '');
	let password = $state('');
	// svelte-ignore state_referenced_locally
	let type = $state(data.userDetail?.type ?? 'user');
	// svelte-ignore state_referenced_locally
	let sekolahId = $state<string | number | null>(data.userDetail?.sekolahId ?? '');
	// svelte-ignore state_referenced_locally
	let mataPelajaranIds = $state(new Set<number>(data.userDetail?.mataPelajaranIds ?? []));
	// svelte-ignore state_referenced_locally
	let kelasIds = $state(new Set<number>(data.userDetail?.kelasIds ?? []));
	let showPassword = $state(false);

	// Akun existing memakai izin yang tersimpan; akun baru mulai dari template role.
	// svelte-ignore state_referenced_locally
	let permissions = $state(
		new Set<string>(
			data.userDetail?.permissions ??
				defaultPermissionsByType[(data.userDetail?.type ?? 'user') as AuthUser['type']] ??
				[]
		)
	);

	const isAdminRole = $derived(type === 'admin' || type === 'kepala_sekolah');
	const multiKelas = $derived(kelasIds.size > 1);

	// Izin yang benar-benar dikirim: kelas_pindah menyusul otomatis untuk akun
	// dengan lebih dari satu kelas, admin memakai daftar penuh.
	const effectivePermissions = $derived.by(() => {
		if (isAdminRole) return new Set<string>(userPermissions);
		const set = new Set(permissions);
		if (multiKelas && (type === 'user' || type === 'wali_kelas')) set.add('kelas_pindah');
		return set;
	});

	function applyRoleTemplate(role: string) {
		permissions = new Set<string>(defaultPermissionsByType[role as AuthUser['type']] ?? []);
		if (role === 'kepala_sekolah' || role === 'admin') {
			mataPelajaranIds = new Set<number>();
			kelasIds = new Set<number>();
		}
	}

	function clearMapel() {
		mataPelajaranIds = new Set<number>();
	}

	function clearKelas() {
		kelasIds = new Set<number>();
	}

	function togglePermission(key: string) {
		const next = new Set(permissions);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		permissions = next;
	}

	const isFormValid = $derived.by(() => {
		const hasNama = nama.trim().length > 0;
		const hasUsername = username.trim().length > 0;
		const hasPassword = isEditMode ? true : password.trim().length > 0;
		return hasNama && hasUsername && hasPassword;
	});

	function uniqueByNama(list: { id: number; nama: string }[]) {
		const map = new Map<string, { id: number; nama: string }>();
		for (const m of list) {
			if (!map.has(m.nama)) map.set(m.nama, m);
		}
		return Array.from(map.values());
	}

	let uniqueMataPelajaran = $derived(uniqueByNama(data.mataPelajaran ?? []));
	let filteredMataPelajaran = $derived(
		uniqueMataPelajaran.filter((m) => {
			const name = (m.nama ?? '').toString().trim().toLowerCase();
			if (name === 'pendidikan agama dan budi pekerti') return false;
			if (name === 'pendalaman kitab suci') return false;
			return true;
		})
	);

	let filteredKelasList = $derived.by(() => {
		if (!sekolahId) return data.kelasList ?? [];
		const sId = Number(sekolahId);
		return (data.kelasList ?? []).filter((k: { sekolahId?: number | null }) => k.sekolahId === sId);
	});

	let allKelasSelected = $derived(
		filteredKelasList.length > 0 && filteredKelasList.every((k) => kelasIds.has(k.id))
	);

	const visibleKelasCount = $derived(filteredKelasList.filter((k) => kelasIds.has(k.id)).length);

	const waliKelasIdSet = $derived(new Set(data.userDetail?.waliKelasIds ?? []));
	const roleHint = $derived.by(() => {
		if (!isEditMode || type !== 'wali_kelas') return '';
		const list = (data.kelasList ?? []) as {
			id: number;
			nama: string;
			fase?: string | null;
			sekolahId: number;
		}[];
		const waliNames = list.filter((k) => waliKelasIdSet.has(k.id)).map((k) => k.nama);
		const guruNames = list
			.filter((k) => !waliKelasIdSet.has(k.id) && kelasIds.has(k.id))
			.map((k) => k.nama);
		const parts: string[] = [];
		if (waliNames.length) parts.push(`Wali Kelas ${waliNames.join(', ')}`);
		if (guruNames.length) parts.push(`Guru di ${guruNames.join(', ')}`);
		return parts.join(' · ');
	});

	function toggleMapel(id: number) {
		if (mataPelajaranIds.has(id)) {
			mataPelajaranIds.delete(id);
		} else {
			mataPelajaranIds.add(id);
		}
		mataPelajaranIds = new Set(mataPelajaranIds);
	}

	function toggleKelas(id: number) {
		if (kelasIds.has(id)) {
			kelasIds.delete(id);
		} else {
			kelasIds.add(id);
		}
		kelasIds = new Set(kelasIds);
	}

	function toggleSelectAllKelas() {
		if (allKelasSelected) {
			for (const k of filteredKelasList) kelasIds.delete(k.id);
		} else {
			for (const k of filteredKelasList) kelasIds.add(k.id);
		}
		kelasIds = new Set(kelasIds);
	}
</script>

<section class="card bg-base-100 mx-auto w-full rounded-lg border border-none p-6 shadow-md">
	<header class="mb-6">
		<div>
			<h1 class="text-2xl font-bold">{pageTitle}</h1>
			<p class="text-base-content/70 mt-1 text-sm">{pageDesc}</p>
		</div>
	</header>

	<FormEnhance action="?/save" onsuccess={() => goto('/pengguna')}>
		{#snippet children({ submitting })}
			<div class="space-y-4">
				<!-- Sekolah -->
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Sekolah</legend>
					<select
						id="form-sekolah"
						class="select bg-base-200 dark:bg-base-300 w-full truncate dark:border-none"
						name="sekolahId"
						bind:value={sekolahId}
						onchange={() => {
							kelasIds = new Set<number>();
						}}
					>
						<option disabled selected={sekolahId === ''} value="">Pilih Sekolah</option>
						{#if data.sekolahList && data.sekolahList.length}
							{#each data.sekolahList as s (s.id)}
								<option value={s.id}>{s.nama}</option>
							{/each}
						{:else}
							<option disabled>- tidak ada sekolah -</option>
						{/if}
					</select>
					<p class="label text-wrap">
						Opsional: kaitkan pengguna ke sekolah tertentu sehingga saat login sekolah aktif bisa
						disesuaikan.
					</p>
				</fieldset>

				<!-- Mata Pelajaran Collapse -->
				<details class="bg-base-200 border-base-300 collapse-arrow collapse">
					<summary class="collapse-title font-semibold">
						Mata Pelajaran
						{#if isAdminRole}
							<span class="badge badge-sm badge-ghost text-xs ml-1"
								>Opsional untuk {type === 'kepala_sekolah' ? 'Kepala Sekolah' : 'Admin'}</span
							>
						{/if}
						{#if mataPelajaranIds.size > 0}
							<span class="badge badge-sm badge-primary ml-1">{mataPelajaranIds.size}</span>
						{/if}
					</summary>
					<div class="collapse-content text-sm">
						<div class="space-y-3">
							{#if isAdminRole}
								<div
									class="alert alert-info bg-info/10 text-info-content border-info/20 text-xs py-2"
								>
									<Icon name="info" class="w-4 h-4 shrink-0 text-info" />
									<span>
										Role <strong>{type === 'kepala_sekolah' ? 'Kepala Sekolah' : 'Admin'}</strong> memiliki
										akses manajerial penuh ke seluruh mata pelajaran. Bagian ini tidak perlu diisi.
									</span>
								</div>
							{:else}
								<p class="text-xs opacity-75">
									Pilih satu atau lebih mata pelajaran yang diajari. Khusus role "Wali Kelas" skip
									langkah ini, karena bawaan Wali Kelas sudah punya akses ke semua mata pelajaran.
								</p>
							{/if}
							{#if mataPelajaranIds.size > 0}
								<button
									type="button"
									class="btn btn-xs btn-outline btn-error shadow-none"
									onclick={clearMapel}
								>
									Kosongkan pilihan mata pelajaran
								</button>
							{/if}
							{#if filteredMataPelajaran.length > 0}
								<div class="space-y-2">
									{#each filteredMataPelajaran as m (m.id)}
										<label class="flex cursor-pointer gap-2">
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												checked={mataPelajaranIds.has(m.id)}
												onchange={() => toggleMapel(m.id)}
											/>
											<span class="text-sm">{m.nama}</span>
										</label>
									{/each}
								</div>
							{:else}
								<p class="text-xs opacity-75">- tidak ada mata pelajaran -</p>
							{/if}
						</div>
					</div>
				</details>

				<!-- Kelas Collapse -->
				<details class="bg-base-200 border-base-300 collapse-arrow collapse">
					<summary class="collapse-title font-semibold">
						Kelas
						{#if isAdminRole}
							<span class="badge badge-sm badge-ghost text-xs ml-1"
								>Opsional untuk {type === 'kepala_sekolah' ? 'Kepala Sekolah' : 'Admin'}</span
							>
						{/if}
						{#if visibleKelasCount > 0}
							<span class="badge badge-sm badge-secondary ml-1">{visibleKelasCount}</span>
						{/if}
					</summary>
					<div class="collapse-content text-sm">
						<div class="space-y-3">
							{#if isAdminRole}
								<div
									class="alert alert-info bg-info/10 text-info-content border-info/20 text-xs py-2"
								>
									<Icon name="info" class="w-4 h-4 shrink-0 text-info" />
									<span>
										Role <strong>{type === 'kepala_sekolah' ? 'Kepala Sekolah' : 'Admin'}</strong> memiliki
										akses ke semua kelas. Bagian ini tidak perlu dipilih jika tidak merangkap wali kelas.
									</span>
								</div>
							{:else}
								<p class="text-xs opacity-75">Pilih satu atau lebih kelas yang bisa diakses</p>
							{/if}
							{#if visibleKelasCount > 0}
								<button
									type="button"
									class="btn btn-xs btn-outline btn-error shadow-none"
									onclick={clearKelas}
								>
									Kosongkan pilihan kelas
								</button>
							{/if}
							{#if filteredKelasList.length > 0}
								<div class="space-y-2">
									<label class="bg-base-300 flex cursor-pointer gap-2 rounded p-2 font-semibold">
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											checked={allKelasSelected}
											onchange={toggleSelectAllKelas}
										/>
										<span class="text-sm">Pilih Semua</span>
									</label>
									{#each filteredKelasList as k (k.id)}
										<label class="flex cursor-pointer gap-2">
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												checked={kelasIds.has(k.id)}
												onchange={() => toggleKelas(k.id)}
											/>
											<span class="text-sm">
												{k.nama}
												{#if k.fase}({k.fase}){/if}
												{#if waliKelasIdSet.has(k.id)}
													<span class="badge badge-sm badge-primary ml-1">wali</span>
												{/if}
											</span>
										</label>
									{/each}
								</div>
							{:else}
								<p class="text-xs opacity-75">- tidak ada kelas -</p>
							{/if}
						</div>
					</div>
				</details>

				<!-- Nama + Role -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Nama</legend>
						<input
							id="form-nama"
							required
							class="input bg-base-200 dark:bg-base-300 w-full dark:border-none"
							name="nama"
							bind:value={nama}
							placeholder="Contoh: Bruce Wayne, Bat."
						/>
						<p class="label text-wrap">Nama lengkap pengguna dan gelar</p>
					</fieldset>

					<!-- Role -->
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Role</legend>
						<select
							id="form-role"
							class="select bg-base-200 dark:bg-base-300 w-full dark:border-none"
							name="type"
							bind:value={type}
							onchange={(e) => applyRoleTemplate((e.currentTarget as HTMLSelectElement).value)}
						>
							<option value="admin">Admin</option>
							<option value="kepala_sekolah">Kepala Sekolah</option>
							<option value="user">Guru</option>
							{#if type === 'wali_kelas'}
								<option value="wali_kelas">Wali Kelas (Lama)</option>
							{/if}
						</select>
						<p class="label text-wrap">Tentukan peran pengguna</p>
						{#if roleHint}
							<p class="label text-wrap font-medium text-info">{roleHint}</p>
						{/if}
					</fieldset>
				</div>

				<!-- Akun -->
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Akun</legend>
					<div class="flex flex-col gap-2 sm:flex-row">
						<label class="input validator bg-base-200 dark:bg-base-300 w-full dark:border-none">
							<Icon name="user" />
							<input
								id="form-username"
								type="text"
								required
								placeholder="Nama pengguna"
								title="Hanya huruf, angka, atau tanda hubung"
								name="username"
								bind:value={username}
							/>
						</label>
						<label class="input validator bg-base-200 dark:bg-base-300 w-full dark:border-none">
							<Icon name="lock" />
							<input
								id="form-password"
								type={showPassword ? 'text' : 'password'}
								name="password"
								placeholder={isEditMode
									? 'Kata sandi baru (kosongkan jika tidak diubah)'
									: 'Kata sandi'}
								bind:value={password}
							/>
							<button
								type="button"
								class="cursor-pointer"
								onclick={() => (showPassword = !showPassword)}
								aria-label="Lihat atau sembunyikan kata sandi"
							>
								<Icon name={showPassword ? 'eye-off' : 'eye'} />
							</button>
						</label>
					</div>
					<p class="validator-hint hidden">Isi nama pengguna dan kata sandi dulu!</p>
					<p class="label text-wrap">
						{isEditMode
							? 'Nama pengguna wajib diisi. Kata sandi opsional (kosongkan jika tidak diubah).'
							: 'Nama pengguna dan kata sandi untuk masuk'}
					</p>
				</fieldset>

				<!-- Hak Akses Collapse -->
				<details class="bg-base-200 border-base-300 collapse-arrow collapse">
					<summary class="collapse-title font-semibold">
						Hak Akses
						<span class="badge badge-sm badge-accent">{effectivePermissions.size}</span>
					</summary>
					<div class="collapse-content text-sm">
						<div class="space-y-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<p class="text-xs opacity-75">
									Mengikuti template role di atas. Admin bisa menyalakan atau mematikan izin per
									akun.
								</p>
								<button
									type="button"
									class="btn btn-xs btn-soft shadow-none"
									disabled={isAdminRole}
									onclick={() => applyRoleTemplate(type)}
								>
									<Icon name="repeat" /> Sesuai template
								</button>
							</div>

							{#if isAdminRole}
								<p class="text-info text-xs">
									Admin dan Kepala Sekolah selalu memegang seluruh izin.
								</p>
							{/if}

							{#each Object.entries(groupedUserPermissions) as [group, permission] (group)}
								<div class="bg-base-300/60 rounded-lg p-2.5">
									<p class="mb-1.5 text-xs font-bold">{permission.description}</p>
									<div class="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
										{#each permission.values as [name, desc] (name)}
											{@const key = `${group}_${name}`}
											{@const autoPindah = key === 'kelas_pindah' && multiKelas}
											<label
												class="flex items-center justify-between gap-2 rounded px-2 py-1 {autoPindah
													? 'opacity-70'
													: 'hover:bg-base-200 cursor-pointer'}"
											>
												<span class="text-xs">
													{desc}
													{#if autoPindah}
														<span class="badge badge-xs badge-info ml-1">otomatis</span>
													{/if}
												</span>
												<input
													type="checkbox"
													class="toggle toggle-primary toggle-xs"
													checked={effectivePermissions.has(key)}
													disabled={isAdminRole || autoPindah}
													onchange={() => togglePermission(key)}
												/>
											</label>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</div>
				</details>

				<!-- Hidden inputs for multi-select -->
				<input
					type="hidden"
					name="mataPelajaranIds"
					value={JSON.stringify(Array.from(mataPelajaranIds))}
				/>
				<input type="hidden" name="kelasIds" value={JSON.stringify(Array.from(kelasIds))} />
				<input
					type="hidden"
					name="permissions"
					value={JSON.stringify(Array.from(effectivePermissions))}
				/>
			</div>

			<div class="mt-6 flex items-center justify-between gap-2">
				<a href="/pengguna" class="btn btn-soft shadow-none"><Icon name="left" /> Kembali</a>
				<button
					class="btn btn-primary shadow-none"
					type="submit"
					disabled={!isFormValid || submitting}
					><Icon name="save" /> {submitting ? 'Menyimpan...' : 'Simpan'}</button
				>
			</div>
		{/snippet}
	</FormEnhance>
</section>
