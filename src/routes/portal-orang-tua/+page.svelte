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

<div class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
	<div>
		<h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
			Portal Orang Tua
		</h1>
		<p class="mt-0.5 text-xs text-slate-500 sm:text-sm dark:text-zinc-400">
			Kelola akun orang tua/wali dan kirim data akademik ke portal publik.
		</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<a
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			href="/portal-orang-tua/export"
		>
			<Icon name="download" class="h-4 w-4" />
			Unduh Kredensial
		</a>
		<form method="POST" action="?/publish">
			<button
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
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
				<Icon name="telegram" class="h-4 w-4" />
				Publikasikan ke Portal
			</button>
		</form>
	</div>
</div>

{#if feedback?.error}
	<div
		class="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-xs text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200"
		role="alert"
	>
		<Icon name="error" class="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
		<span>{feedback.error}</span>
	</div>
{/if}

{#if feedback?.created}
	<div
		class="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200"
	>
		<Icon name="success" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
		<div>
			<p class="font-semibold">Akun dibuat: {feedback.created.nama}</p>
			<p class="mt-0.5">
				Nomor HP <strong>{feedback.created.telepon}</strong>, password awal
				<strong>{feedback.created.password}</strong> ({feedback.created.children} anak terhubung).
			</p>
			<p class="mt-0.5 text-emerald-800/80 dark:text-emerald-300/80">
				Minta orang tua mengganti password setelah login pertama.
			</p>
		</div>
	</div>
{/if}

{#if feedback?.reset}
	<div
		class="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200"
	>
		<Icon name="key" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
		<div>
			<p class="font-semibold">Password direset: {feedback.reset.nama}</p>
			<p class="mt-0.5">
				Nomor HP <strong>{feedback.reset.telepon}</strong>, password baru
				<strong>{feedback.reset.password}</strong>.
			</p>
			<p class="mt-0.5 text-emerald-800/80 dark:text-emerald-300/80">
				Password akan dipakai portal setelah tombol <strong>Publikasikan ke Portal</strong> dijalankan.
			</p>
		</div>
	</div>
{/if}

{#if feedback?.generated}
	<div
		class="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200"
	>
		<Icon name="users" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
		<span>
			Akun baru: <strong>{feedback.generated.accounts}</strong>, tautan anak baru:
			<strong>{feedback.generated.links}</strong>, nomor HP unik:
			<strong>{feedback.generated.phones}</strong>.
		</span>
	</div>
{/if}

{#if feedback?.toggled}
	<div
		class="mb-4 flex items-center gap-2.5 rounded-2xl border border-blue-200/80 bg-blue-50/85 px-4 py-3 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200"
	>
		<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
		<span>
			Akun {feedback.toggled.nama}
			{feedback.toggled.active ? 'diaktifkan' : 'dinonaktifkan'}. Publikasikan ulang agar status di
			portal ikut berubah.
		</span>
	</div>
{/if}

{#if feedback?.deleted}
	<div
		class="mb-4 flex items-center gap-2.5 rounded-2xl border border-blue-200/80 bg-blue-50/85 px-4 py-3 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200"
	>
		<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
		<span>
			Akun {feedback.deleted.nama} dihapus dari e-Rapor. Publikasikan ulang untuk menonaktifkannya di
			portal.
		</span>
	</div>
{/if}

{#if feedback?.publish}
	<div
		class="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200"
	>
		<Icon name="success" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
		<div>
			<p class="font-semibold">Publikasi selesai.</p>
			<p class="mt-0.5 tabular-nums">
				{feedback.publish.students} murid, {feedback.publish.parents} akun orang tua,
				{feedback.publish.links} tautan anak, {feedback.publish.subjects} mata pelajaran,
				{feedback.publish.grades} nilai, {feedback.publish.attendance} rekap presensi,
				{feedback.publish.schedules} baris jadwal.
			</p>
		</div>
	</div>
{/if}

<div class="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
	<div
		class="flex items-start gap-3 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
		>
			<Icon name="users" class="h-5 w-5" />
		</div>
		<div class="min-w-0">
			<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Murid Aktif</div>
			<div class="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{students.length}
			</div>
			<div class="mt-0.5 truncate text-[11px] text-slate-500 dark:text-zinc-400">
				{pageData.semester?.nama ?? 'Semester belum diatur'}
			</div>
		</div>
	</div>
	<div
		class="flex items-start gap-3 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400"
		>
			<Icon name="user" class="h-5 w-5" />
		</div>
		<div class="min-w-0">
			<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Wali Punya HP</div>
			<div class="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{pageData.contactCount}
			</div>
			<div class="mt-0.5 truncate text-[11px] text-slate-500 dark:text-zinc-400">
				Dari data wali murid
			</div>
		</div>
	</div>
	<div
		class="flex items-start gap-3 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
		>
			<Icon name="key" class="h-5 w-5" />
		</div>
		<div class="min-w-0">
			<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Akun Portal</div>
			<div class="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{accounts.length}
			</div>
			<div class="mt-0.5 truncate text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
				{accounts.filter((account) => account.isActive).length} aktif
			</div>
		</div>
	</div>
	<div
		class="flex items-start gap-3 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400"
		>
			<Icon name="layers" class="h-5 w-5" />
		</div>
		<div class="min-w-0">
			<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Tautan Anak</div>
			<div class="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{totalLinks}
			</div>
			<div class="mt-0.5 truncate text-[11px] text-slate-500 dark:text-zinc-400">
				Satu akun bisa banyak anak
			</div>
		</div>
	</div>
</div>

{#if pageData.contactCount === 0 && accounts.length === 0}
	<div
		class="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
	>
		<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
		<div>
			<p class="font-semibold">Belum ada nomor HP orang tua/wali.</p>
			<p class="mt-0.5">
				Isi kolom kontak pada data orang tua/wali di menu
				<a class="font-semibold text-blue-700 underline dark:text-blue-400" href="/murid">Murid</a>,
				lalu gunakan tombol <strong>Buat dari Data Wali</strong>. Untuk uji coba, akun juga bisa
				dibuat manual di samping.
			</p>
		</div>
	</div>
{/if}

<div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
	<div
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 xl:col-span-2 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800"
		>
			<div class="min-w-0 flex-1">
				<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Daftar Akun
				</h2>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Password awal adalah 6 digit terakhir nomor HP. Password yang sudah diganti orang tua
					tidak akan tertimpa saat publikasi, kecuali setelah reset dari halaman ini.
				</p>
			</div>
			<form method="POST" action="?/generate">
				<button
					class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="submit"
				>
					<Icon name="users" class="h-3.5 w-3.5" />
					Buat dari Data Wali
				</button>
			</form>
		</div>

		<div class="mt-4 overflow-x-auto">
			<table class="w-full border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200/80 text-left font-semibold text-slate-500 dark:border-zinc-800 dark:text-zinc-400"
					>
						<th class="px-2 py-2.5">Orang Tua</th>
						<th class="px-2 py-2.5">Anak</th>
						<th class="px-2 py-2.5">Status</th>
						<th class="px-2 py-2.5">Publikasi</th>
						<th class="px-2 py-2.5 text-right">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
					{#each accounts as account (account.id)}
						<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
							<td class="px-2 py-2.5">
								<div class="font-semibold text-slate-900 dark:text-zinc-100">{account.nama}</div>
								<div class="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
									{account.telepon}
								</div>
							</td>
							<td class="px-2 py-2.5">
								{#if account.children.length}
									<ul class="space-y-0.5">
										{#each account.children as child (child.muridId)}
											<li class="text-xs text-slate-800 dark:text-zinc-200">
												{child.nama}
												<span class="text-slate-400 dark:text-zinc-500">
													({child.kelas} · {child.hubungan})
												</span>
											</li>
										{/each}
									</ul>
								{:else}
									<span
										class="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
									>
										Belum terhubung
									</span>
								{/if}
							</td>
							<td class="px-2 py-2.5">
								<span
									class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold {account.isActive
										? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
										: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'}"
								>
									{account.isActive ? 'Aktif' : 'Nonaktif'}
								</span>
								{#if account.mustChangePassword}
									<div class="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
										Wajib ganti password
									</div>
								{/if}
							</td>
							<td class="px-2 py-2.5 text-xs text-slate-600 tabular-nums dark:text-zinc-400">
								{formatDate(account.lastPublishedAt)}
							</td>
							<td class="px-2 py-2.5">
								<div class="flex flex-wrap justify-end gap-1">
									<form method="POST" action="?/reset">
										<input type="hidden" name="id" value={account.id} />
										<button
											class="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
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
										<button
											class="inline-flex h-7 items-center rounded-lg px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
											type="submit"
										>
											{account.isActive ? 'Nonaktifkan' : 'Aktifkan'}
										</button>
									</form>
									<form method="POST" action="?/delete">
										<input type="hidden" name="id" value={account.id} />
										<button
											class="inline-flex h-7 items-center rounded-lg px-2 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
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
							<td
								colspan="5"
								class="py-8 text-center text-xs italic text-slate-500 dark:text-zinc-400"
							>
								Belum ada akun. Buat dari data wali atau tambahkan manual.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<div
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
			Tambah Akun Manual
		</h2>
		<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
			Untuk orang tua yang belum punya nomor HP di data wali murid.
		</p>

		<form method="POST" action="?/create" class="mt-4 space-y-3">
			<div>
				<label
					for="portal-telepon"
					class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300"
				>
					Nomor HP
				</label>
				<input
					id="portal-telepon"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					name="telepon"
					type="tel"
					inputmode="tel"
					placeholder="08xxxxxxxxxx"
					required
				/>
				<p class="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
					Boleh diawali 62 atau 8; disimpan sebagai 08...
				</p>
			</div>

			<div>
				<label
					for="portal-nama"
					class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300"
				>
					Nama Orang Tua/Wali
				</label>
				<input
					id="portal-nama"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					name="nama"
					type="text"
					placeholder="Nama lengkap"
					required
				/>
			</div>

			<div>
				<label
					for="portal-cari-anak"
					class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300"
				>
					Cari Anak
				</label>
				<input
					id="portal-cari-anak"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					type="search"
					placeholder="Nama, NIS, atau kelas"
					bind:value={query}
				/>
			</div>

			<div
				class="max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/75 p-2 dark:border-zinc-800 dark:bg-zinc-800/40"
			>
				{#each filteredStudents as student (student.id)}
					<label
						class="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-xs transition-colors hover:bg-white dark:hover:bg-zinc-800"
					>
						<input
							class="checkbox checkbox-sm mt-0.5"
							type="checkbox"
							checked={selectedIds.includes(student.id)}
							onchange={(event) => toggleStudent(student.id, event.currentTarget.checked)}
						/>
						<span>
							<span class="font-medium text-slate-900 dark:text-zinc-100">{student.nama}</span>
							<span class="text-slate-500 dark:text-zinc-400">
								· {student.nis} · {student.kelas}
							</span>
						</span>
					</label>
				{:else}
					<p class="p-3 text-xs italic text-slate-500 dark:text-zinc-400">
						Tidak ada murid yang cocok.
					</p>
				{/each}
			</div>
			{#each selectedIds as id (id)}
				<input type="hidden" name="muridIds" value={id} />
			{/each}
			<p class="text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
				{selectedIds.length} anak dipilih.
			</p>

			<button
				class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
				type="submit"
				disabled={!selectedIds.length}
			>
				<Icon name="plus" class="h-4 w-4" />
				Buat Akun
			</button>
		</form>

		<div class="mt-5 border-t border-slate-100 pt-4 text-xs dark:border-zinc-800">
			<p class="text-slate-500 dark:text-zinc-400">Publikasi terakhir</p>
			<p class="mt-0.5 font-semibold text-slate-900 tabular-nums dark:text-zinc-100">
				{formatDate(pageData.lastPublish)}
			</p>
			<a
				class="mt-2 inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
				href={pageData.portalUrl}
				target="_blank"
				rel="noreferrer"
			>
				Buka portal publik
				<Icon name="right" class="h-3.5 w-3.5" />
			</a>
		</div>
	</div>
</div>

<div class="mt-6 text-xs text-slate-500 dark:text-zinc-400">
	Data murid, nilai, presensi, jadwal, dan catatan dikirim ulang setiap publikasi. Akun dan password
	portal tidak dihapus; hanya akun yang dinonaktifkan di sini yang ikut dinonaktifkan di portal.
</div>
