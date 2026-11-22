<script lang="ts">
	/* eslint-disable svelte/valid-prop-names-in-kit-pages -- komponen ini juga dipakai di modal. */
	import { invalidateAll } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { modalRoute } from '$lib/utils';
	import type { PageData } from './$types';

	let {
		data,
		modal = false,
		onclose
	}: { data: PageData; modal?: boolean; onclose?: () => void } = $props();

	const p = $derived(data.pegawai);
	const inisial = $derived(
		p.nama
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((k) => k[0]?.toUpperCase() ?? '')
			.join('')
	);
	const roleLabel = $derived.by(() => {
		const roles = data.account?.roles ?? [];
		if (roles.length) return roles.map(labelRole).join(' + ');
		return data.account?.type ? labelRole(data.account.type) : '';
	});
	const kelasWali = $derived(data.waliKelas.map((k) => k.nama).join(', '));
	const mapelLabel = $derived(data.mapel.map((m) => m.nama).join(', '));
	const kelasLabel = $derived(data.kelas.map((k) => k.nama).join(', '));
	const ekskulLabel = $derived(data.ekskul.map((e) => e.nama).join(', '));
	const statusAktif = $derived(p.statusAktif === 'nonaktif' ? 'Nonaktif' : 'Aktif');

	function labelRole(role: string) {
		return role
			.split('_')
			.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
			.join(' ');
	}

	function handleSaved() {
		toast('Profil guru diperbarui', 'success');
		if (modal) onclose?.();
		else invalidateAll();
	}
</script>

<section
	class={modal
		? 'w-full'
		: 'mx-auto w-full rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900'}
>
	<header
		class="mb-5 flex items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-zinc-800"
	>
		<div class="flex min-w-0 items-center gap-3">
			{#if p.fotoProfil}
				<img
					src={p.fotoProfil}
					alt="Foto {p.nama}"
					class="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 object-cover dark:border-zinc-700"
				/>
			{:else}
				<div
					class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-base font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
				>
					{inisial || '-'}
				</div>
			{/if}
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
						{p.nama}
					</h1>
					<span
						class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold {p.statusAktif ===
						'nonaktif'
							? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
							: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}"
					>
						{statusAktif}
					</span>
				</div>
				<p class="mt-0.5 truncate text-xs text-slate-600 dark:text-zinc-400">
					{roleLabel || 'Guru'}
					{#if data.account?.username}
						· <span class="font-mono">{data.account.username}</span>
					{/if}
				</p>
			</div>
		</div>
		{#if modal}
			<button
				type="button"
				class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
				onclick={onclose}
				aria-label="Tutup"
			>
				<Icon name="close" class="h-4 w-4" />
			</button>
		{/if}
	</header>

	<FormEnhance
		action="?/save"
		enctype="multipart/form-data"
		onsuccess={handleSaved}
		updateAfterSuccess={false}
	>
		{#snippet children({ submitting })}
			<div class="space-y-5">
				<!-- 1. Informasi profil guru -->
				<div>
					<h2 class="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-zinc-400">
						1. Informasi Profil Guru
					</h2>
					<div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div class="sm:col-span-2">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Foto Profil
							</span>
							<div class="mt-1.5 flex flex-wrap items-center gap-2">
								<input
									type="file"
									name="foto"
									accept="image/png,image/jpeg,image/webp"
									class="block w-full max-w-sm text-xs text-slate-700 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100 dark:text-zinc-300 dark:file:bg-blue-950/60 dark:file:text-blue-300"
								/>
								{#if p.fotoProfil}
									<label
										class="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-zinc-400"
									>
										<input
											type="checkbox"
											name="hapusFoto"
											value="1"
											class="checkbox checkbox-xs"
										/>
										Hapus foto
									</label>
								{/if}
							</div>
							<p class="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
								PNG/JPG/WEBP, maksimal 400 KB.
							</p>
						</div>
						<label class="flex flex-col gap-1.5 sm:col-span-2">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Nama Lengkap
							</span>
							<input
								name="nama"
								required
								value={p.nama}
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NIP</span>
							<input
								name="nip"
								value={p.nip}
								inputmode="numeric"
								placeholder="Nomor Induk Pegawai"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NUPTK</span>
							<input
								name="nuptk"
								value={p.nuptk ?? ''}
								inputmode="numeric"
								placeholder="16 digit, opsional"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NIK</span>
							<input
								name="nik"
								value={p.nik ?? ''}
								inputmode="numeric"
								maxlength="16"
								placeholder="16 digit, untuk login guru"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Jenis Kelamin
							</span>
							<select
								name="jenisKelamin"
								value={p.jenisKelamin ?? ''}
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							>
								<option value="">Belum diisi</option>
								<option value="L">Laki-laki</option>
								<option value="P">Perempuan</option>
							</select>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Tempat Lahir
							</span>
							<input
								name="tempatLahir"
								value={p.tempatLahir ?? ''}
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Tanggal Lahir
							</span>
							<input
								type="date"
								name="tanggalLahir"
								value={p.tanggalLahir ?? ''}
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5 sm:col-span-2">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Alamat</span>
							<textarea
								name="alamat"
								rows="2"
								value={p.alamat ?? ''}
								placeholder="Alamat domisili"
								class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							></textarea>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nomor HP</span>
							<input
								name="noHp"
								value={p.noHp ?? ''}
								inputmode="tel"
								placeholder="08xx"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Email</span>
							<input
								type="email"
								name="email"
								value={p.email ?? ''}
								placeholder="email@sekolah.sch.id"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							/>
						</label>
					</div>
				</div>

				<!-- 2. Informasi kepegawaian -->
				<div>
					<h2 class="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-zinc-400">
						2. Informasi Kepegawaian
					</h2>
					<p class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
						Biasanya dikelola operator/admin.
					</p>
					<div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Status Kepegawaian
							</span>
							<select
								name="statusKepegawaian"
								value={p.statusKepegawaian ?? ''}
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							>
								<option value="">Belum diisi</option>
								<option value="PNS">PNS</option>
								<option value="PPPK">PPPK</option>
								<option value="GTY">GTY</option>
								<option value="GTT">GTT</option>
								<option value="Honor">Honor</option>
								<option value="Lainnya">Lainnya</option>
							</select>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Jabatan</span>
							<input
								name="jabatan"
								value={p.jabatan ?? ''}
								placeholder="Guru, Wali Kelas, dst."
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Pangkat / Golongan
							</span>
							<input
								name="pangkatGolongan"
								value={p.pangkatGolongan ?? ''}
								placeholder="Contoh: III/a"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Status Aktif
							</span>
							<select
								name="statusAktif"
								value={p.statusAktif ?? 'aktif'}
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							>
								<option value="aktif">Aktif</option>
								<option value="nonaktif">Nonaktif</option>
							</select>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Tanggal Mulai Bertugas
							</span>
							<input
								type="date"
								name="tanggalMulaiTugas"
								value={p.tanggalMulaiTugas ?? ''}
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Pendidikan Terakhir
							</span>
							<select
								name="pendidikanTerakhir"
								value={p.pendidikanTerakhir ?? ''}
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							>
								<option value="">Belum diisi</option>
								<option value="SMA/SMK">SMA/SMK</option>
								<option value="D3">D3</option>
								<option value="S1">S1</option>
								<option value="S2">S2</option>
								<option value="S3">S3</option>
							</select>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Program Studi / Jurusan
							</span>
							<input
								name="programStudi"
								value={p.programStudi ?? ''}
								placeholder="Contoh: Pendidikan Informatika"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Instansi / Sekolah
							</span>
							<input
								readonly
								value={data.sekolahNama ?? '-'}
								class="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
							/>
						</label>
					</div>
				</div>

				<!-- 3. Informasi akademik -->
				<div>
					<h2 class="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-zinc-400">
						3. Informasi Akademik
					</h2>
					<dl class="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
						<div class="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-zinc-800">
							<dt class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Wali Kelas</dt>
							<dd class="mt-0.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
								{kelasWali || 'Belum menjadi wali kelas'}
							</dd>
						</div>
						<div class="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-zinc-800">
							<dt class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
								Mata Pelajaran
							</dt>
							<dd class="mt-0.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
								{mapelLabel || '-'}
							</dd>
						</div>
						<div class="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-zinc-800">
							<dt class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
								Kelas Mengajar
							</dt>
							<dd class="mt-0.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
								{kelasLabel || '-'}
							</dd>
						</div>
						<div class="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-zinc-800">
							<dt class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
								Pembina Ekstrakurikuler
							</dt>
							<dd class="mt-0.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
								{ekskulLabel || '-'}
							</dd>
						</div>
						<div class="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-zinc-800">
							<dt class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
								Jam Mengajar
							</dt>
							<dd class="mt-0.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">-</dd>
						</div>
						<div class="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-zinc-800">
							<dt class="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
								Tahun Ajaran / Semester Aktif
							</dt>
							<dd class="mt-0.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
								{data.academic.tahunAjaran ?? '-'} / {data.academic.semester ?? '-'}
							</dd>
						</div>
					</dl>
				</div>

				<!-- 4. Pengaturan akun -->
				{#if data.account}
					<div>
						<h2 class="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-zinc-400">
							4. Pengaturan Akun
						</h2>
						<div
							class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-800/40"
						>
							<div class="text-xs text-slate-600 dark:text-zinc-300">
								Username <strong class="font-mono">{data.account.username}</strong> · {roleLabel} ·
								{data.account.permissionsCount} izin aktif
							</div>
							<div class="flex flex-wrap gap-2">
								<a
									href={`/pengguna/${data.account.id}`}
									class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
								>
									<Icon name="lock" class="h-3.5 w-3.5" /> Kelola izin
								</a>
								<a
									href={`/pengguna/form/${data.account.id}`}
									use:modalRoute={'edit-pengguna'}
									class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
								>
									<Icon name="edit" class="h-3.5 w-3.5" /> Ubah akun &amp; peran
								</a>
							</div>
						</div>
						<p class="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
							Ganti kata sandi guru lewat tombol <strong>Ubah akun &amp; peran</strong>.
						</p>
					</div>
				{/if}
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
					disabled={submitting}
				>
					<Icon name="save" class="h-4 w-4" />
					{submitting ? 'Menyimpan...' : 'Simpan Profil'}
				</button>
			</div>
		{/snippet}
	</FormEnhance>
</section>
