<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { jenisKelamin } from '$lib/statics';
	import {
		golonganByStatus,
		jabatanByGolongan,
		pangkatByGolongan,
		statusKepegawaianOptions
	} from '$lib/profile';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const profile = data.profile;

	const initialNama = profile?.pegawai?.nama ?? profile?.namaLengkap ?? '';
	const initialNip = profile?.pegawai?.nip ?? '';

	let namaLengkap = $state(initialNama);
	let nip = $state(initialNip);
	let tempatLahir = $state(profile?.tempatLahir ?? '');
	let tanggalLahir = $state(profile?.tanggalLahir ?? '');
	let jenisKelaminValue = $state(profile?.jenisKelamin ?? '');
	let ijazah = $state(profile?.ijazah ?? '');
	let tahunIjazah = $state(profile?.tahunIjazah != null ? String(profile.tahunIjazah) : '');
	let statusKepegawaian = $state(profile?.statusKepegawaian ?? '');
	let golongan = $state(profile?.golongan ?? '');
	let jabatan = $state(profile?.jabatan ?? '');
	let tanggalPangkat = $state(profile?.tanggalPangkat ?? '');
	let tanggalDiangkat = $state(profile?.tanggalDiangkat ?? '');
	let tanggalBekerja = $state(profile?.tanggalBekerja ?? '');
	let tanggalGajiBerkala = $state(profile?.tanggalGajiBerkala ?? '');

	const golonganOptions = $derived(golonganByStatus[statusKepegawaian] ?? []);
	const jabatanOptions = $derived(golongan ? (jabatanByGolongan[golongan] ?? []) : []);
	const isHonor = $derived(
		statusKepegawaian === 'Honor Pemda' || statusKepegawaian === 'Honorer Sekolah'
	);
	const isPppk = $derived(statusKepegawaian === 'PPPK');
	const isGajiBerkalaLocked = $derived(isHonor || isPppk);
	const pangkat = $derived(
		isGajiBerkalaLocked ? '-' : golongan ? (pangkatByGolongan[golongan] ?? '') : ''
	);

	$effect(() => {
		if (golonganOptions.length > 0) {
			if (!golonganOptions.includes(golongan)) golongan = golonganOptions[0];
		} else if (golongan) {
			golongan = '';
		}
	});

	$effect(() => {
		if (jabatanOptions.length > 0) {
			if (!jabatanOptions.includes(jabatan)) jabatan = jabatanOptions[0];
		} else if (jabatan) {
			jabatan = '';
		}
	});

	$effect(() => {
		if (isGajiBerkalaLocked) {
			tanggalPangkat = '-';
			tanggalGajiBerkala = '-';
		}
	});
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="space-y-4">
		<header class="border-b border-slate-200 pb-4 dark:border-zinc-800">
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Edit Profil
			</h1>
			<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
				Perbarui informasi profil pribadi Anda. Data tersimpan di akun {profile?.username ?? ''}.
			</p>
		</header>

		<FormEnhance action="?/save">
			{#snippet children({ submitting })}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nama Lengkap</span
						>
						<input
							type="text"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							placeholder="Contoh: Drs. H. Arif Rahman"
							bind:value={namaLengkap}
							name="namaLengkap"
							required
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							Terintegrasi dengan data pegawai pada halaman Manajemen Pengguna.
						</span>
					</label>
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NIP</span>
						<input
							type="text"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							placeholder="Contoh: NIP. 196508101988031001"
							bind:value={nip}
							name="nip"
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							Terintegrasi dengan data pegawai pada halaman Data Kelas.
						</span>
					</label>

					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Tempat Lahir</span
						>
						<input
							type="text"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							placeholder="Contoh: Pontianak"
							bind:value={tempatLahir}
							name="tempatLahir"
						/>
					</label>
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Tanggal Lahir</span
						>
						<input
							type="date"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							bind:value={tanggalLahir}
							name="tanggalLahir"
						/>
					</label>

					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Jenis Kelamin</span
						>
						<div class="relative flex items-center">
							<select
								class="validator h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={jenisKelaminValue}
								name="jenisKelamin"
							>
								<option value="" disabled>Pilih Jenis Kelamin</option>
								{#each Object.entries(jenisKelamin) as [value, label] (value)}
									<option {value}>{label}</option>
								{/each}
							</select>
							<span
								aria-hidden="true"
								class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
							>
								<Icon name="down" class="h-3.5 w-3.5" />
							</span>
						</div>
					</label>
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Ijazah</span>
						<input
							type="text"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							placeholder="Contoh: S1 PGSD"
							bind:value={ijazah}
							name="ijazah"
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400">Input ijazah terakhir</span>
					</label>

					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Tahun</span>
						<input
							type="number"
							min="1900"
							max="3000"
							inputmode="numeric"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							placeholder="Contoh: 2012"
							bind:value={tahunIjazah}
							name="tahunIjazah"
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400"
							>Input tahun lulus ijazah terakhir</span
						>
					</label>
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Status Kepegawaian</span
						>
						<div class="relative flex items-center">
							<select
								class="validator h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								bind:value={statusKepegawaian}
								name="statusKepegawaian"
							>
								<option value="" disabled>Pilih Status Kepegawaian</option>
								{#each statusKepegawaianOptions as option (option)}
									<option value={option}>{option}</option>
								{/each}
							</select>
							<span
								aria-hidden="true"
								class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
							>
								<Icon name="down" class="h-3.5 w-3.5" />
							</span>
						</div>
					</label>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Golongan</span>
						<div class="relative flex items-center">
							<select
								class="validator h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
								bind:value={golongan}
								name="golongan"
								disabled={golonganOptions.length === 0}
							>
								<option value="" disabled>Pilih Golongan</option>
								{#each golonganOptions as option (option)}
									<option value={option}>{option}</option>
								{/each}
							</select>
							<span
								aria-hidden="true"
								class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
							>
								<Icon name="down" class="h-3.5 w-3.5" />
							</span>
						</div>
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							Golongan otomatis menyesuaikan status kepegawaian.
						</span>
					</label>
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Jabatan</span>
						<div class="relative flex items-center">
							<select
								class="validator h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
								bind:value={jabatan}
								name="jabatan"
								disabled={jabatanOptions.length === 0}
							>
								<option value="" disabled>Pilih Jabatan</option>
								{#each jabatanOptions as option (option)}
									<option value={option}>{option}</option>
								{/each}
							</select>
							<span
								aria-hidden="true"
								class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
							>
								<Icon name="down" class="h-3.5 w-3.5" />
							</span>
						</div>
					</label>
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Pangkat</span>
						<input
							type="text"
							class="validator h-9 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs text-slate-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
							value={pangkat}
							placeholder="Otomatis dari golongan"
							disabled
							readonly
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							Pangkat otomatis mengikuti golongan dan tersimpan saat profil disimpan.
						</span>
					</label>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Diangkat</span>
						<input
							type="date"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							bind:value={tanggalDiangkat}
							name="tanggalDiangkat"
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400">Pertama kali diangkat</span>
					</label>
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Kerja di Sekolah Ini</span
						>
						<input
							type="date"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							bind:value={tanggalBekerja}
							name="tanggalBekerja"
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							Tanggal bekerja di sekolah ini sesuai SK.
						</span>
					</label>

					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Gaji Berkala</span
						>
						<input
							type="date"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
							bind:value={tanggalGajiBerkala}
							name="tanggalGajiBerkala"
							disabled={isGajiBerkalaLocked}
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400"
							>Gaji berkala yang akan datang</span
						>
					</label>
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Tanggal Pangkat Terakhir</span
						>
						<input
							type="date"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
							bind:value={tanggalPangkat}
							name="tanggalPangkat"
							disabled={isGajiBerkalaLocked}
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400"
							>Tanggal pangkat terakhir sesuai SK.</span
						>
					</label>
				</div>

				<div
					class="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800"
				>
					<a
						class="inline-flex h-9 items-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						href="/pengaturan">Batal</a
					>
					<button
						class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						type="submit"
						disabled={submitting}
					>
						<Icon name="save" class="h-4 w-4" />
						{submitting ? 'Menyimpan…' : 'Simpan Profil'}
					</button>
				</div>
			{/snippet}
		</FormEnhance>
	</div>
</section>
