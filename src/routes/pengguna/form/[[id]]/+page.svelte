<script lang="ts">
	import { goto } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { defaultPermissionsByType, userPermissions } from '../../permissions';

	let { data } = $props();

	const isEditMode = $derived(!!data.userDetail);
	const guruName = $derived(
		(data.userDetail?.namaLengkap ?? data.userDetail?.pegawaiName ?? '').trim()
	);
	const pageTitle = $derived(
		isEditMode ? `Edit Pengguna${guruName ? `: ${guruName}` : ''}` : 'Tambah Pengguna'
	);
	const pageDesc = $derived(
		isEditMode
			? 'Perbarui informasi pengguna dan hak akses.'
			: 'Buat akun pengguna baru dan tentukan hak aksesnya.'
	);

	/** Pilihan role boleh dikombinasi; server mengarahkan ke `type` + `operatorLevel`. */
	const ROLE_OPTIONS = [
		{
			value: 'guru',
			label: 'Guru',
			desc: 'Mengajar mata pelajaran pilihan, input nilai & presensi.'
		},
		{
			value: 'wali_kelas',
			label: 'Wali Kelas',
			desc: 'Kelola satu kelas penuh: semua mapel, catatan, rapor.'
		},
		{
			value: 'pembina_eskul',
			label: 'Pembina Eskul (Eksternal)',
			desc: 'Kelola TP & nilai ekstrakurikuler binaan tanpa masuk daftar pegawai.'
		},
		{
			value: 'operator',
			label: 'Operator',
			desc: 'Mengelola data master, presensi guru, dan administrasi sekolah.'
		},
		{
			value: 'kepala_sekolah',
			label: 'Kepala Sekolah',
			desc: 'Akses manajerial: monitor semua kelas & kepegawaian.'
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
	let roles = $state<string[]>(data.userDetail?.roles ?? ['guru']);
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

	const rolesSet = $derived(new Set(roles));
	const hasEducator = $derived(rolesSet.has('guru') || rolesSet.has('wali_kelas'));
	// Admin & kepala sekolah murni selalu memegang seluruh izin.
	const isAdminRole = $derived(
		rolesSet.has('admin') || (rolesSet.has('kepala_sekolah') && !hasEducator)
	);
	const adminRoleLabel = $derived(rolesSet.has('admin') ? 'Admin' : 'Kepala Sekolah');
	const multiKelas = $derived(kelasIds.size > 1);

	// Izin yang benar-benar dikirim: kelas_pindah menyusul otomatis untuk akun
	// dengan lebih dari satu kelas, admin memakai daftar penuh.
	const effectivePermissions = $derived.by(() => {
		if (isAdminRole) return new Set<string>(userPermissions);
		const set = new Set(permissions);
		if (multiKelas && hasEducator) set.add('kelas_pindah');
		return set;
	});

	/** Gabungkan izin default dari semua role yang dicentang. */
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
		if (rolesSet.has('kepala_sekolah')) templateKeys.push('kepala_sekolah');
		if (rolesSet.has('operator')) templateKeys.push('admin');
		if (rolesSet.has('wali_kelas')) templateKeys.push('wali_kelas');
		if (rolesSet.has('guru')) templateKeys.push('user');
		if (rolesSet.has('pembina_eskul')) templateKeys.push('pembina_eskul');
		const merged = new Set<string>();
		for (const key of templateKeys) {
			for (const permission of defaultPermissionsByType[key as AuthUser['type']] ?? []) {
				merged.add(permission);
			}
		}
		permissions = merged;
		if (isAdminRole || rolesSet.has('pembina_eskul')) {
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
		if (!isEditMode || !rolesSet.has('wali_kelas')) return '';
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

<section
	class="mx-auto w-full rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<header class="mb-5 border-b border-slate-200 pb-4 dark:border-zinc-800">
		<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">{pageTitle}</h1>
		<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">{pageDesc}</p>
	</header>

	<FormEnhance action="?/save" onsuccess={() => goto('/master-data/pengguna')}>
		{#snippet children({ submitting })}
			<div class="space-y-4">
				<!-- Sekolah -->
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Sekolah</span>
					<div class="relative flex items-center">
						<select
							id="form-sekolah"
							class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
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
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
					<span class="text-xs text-slate-500 dark:text-zinc-400">
						Opsional: kaitkan pengguna ke sekolah tertentu sehingga saat login sekolah aktif bisa
						disesuaikan.
					</span>
				</label>

				<!-- Mata Pelajaran Collapse -->
				<details
					class="collapse-arrow collapse rounded-xl border border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-800/40"
				>
					<summary class="collapse-title text-sm font-semibold text-slate-900 dark:text-zinc-100">
						Mata Pelajaran
						{#if isAdminRole}
							<span
								class="ml-1.5 inline-flex items-center rounded bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-zinc-700 dark:text-zinc-200"
								>Opsional untuk {adminRoleLabel}</span
							>
						{/if}
						{#if mataPelajaranIds.size > 0}
							<span
								class="ml-1.5 inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 tabular-nums dark:bg-blue-950/60 dark:text-blue-300"
								>{mataPelajaranIds.size}</span
							>
						{/if}
					</summary>
					<div class="collapse-content text-xs">
						<div class="space-y-3 pt-1">
							{#if isAdminRole}
								<div
									class="flex items-start gap-2 rounded-xl border border-blue-200/80 bg-blue-50/75 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
								>
									<Icon
										name="info"
										class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
									/>
									<span>
										Role <strong>{adminRoleLabel}</strong> memiliki akses manajerial penuh ke seluruh
										mata pelajaran. Bagian ini tidak perlu diisi.
									</span>
								</div>
							{:else}
								<p class="text-xs text-slate-600 dark:text-zinc-400">
									Pilih satu atau lebih mata pelajaran yang diajari. Khusus role "Wali Kelas" skip
									langkah ini, karena bawaan Wali Kelas sudah punya akses ke semua mata pelajaran.
								</p>
							{/if}
							{#if mataPelajaranIds.size > 0}
								<button
									type="button"
									class="inline-flex h-7 items-center rounded-lg border border-red-300 bg-red-50 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
									onclick={clearMapel}
								>
									Kosongkan pilihan mata pelajaran
								</button>
							{/if}
							{#if filteredMataPelajaran.length > 0}
								<div class="space-y-2">
									{#each filteredMataPelajaran as m (m.id)}
										<label
											class="flex cursor-pointer items-center gap-2 text-slate-800 dark:text-zinc-200"
										>
											<input
												type="checkbox"
												class="checkbox checkbox-sm rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
												checked={mataPelajaranIds.has(m.id)}
												onchange={() => toggleMapel(m.id)}
											/>
											<span class="text-xs">{m.nama}</span>
										</label>
									{/each}
								</div>
							{:else}
								<p class="text-xs text-slate-500 dark:text-zinc-400">
									- tidak ada mata pelajaran -
								</p>
							{/if}
						</div>
					</div>
				</details>

				<!-- Kelas Collapse -->
				<details
					class="collapse-arrow collapse rounded-xl border border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-800/40"
				>
					<summary class="collapse-title text-sm font-semibold text-slate-900 dark:text-zinc-100">
						Kelas
						{#if isAdminRole}
							<span
								class="ml-1.5 inline-flex items-center rounded bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-zinc-700 dark:text-zinc-200"
								>Opsional untuk {adminRoleLabel}</span
							>
						{/if}
						{#if visibleKelasCount > 0}
							<span
								class="ml-1.5 inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 tabular-nums dark:bg-blue-950/60 dark:text-blue-300"
								>{visibleKelasCount}</span
							>
						{/if}
					</summary>
					<div class="collapse-content text-xs">
						<div class="space-y-3 pt-1">
							{#if isAdminRole}
								<div
									class="flex items-start gap-2 rounded-xl border border-blue-200/80 bg-blue-50/75 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
								>
									<Icon
										name="info"
										class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
									/>
									<span>
										Role <strong>{adminRoleLabel}</strong> memiliki akses ke semua kelas. Bagian ini tidak
										perlu dipilih jika tidak merangkap wali kelas.
									</span>
								</div>
							{:else}
								<p class="text-xs text-slate-600 dark:text-zinc-400">
									Pilih satu atau lebih kelas yang bisa diakses
								</p>
							{/if}
							{#if visibleKelasCount > 0}
								<button
									type="button"
									class="inline-flex h-7 items-center rounded-lg border border-red-300 bg-red-50 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
									onclick={clearKelas}
								>
									Kosongkan pilihan kelas
								</button>
							{/if}
							{#if filteredKelasList.length > 0}
								<div class="space-y-2">
									<label
										class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 font-semibold text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
									>
										<input
											type="checkbox"
											class="checkbox checkbox-sm rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
											checked={allKelasSelected}
											onchange={toggleSelectAllKelas}
										/>
										<span class="text-xs">Pilih Semua</span>
									</label>
									{#each filteredKelasList as k (k.id)}
										<label
											class="flex cursor-pointer items-center gap-2 text-slate-800 dark:text-zinc-200"
										>
											<input
												type="checkbox"
												class="checkbox checkbox-sm rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
												checked={kelasIds.has(k.id)}
												onchange={() => toggleKelas(k.id)}
											/>
											<span class="text-xs">
												{k.nama}
												{#if k.fase}({k.fase}){/if}
												{#if waliKelasIdSet.has(k.id)}
													<span
														class="ml-1 inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
														>wali</span
													>
												{/if}
											</span>
										</label>
									{/each}
								</div>
							{:else}
								<p class="text-xs text-slate-500 dark:text-zinc-400">- tidak ada kelas -</p>
							{/if}
						</div>
					</div>
				</details>

				<!-- Nama + Role -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="flex flex-col gap-1.5 sm:col-span-2">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nama</span>
						<input
							id="form-nama"
							required
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							name="nama"
							bind:value={nama}
							placeholder="Contoh: Bruce Wayne, Bat."
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400"
							>Nama lengkap pengguna dan gelar</span
						>
					</label>

					<!-- Role (checkbox, boleh dikombinasi) -->
					<div class="flex flex-col gap-1.5 sm:col-span-2">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Role</span>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
							Centang lebih dari satu untuk akun peran ganda (contoh: operator yang juga guru atau
							wali kelas).
						</p>
						{#if roleHint}
							<p class="text-xs font-medium text-sky-700 dark:text-sky-400">{roleHint}</p>
						{/if}
					</div>
				</div>

				{#if rolesSet.has('pembina_eskul')}
					<div
						class="flex items-start gap-2 rounded-xl border border-blue-200/80 bg-blue-50/75 px-3.5 py-2.5 text-xs text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
					>
						<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
						<span>
							Akun <strong>Pembina Eskul (Eksternal)</strong> masuk menggunakan
							<strong>Nama Pengguna</strong>, tidak memerlukan NIK/pegawai sekolah, dan hanya
							mengelola ekstrakurikuler yang ditugaskan.
						</span>
					</div>
				{:else}
					<!-- NIK -->
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NIK Guru</span>
						<input
							id="form-nik"
							type="text"
							inputmode="numeric"
							maxlength="16"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							name="nik"
							bind:value={nik}
							placeholder="16 digit NIK"
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							Dipakai guru untuk masuk ke e-Rapor. Kosongkan jika akun ini hanya memakai nama
							pengguna (mis. admin).
						</span>
					</label>
				{/if}

				<!-- Akun -->
				<div class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Akun</span>
					<div class="flex flex-col gap-2 sm:flex-row">
						<div
							class="flex h-9 flex-1 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
						>
							<span class="pl-3 text-slate-500 dark:text-zinc-400"
								><Icon name="user" class="h-4 w-4" /></span
							>
							<input
								id="form-username"
								type="text"
								class="validator h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
								required
								placeholder="Nama pengguna"
								title="Hanya huruf, angka, atau tanda hubung"
								name="username"
								bind:value={username}
							/>
						</div>
						<div
							class="flex h-9 flex-1 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
						>
							<span class="pl-3 text-slate-500 dark:text-zinc-400"
								><Icon name="lock" class="h-4 w-4" /></span
							>
							<input
								id="form-password"
								type={showPassword ? 'text' : 'password'}
								class="validator h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
								name="password"
								placeholder={isEditMode
									? 'Kata sandi baru (kosongkan jika tidak diubah)'
									: 'Kata sandi'}
								bind:value={password}
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
					<p class="validator-hint hidden text-xs text-red-600">
						Isi nama pengguna dan kata sandi dulu!
					</p>
					<p class="text-xs text-slate-500 dark:text-zinc-400">
						{isEditMode
							? 'Nama pengguna wajib diisi. Kata sandi opsional (kosongkan jika tidak diubah).'
							: 'Nama pengguna dan kata sandi untuk masuk'}
					</p>
				</div>

				<!-- Hak Akses Collapse - ringkasan saja; editor tunggal ada di /pengguna/{id} -->
				<details
					class="collapse-arrow collapse rounded-xl border border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-800/40"
				>
					<summary class="collapse-title text-sm font-semibold text-slate-900 dark:text-zinc-100">
						Hak Akses
						<span
							class="ml-1.5 inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 tabular-nums dark:bg-blue-950/60 dark:text-blue-300"
							>{effectivePermissions.size}</span
						>
					</summary>
					<div class="collapse-content text-xs">
						<div class="space-y-3 pt-1">
							<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
								Rincian izin disunting di halaman <strong>Kelola izin</strong> agar tidak ada dua editor
								matriks yang bisa saling menimpa. Di sini hanya ringkasan; mengubah role di atas akan
								menerapkan template izin role tersebut saat disimpan.
							</p>
							{#if isAdminRole}
								<p class="text-xs font-medium text-sky-700 dark:text-sky-400">
									{adminRoleLabel} selalu memegang seluruh izin ({effectivePermissions.size} izin).
								</p>
							{:else}
								<p class="text-xs text-slate-700 dark:text-zinc-300">
									<strong>{effectivePermissions.size}</strong> dari {userPermissions.length} izin aktif.
									{#if multiKelas && hasEducator}
										Izin <em>pindah kelas</em> ditambahkan otomatis karena akun memegang lebih dari satu
										kelas.
									{/if}
								</p>
							{/if}
							{#if isEditMode}
								<a
									class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
									href={`/pengguna/${data.userDetail?.id}`}
								>
									<Icon name="lock" class="h-3.5 w-3.5" />
									Kelola izin
								</a>
							{/if}
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

			<div
				class="mt-6 flex items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800"
			>
				<a
					href="/master-data/pengguna"
					class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					><Icon name="left" class="h-4 w-4" /> Kembali</a
				>
				<button
					class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					type="submit"
					disabled={!isFormValid || submitting}
					><Icon name="save" class="h-4 w-4" /> {submitting ? 'Menyimpan...' : 'Simpan'}</button
				>
			</div>
		{/snippet}
	</FormEnhance>
</section>
