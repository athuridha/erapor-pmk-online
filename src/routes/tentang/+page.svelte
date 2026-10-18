<script lang="ts">
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

<!-- Semua blok memakai kartu dengan padding yang sama, supaya tepi kiri teks satu garis
     dari atas ke bawah. Kredit pengembang ikut jadi kartu agar kolom terakhir rata. -->
<div class="flex flex-col gap-5">
	<!-- Identitas aplikasi. Nama produk duduk di dalam pita foto (bukan di bawahnya)
	     supaya tidak menabrak gambar; pita gelap di bawah foto jadi alas teks putih
	     dengan perlakuan yang sama seperti halaman /login. -->
	<section class="card bg-base-100 rounded-box overflow-hidden shadow-md">
		<div class="relative h-36 w-full overflow-hidden bg-emerald-900 sm:h-44">
			<img src="/guru-banner.webp" alt="" class="h-full w-full object-cover opacity-85" />
			<div
				class="absolute inset-0 bg-gradient-to-t from-[#064e3b] via-[#064e3b]/60 to-[#064e3b]/10"
			></div>
			<div class="absolute inset-x-0 bottom-0 flex items-center gap-3 p-5 sm:gap-4">
				<span
					class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white p-1.5 shadow-lg sm:h-14 sm:w-14"
				>
					<img src="/logo.png" alt="Logo SMK Pratama Mulya" class="h-full w-full object-contain" />
				</span>
				<div class="min-w-0">
					<h1 class="text-lg font-black text-white sm:text-2xl lg:text-3xl">
						e-Rapor SMK Pratama Mulya
					</h1>
					<p class="text-xs font-semibold text-emerald-100 sm:text-sm">Karawang - v{appVersion}</p>
				</div>
			</div>
		</div>
		<div class="card-body gap-4">
			<p class="text-base-content/80">
				Sistem Informasi Penilaian dan Administrasi Hasil Belajar Peserta Didik khusus SMK Pratama
				Mulya Karawang.
			</p>
			<div class="flex flex-wrap gap-2">
				<a
					class="btn btn-primary btn-sm shadow-none"
					href="https://smkpratamamulya.sch.id"
					target="_blank"
					rel="noreferrer"
				>
					<Icon name="school" />
					Website Sekolah
				</a>
				<!-- Lockup Kurikulum Merdeka berwarna gelap, jadi seluruh tombolnya diberi alas
				     putih agar tetap terbaca di mode gelap. Padding p-2 + gambar h-4 sama dengan
				     tinggi btn-sm, jadi sejajar dengan tombol lain. Nama tautan dari alt gambar. -->
				<a
					class="btn btn-sm border-base-300 bg-white p-2 shadow-none hover:bg-white"
					href="https://kurikulum.kemendikdasmen.go.id/"
					target="_blank"
					rel="noreferrer"
					aria-label="Kurikulum Merdeka"
				>
					<img src="/logo-kumer.png" alt="Kurikulum Merdeka" class="h-4 w-auto" />
				</a>
				<a class="btn btn-soft btn-sm" href="/lisensi">Lisensi</a>
			</div>
		</div>
	</section>

	<!-- Fitur utama: daftar pendukung dan kemampuan Dapodik dalam satu kartu, dibedakan
	     lewat blok bertinta aksen tipis supaya tetap terbaca sebagai satu panel. -->
	<section class="card bg-base-100 rounded-box shadow-md">
		<div class="card-body gap-5">
			<h2 class="card-title">Fitur Utama</h2>
			<div class="grid gap-5 sm:grid-cols-3">
				{#each fiturPendukung as fitur (fitur.judul)}
					<div class="flex flex-col gap-2">
						<span class="bg-primary/10 text-primary grid h-9 w-9 place-items-center rounded-lg">
							<Icon name={fitur.icon} class="h-5 w-5" />
						</span>
						<p class="font-semibold">{fitur.judul}</p>
						<p class="text-base-content/70 text-sm">{fitur.deskripsi}</p>
					</div>
				{/each}
			</div>
			<div class="border-primary/20 bg-primary/5 flex items-start gap-3 rounded-lg border p-4">
				<span
					class="bg-primary/10 text-primary grid h-9 w-9 shrink-0 place-items-center rounded-lg"
				>
					<Icon name="export" class="h-5 w-5" />
				</span>
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

	<!-- Prosa penjelas dan daftar referensi berdampingan. Keduanya kartu dengan padding
	     identik, jadi tepi teks tetap satu garis walau komposisinya dua kolom. -->
	<section class="grid gap-5 lg:grid-cols-2">
		<div class="card bg-base-100 rounded-box shadow-md">
			<div class="card-body gap-3">
				<h2 class="card-title">Mengapa e-Rapor SMK Pratama Mulya?</h2>
				<p class="text-base-content/80">
					Aplikasi ini kami kembangkan sebagai solusi terpadu untuk tugas administrasi guru:
					presensi harian, jurnal mengajar, nilai harian, nilai STS, dan nilai SAS yang dihitung
					otomatis menjadi nilai rapor, bisa langsung dicetak atau dikirim ke Dapodik.
				</p>
				<p class="text-base-content/80">
					Ada juga jadwal pembelajaran dan bell otomatis. Harapan kami, aplikasi ini membantu
					pendidik dan tenaga kependidikan menerapkan Kurikulum Merdeka secara efektif dan efisien.
				</p>
			</div>
		</div>

		<div class="card bg-base-100 rounded-box shadow-md">
			<div class="card-body gap-3">
				<h2 class="card-title">Referensi</h2>
				<!-- Seluruh baris jadi tautan supaya area klik lebih besar di layar sentuh.
				     Margin negatif sebesar padding baris membuat teks tetap sejajar dengan
				     judul kartu, bukan menjorok ke dalam. -->
				<ul class="-mx-2 flex flex-col">
					{#each referensi as ref (ref.href)}
						<li>
							<a
								class="hover:bg-base-200 focus-visible:outline-primary flex gap-3 rounded-lg p-2 transition-colors focus-visible:outline-2"
								href={ref.href}
								target="_blank"
								rel="noreferrer"
							>
								<Icon name="download" class="text-base-content/60 mt-1 h-4 w-4 shrink-0" />
								<span class="flex min-w-0 flex-col">
									<span class="font-semibold">{ref.judul}</span>
									<span class="text-base-content/70 text-xs">{ref.sumber}</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>

	<!-- Kredit pengembang: satu tautan, nama sekaligus alamat situsnya. -->
	<footer class="card bg-base-100 rounded-box shadow-md">
		<div
			class="card-body flex-col gap-1 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
		>
			<p class="text-base-content/70">Dikembangkan oleh</p>
			<a
				class="link link-hover font-semibold"
				href="https://athuridha.my.id"
				target="_blank"
				rel="noreferrer">Amara Thuridha, athuridha.my.id</a
			>
		</div>
	</footer>
</div>
