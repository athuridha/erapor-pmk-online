<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { hideModal, updateModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { onMount, untrack } from 'svelte';

	interface GuruItem {
		id: number;
		nama: string;
	}

	interface PengikutItem {
		key: number;
		nama: string;
		tempatLahir: string;
		tanggalLahir: string;
	}

	interface EditSppdData {
		id: number;
		nomorSuratTugas: string | null;
		tanggalSuratTugas: string | null;
		dasarSuratTugas: string | null;
		maksud: string;
		alatAngkut: string | null;
		tempatBerangkat: string | null;
		tempatTujuan: string | null;
		lamanya: string | null;
		tanggalBerangkat: string;
		tanggalKembali: string;
		keteranganPengikut: string | null;
		kodeRekening: string | null;
		tingkatBiaya: string | null;
		keteranganLain: string | null;
		pegawai: { authUserId: number | null }[];
		pengikut: { nama: string; tempatLahir: string; tanggalLahir: string }[];
	}

	interface Props {
		guruList: GuruItem[];
		sppd?: EditSppdData;
		prefill?: {
			maksud: string;
			authUserId: number;
			permohonanId: number;
		};
	}

	let { guruList, sppd, prefill }: Props = $props();

	const editSppd = $state<EditSppdData | null>(untrack(() => sppd ?? null));
	const isEdit = !!editSppd;

	// svelte-ignore state_referenced_locally
	const prefillAuthUserId = prefill?.authUserId;
	const prefillUserIdInGuruList =
		prefillAuthUserId != null && untrack(() => guruList).some((g) => g.id === prefillAuthUserId)
			? prefillAuthUserId
			: null;

	let selectedPegawaiIds = $state<number[]>(
		editSppd
			? editSppd.pegawai.map((p) => p.authUserId).filter((v): v is number => v !== null)
			: prefillUserIdInGuruList
				? [prefillUserIdInGuruList]
				: []
	);
	let nomorSuratTugas = $state(editSppd?.nomorSuratTugas ?? '');
	let tanggalSuratTugas = $state(editSppd?.tanggalSuratTugas ?? '');
	let dasarSuratTugas = $state(editSppd?.dasarSuratTugas ?? '');
	// svelte-ignore state_referenced_locally
	let maksud = $state(editSppd?.maksud ?? prefill?.maksud ?? '');
	let alatAngkut = $state(editSppd?.alatAngkut ?? '');
	let tempatBerangkat = $state(editSppd?.tempatBerangkat ?? '');
	let tempatTujuan = $state(editSppd?.tempatTujuan ?? '');
	let lamanya = $state(editSppd?.lamanya ?? '');
	let tanggalBerangkat = $state(editSppd?.tanggalBerangkat ?? '');
	let tanggalKembali = $state(editSppd?.tanggalKembali ?? '');
	let pengikut = $state<PengikutItem[]>(
		editSppd
			? editSppd.pengikut.map((p, i) => ({
					key: i + 1,
					nama: p.nama,
					tempatLahir: p.tempatLahir,
					tanggalLahir: p.tanggalLahir
				}))
			: []
	);
	let keteranganPengikut = $state(editSppd?.keteranganPengikut ?? '');
	let kodeRekening = $state(editSppd?.kodeRekening ?? '');
	let tingkatBiaya = $state(editSppd?.tingkatBiaya ?? '');
	let keteranganLain = $state(editSppd?.keteranganLain ?? '');
	let submitting = $state(false);

	let pengikutKey = editSppd?.pengikut.length ?? 0;

	function togglePegawai(id: number, checked: boolean) {
		if (checked) {
			if (!selectedPegawaiIds.includes(id)) {
				selectedPegawaiIds = [...selectedPegawaiIds, id];
			}
		} else {
			selectedPegawaiIds = selectedPegawaiIds.filter((v) => v !== id);
		}
	}

	function addPengikut() {
		pengikut = [...pengikut, { key: ++pengikutKey, nama: '', tempatLahir: '', tanggalLahir: '' }];
	}

	function removePengikut(index: number) {
		pengikut = pengikut.filter((_, i) => i !== index);
	}

	onMount(() => {
		updateModal({
			onPositive: {
				label: 'Simpan',
				class: 'btn-primary',
				action: () => void submit()
			},
			onNegative: undefined,
			onNeutral: { label: 'Batal', action: () => hideModal() },
			spreadActions: true
		});
	});

	function pengikutHasContent(p: PengikutItem) {
		return !!(p.nama.trim() || p.tempatLahir.trim() || p.tanggalLahir);
	}

	async function submit() {
		if (submitting) return;

		if (selectedPegawaiIds.length === 0) {
			toast('Pilih minimal satu pegawai yang melaksanakan perjalanan dinas', 'warning');
			return;
		}
		if (!maksud.trim()) {
			toast('Maksud Perjalanan Dinas wajib diisi', 'warning');
			return;
		}
		if (!tanggalBerangkat) {
			toast('Tanggal berangkat wajib diisi', 'warning');
			return;
		}
		if (!tanggalKembali) {
			toast('Tanggal kembali wajib diisi', 'warning');
			return;
		}
		if (tanggalKembali < tanggalBerangkat) {
			toast('Tanggal kembali tidak boleh sebelum tanggal berangkat', 'warning');
			return;
		}
		for (const p of pengikut) {
			if (!pengikutHasContent(p)) continue;
			if (!p.nama.trim()) {
				toast('Nama pengikut wajib diisi', 'warning');
				return;
			}
			if (!p.tempatLahir.trim()) {
				toast('Tempat lahir pengikut wajib diisi', 'warning');
				return;
			}
			if (!p.tanggalLahir) {
				toast('Tanggal lahir pengikut wajib diisi', 'warning');
				return;
			}
		}

		submitting = true;
		try {
			const res = await fetch(isEdit ? `/api/sppd?id=${editSppd.id}` : '/api/sppd', {
				method: isEdit ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...(prefill?.permohonanId ? { permohonanId: prefill.permohonanId } : {}),
					nomorSuratTugas: nomorSuratTugas.trim() || null,
					tanggalSuratTugas: tanggalSuratTugas || null,
					dasarSuratTugas: dasarSuratTugas.trim() || null,
					maksud: maksud.trim(),
					alatAngkut: alatAngkut.trim() || null,
					tempatBerangkat: tempatBerangkat.trim() || null,
					tempatTujuan: tempatTujuan.trim() || null,
					lamanya: lamanya.trim() || null,
					tanggalBerangkat,
					tanggalKembali,
					pegawaiIds: selectedPegawaiIds,
					pengikut: pengikut
						.filter((p) => pengikutHasContent(p))
						.map((p) => ({
							nama: p.nama.trim(),
							tempatLahir: p.tempatLahir.trim(),
							tanggalLahir: p.tanggalLahir
						})),
					keteranganPengikut: keteranganPengikut.trim() || null,
					kodeRekening: kodeRekening.trim() || null,
					tingkatBiaya: tingkatBiaya.trim() || null,
					keteranganLain: keteranganLain.trim() || null
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(
					(data as { message?: string }).message ?? `Terjadi kesalahan (${res.status})`
				);
			}
			hideModal();
			await invalidate('app:sppd');
			toast(
				(data as { message?: string }).message ??
					(isEdit ? 'Dinas luar berhasil diperbarui' : 'Dinas luar berhasil disimpan'),
				'success'
			);
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menyimpan data', 'error');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="not-prose flex flex-col gap-4">
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div>
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
				>Nomor Surat Tugas</span
			>
			<input
				type="text"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				bind:value={nomorSuratTugas}
				placeholder="contoh: 422/12/SD.19/Adm/2026"
				disabled={submitting}
			/>
		</div>

		<div>
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
				>Tanggal Surat Tugas</span
			>
			<input
				type="date"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={tanggalSuratTugas}
				disabled={submitting}
			/>
		</div>
	</div>

	<div>
		<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
			>Dasar Surat Tugas</span
		>
		<textarea
			class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			bind:value={dasarSuratTugas}
			placeholder="Contoh: berdasarkan undangan dari Dinas nomor xxx tanggal xxx"
			rows={3}
			disabled={submitting}></textarea>
	</div>

	<div>
		<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
			Nama yang melaksanakan perjalanan dinas
			<span class="text-red-500">*</span>
		</span>
		{#if guruList.length === 0}
			<p class="text-xs text-slate-500 dark:text-zinc-400">Belum ada guru/staff yang terdaftar.</p>
		{:else}
			<div
				class="max-h-48 space-y-0.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 dark:border-zinc-800 dark:bg-zinc-800/50"
			>
				{#each guruList as guru (guru.id)}
					<label
						class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white dark:hover:bg-zinc-800"
					>
						<input
							type="checkbox"
							class="checkbox checkbox-sm checkbox-primary"
							checked={selectedPegawaiIds.includes(guru.id)}
							onchange={(e) =>
								togglePegawai(guru.id, (e.currentTarget as HTMLInputElement).checked)}
						/>
						<span class="text-xs font-medium text-slate-800 dark:text-zinc-200">{guru.nama}</span>
					</label>
				{/each}
			</div>
			<p class="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
				Pilih satu atau lebih pegawai.
			</p>
		{/if}
	</div>

	<div>
		<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
			Maksud Perjalanan Dinas
			<span class="text-red-500">*</span>
		</span>
		<textarea
			class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			bind:value={maksud}
			placeholder="Contoh: Menghadiri seminar, rapat, dsb."
			rows={3}
			disabled={submitting}></textarea>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div>
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
				>Alat angkut yang digunakan</span
			>
			<input
				type="text"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				bind:value={alatAngkut}
				placeholder="Contoh: Mobil, Motor, Sepeda, dsb."
				disabled={submitting}
			/>
		</div>

		<div>
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
				>Lamanya Perjalanan Dinas</span
			>
			<input
				type="text"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				bind:value={lamanya}
				placeholder="Contoh: 1 hari, 2 hari, dsb."
				disabled={submitting}
			/>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div>
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
				>Tempat Berangkat</span
			>
			<input
				type="text"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				bind:value={tempatBerangkat}
				placeholder="Contoh: Kantor, Rumah, dsb."
				disabled={submitting}
			/>
		</div>

		<div>
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
				>Tempat Tujuan</span
			>
			<input
				type="text"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				bind:value={tempatTujuan}
				placeholder="Contoh: Kantor BKPSDM, Kantor Bupati, dsb."
				disabled={submitting}
			/>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div>
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
				Tanggal Berangkat
				<span class="text-red-500">*</span>
			</span>
			<input
				type="date"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={tanggalBerangkat}
				disabled={submitting}
			/>
		</div>

		<div>
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
				Tanggal Kembali
				<span class="text-red-500">*</span>
			</span>
			<input
				type="date"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={tanggalKembali}
				disabled={submitting}
			/>
		</div>
	</div>

	<div
		class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
	>
		<div class="mb-2.5 flex items-center justify-between gap-2">
			<span class="text-xs font-bold text-slate-900 dark:text-zinc-100"
				>Pengikut Perjalanan Dinas</span
			>
			<button
				type="button"
				class="inline-flex h-8 items-center justify-center gap-1 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={addPengikut}
				disabled={submitting}
			>
				<Icon name="plus" class="h-3.5 w-3.5" />
				Tambah Pengikut
			</button>
		</div>

		{#if pengikut.length === 0}
			<p class="text-xs text-slate-500 dark:text-zinc-400">Belum ada pengikut.</p>
		{:else}
			<div class="space-y-3">
				{#each pengikut as p, i (p.key)}
					<div
						class="space-y-3 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
					>
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-semibold text-slate-900 dark:text-zinc-100"
								>Pengikut {i + 1}</span
							>
							<button
								type="button"
								class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
								onclick={() => removePengikut(i)}
								disabled={submitting}
								aria-label="Hapus pengikut"
								title="Hapus pengikut"
							>
								<Icon name="del" class="h-3.5 w-3.5" />
							</button>
						</div>
						<div>
							<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Nama Pengikut</span
							>
							<input
								type="text"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
								bind:value={p.nama}
								placeholder="Contoh: Budi Santoso, Siti Aminah, dsb."
								disabled={submitting}
							/>
						</div>
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div>
								<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
									>Tempat Lahir Pengikut</span
								>
								<input
									type="text"
									class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
									bind:value={p.tempatLahir}
									placeholder="Contoh: Jakarta, Bandung, dsb."
									disabled={submitting}
								/>
							</div>
							<div>
								<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
									>Tanggal Lahir Pengikut</span
								>
								<input
									type="date"
									class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
									bind:value={p.tanggalLahir}
									disabled={submitting}
								/>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-3">
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
				>Keterangan Pengikut</span
			>
			<input
				type="text"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				bind:value={keteranganPengikut}
				placeholder="Contoh: Keluarga, Sopir, dsb."
				disabled={submitting}
			/>
		</div>
	</div>

	<div>
		<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
			>Kode rekening pembebanan anggaran</span
		>
		<input
			type="text"
			class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			bind:value={kodeRekening}
			placeholder="Masukkan kode rekening di arkas jika ada"
			disabled={submitting}
		/>
	</div>

	<div>
		<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
			>Tingkat biaya perjalanan dinas</span
		>
		<input
			type="text"
			class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			bind:value={tingkatBiaya}
			placeholder="Contoh: Perjalanan dinas dalam kota/daerah"
			disabled={submitting}
		/>
	</div>

	<div>
		<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
			>Keterangan lain-lain</span
		>
		<textarea
			class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			rows="3"
			bind:value={keteranganLain}
			placeholder="Masukkan keterangan yang diperlukan"
			disabled={submitting}></textarea>
	</div>
</div>
