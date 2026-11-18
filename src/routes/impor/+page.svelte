<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import { isAdminUser, isAuthorizedUser, resolveRoutePermission } from '../pengguna/permissions';

	type AlurImpor = {
		judul: string;
		deskripsi: string;
		href: string;
		icon: IconName;
		labelAksi: string;
		/** Halaman tujuan yang dipakai untuk mengecek izin pengguna. */
		pathIzin: string;
		catatan?: string;
	};

	/**
	 * Daftar alur impor yang SUDAH ada — halaman ini hanya memusatkan pintunya.
	 * Ikon memakai ikon yang sudah tersedia di `$lib/icons`.
	 */
	const alur: AlurImpor[] = [
		{
			judul: 'Impor Nilai',
			deskripsi:
				'Unggah nilai dari file Excel (format rekap nilai akhir). Tersedia pratinjau sebelum disimpan.',
			href: '/nilai-akhir/impor-nilai',
			icon: 'import',
			labelAksi: 'Buka Impor Nilai',
			pathIzin: '/master-data',
			catatan: 'Untuk operator/admin sekolah.'
		},
		{
			judul: 'Impor Data Pokok',
			deskripsi:
				'Impor data murid, kelas, dan pegawai dari Excel, atau impor database hasil ekspor aplikasi.',
			href: '/import-data',
			icon: 'database',
			labelAksi: 'Buka Impor Data',
			pathIzin: '/import-data',
			catatan: 'Operator/admin. Melengkapi sinkronisasi Dapodik.'
		},
		{
			judul: 'Impor Daftar Guru',
			deskripsi:
				'Buat akun guru sekaligus dari file .xlsx/.csv berisi kolom Pengguna/Password dan Nama.',
			href: '/master-data/pengguna',
			icon: 'users',
			labelAksi: 'Buka Akun Pengguna',
			pathIzin: '/master-data',
			catatan: 'Tombol "Impor Daftar Guru" ada di halaman Akun Pengguna.'
		},
		{
			judul: 'Impor Mapel Intrakurikuler',
			deskripsi:
				'Impor daftar mata pelajaran beserta lingkup materi dan tujuan pembelajaran dari Excel.',
			href: '/intrakurikuler',
			icon: 'book',
			labelAksi: 'Buka Intrakurikuler',
			pathIzin: '/intrakurikuler',
			catatan: 'Tombol Impor Mapel ada pada menu tetikus di halaman Intrakurikuler.'
		},
		{
			judul: 'Impor Kokurikuler',
			deskripsi: 'Impor kegiatan kokurikuler beserta dimensi profil lulusan dari file Excel.',
			href: '/kokurikuler',
			icon: 'layers',
			labelAksi: 'Buka Kokurikuler',
			pathIzin: '/kokurikuler',
			catatan: 'Tombol Impor Kokurikuler ada di halaman Kokurikuler.'
		},
		{
			judul: 'Impor Ekstrakurikuler',
			deskripsi: 'Impor daftar ekstrakurikuler dari file Excel, lengkap dengan kaitan kelas.',
			href: '/ekstrakurikuler',
			icon: 'activity',
			labelAksi: 'Buka Ekstrakurikuler',
			pathIzin: '/ekstrakurikuler',
			catatan: 'Tombol Impor Ekstrakurikuler ada di halaman Ekstrakurikuler.'
		},
		{
			judul: 'Import JSON RPM',
			deskripsi:
				'Impor rencana pembelajaran mendalam (RPM) dari berkas JSON hasil ekspor aplikasi lain.',
			href: '/rpm',
			icon: 'folder',
			labelAksi: 'Buka RPM',
			pathIzin: '/rpm',
			catatan: 'Tombol “Import JSON” ada di halaman RPM.'
		}
	];

	const user = $derived(page.data.user ?? null);

	function boleAkses(item: AlurImpor): boolean {
		if (!user) return false;
		if (isAdminUser(user)) return true;
		const izin = resolveRoutePermission(item.pathIzin);
		if (!izin) return true;
		return isAuthorizedUser([izin], user);
	}

	const alurTampil = $derived(alur.filter((item) => boleAkses(item)));
</script>

<div class="space-y-4">
	<header class="space-y-1">
		<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Pusat Impor</h1>
		<p class="text-xs text-slate-600 dark:text-zinc-400">
			Satu pintu untuk semua alur impor. Pilih jenis data yang ingin diimpor tanpa mengubah format
			dokumen asli.
		</p>
	</header>

	<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
		{#each alurTampil as item (item.href)}
			<section
				class="flex h-full flex-col gap-3 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] transition-colors hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
			>
				<div class="flex items-start gap-3">
					<span
						class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
					>
						<Icon name={item.icon} class="h-4 w-4" />
					</span>
					<div class="min-w-0">
						<h2 class="text-sm font-bold text-slate-900 dark:text-zinc-100">{item.judul}</h2>
						{#if item.catatan}
							<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{item.catatan}</p>
						{/if}
					</div>
				</div>
				<p class="grow text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
					{item.deskripsi}
				</p>
				<a
					class="mt-auto inline-flex h-8 w-fit items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					href={item.href}
				>
					<Icon name="right" class="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
					{item.labelAksi}
				</a>
			</section>
		{:else}
			<div
				class="flex items-center gap-2 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 md:col-span-2 xl:col-span-3 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
			>
				<Icon name="info" class="h-4 w-4 shrink-0" />
				<span>Belum ada alur impor yang tersedia untuk akun Anda.</span>
			</div>
		{/each}
	</div>

	<div
		class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300"
	>
		<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
		<span>
			Impor data pokok melengkapi sinkronisasi Dapodik: data lokal tetap bisa dimasukkan atau
			diperbarui lewat jalur ini tanpa menunggu sinkronisasi.
		</span>
	</div>
</div>
