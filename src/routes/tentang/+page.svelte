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
	<section
		class="overflow-hidden rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="relative h-36 w-full overflow-hidden bg-blue-950 sm:h-44">
			<img src="/guru-banner.webp" alt="" class="h-full w-full object-cover opacity-85" />
			<div
				class="absolute inset-0 bg-gradient-to-t from-slate-950 via-blue-950/65 to-blue-950/15"
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
					<p class="text-xs font-semibold text-blue-100 sm:text-sm">Karawang - v{appVersion}</p>
				</div>
			</div>
		</div>
		<div class="space-y-4 p-5">
			<p class="text-sm text-slate-700 dark:text-zinc-300">
				Sistem Informasi Penilaian dan Administrasi Hasil Belajar Peserta Didik khusus SMK Pratama
				Mulya Karawang.
			</p>
			<div class="flex flex-wrap gap-2">
				<a
					class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
					href="https://smkpratamamulya.sch.id"
					target="_blank"
					rel="noreferrer"
				>
					<Icon name="school" class="h-3.5 w-3.5" />
					Website Sekolah
				</a>
				<a
					class="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-2.5 transition-colors hover:bg-slate-50"
					href="https://kurikulum.kemendikdasmen.go.id/"
					target="_blank"
					rel="noreferrer"
					aria-label="Kurikulum Merdeka"
				>
					<img src="/logo-kumer.png" alt="Kurikulum Merdeka" class="h-4 w-auto" />
				</a>
				<a
					class="inline-flex h-8 items-center rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					href="/lisensi">Lisensi</a
				>
			</div>
		</div>
	</section>

	<section
		class="space-y-5 rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<h2 class="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">Fitur Utama</h2>
		<div class="grid gap-5 sm:grid-cols-3">
			{#each fiturPendukung as fitur (fitur.judul)}
				<div class="flex flex-col gap-2">
					<span
						class="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"
					>
						<Icon name={fitur.icon} class="h-5 w-5" />
					</span>
					<p class="text-sm font-bold text-slate-900 dark:text-zinc-100">{fitur.judul}</p>
					<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">{fitur.deskripsi}</p>
				</div>
			{/each}
		</div>
		<div
			class="flex items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50/75 p-4 dark:border-blue-900/60 dark:bg-blue-950/40"
		>
			<span
				class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
			>
				<Icon name="export" class="h-5 w-5" />
			</span>
			<div class="flex flex-col gap-1">
				<p class="text-sm font-bold text-slate-900 dark:text-zinc-100">
					Tarik data dan kirim nilai ke Dapodik
				</p>
				<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
					Aplikasi ini sudah bisa menarik data dan mengirim mata evaluasi (matev) beserta nilainya
					langsung ke Dapodik.
				</p>
			</div>
		</div>
	</section>

	<section class="grid gap-5 lg:grid-cols-2">
		<div
			class="space-y-3 rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<h2 class="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Mengapa e-Rapor SMK Pratama Mulya?
			</h2>
			<p class="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
				Aplikasi ini kami kembangkan sebagai solusi terpadu untuk tugas administrasi guru: presensi
				harian, jurnal mengajar, nilai harian, nilai STS, dan nilai SAS yang dihitung otomatis
				menjadi nilai rapor, bisa langsung dicetak atau dikirim ke Dapodik.
			</p>
			<p class="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
				Ada juga jadwal pembelajaran dan bell otomatis. Harapan kami, aplikasi ini membantu pendidik
				dan tenaga kependidikan menerapkan Kurikulum Merdeka secara efektif dan efisien.
			</p>
		</div>

		<div
			class="space-y-3 rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<h2 class="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">Referensi</h2>
			<ul class="-mx-2 flex flex-col">
				{#each referensi as ref (ref.href)}
					<li>
						<a
							class="flex gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800"
							href={ref.href}
							target="_blank"
							rel="noreferrer"
						>
							<Icon
								name="download"
								class="mt-1 h-4 w-4 shrink-0 text-slate-500 dark:text-zinc-400"
							/>
							<span class="flex min-w-0 flex-col">
								<span class="text-sm font-semibold text-slate-900 dark:text-zinc-100"
									>{ref.judul}</span
								>
								<span class="text-xs text-slate-500 dark:text-zinc-400">{ref.sumber}</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<footer
		class="flex flex-col gap-1 rounded-2xl border border-slate-200/75 bg-white px-5 py-4 text-xs shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900"
	>
		<p class="text-slate-600 dark:text-zinc-400">Dikembangkan oleh</p>
		<a
			class="font-semibold text-slate-900 hover:underline dark:text-zinc-100"
			href="https://athuridha.my.id"
			target="_blank"
			rel="noreferrer">Amara Thuridha, athuridha.my.id</a
		>
	</footer>
</div>
