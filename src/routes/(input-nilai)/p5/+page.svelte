<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';

	type RatingLabels = Record<string, string>;

	type Projek = {
		id: number;
		kelasId: number;
		tema: string;
		judul: string;
		catatan: string | null;
		kelas: { id: number; nama: string; fase: string | null } | null;
		pembina: { id: number; nama: string } | null;
		anggotaIds: number[];
		anggotaCount: number;
		dinilaiCount: number;
		dimensiDinilai: string[];
		ratingCount: Record<string, number>;
	};

	type PageData = {
		tableReady: boolean;
		kelasAktifId: number | null;
		projek: Projek[];
		daftarKelas: Array<{ id: number; nama: string; fase: string | null }>;
		pembinaList: Array<{ id: number; nama: string }>;
		muridList: Array<{ id: number; nama: string; kelasId: number }>;
		temaList: string[];
		ratingLabels: RatingLabels;
	};

	let { data }: { data: PageData } = $props();

	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return null;
		return kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
	});

	/** Pilihan kelas lokal halaman ini (?kelas_id=); tidak mengubah halaman lain. */
	function pilihKelas(kelasId: number) {
		goto(`/p5?kelas_id=${kelasId}`, { invalidateAll: true });
	}

	type UserLite = { type?: string; operatorLevel?: string | null; ownKelasIds?: number[] | null };
	const user = $derived((page.data.user as UserLite | null | undefined) ?? null);

	// Server guard is source of truth; this mirrors it so disabled states match.
	function mayManageKelas(kelasId: number | null | undefined) {
		if (!user) return false;
		const role = user.operatorLevel ?? user.type ?? '';
		if (role === 'admin' || role === 'kepala_sekolah') return true;
		if (role === 'wali_asuh') return false;
		return (user.ownKelasIds ?? []).includes(kelasId ?? -1);
	}
	const canTambah = $derived(
		data.tableReady && (data.kelasAktifId == null || mayManageKelas(data.kelasAktifId))
	);

	// Modal tambah projek
	let tambahOpen = $state(false);
	let addKelasId = $state('');
	let addTema = $state('');
	let addJudul = $state('');
	let addPembinaId = $state('');
	let addCatatan = $state('');
	let addSubmitting = $state(false);
	const addDisabled = $derived.by(
		() => addSubmitting || !addJudul.trim() || !addKelasId || !addTema
	);

	// Modal anggota projek
	let anggotaOpen = $state(false);
	let anggotaProjek: Projek | null = $state(null);
	let anggotaSelected = $state<number[]>([]);
	let anggotaSubmitting = $state(false);

	const anggotaMurid = $derived.by(() => {
		const projek = anggotaProjek;
		if (!projek) return [];
		return data.muridList.filter((murid) => murid.kelasId === projek.kelasId);
	});
	const anggotaAddIds = $derived.by(() => {
		const projek = anggotaProjek;
		if (!projek) return [];
		return anggotaSelected.filter((id) => !projek.anggotaIds.includes(id));
	});
	const anggotaRemoveIds = $derived.by(() => {
		const projek = anggotaProjek;
		if (!projek) return [];
		return projek.anggotaIds.filter((id) => !anggotaSelected.includes(id));
	});
	const anggotaTanpaPerubahan = $derived(
		anggotaAddIds.length === 0 && anggotaRemoveIds.length === 0
	);

	function escapeHtml(value: string) {
		return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
	}

	function openTambah() {
		addKelasId = data.kelasAktifId != null ? String(data.kelasAktifId) : '';
		addTema = '';
		addJudul = '';
		addPembinaId = '';
		addCatatan = '';
		tambahOpen = true;
	}

	function closeTambah() {
		tambahOpen = false;
		addSubmitting = false;
	}

	function openAnggota(projek: Projek) {
		anggotaProjek = projek;
		anggotaSelected = [...projek.anggotaIds];
		anggotaOpen = true;
	}

	function closeAnggota() {
		anggotaOpen = false;
		anggotaProjek = null;
		anggotaSubmitting = false;
	}

	function toggleAnggota(muridId: number, checked: boolean) {
		anggotaSelected = checked
			? [...new Set([...anggotaSelected, muridId])]
			: anggotaSelected.filter((id) => id !== muridId);
	}

	function confirmHapus(projek: Projek) {
		if (!data.tableReady || !mayManageKelas(projek.kelasId)) return;
		showModal({
			title: 'Hapus Projek P5',
			dismissible: true,
			body: `<p>Hapus projek <strong>${escapeHtml(projek.judul)}</strong>?${
				projek.kelas ? ` (Kelas ${escapeHtml(projek.kelas.nama)})` : ''
			}</p><p>Anggota dan nilai P5 projek ini ikut terhapus.</p>`,
			onNegative: { label: 'Batal' },
			onPositive: {
				label: 'Hapus',
				icon: 'del',
				class: 'btn-error',
				action: async ({ close }) => {
					const formData = new FormData();
					formData.set('id', String(projek.id));
					try {
						const response = await fetch('?/hapusProjek', {
							method: 'POST',
							body: formData
						});
						const payload = await response.json().catch(() => ({}));
						if (!response.ok || payload?.type === 'failure') {
							toast({
								message: payload?.data?.fail ?? 'Gagal menghapus projek.',
								type: 'error'
							});
							return;
						}
						close();
						toast({
							message: payload?.data?.message ?? 'Projek P5 berhasil dihapus',
							type: 'success'
						});
						await invalidate('app:p5');
					} catch {
						toast({ message: 'Terjadi kesalahan saat menghapus projek.', type: 'error' });
					}
				}
			}
		});
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between dark:border-zinc-800"
	>
		<div class="min-w-0">
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				P5 (Projek Pancasila)
			</h1>
			{#if kelasAktifLabel}
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Kelas: <span class="font-medium text-slate-800 dark:text-zinc-200">{kelasAktifLabel}</span
					>
				</p>
			{:else}
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Pilih kelas pada dropdown di bawah untuk melihat projek P5 kelas tertentu, atau tambah
					projek lalu pilih kelasnya pada modal.
				</p>
			{/if}
			{#if data.daftarKelas.length > 0}
				<label class="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
					<span class="font-semibold text-slate-700 dark:text-zinc-300">Kelas</span>
					<div class="relative flex w-full items-center sm:w-64">
						<select
							class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							value={data.kelasAktifId ?? ''}
							onchange={(event) => {
								const nilai = Number((event.currentTarget as HTMLSelectElement).value);
								if (Number.isInteger(nilai) && nilai > 0) pilihKelas(nilai);
							}}
						>
							<option value="">Pilih kelas...</option>
							{#each data.daftarKelas as kelas (kelas.id)}
								<option value={kelas.id}>
									{kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama}
								</option>
							{/each}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
				</label>
			{/if}
		</div>
		<div class="flex flex-row max-sm:w-full">
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 max-sm:w-full dark:bg-blue-500 dark:hover:bg-blue-600"
				disabled={!data.tableReady || !canTambah}
				onclick={openTambah}
				title={!canTambah ? 'Anda tidak memiliki izin untuk menambah' : 'Tambah projek P5'}
				aria-disabled={!data.tableReady || !canTambah}
			>
				<Icon name="plus" class="h-4 w-4" />
				Tambah Projek
			</button>
		</div>
	</div>

	{#if !data.tableReady}
		<div
			class="mt-4 flex items-center gap-2.5 rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200"
		>
			<Icon name="warning" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
			<span>
				Database P5 belum siap. Jalankan <code>pnpm db:push</code> untuk menerapkan migrasi terbaru.
			</span>
		</div>
	{/if}

	{#if data.tableReady && data.projek.length === 0}
		<div
			class="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Belum ada projek P5{kelasAktifLabel ? ' pada kelas ini' : ''}.</span>
		</div>
	{/if}

	<div class="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
		{#each data.projek as projek (projek.id)}
			{@const bolehKelola = mayManageKelas(projek.kelasId)}
			<div
				class="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
			>
				<div>
					<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div class="min-w-0">
							<span
								class="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
							>
								<Icon name="star" class="h-3 w-3" />
								{projek.tema}
							</span>
							<h2 class="mt-2 truncate text-base font-bold text-slate-900 dark:text-zinc-100">
								{projek.judul}
							</h2>
							<p class="mt-1 text-xs text-slate-600 dark:text-zinc-400">
								<span class="inline-flex items-center gap-1">
									<Icon name="users" class="h-3.5 w-3.5" />
									Anggota: {projek.anggotaCount}
								</span>
								· {#if projek.pembina}Pembina: {projek.pembina.nama}{:else}
									Tanpa pembina{/if}
								{#if projek.kelas}· Kelas {projek.kelas.nama}{/if}
							</p>
							{#if projek.catatan}
								<p class="mt-1 text-xs italic text-slate-500 dark:text-zinc-400">
									{projek.catatan}
								</p>
							{/if}
						</div>
						{#if bolehKelola}
							<div class="flex gap-1.5 max-sm:self-end">
								<button
									type="button"
									class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
									onclick={() => openAnggota(projek)}
									title="Atur anggota projek"
								>
									<Icon name="edit" class="h-3.5 w-3.5" />
								</button>
								<button
									type="button"
									class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
									onclick={() => confirmHapus(projek)}
									title="Hapus projek"
								>
									<Icon name="del" class="h-3.5 w-3.5" />
								</button>
							</div>
						{/if}
					</div>

					<div class="mt-3 flex flex-wrap items-center gap-2">
						<span class="text-xs text-slate-500 tabular-nums dark:text-zinc-400">
							Dinilai: {projek.dinilaiCount}/{projek.anggotaCount}
						</span>
						{#each Object.entries(projek.ratingCount) as [rating, count] (rating)}
							{#if count > 0}
								<span
									class="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
									title={data.ratingLabels[rating] ?? rating}
								>
									{rating} · {count}
								</span>
							{/if}
						{/each}
					</div>
					{#if projek.dimensiDinilai.length > 0}
						<p class="mt-2 line-clamp-2 text-[11px] text-slate-500 dark:text-zinc-400">
							Dimensi: {projek.dimensiDinilai.join(', ')}
						</p>
					{/if}
				</div>

				<div class="mt-3.5">
					{#if bolehKelola}
						<a
							href={`/p5/nilais?projek=${projek.id}`}
							class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
							title="Input nilai P5 anggota projek"
						>
							<Icon name="layers" class="h-3.5 w-3.5" />
							Input Nilai
						</a>
					{:else}
						<a
							href={`/p5/nilais?projek=${projek.id}`}
							class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
							title="Lihat nilai P5 anggota projek"
						>
							<Icon name="layers" class="h-3.5 w-3.5" />
							Lihat Nilai
						</a>
					{/if}
				</div>
			</div>
		{:else}
			{#if data.tableReady && data.projek.length === 0 && addJudul === ''}
				<p
					class="min-h-[40px] py-6 text-center text-xs italic text-slate-500 lg:col-span-2 dark:text-zinc-400"
				>
					Tekan "Tambah Projek" untuk membuat projek P5 pertama.
				</p>
			{/if}
		{/each}
	</div>
</div>

<!-- Modal tambah projek -->
<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open={tambahOpen} onclose={closeTambah}>
	<div
		class="modal-box flex max-h-[85vh] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:max-w-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<h3 class="shrink-0 text-lg font-bold">Tambah Projek P5</h3>

		<FormEnhance
			id="form-tambah-p5"
			action="?/tambahProjek"
			submitStateChange={(value) => (addSubmitting = value)}
			onsuccess={({ form }) => {
				form.reset();
				closeTambah();
				invalidate('app:p5');
			}}
		>
			{#snippet children({ submitting })}
				<div class="mt-3 space-y-3">
					{#if data.kelasAktifId == null}
						<div>
							<span class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Kelas
							</span>
							<div class="relative flex items-center">
								<select
									name="kelasId"
									required
									class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
									value={addKelasId}
									onchange={(event) =>
										(addKelasId = (event.currentTarget as HTMLSelectElement).value)}
								>
									<option value="">Pilih kelas...</option>
									{#each data.daftarKelas as kelas (kelas.id)}
										<option value={String(kelas.id)}>
											{kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama}
										</option>
									{/each}
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3.5 w-3.5" />
								</span>
							</div>
						</div>
					{:else}
						<input name="kelasId" value={data.kelasAktifId} hidden />
					{/if}

					<div>
						<span class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Tema
						</span>
						<div class="relative flex items-center">
							<select
								name="tema"
								required
								class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								value={addTema}
								onchange={(event) => (addTema = (event.currentTarget as HTMLSelectElement).value)}
							>
								<option value="">Pilih tema...</option>
								{#each data.temaList as tema, index (index)}
									<option value={tema}>{tema}</option>
								{/each}
							</select>
							<span
								aria-hidden="true"
								class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
							>
								<Icon name="down" class="h-3.5 w-3.5" />
							</span>
						</div>
					</div>

					<div>
						<span class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Judul projek
						</span>
						<input
							name="judul"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							placeholder="Mis. Pemasangan Instalasi Listrik Hemat Energi"
							value={addJudul}
							oninput={(event) => (addJudul = (event.currentTarget as HTMLInputElement).value)}
							autocomplete="off"
							required
						/>
					</div>

					<div>
						<span class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Guru pembina (opsional)
						</span>
						<div class="relative flex items-center">
							<select
								name="pembinaPegawaiId"
								class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								value={addPembinaId}
								onchange={(event) =>
									(addPembinaId = (event.currentTarget as HTMLSelectElement).value)}
							>
								<option value="">Tanpa pembina</option>
								{#each data.pembinaList as pembina (pembina.id)}
									<option value={String(pembina.id)}>{pembina.nama}</option>
								{/each}
							</select>
							<span
								aria-hidden="true"
								class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
							>
								<Icon name="down" class="h-3.5 w-3.5" />
							</span>
						</div>
					</div>

					<div>
						<span class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
							Catatan (opsional)
						</span>
						<textarea
							name="catatan"
							class="w-full rounded-xl border border-[#7e8b9b] bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							rows="2"
							placeholder="Catatan terkait projek"
							value={addCatatan}
							oninput={(event) => (addCatatan = (event.currentTarget as HTMLTextAreaElement).value)}
						></textarea>
					</div>
				</div>

				<div
					class="mt-5 flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800"
				>
					<button
						type="button"
						class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						onclick={closeTambah}
						disabled={submitting}
					>
						Batal
					</button>
					<button
						type="submit"
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
						disabled={addDisabled || submitting}
						title="Simpan"
					>
						{#if submitting}
							<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
						{:else}
							<Icon name="save" class="h-4 w-4" />
						{/if}
						Simpan
					</button>
				</div>
			{/snippet}
		</FormEnhance>
	</div>
	<form method="dialog" class="modal-backdrop bg-transparent">
		<button aria-label="Tutup">close</button>
	</form>
</dialog>

<!-- Modal anggota projek -->
<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open={anggotaOpen} onclose={closeAnggota}>
	{#if anggotaProjek}
		<div
			class="modal-box flex max-h-[85vh] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:max-w-md dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="shrink-0 text-lg font-bold">Anggota Projek</h3>
			<p class="mt-0.5 shrink-0 text-xs text-slate-600 dark:text-zinc-400">
				{anggotaProjek.judul}
				{#if anggotaProjek.kelas}· Kelas {anggotaProjek.kelas.nama}{/if}
			</p>

			<FormEnhance
				id="form-atur-anggota"
				action="?/aturAnggota"
				submitStateChange={(value) => (anggotaSubmitting = value)}
				onsuccess={({ form }) => {
					form.reset();
					closeAnggota();
					invalidate('app:p5');
				}}
			>
				{#snippet children({ submitting })}
					<input name="projekId" value={anggotaProjek ? anggotaProjek.id : ''} hidden />
					{#each anggotaAddIds as muridId (muridId)}
						<input name="add" value={muridId} hidden />
					{/each}
					{#each anggotaRemoveIds as muridId (muridId)}
						<input name="remove" value={muridId} hidden />
					{/each}

					<div class="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-0.5 py-3">
						{#each anggotaMurid as murid (murid.id)}
							<label
								class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={anggotaSelected.includes(murid.id)}
									disabled={submitting}
									onchange={(event) => toggleAnggota(murid.id, event.currentTarget.checked)}
								/>
								<span class="truncate">{murid.nama}</span>
							</label>
						{:else}
							<p class="py-2 text-xs italic text-slate-500 dark:text-zinc-400">
								Belum ada murid aktif di kelas ini.
							</p>
						{/each}
					</div>
				{/snippet}
			</FormEnhance>

			<div
				class="mt-2 flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800"
			>
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={closeAnggota}
					disabled={anggotaSubmitting}
				>
					Batal
				</button>
				<button
					form="form-atur-anggota"
					type="submit"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
					disabled={anggotaSubmitting || anggotaTanpaPerubahan}
					title="Simpan anggota"
				>
					{#if anggotaSubmitting}
						<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
					{:else}
						<Icon name="save" class="h-4 w-4" />
					{/if}
					Simpan
				</button>
			</div>
		</div>
	{/if}
	<form method="dialog" class="modal-backdrop bg-transparent">
		<button aria-label="Tutup">close</button>
	</form>
</dialog>
