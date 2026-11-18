<script lang="ts">
	import { invalidate, preloadData } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { jenisKelamin } from '$lib/statics';
	// deletion handled elsewhere; removed unused modal/toast imports
	let { data } = $props();
	let activeTab = $state(0);
	const totalTabs = 5;

	// openDeleteModal removed — deletion moved to dedicated route/modal
</script>

<FormEnhance
	action="?/save"
	enctype="multipart/form-data"
	init={data.murid}
	onsuccess={async ({ data: res }) => {
		await invalidate('app:murid');
		// navigate back to detail modal first, then dispatch update event
		history.back();
		const id = res?.id ?? data.murid?.id;
		if (!id) return;
		// delay refetch slightly so the detail modal can mount its listener
		setTimeout(async () => {
			try {
				const result = await preloadData('/murid/' + id);
				if (result.type === 'loaded' && result.status === 200 && result.data?.murid) {
					window.dispatchEvent(new CustomEvent('murid:updated', { detail: result.data.murid }));
				}
			} catch {
				void 0;
			}
		}, 120);
	}}
>
	{#snippet children({ submitting, invalid })}
		<h2 class="mb-4 text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
			{data.murid?.id ? 'Formulir Edit Murid Manual' : 'Formulir Tambah Murid Manual'}
		</h2>
		<div class="max-h-[60vh] overflow-y-auto sm:max-h-none sm:overflow-y-visible">
			<!-- Tab Isian -->
			<div class="tabs tabs-box bg-slate-100/80 p-1 dark:bg-zinc-800/70">
				<!-- data Murid -->
				<input
					type="radio"
					bind:group={activeTab}
					value={0}
					class="tab text-xs font-semibold"
					aria-label="Data Murid"
				/>
				<div
					class="tab-content mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- NIS -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NIS</span>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: 0030"
								name="nis"
							/>
						</label>
						<!-- NISN -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NISN</span>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: 8371612"
								name="nisn"
							/>
						</label>
					</div>

					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Nama Murid -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nama Murid</span>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Chairil Anwar"
								name="nama"
							/>
						</label>

						<!-- Kelas -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Kelas</span>
							<div class="relative flex items-center">
								<select
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									title="Pilih kelas"
									name="kelasId"
									required
								>
									<option value="" disabled selected>Pilih Kelas</option>
									{#each data.daftarKelas as kelas (kelas.id)}
										<option value={kelas.id}>
											{kelas.nama} &bullet; {kelas.fase}
										</option>
									{:else}
										<option value="" disabled selected>Belum ada data kelas</option>
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

					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Tempat lahir -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Tempat Lahir</span
							>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Kembayan"
								name="tempatLahir"
							/>
						</label>
						<!-- Tanggal Lahir -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Tanggal Lahir</span
							>
							<input
								type="date"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								name="tanggalLahir"
								required
							/>
						</label>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Jenis Kelamin -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Jenis Kelamin</span
							>
							<div class="relative flex items-center">
								<select
									class="validator h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									name="jenisKelamin"
									required
								>
									<option value="" disabled selected>Pilih Jenis Kelamin</option>
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
						<!-- Agama -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Agama</span>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Islam"
								name="agama"
							/>
						</label>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Pendidikan Sebelumnya -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Pendidikan Sebelumnya</span
							>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: TK Kencana Pertiwi"
								name="pendidikanSebelumnya"
							/>
						</label>
						<!-- Tanggal Masuk Sekolah Ini -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Tanggal masuk sekolah ini</span
							>
							<input
								type="date"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								name="tanggalMasuk"
								required
							/>
						</label>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Status Murid -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Status Murid</span
							>
							<div class="relative flex items-center">
								<select
									class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									name="status"
								>
									<option value="aktif">Aktif</option>
									<option value="lulus">Lulus</option>
									<option value="pindah">Pindah</option>
									<option value="keluar">Keluar</option>
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3.5 w-3.5" />
								</span>
							</div>
							<span class="text-xs text-slate-500 dark:text-zinc-400">
								Status Lulus membuka unggahan Ijazah Sekolah di tab Arsip.
							</span>
						</label>
						<!-- Tanggal Lulus -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Tanggal Lulus</span
							>
							<input
								type="date"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								name="tanggalLulus"
							/>
						</label>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Tanggal Keluar -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Tanggal Keluar (Jika Keluar/Pindah)</span
							>
							<input
								type="date"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								name="tanggalKeluar"
							/>
						</label>
						<!-- Alasan Keluar -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Alasan Keluar</span
							>
							<input
								type="text"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								name="alasanKeluar"
								placeholder="Contoh: Dikeluarkan, Mengundurkan diri, Pindah..."
							/>
						</label>
					</div>
				</div>

				<!-- data Orang Tua -->
				<input
					type="radio"
					bind:group={activeTab}
					value={1}
					class="tab text-xs font-semibold"
					aria-label="Data Orang Tua"
				/>
				<div
					class="tab-content mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Nama Ayah -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nama Ayah</span>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Agus"
								name="ayah.nama"
							/>
						</label>
						<!-- Nama Ibu -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nama Ibu</span>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Ratih"
								name="ibu.nama"
							/>
						</label>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Pekerjaan Ayah -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Pekerjaan Ayah</span
							>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Tani"
								name="ayah.pekerjaan"
							/>
						</label>
						<!-- Pekerjaan Ibu -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Pekerjaan Ibu</span
							>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: IRT"
								name="ibu.pekerjaan"
							/>
						</label>
					</div>
					<!-- Kontak -->
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Kontak</span>
						<input
							required
							type="text"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							placeholder="Nomor telepon atau WhatsApp"
							name="ayah.kontak"
						/>
					</label>
				</div>

				<!-- data Alamat Murid -->
				<input
					type="radio"
					bind:group={activeTab}
					value={2}
					class="tab text-xs font-semibold"
					aria-label="Data Alamat Murid"
				/>
				<div
					class="tab-content mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<!-- Alamat Jalan -->
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Jalan</span>
						<input
							required
							type="text"
							class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							placeholder="Contoh: Jalan Raya Noyan, Dusun Periji"
							name="alamat.jalan"
						/>
					</label>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Kelurahan/Desa -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Kelurahan/Desa</span
							>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Sungai Dangin"
								name="alamat.desa"
							/>
						</label>
						<!-- Kecamatan -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Kecamatan</span>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Noyan"
								name="alamat.kecamatan"
							/>
						</label>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Kabupaten -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Kabupaten</span>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Sanggau"
								name="alamat.kabupaten"
							/>
						</label>
						<!-- Provinsi -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Provinsi</span>
							<input
								required
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Kalimantan Barat"
								name="alamat.provinsi"
							/>
						</label>
					</div>
				</div>

				<!-- data Wali -->
				<input
					type="radio"
					bind:group={activeTab}
					value={3}
					class="tab text-xs font-semibold"
					aria-label="Data Wali (Opsional)"
				/>
				<div
					class="tab-content mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Nama Wali -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nama Wali</span>
							<input
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Hendra"
								name="wali.nama"
							/>
						</label>
						<!-- Pekerjaan Wali -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Pekerjaan Wali</span
							>
							<input
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: PNS"
								name="wali.pekerjaan"
							/>
						</label>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- Alamat Wali -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Alamat Wali</span
							>
							<input
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Jalan Raya Noyan, Dusun Periji"
								name="wali.alamat"
							/>
						</label>
						<!-- Kontak Wali -->
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Kontak</span>
							<input
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Nomor telepon atau WhatsApp"
								name="wali.kontak"
							/>
						</label>
					</div>
				</div>

				<!-- data Wali Asuh -->
				<input
					type="radio"
					bind:group={activeTab}
					value={4}
					class="tab text-xs font-semibold"
					aria-label="Wali Asuh (Opsional)"
				/>
				<div
					class="tab-content mt-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Nama Wali Asuh</span
							>
							<input
								type="text"
								class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: Budi Santoso"
								name="waliAsuhNama"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>NIP Wali Asuh
								<span class="font-normal text-slate-500 dark:text-zinc-400">(Opsional)</span
								></span
							>
							<input
								type="text"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: NIP 19940505 201803 1 008"
								name="waliAsuhNip"
							/>
						</label>
					</div>
				</div>
			</div>
		</div>
		<div
			class="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-end dark:border-zinc-800"
		>
			<button
				class="hidden h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 md:mr-auto md:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				type="button"
				onclick={() => history.back()}
			>
				<Icon name="close-sm" class="h-3.5 w-3.5" />
				Batal
			</button>

			{#if invalid}
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 max-sm:w-full dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
					type="button"
					onclick={() => (activeTab = (activeTab + 1) % totalTabs)}
				>
					<Icon name="double-arrow" class="h-4 w-4" />
					Selanjutnya
				</button>
			{/if}

			<div class="flex flex-row justify-between gap-2 max-sm:w-full sm:ml-2 md:contents">
				<button
					class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 md:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="button"
					onclick={() => history.back()}
				>
					<Icon name="close-sm" class="h-3.5 w-3.5" />
					Batal
				</button>

				<div
					class="tooltip tooltip-left tooltip-error {data.murid?.id}"
					data-tip={submitting || invalid
						? 'Ada data lain yang belum terisi, mohon periksa terlebih dahulu!'
						: ''}
				>
					<button
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						type="submit"
						disabled={submitting || invalid}
					>
						{#if submitting}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<Icon name="save" class="h-3.5 w-3.5" />
						{/if}
						Simpan
					</button>
				</div>
			</div>
		</div>
	{/snippet}
</FormEnhance>

<!-- delete-confirm modal logic merged into top-level script -->
