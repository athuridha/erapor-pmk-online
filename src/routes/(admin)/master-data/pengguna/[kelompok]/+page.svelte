<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { buildPageNumbers, OPSI_BARIS_PER_HALAMAN } from '$lib/utils/pagination';
	import { selectAll, semuaTerpilih, toggleId } from '$lib/utils/bulk-select';

	type Baris = {
		id: number;
		nama: string;
		role: string;
		username: string;
		bisaHapus: boolean;
		nik_username: string;
		kelas: string | null;
		mapel: string | null;
		izin: number;
		dibuat: string | null;
	};

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.filter?.q ?? '');
	let terpilih = $state<number[]>([]);
	let hapusId = $state<number | null>(null);
	let tambahTerbuka = $state(false);
	let roleBaru = $state<'user' | 'wali_kelas' | 'admin' | 'kepala_sekolah'>('user');
	let kelasBaru = $state('');
	let mapelBaru = $state('');

	const kelompokKey = $derived(String(data.kelompok?.key ?? 'guru'));
	const roleOpsi = $derived(
		kelompokKey === 'operator'
			? ([
					{ value: 'admin', label: 'Admin' },
					{ value: 'kepala_sekolah', label: 'Kepala Sekolah' }
				] as Array<{ value: string; label: string }>)
			: ([
					{ value: 'user', label: 'Guru' },
					{ value: 'wali_kelas', label: 'Wali Kelas' }
				] as Array<{ value: string; label: string }>)
	);
	const daftarKelas = $derived(
		(data.daftarKelas ?? []) as Array<{ id: number; nama: string; fase: string | null }>
	);
	const daftarMapel = $derived(
		(data.daftarMapel ?? []) as Array<{ id: number; nama: string; kelasId: number }>
	);
	const mapelSesuaiKelas = $derived(
		kelasBaru ? daftarMapel.filter((m) => String(m.kelasId) === String(kelasBaru)) : daftarMapel
	);

	const baris = $derived((data.baris ?? []) as Baris[]);
	const total = $derived(data.total ?? 0);
	const totalHalaman = $derived(data.totalHalaman ?? 1);
	const perHalaman = $derived(data.perHalaman ?? 50);
	const halamanSekarang = $derived(data.filter?.page ?? 1);
	const nomorHalaman = $derived(buildPageNumbers(halamanSekarang, totalHalaman));
	const idsHalaman = $derived(baris.map((row) => row.id));

	const rekapRole = $derived.by(() => {
		const map = new Map<string, number>();
		for (const row of baris) map.set(row.role, (map.get(row.role) ?? 0) + 1);
		return [...map.entries()].sort((a, b) => b[1] - a[1]);
	});

	async function applySearch(value: string) {
		const params = new URLSearchParams(page.url.search);
		if (value.trim()) params.set('q', value.trim());
		else params.delete('q');
		params.delete('page');
		const query = params.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, { keepFocus: true });
	}

	async function gotoPage(pageNumber: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('page', String(pageNumber));
		await goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	}

	async function gotoPerHalaman(jumlah: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('per_page', String(jumlah));
		params.delete('page');
		await goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	}

	function formatTanggal(value: string | null | undefined): string {
		if (!value) return '—';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(parsed);
	}

	async function handleSimpan({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:master-data');
		terpilih = [];
		hapusId = null;
		tambahTerbuka = false;
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Tersimpan',
			type: 'success'
		});
	}
</script>

<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
	<div class="mb-4 flex items-start justify-between gap-2 max-sm:flex-col sm:flex-row">
		<div>
			<h2 class="text-xl font-bold">Data Pengguna — {data.kelompok.judul}</h2>
			<p class="text-base-content/80 block text-sm">{data.kelompok.deskripsi}</p>
		</div>
		<div class="flex flex-wrap items-center gap-2 max-sm:w-full">
			{#if terpilih.length}
				<FormEnhance action="?/hapusMassal" showToast={false} onsuccess={handleSimpan}>
					{#snippet children({ submitting })}
						<input type="hidden" name="ids" value={JSON.stringify(terpilih)} />
						<button type="submit" class="btn btn-error btn-soft shadow-none" disabled={submitting}>
							<Icon name="del" />
							Hapus {terpilih.length} Terpilih
						</button>
					{/snippet}
				</FormEnhance>
			{/if}
			<button
				type="button"
				class="btn btn-primary btn-soft shadow-none max-sm:w-full"
				onclick={() => {
					roleBaru = kelompokKey === 'operator' ? 'admin' : 'user';
					kelasBaru = '';
					mapelBaru = '';
					tambahTerbuka = true;
				}}
			>
				<Icon name="plus" />
				Tambah Akun
			</button>
		</div>
	</div>

	{#if rekapRole.length}
		<div class="mb-4 flex flex-wrap gap-2">
			{#each rekapRole as [role, jumlah] (role)}
				<div class="bg-base-200 dark:bg-base-300 flex items-center gap-2 rounded-lg px-3 py-1.5">
					<span class="badge badge-sm badge-soft badge-primary">{role}</span>
					<span class="text-sm font-semibold">{jumlah}</span>
				</div>
			{/each}
		</div>
	{/if}

	<form
		class="mb-4 flex flex-col gap-2 sm:flex-row"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
		onsubmit={(event) => event.preventDefault()}
	>
		<div class="join w-full">
			<label class="input bg-base-200 dark:bg-base-300 join-item grow dark:border-none">
				<Icon name="search" />
				<input
					type="search"
					name="q"
					bind:value={searchTerm}
					spellcheck="false"
					placeholder="Cari nama, NIK, atau username..."
					autocomplete="off"
					onchange={(event) => applySearch((event.currentTarget as HTMLInputElement).value)}
				/>
			</label>
			<select
				class="select bg-base-200 dark:bg-base-300 join-item w-auto shrink dark:border-none"
				value={perHalaman}
				title="Baris per halaman"
				onchange={(event) =>
					gotoPerHalaman(Number((event.currentTarget as HTMLSelectElement).value))}
			>
				{#each OPSI_BARIS_PER_HALAMAN as jumlah (jumlah)}
					<option value={jumlah}>{jumlah} / hal</option>
				{/each}
			</select>
		</div>
	</form>

	<div class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none">
		<table class="border-base-200 table border dark:border-none">
			<thead>
				<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
					<th style="width: 50px; min-width: 40px;" class="text-center">
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							checked={semuaTerpilih(idsHalaman, terpilih)}
							onchange={(event) =>
								(terpilih = selectAll(
									idsHalaman,
									(event.currentTarget as HTMLInputElement).checked
								))}
						/>
					</th>
					<th style="min-width: 150px;">NIK / Username</th>
					<th style="min-width: 180px;">Nama</th>
					<th style="min-width: 130px;">Role</th>
					<th style="min-width: 130px;">Kelas</th>
					<th style="min-width: 150px;">Mata Pelajaran</th>
					<th class="text-center" style="width: 110px;">Hak Akses</th>
					<th style="min-width: 120px;">Dibuat</th>
					<th class="text-center" style="width: 220px;">Aksi</th>
				</tr>
			</thead>
			<tbody>
				{#each baris as row (row.id)}
					<tr class={terpilih.includes(row.id) ? 'bg-base-200/40' : undefined}>
						<td class="text-center">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={terpilih.includes(row.id)}
								disabled={!row.bisaHapus}
								onchange={(event) =>
									(terpilih = toggleId(
										terpilih,
										row.id,
										(event.currentTarget as HTMLInputElement).checked
									))}
							/>
						</td>
						<td>{row.nik_username}</td>
						<td class="font-medium">{row.nama}</td>
						<td>
							<span class="badge badge-sm badge-soft badge-primary">{row.role}</span>
						</td>
						<td>{row.kelas ?? '—'}</td>
						<td>{row.mapel ?? '—'}</td>
						<td class="text-center">{row.izin}</td>
						<td>{formatTanggal(row.dibuat)}</td>
						<td>
							<div class="flex items-center justify-center gap-1">
								{#if hapusId === row.id}
									<FormEnhance action="?/hapus" showToast={false} onsuccess={handleSimpan}>
										{#snippet children({ submitting })}
											<input type="hidden" name="id" value={row.id} />
											<div class="flex items-center justify-center gap-1">
												<button
													type="submit"
													class="btn btn-error btn-soft btn-sm shadow-none"
													disabled={submitting}
												>
													Ya
												</button>
												<button
													type="button"
													class="btn btn-soft btn-sm shadow-none"
													onclick={() => (hapusId = null)}
												>
													Batal
												</button>
											</div>
										{/snippet}
									</FormEnhance>
								{:else}
									<a class="btn btn-soft btn-sm shadow-none" href={`/pengguna/${row.id}`}>
										<Icon name="eye" />
										Kelola
									</a>
									<a class="btn btn-soft btn-sm shadow-none" href={`/pengguna/form/${row.id}`}>
										<Icon name="edit" />
										Ubah
									</a>
									<button
										type="button"
										class="btn btn-soft btn-error btn-sm shadow-none"
										title={row.bisaHapus ? 'Hapus akun' : 'Akun utama admin tidak bisa dihapus'}
										disabled={!row.bisaHapus}
										onclick={() => (hapusId = row.id)}
									>
										<Icon name="del" />
									</button>
								{/if}
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td class="p-6 text-center" colspan="9">
							<em class="opacity-60">Belum ada akun {data.kelompok.judul.toLowerCase()}.</em>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if totalHalaman > 1}
		<div class="mt-4 flex justify-center">
			<div class="join">
				<button
					type="button"
					class="join-item btn"
					disabled={halamanSekarang <= 1}
					onclick={() => gotoPage(halamanSekarang - 1)}
				>
					«
				</button>
				{#each nomorHalaman as nomor, index (index)}
					{#if nomor === '…'}
						<button type="button" class="join-item btn" disabled>…</button>
					{:else}
						<button
							type="button"
							class="join-item btn"
							class:btn-active={nomor === halamanSekarang}
							onclick={() => gotoPage(nomor)}
						>
							{nomor}
						</button>
					{/if}
				{/each}
				<button
					type="button"
					class="join-item btn"
					disabled={halamanSekarang >= totalHalaman}
					onclick={() => gotoPage(halamanSekarang + 1)}
				>
					»
				</button>
			</div>
		</div>
	{/if}

	<p class="mt-3 text-center text-sm opacity-70">
		Menampilkan {baris.length} dari {total} akun
	</p>
</div>

{#if tambahTerbuka}
	<dialog class="modal" open>
		<div class="modal-box max-w-2xl">
			<h3 class="mb-4 text-lg font-bold">Tambah Akun {data.kelompok.judul}</h3>

			<FormEnhance action="?/tambah" showToast={false} onsuccess={handleSimpan}>
				{#snippet children({ submitting, invalid })}
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="form-control sm:col-span-2">
							<span class="label-text mb-1 text-sm">
								Nama Lengkap <span class="text-error">*</span>
							</span>
							<input
								name="nama"
								type="text"
								class="input input-bordered w-full rounded-xl"
								placeholder="Nama lengkap pengguna"
								required
								disabled={submitting}
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">NIK (opsional)</span>
							<input
								name="nik"
								type="text"
								inputmode="numeric"
								maxlength="16"
								class="input input-bordered w-full rounded-xl"
								placeholder="16 digit NIK"
								disabled={submitting}
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">Role</span>
							<select
								name="type"
								class="select select-bordered w-full rounded-xl"
								disabled={submitting}
								onchange={(event) => (roleBaru = event.currentTarget.value as typeof roleBaru)}
							>
								{#each roleOpsi as opsi (opsi.value)}
									<option value={opsi.value} selected={roleBaru === opsi.value}>
										{opsi.label}
									</option>
								{/each}
							</select>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">
								Nama Pengguna <span class="text-error">*</span>
							</span>
							<input
								name="username"
								type="text"
								class="input input-bordered w-full rounded-xl"
								placeholder="Username untuk login"
								required
								disabled={submitting}
							/>
						</label>
						<label class="form-control">
							<span class="label-text mb-1 text-sm">
								Kata Sandi <span class="text-error">*</span>
							</span>
							<input
								name="password"
								type="password"
								class="input input-bordered w-full rounded-xl"
								placeholder="Minimal 8 karakter"
								required
								disabled={submitting}
							/>
						</label>
						{#if kelompokKey === 'guru'}
							<label class="form-control">
								<span class="label-text mb-1 text-sm">Kelas</span>
								<select
									name="kelas_id"
									class="select select-bordered w-full rounded-xl"
									disabled={submitting}
									onchange={(event) => {
										kelasBaru = event.currentTarget.value;
										mapelBaru = '';
									}}
								>
									<option value="">—</option>
									{#each daftarKelas as kelas (kelas.id)}
										<option value={kelas.id} selected={kelasBaru === String(kelas.id)}>
											{kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama}
										</option>
									{/each}
								</select>
							</label>
							<label class="form-control">
								<span class="label-text mb-1 text-sm">Mata Pelajaran</span>
								<select
									name="mata_pelajaran_id"
									class="select select-bordered w-full rounded-xl"
									disabled={submitting}
									onchange={(event) => (mapelBaru = event.currentTarget.value)}
								>
									<option value="">—</option>
									{#each mapelSesuaiKelas as mapel (mapel.id)}
										<option value={mapel.id} selected={mapelBaru === String(mapel.id)}>
											{mapel.nama}
										</option>
									{/each}
								</select>
							</label>
						{/if}
					</div>

					<p class="text-base-content/70 mt-3 text-xs">
						Akun dibuat dengan hak akses bawaan sesuai role. Detail &amp; penyesuaian izin bisa
						dibuka lewat tombol Kelola.
					</p>

					<div class="modal-action">
						<button
							type="button"
							class="btn btn-ghost rounded-xl"
							onclick={() => (tambahTerbuka = false)}
							disabled={submitting}
						>
							<Icon name="close" />
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-primary btn-soft rounded-xl shadow-none"
							disabled={submitting || invalid}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<Icon name="save" />
							{/if}
							Simpan Akun
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<div class="modal-backdrop">
			<button type="button" onclick={() => (tambahTerbuka = false)}>close</button>
		</div>
	</dialog>
{/if}
