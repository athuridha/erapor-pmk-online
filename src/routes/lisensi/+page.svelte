<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
</script>

<div class="flex flex-col gap-5">
	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-6 text-center shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="mx-auto max-w-xl">
			<h1 class="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-zinc-100">
				Lisensi
			</h1>
			<p class="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
				Perangkat lunak ini menggunakan lisensi khusus yang melindungi hak pengembang sekaligus
				memberikan kebebasan untuk penggunaan nonkomersial.
			</p>
		</div>
	</section>

	<section class="grid gap-4 sm:grid-cols-3">
		<div
			class="flex gap-3 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<Icon name="check" class="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
			<div>
				<p class="text-sm font-bold text-slate-900 dark:text-zinc-100">Gratis &amp; Bebas</p>
				<p class="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Boleh digunakan, disalin, dan dimodifikasi untuk keperluan nonkomersial.
				</p>
			</div>
		</div>
		<div
			class="flex gap-3 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<Icon name="lock" class="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
			<div>
				<p class="text-sm font-bold text-slate-900 dark:text-zinc-100">Non-Komersial</p>
				<p class="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Dilarang menjual, menyewakan, atau memonetisasi perangkat lunak ini atau hasil
					modifikasinya.
				</p>
			</div>
		</div>
		<div
			class="flex gap-3 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<Icon name="info" class="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
			<div>
				<p class="text-sm font-bold text-slate-900 dark:text-zinc-100">Atribusi</p>
				<p class="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Sistem e-Rapor khusus SMK Pratama Mulya Karawang.
				</p>
			</div>
		</div>
	</section>

	<section
		class="space-y-4 rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Hak Penggunaan</h2>
		<ul
			class="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-800/40"
		>
			<li class="flex flex-col gap-1 p-4">
				<p class="text-sm font-semibold text-slate-900 dark:text-zinc-100">
					Pribadi, pendidikan &amp; penelitian
				</p>
				<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Perangkat lunak ini boleh digunakan untuk keperluan pribadi, pendidikan, pembelajaran, dan
					penelitian.
				</p>
			</li>
			<li class="flex flex-col gap-1 p-4">
				<p class="text-sm font-semibold text-slate-900 dark:text-zinc-100">
					Pelajari &amp; modifikasi
				</p>
				<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Boleh mempelajari cara kerja kode sumber dan memodifikasinya sesuai kebutuhan.
				</p>
			</li>
			<li class="flex flex-col gap-1 p-4">
				<p class="text-sm font-semibold text-slate-900 dark:text-zinc-100">Kontribusi</p>
				<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Boleh mengirimkan perbaikan bug, fitur baru, atau kontribusi lainnya ke repositori resmi
					e-Rapor SMK Pratama Mulya.
				</p>
			</li>
			<li class="flex flex-col gap-1 p-4">
				<p class="text-sm font-semibold text-slate-900 dark:text-zinc-100">
					Penyalinan &amp; distribusi
				</p>
				<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Boleh menyalin dan mendistribusikan perangkat lunak ini (asli maupun dimodifikasi) dengan
					syarat lisensi ini tetap disertakan, copyright notice dipertahankan, dan identitas
					pengembang asli tidak dihilangkan.
				</p>
			</li>
		</ul>
	</section>

	<section
		class="space-y-4 rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Larangan Komersial</h2>
		<p class="text-sm text-slate-700 dark:text-zinc-300">
			Perangkat lunak ini <strong class="text-red-700 dark:text-red-400">tidak boleh</strong> digunakan
			untuk tujuan komersial dalam bentuk apa pun:
		</p>
		<ul
			class="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-700 dark:text-zinc-300"
		>
			<li>Menjual perangkat lunak ini, versi modifikasinya, atau hasil turunannya.</li>
			<li>Menjual atau menyewakan lisensi penggunaan.</li>
			<li>Memberikan akses berbayar terhadap perangkat lunak ini.</li>
			<li>Memungut biaya untuk mengunduh perangkat lunak ini.</li>
			<li>
				Menawarkan layanan instalasi, konfigurasi, atau dukungan dengan menjadikan perangkat lunak
				ini sebagai produk utama yang diperjualbelikan.
			</li>
			<li>
				Menggunakan perangkat lunak ini sebagai bagian dari produk atau layanan komersial tanpa izin
				tertulis dari pemegang hak cipta.
			</li>
		</ul>
		<div
			role="alert"
			class="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="alert" class="mt-0.5 h-4 w-4 shrink-0" />
			<span>
				Ingin menggunakan e-Rapor SMK Pratama Mulya untuk keperluan komersial? Hubungi tim
				pengembang untuk memperoleh izin tertulis.
			</span>
		</div>
	</section>

	<section class="grid gap-4 lg:grid-cols-2">
		<div
			class="space-y-3 rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Atribusi</h2>
			<p class="text-xs text-slate-700 dark:text-zinc-300">
				Jika mendistribusikan perangkat lunak ini atau versi yang telah dimodifikasi, wajib:
			</p>
			<ul
				class="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-800/40"
			>
				<li class="flex flex-col gap-1 p-3.5">
					<p class="text-xs font-bold text-slate-900 dark:text-zinc-100">Kredit pengembang</p>
					<p class="text-xs text-slate-600 dark:text-zinc-400">
						Cantumkan nama e-Rapor SMK Pratama Mulya sebagai pengembang asli.
					</p>
				</li>
				<li class="flex flex-col gap-1 p-3.5">
					<p class="text-xs font-bold text-slate-900 dark:text-zinc-100">Tautan repositori</p>
					<p class="text-xs text-slate-600 dark:text-zinc-400">
						Sertakan tautan ke repositori resmi e-Rapor SMK Pratama Mulya.
					</p>
				</li>
				<li class="flex flex-col gap-1 p-3.5">
					<p class="text-xs font-bold text-slate-900 dark:text-zinc-100">Sebutkan modifikasi</p>
					<p class="text-xs text-slate-600 dark:text-zinc-400">
						Jelaskan bahwa perangkat lunak telah dimodifikasi jika ada perubahan.
					</p>
				</li>
			</ul>
		</div>

		<div
			class="space-y-3 rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Cakupan Lisensi</h2>
			<p class="text-xs text-slate-700 dark:text-zinc-300">Lisensi ini berlaku untuk:</p>
			<ul
				class="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-800/40"
			>
				<li class="flex flex-col gap-1 p-3.5">
					<p class="text-xs font-bold text-slate-900 dark:text-zinc-100">Seluruh kode sumber</p>
					<p class="text-xs text-slate-600 dark:text-zinc-400">
						Semua file kode dalam repositori ini.
					</p>
				</li>
				<li class="flex flex-col gap-1 p-3.5">
					<p class="text-xs font-bold text-slate-900 dark:text-zinc-100">Aset visual</p>
					<p class="font-mono text-xs text-slate-600 dark:text-zinc-400">
						logo.png, logo.ico, favicon.ico, favicon.png, bipmap2.png
					</p>
				</li>
				<li class="flex flex-col gap-1 p-3.5">
					<p class="text-xs font-bold text-slate-900 dark:text-zinc-100">Ikon pihak ketiga</p>
					<p class="text-xs text-slate-600 dark:text-zinc-400">
						<code>src/lib/icons/</code> berasal dari Feather Icons (lisensi MIT).
					</p>
				</li>
			</ul>
			<p class="text-xs text-slate-500 dark:text-zinc-400">
				Aset lain di luar daftar di atas tetap mengikuti lisensi masing-masing.
			</p>
		</div>
	</section>

	<section
		class="space-y-3 rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Penafian</h2>
		<div
			role="alert"
			class="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="alert" class="mt-0.5 h-4 w-4 shrink-0" />
			<span>
				Perangkat lunak ini disediakan <strong>"sebagaimana adanya"</strong> (AS IS), tanpa jaminan dalam
				bentuk apa pun, baik tersurat maupun tersirat. Pemegang hak cipta tidak bertanggung jawab atas
				kerusakan, kehilangan data, gangguan operasional, atau kerugian lainnya yang timbul akibat penggunaan
				perangkat lunak ini.
			</span>
		</div>
	</section>
</div>
