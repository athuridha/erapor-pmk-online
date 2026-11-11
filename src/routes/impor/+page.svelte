<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import {
		isAdminUser,
		isAuthorizedUser,
		resolveRoutePermission
	} from '../pengguna/permissions';

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
			pathIzin: '/nilai-akhir',
			catatan: 'Untuk guru mapel dan operator.'
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
			href: '/master-data/pengguna/guru',
			icon: 'users',
			labelAksi: 'Buka Data Pengguna Guru',
			pathIzin: '/master-data',
			catatan: 'Tombol “Impor Daftar Guru” ada di halaman Data Pengguna — Guru.'
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
		<h1 class="text-2xl font-bold">Pusat Impor</h1>
		<p class="text-base-content/70 text-sm">
			Satu pintu untuk semua alur impor. Halaman dan tombol impor aslinya tidak berubah — pilih
			jenis data yang ingin diimpor.
		</p>
	</header>

	<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
		{#each alurTampil as item (item.href)}
			<section class="card bg-base-100 border-base-200 h-full rounded-2xl border shadow-sm">
				<div class="card-body flex flex-col gap-2 p-4">
					<div class="flex items-start gap-2">
						<span
							class="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
						>
							<Icon name={item.icon} />
						</span>
						<h2 class="min-w-0 text-base font-bold">{item.judul}</h2>
					</div>
					<p class="text-base-content/70 grow text-sm">{item.deskripsi}</p>
					{#if item.catatan}
						<p class="text-base-content/60 text-xs">{item.catatan}</p>
					{/if}
					<a class="btn btn-soft btn-sm mt-auto shadow-none" href={item.href}>
						<Icon name="right" />
						{item.labelAksi}
					</a>
				</div>
			</section>
		{:else}
			<div class="alert alert-info md:col-span-2 xl:col-span-3">
				<Icon name="info" />
				<span>Belum ada alur impor yang tersedia untuk akun Anda.</span>
			</div>
		{/each}
	</div>

	<div class="alert alert-soft text-sm">
		<Icon name="info" />
		<span>
			Impor data pokok melengkapi sinkronisasi Dapodik: data lokal tetap bisa dimasukkan atau
			diperbarui lewat jalur ini tanpa menunggu sinkronisasi.
		</span>
	</div>
</div>
