<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- static link(s) to external/about pages */
	import Icon from '$lib/components/icon.svelte';
	import type { PageData } from './$types';

	const { data } = $props<{ data: PageData }>();
	const appVersion = $derived(data.appVersion ?? '0.1.0');

	// Tiga fitur pendukung ditampilkan ringkas; Dapodik dipisah karena satu-satunya
	// kemampuan yang menyentuh sistem di luar aplikasi ini.
	const fiturPendukung: { icon: IconName; judul: string; deskripsi: string }[] = [
		{
			icon: 'import',
			judul: 'Import Excel',
			deskripsi: 'Template bawaan untuk input data massal, tidak perlu copy paste berulang.'
		},
		{
			icon: 'book-open',
			judul: 'Jurnal Mengajar',
			deskripsi: 'Catat kegiatan belajar mengajar harian secara otomatis.'
		},
		{
			icon: 'bar-chart',
			judul: 'Nilai Otomatis',
			deskripsi: 'Nilai STS dan SAS dihitung otomatis untuk rapor, siap cetak.'
		}
	];

	const referensi = [
		{
			judul: 'Panduan Belajar dan Asesmen revisi 2025',
			sumber: 'PDF: kurikulum.kemendikdasmen.go.id',
			href: 'https://kurikulum.kemendikdasmen.go.id/file/1755668120_manage_file.pdf'
		},
		{
			judul: 'Panduan Kokurikuler tahun 2025',
			sumber: 'PDF: kurikulum.kemendikdasmen.go.id',
			href: 'https://kurikulum.kemendikdasmen.go.id/file/1753779343_manage_file.pdf'
		},
		{
			judul: 'Capaian Pembelajaran',
			sumber: 'PDF: uploads.belajar.id',
			href: 'https://uploads.belajar.id/document/files/Kepka_BSKAP_No_01k17e8396ajn15j3hcw0k773b.pdf'
		},
		{
			judul: 'Capaian Pembelajaran Khusus PAPB',
			sumber: 'PDF: Google Drive',
			href: 'https://drive.google.com/file/d/1kZnNYVitjQQqHtqVHGhuiMTdNFDqF3v1/view'
		}
	];
</script>

<div class="flex flex-col gap-5">
	<!-- Identitas aplikasi. Rata kiri (bukan hero tengah) karena halaman ini bagian
	     dalam aplikasi, bukan halaman pemasaran. -->
	<section class="card bg-base-100 rounded-box shadow-md">
		<div class="card-body gap-5 md:flex-row md:items-start md:gap-6">
			<img
				src="/logo.png"
				alt="Logo SMK Pratama Mulya"
				class="mx-auto h-20 w-20 shrink-0 rounded-full object-contain md:mx-0"
			/>
			<div class="flex min-w-0 flex-1 flex-col gap-4">
				<div class="flex flex-col gap-2 text-center md:text-left">
					<h1 class="text-2xl font-bold md:text-3xl">e-Rapor SMK Pratama Mulya</h1>
					<p class="text-base-content/70 text-sm">Karawang - v{appVersion}</p>
					<p class="text-base-content/80 max-w-prose">
						Sistem Informasi Penilaian dan Administrasi Hasil Belajar Peserta Didik khusus SMK
						Pratama Mulya Karawang.
					</p>
				</div>
				<div class="flex flex-wrap justify-center gap-2 md:justify-start">
					<a
						class="btn btn-primary btn-sm shadow-none"
						href="https://smkpratamamulya.sch.id"
						target="_blank"
						rel="noreferrer"
					>
						<Icon name="school" />
						Website Sekolah
					</a>
					<a
						class="btn btn-soft btn-sm"
						href="https://kurikulum.kemendikdasmen.go.id/"
						target="_blank"
						rel="noreferrer"
					>
						Kurikulum Merdeka
					</a>
					<a class="btn btn-soft btn-sm" href="/lisensi">Lisensi</a>
				</div>
			</div>
		</div>
	</section>

	<!-- Fitur utama. Tanpa kotak per fitur supaya tidak jadi tumpukan kartu seragam;
	     ikon memakai satu warna aksen saja (primary) sebagai penanda, bukan hiasan. -->
	<section class="card bg-base-100 rounded-box shadow-md">
		<div class="card-body gap-5">
			<h2 class="card-title">Fitur Utama</h2>
			<div class="grid gap-5 sm:grid-cols-3">
				{#each fiturPendukung as fitur (fitur.judul)}
					<div class="flex flex-col gap-2">
						<Icon name={fitur.icon} class="text-primary h-5 w-5" />
						<p class="font-semibold">{fitur.judul}</p>
						<p class="text-base-content/70 text-sm">{fitur.deskripsi}</p>
					</div>
				{/each}
			</div>
			<div class="bg-base-200 rounded-lg flex flex-col gap-2 p-4 lg:flex-row lg:gap-4">
				<Icon name="export" class="text-primary h-5 w-5 shrink-0" />
				<div class="flex flex-col gap-1">
					<p class="font-semibold">Tarik data dan kirim nilai ke Dapodik</p>
					<p class="text-base-content/70 text-sm">
						Aplikasi ini sudah bisa menarik data dan mengirim matev beserta nilainya langsung ke
						Dapodik.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Satu bagian tanpa kartu sebagai jeda komposisi di antara panel-panel daftar. -->
	<section class="flex flex-col gap-3 px-1 py-2">
		<h2 class="text-xl font-bold">Mengapa e-Rapor SMK Pratama Mulya?</h2>
		<p class="text-base-content/80 max-w-prose">
			Aplikasi ini kami kembangkan sebagai solusi terpadu untuk tugas administrasi guru: presensi
			harian, jurnal mengajar, nilai harian, nilai STS, dan nilai SAS yang dihitung otomatis menjadi
			nilai rapor, bisa langsung dicetak atau dikirim ke Dapodik.
		</p>
		<p class="text-base-content/80 max-w-prose">
			Ada juga jadwal pembelajaran dan bell otomatis. Harapan kami, aplikasi ini membantu pendidik
			dan tenaga kependidikan menerapkan Kurikulum Merdeka secara efektif dan efisien.
		</p>
	</section>

	<section class="card bg-base-100 rounded-box shadow-md">
		<div class="card-body gap-4">
			<h2 class="card-title">Referensi</h2>
			<ul class="grid gap-x-6 gap-y-4 lg:grid-cols-2">
				{#each referensi as ref (ref.href)}
					<li class="flex gap-3">
						<Icon name="download" class="text-base-content/60 mt-0.5 h-4 w-4 shrink-0" />
						<div class="flex min-w-0 flex-col">
							<a
								class="link link-hover font-semibold"
								href={ref.href}
								target="_blank"
								rel="noreferrer"
							>
								{ref.judul}
							</a>
							<span class="text-base-content/70 text-xs">{ref.sumber}</span>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<!-- Kredit pengembang sebagai strip, bukan kartu sejajar dengan daftar referensi. -->
	<footer
		class="border-base-300 flex flex-col gap-1 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between"
	>
		<p class="text-base-content/80">
			Dikembangkan oleh
			<span class="font-semibold">Amara Thuridha</span>
		</p>
		<a class="link link-hover" href="https://athuridha.my.id" target="_blank" rel="noreferrer">
			athuridha.my.id
		</a>
	</footer>
</div>
