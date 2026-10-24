<script lang="ts">
	import { invalidate } from '$app/navigation';
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

<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h2 class="text-xl font-bold">P5 (Projek Pancasila)</h2>
			{#if kelasAktifLabel}
				<p class="text-base-content/70 text-sm">Kelas aktif: {kelasAktifLabel}</p>
			{:else}
				<p class="text-base-content/60 text-sm">
					Pilih kelas di navbar untuk melihat projek P5 kelas tertentu, atau tambah projek lalu
					pilih kelasnya pada modal.
				</p>
			{/if}
		</div>
		<div class="flex flex-row max-sm:w-full">
			<button
				class="btn btn-soft shadow-none"
				disabled={!data.tableReady || !canTambah}
				onclick={openTambah}
				title={!canTambah ? 'Anda tidak memiliki izin untuk menambah' : 'Tambah projek P5'}
				aria-disabled={!data.tableReady || !canTambah}
			>
				<Icon name="plus" />
				Tambah Projek
			</button>
		</div>
	</div>

	{#if !data.tableReady}
		<div class="alert border-error/60 bg-error/10 text-error-content mt-4 border border-dashed">
			<Icon name="warning" />
			<span>
				Database P5 belum siap. Jalankan <code>pnpm db:push</code> untuk menerapkan migrasi terbaru.
			</span>
		</div>
	{/if}

	{#if data.tableReady && data.projek.length === 0}
		<div
			class="alert border-warning/60 bg-warning/10 text-warning-content mt-4 border border-dashed"
		>
			<Icon name="info" />
			<span>Belum ada projek P5{kelasAktifLabel ? ' pada kelas ini' : ''}.</span>
		</div>
	{/if}

	<div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
		{#each data.projek as projek (projek.id)}
			{@const bolehKelola = mayManageKelas(projek.kelasId)}
			<div
				class="bg-base-100 dark:bg-base-200 rounded-md border border-base-300 p-4 shadow-md dark:border-none"
			>
				<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
					<div class="min-w-0">
						<span class="badge badge-primary badge-soft">
							<Icon name="star" />
							{projek.tema}
						</span>
						<h3 class="mt-2 truncate text-base font-bold">{projek.judul}</h3>
						<p class="text-base-content/70 mt-1 text-sm">
							<span class="inline-flex items-center gap-1">
								<Icon name="users" />
								Anggota: {projek.anggotaCount}
							</span>
							· {#if projek.pembina}Pembina: {projek.pembina.nama}{:else}
								Tanpa pembina{/if}
							{#if projek.kelas}· Kelas {projek.kelas.nama}{/if}
						</p>
						{#if projek.catatan}
							<p class="text-base-content/60 mt-1 text-sm italic">{projek.catatan}</p>
						{/if}
					</div>
					{#if bolehKelola}
						<div class="flex gap-1 max-sm:self-end">
							<button
								class="btn btn-soft btn-sm shadow-none"
								onclick={() => openAnggota(projek)}
								title="Atur anggota projek"
							>
								<Icon name="edit" />
							</button>
							<button
								class="btn btn-soft btn-sm btn-error shadow-none"
								onclick={() => confirmHapus(projek)}
								title="Hapus projek"
							>
								<Icon name="del" />
							</button>
						</div>
					{/if}
				</div>

				<div class="mt-3 flex flex-wrap items-center gap-2">
					<span class="text-base-content/60 text-xs">
						Dinilai: {projek.dinilaiCount}/{projek.anggotaCount}
					</span>
					{#each Object.entries(projek.ratingCount) as [rating, count] (rating)}
						{#if count > 0}
							<span class="badge badge-soft badge-sm" title={data.ratingLabels[rating] ?? rating}
								>{rating} · {count}</span
							>
						{/if}
					{/each}
				</div>
				{#if projek.dimensiDinilai.length > 0}
					<p class="text-base-content/50 mt-2 line-clamp-2 text-xs">
						Dimensi: {projek.dimensiDinilai.join(', ')}
					</p>
				{/if}

				{#if bolehKelola}
					<a
						href={`/p5/nilais?projek=${projek.id}`}
						class="btn btn-primary btn-sm mt-3 shadow-none"
						title="Input nilai P5 anggota projek"
					>
						<Icon name="layers" />
						Input Nilai
					</a>
				{:else}
					<a
						href={`/p5/nilais?projek=${projek.id}`}
						class="btn btn-soft btn-sm mt-3 shadow-none"
						title="Lihat nilai P5 anggota projek"
					>
						<Icon name="layers" />
						Lihat Nilai
					</a>
				{/if}
			</div>
		{:else}
			{#if data.tableReady && data.projek.length === 0 && addJudul === ''}
				<p class="text-base-content/60 min-h-[40px] py-6 text-center text-sm italic">
					Tekan "Tambah Projek" untuk membuat projek P5 pertama.
				</p>
			{/if}
		{/each}
	</div>
</div>

<!-- Modal tambah projek -->
<dialog class="modal" open={tambahOpen} onclose={closeTambah}>
	<div class="modal-box flex max-h-[85vh] flex-col p-4 sm:max-w-lg">
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
							<span class="text-sm font-semibold">Kelas</span>
							<select
								name="kelasId"
								required
								class="select select-sm bg-base-200 w-full"
								value={addKelasId}
								onchange={(event) =>
									(addKelasId = (event.currentTarget as HTMLSelectElement).value)}
							>
								<option value="">— pilih kelas —</option>
								{#each data.daftarKelas as kelas (kelas.id)}
									<option value={String(kelas.id)}>
										{kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama}
									</option>
								{/each}
							</select>
						</div>
					{:else}
						<input name="kelasId" value={data.kelasAktifId} hidden />
					{/if}

					<div>
						<span class="text-sm font-semibold">Tema</span>
						<select
							name="tema"
							required
							class="select select-sm bg-base-200 w-full"
							value={addTema}
							onchange={(event) => (addTema = (event.currentTarget as HTMLSelectElement).value)}
						>
							<option value="">— pilih tema —</option>
							{#each data.temaList as tema, index (index)}
								<option value={tema}>{tema}</option>
							{/each}
						</select>
					</div>

					<div>
						<span class="text-sm font-semibold">Judul projek</span>
						<input
							name="judul"
							class="input input-sm bg-base-200 w-full"
							placeholder="Mis. Pemasangan Instalasi Listrik Hemat Energi"
							value={addJudul}
							oninput={(event) => (addJudul = (event.currentTarget as HTMLInputElement).value)}
							autocomplete="off"
							required
						/>
					</div>

					<div>
						<span class="text-sm font-semibold">Guru pembina (opsional)</span>
						<select
							name="pembinaPegawaiId"
							class="select select-sm bg-base-200 w-full"
							value={addPembinaId}
							onchange={(event) =>
								(addPembinaId = (event.currentTarget as HTMLSelectElement).value)}
						>
							<option value="">— tanpa pembina —</option>
							{#each data.pembinaList as pembina (pembina.id)}
								<option value={String(pembina.id)}>{pembina.nama}</option>
							{/each}
						</select>
					</div>

					<div>
						<span class="text-sm font-semibold">Catatan (opsional)</span>
						<textarea
							name="catatan"
							class="textarea bg-base-200 w-full"
							rows="2"
							placeholder="Catatan terkait projek"
							value={addCatatan}
							oninput={(event) => (addCatatan = (event.currentTarget as HTMLTextAreaElement).value)}
						></textarea>
					</div>
				</div>

				<div class="modal-action shrink-0">
					<button
						type="button"
						class="btn btn-soft shadow-none"
						onclick={closeTambah}
						disabled={submitting}
					>
						Batal
					</button>
					<button
						type="submit"
						class="btn btn-primary shadow-none"
						disabled={addDisabled || submitting}
						title="Simpan"
					>
						{#if submitting}
							<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
						{/if}
						<Icon name="save" />
						Simpan
					</button>
				</div>
			{/snippet}
		</FormEnhance>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Tutup">close</button>
	</form>
</dialog>

<!-- Modal anggota projek -->
<dialog class="modal" open={anggotaOpen} onclose={closeAnggota}>
	{#if anggotaProjek}
		<div class="modal-box flex max-h-[85vh] flex-col p-4 sm:max-w-md">
			<h3 class="shrink-0 text-lg font-bold">Anggota Projek</h3>
			<p class="shrink-0 text-sm">
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

					<div class="min-h-0 flex-1 space-y-1 overflow-y-auto px-1 py-3">
						{#each anggotaMurid as murid (murid.id)}
							<label
								class="flex cursor-pointer items-center gap-2 rounded p-1 text-sm hover:bg-base-200"
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
							<p class="py-2 text-sm opacity-60">Belum ada murid aktif di kelas ini.</p>
						{/each}
					</div>
				{/snippet}
			</FormEnhance>

			<div class="modal-action shrink-0">
				<button
					type="button"
					class="btn btn-soft shadow-none"
					onclick={closeAnggota}
					disabled={anggotaSubmitting}
				>
					Batal
				</button>
				<button
					form="form-atur-anggota"
					type="submit"
					class="btn btn-primary shadow-none"
					disabled={anggotaSubmitting || anggotaTanpaPerubahan}
					title="Simpan anggota"
				>
					{#if anggotaSubmitting}
						<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
					{/if}
					<Icon name="save" />
					Simpan
				</button>
			</div>
		</div>
	{/if}
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Tutup">close</button>
	</form>
</dialog>
