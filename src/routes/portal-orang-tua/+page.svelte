<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { PageData } from './$types';

	let { data, form } = $props();

	type Feedback = {
		error?: string;
		created?: { nama: string; telepon: string; password: string; children: number };
		reset?: { nama: string; telepon: string; password: string };
		generated?: { accounts: number; links: number; phones: number };
		toggled?: { nama: string; active: boolean };
		deleted?: { nama: string };
		publish?: {
			students: number;
			parents: number;
			links: number;
			grades: number;
			attendance: number;
			schedules: number;
			subjects: number;
		};
	};

	const pageData = $derived(data as PageData);
	const feedback = $derived(form as Feedback | null);
	const accounts = $derived(pageData.accounts ?? []);
	const students = $derived(pageData.students ?? []);

	let query = $state('');
	let selectedIds = $state<number[]>([]);

	const filteredStudents = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		const rows = needle
			? students.filter((student) =>
					`${student.nama} ${student.nis} ${student.kelas}`.toLowerCase().includes(needle)
				)
			: students;
		return rows.slice(0, 80);
	});

	const totalLinks = $derived(
		accounts.reduce((total, account) => total + (account.children?.length ?? 0), 0)
	);

	function toggleStudent(id: number, checked: boolean) {
		selectedIds = checked
			? [...selectedIds, id]
			: selectedIds.filter((selectedId) => selectedId !== id);
	}

	function confirmAction(message: string): boolean {
		return window.confirm(message);
	}

	function formatDate(value: string | null | undefined) {
		if (!value) return 'Belum pernah';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat('id-ID', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	$effect(() => {
		if (feedback?.created) {
			selectedIds = [];
			query = '';
		}
	});
</script>

<div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
	<div>
		<h1 class="text-2xl font-bold">Portal Orang Tua</h1>
		<p class="text-base-content/60">
			Kelola akun orang tua/wali dan kirim data akademik ke portal publik.
		</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<a class="btn btn-soft shadow-none" href="/portal-orang-tua/export">
			<Icon name="download" />
			Unduh Kredensial
		</a>
		<form method="POST" action="?/publish">
			<button
				class="btn btn-primary shadow-none"
				type="submit"
				onclick={(event) => {
					if (
						!confirmAction(
							'Publikasikan data terbaru ke portal? Data nilai/presensi di portal akan diganti dengan data saat ini.'
						)
					) {
						event.preventDefault();
					}
				}}
			>
				<Icon name="telegram" />
				Publikasikan ke Portal
			</button>
		</form>
	</div>
</div>

{#if feedback?.error}
	<div class="alert alert-error alert-soft mb-4 flex items-start gap-3">
		<Icon name="error" />
		<span>{feedback.error}</span>
	</div>
{/if}

{#if feedback?.created}
	<div class="alert alert-success alert-soft mb-4 items-start">
		<Icon name="success" />
		<div>
			<p class="font-semibold">Akun dibuat: {feedback.created.nama}</p>
			<p>
				Nomor HP <strong>{feedback.created.telepon}</strong>, password awal
				<strong>{feedback.created.password}</strong> ({feedback.created.children} anak terhubung).
			</p>
			<p class="text-sm">Minta orang tua mengganti password setelah login pertama.</p>
		</div>
	</div>
{/if}

{#if feedback?.reset}
	<div class="alert alert-success alert-soft mb-4 items-start">
		<Icon name="key" />
		<div>
			<p class="font-semibold">Password direset: {feedback.reset.nama}</p>
			<p>
				Nomor HP <strong>{feedback.reset.telepon}</strong>, password baru
				<strong>{feedback.reset.password}</strong>.
			</p>
			<p class="text-sm">
				Password akan dipakai portal setelah tombol <strong>Publikasikan ke Portal</strong> dijalankan.
			</p>
		</div>
	</div>
{/if}

{#if feedback?.generated}
	<div class="alert alert-success alert-soft mb-4 items-start">
		<Icon name="users" />
		<span>
			Akun baru: <strong>{feedback.generated.accounts}</strong>, tautan anak baru:
			<strong>{feedback.generated.links}</strong>, nomor HP unik:
			<strong>{feedback.generated.phones}</strong>.
		</span>
	</div>
{/if}

{#if feedback?.toggled}
	<div class="alert alert-info alert-soft mb-4 items-center gap-3">
		<Icon name="info" />
		<span>
			Akun {feedback.toggled.nama}
			{feedback.toggled.active ? 'diaktifkan' : 'dinonaktifkan'}. Publikasikan ulang agar status di
			portal ikut berubah.
		</span>
	</div>
{/if}

{#if feedback?.deleted}
	<div class="alert alert-info alert-soft mb-4 items-center gap-3">
		<Icon name="info" />
		<span
			>Akun {feedback.deleted.nama} dihapus dari e-Rapor. Publikasikan ulang untuk menonaktifkannya di
			portal.</span
		>
	</div>
{/if}

{#if feedback?.publish}
	<div class="alert alert-success alert-soft mb-4 items-start">
		<Icon name="success" />
		<div>
			<p class="font-semibold">Publikasi selesai.</p>
			<p>
				{feedback.publish.students} murid, {feedback.publish.parents} akun orang tua,
				{feedback.publish.links} tautan anak, {feedback.publish.subjects} mata pelajaran,
				{feedback.publish.grades} nilai, {feedback.publish.attendance} rekap presensi,
				{feedback.publish.schedules} baris jadwal.
			</p>
		</div>
	</div>
{/if}

<div class="stats bg-base-100 rounded-box mb-6 w-full shadow-sm">
	<div class="stat">
		<div class="stat-title">Murid Aktif</div>
		<div class="stat-value text-2xl">{students.length}</div>
		<div class="stat-desc">{pageData.semester?.nama ?? 'Semester belum diatur'}</div>
	</div>
	<div class="stat">
		<div class="stat-title">Wali Punya HP</div>
		<div class="stat-value text-2xl">{pageData.contactCount}</div>
		<div class="stat-desc">Dari data wali murid</div>
	</div>
	<div class="stat">
		<div class="stat-title">Akun Portal</div>
		<div class="stat-value text-2xl">{accounts.length}</div>
		<div class="stat-desc">{accounts.filter((account) => account.isActive).length} aktif</div>
	</div>
	<div class="stat">
		<div class="stat-title">Tautan Anak</div>
		<div class="stat-value text-2xl">{totalLinks}</div>
		<div class="stat-desc">Satu akun bisa banyak anak</div>
	</div>
</div>

{#if pageData.contactCount === 0 && accounts.length === 0}
	<div class="alert alert-warning alert-soft mb-6 items-start gap-3">
		<Icon name="warning" />
		<div>
			<p class="font-semibold">Belum ada nomor HP orang tua/wali.</p>
			<p>
				Isi kolom kontak pada data orang tua/wali di menu <a class="link" href="/murid">Murid</a>,
				lalu gunakan tombol <strong>Buat dari Data Wali</strong>. Untuk uji coba, akun juga bisa
				dibuat manual di bawah.
			</p>
		</div>
	</div>
{/if}

<div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
	<div class="card bg-base-100 rounded-box shadow-sm xl:col-span-2">
		<div class="card-body">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 class="card-title">Daftar Akun</h2>
					<p class="text-base-content/60 text-sm">
						Password awal adalah 6 digit terakhir nomor HP. Password yang sudah diganti orang tua
						tidak akan tertimpa saat publikasi, kecuali setelah reset dari halaman ini.
					</p>
				</div>
				<form method="POST" action="?/generate">
					<button class="btn btn-soft btn-sm shadow-none" type="submit">
						<Icon name="users" />
						Buat dari Data Wali
					</button>
				</form>
			</div>

			<div class="mt-4 overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Orang Tua</th>
							<th>Anak</th>
							<th>Status</th>
							<th>Publikasi</th>
							<th class="text-right">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each accounts as account (account.id)}
							<tr>
								<td>
									<div class="font-semibold">{account.nama}</div>
									<div class="text-base-content/60 text-sm">{account.telepon}</div>
								</td>
								<td>
									{#if account.children.length}
										<ul class="space-y-1">
											{#each account.children as child (child.muridId)}
												<li class="text-sm">
													{child.nama}
													<span class="text-base-content/50"
														>({child.kelas} · {child.hubungan})</span
													>
												</li>
											{/each}
										</ul>
									{:else}
										<span class="badge badge-warning badge-soft badge-sm">Belum terhubung</span>
									{/if}
								</td>
								<td>
									<span class="badge badge-sm {account.isActive ? 'badge-success' : 'badge-ghost'}">
										{account.isActive ? 'Aktif' : 'Nonaktif'}
									</span>
									{#if account.mustChangePassword}
										<div class="text-base-content/50 mt-1 text-xs">Wajib ganti password</div>
									{/if}
								</td>
								<td class="text-sm">{formatDate(account.lastPublishedAt)}</td>
								<td>
									<div class="flex flex-wrap justify-end gap-1">
										<form method="POST" action="?/reset">
											<input type="hidden" name="id" value={account.id} />
											<button
												class="btn btn-soft btn-xs shadow-none"
												type="submit"
												onclick={(event) => {
													if (
														!confirmAction(`Reset password ${account.nama} ke 6 digit terakhir HP?`)
													) {
														event.preventDefault();
													}
												}}
											>
												Reset
											</button>
										</form>
										<form method="POST" action="?/toggle">
											<input type="hidden" name="id" value={account.id} />
											<button class="btn btn-ghost btn-xs" type="submit">
												{account.isActive ? 'Nonaktifkan' : 'Aktifkan'}
											</button>
										</form>
										<form method="POST" action="?/delete">
											<input type="hidden" name="id" value={account.id} />
											<button
												class="btn btn-error btn-ghost btn-xs"
												type="submit"
												onclick={(event) => {
													if (
														!confirmAction(`Hapus akun ${account.nama}? Tautan anak juga dihapus.`)
													) {
														event.preventDefault();
													}
												}}
											>
												Hapus
											</button>
										</form>
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="py-8 text-center opacity-60">
									Belum ada akun. Buat dari data wali atau tambahkan manual.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<div class="card bg-base-100 rounded-box shadow-sm">
		<div class="card-body">
			<h2 class="card-title">Tambah Akun Manual</h2>
			<p class="text-base-content/60 text-sm">
				Untuk orang tua yang belum punya nomor HP di data wali murid.
			</p>

			<form method="POST" action="?/create" class="mt-2 space-y-3">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Nomor HP</legend>
					<input
						class="input w-full"
						name="telepon"
						type="tel"
						inputmode="tel"
						placeholder="08xxxxxxxxxx"
						required
					/>
					<p class="label">Boleh diawali 62 atau 8; disimpan sebagai 08...</p>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">Nama Orang Tua/Wali</legend>
					<input class="input w-full" name="nama" type="text" placeholder="Nama lengkap" required />
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">Cari Anak</legend>
					<input
						class="input w-full"
						type="search"
						placeholder="Nama, NIS, atau kelas"
						bind:value={query}
					/>
				</fieldset>

				<div class="border-base-300 max-h-64 overflow-y-auto rounded-box border p-2">
					{#each filteredStudents as student (student.id)}
						<label class="hover:bg-base-200 flex cursor-pointer items-start gap-2 rounded-box p-2">
							<input
								class="checkbox checkbox-sm mt-0.5"
								type="checkbox"
								checked={selectedIds.includes(student.id)}
								onchange={(event) => toggleStudent(student.id, event.currentTarget.checked)}
							/>
							<span class="text-sm">
								<span class="font-medium">{student.nama}</span>
								<span class="text-base-content/50"> · {student.nis} · {student.kelas}</span>
							</span>
						</label>
					{:else}
						<p class="p-3 text-sm opacity-60">Tidak ada murid yang cocok.</p>
					{/each}
				</div>
				{#each selectedIds as id (id)}
					<input type="hidden" name="muridIds" value={id} />
				{/each}
				<p class="text-base-content/60 text-sm">{selectedIds.length} anak dipilih.</p>

				<button
					class="btn btn-primary w-full shadow-none"
					type="submit"
					disabled={!selectedIds.length}
				>
					<Icon name="plus" />
					Buat Akun
				</button>
			</form>

			<div class="divider"></div>
			<div class="text-sm">
				<p class="text-base-content/60">Publikasi terakhir</p>
				<p class="font-semibold">{formatDate(pageData.lastPublish)}</p>
				<a
					class="link link-primary mt-2 inline-block"
					href={pageData.portalUrl}
					target="_blank"
					rel="noreferrer"
				>
					Buka portal publik
				</a>
			</div>
		</div>
	</div>
</div>

<div class="text-base-content/50 mt-6 text-xs">
	Data murid, nilai, presensi, jadwal, dan catatan dikirim ulang setiap publikasi. Akun dan password
	portal tidak dihapus; hanya akun yang dinonaktifkan di sini yang ikut dinonaktifkan di portal.
</div>
