<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import SekolahModals from '$lib/components/sekolah/modals.svelte';
	import type { SekolahCard } from '$lib/components/sekolah/types';
	import { jenjangPendidikanSederajat, nauganLabelByKey } from '$lib/statics.js';
	import { modalRoute } from '$lib/utils';

	import { page } from '$app/state';

	// single permission for sekolah management
	let canSekolahManage = $derived.by(() => {
		const perms = (page.data.user ?? { permissions: [] }).permissions ?? [];
		return (perms as string[]).includes('informasi_umum_sekolah');
	});

	let { data } = $props();
	const sekolahList = $derived((data.sekolahList ?? []) as SekolahCard[]);
	const activeSekolahId = $derived(data.sekolah?.id ?? null);
	const sortedSekolahList = $derived.by(() => {
		const list = sekolahList;
		const aktifId = activeSekolahId;
		return [...list].sort((a, b) => {
			if (a.id === aktifId) return -1;
			if (b.id === aktifId) return 1;
			return list.indexOf(a) - list.indexOf(b);
		});
	});

	const formatDate = (value?: string | null) => {
		if (!value) return '-';
		return new Date(value).toLocaleDateString('id-ID', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	/**
	 * Gabungkan komponen alamat tanpa menggandakan bagian yang sudah tercakup
	 * di komponen lain. Kasus nyata: `alamat.jalan` sudah berisi
	 * "Kutapohaci, Kec. Ciampel, Karawang, Jawa Barat 41363" padahal
	 * desa/kecamatan/kabupaten/provinsi/kode pos juga terisi terpisah.
	 */
	function plainAlamat(alamat?: Alamat | null) {
		if (!alamat) return '-';
		const bagian = [
			alamat.jalan,
			alamat.desa,
			alamat.kecamatan,
			alamat.kabupaten,
			alamat.provinsi,
			alamat.kodePos
		]
			.map((nilai) => (nilai ?? '').toString().trim())
			.filter((nilai) => nilai && nilai !== '-');
		const normal = (teks: string) =>
			teks.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
		const hasil: string[] = [];
		for (const nilai of bagian) {
			const n = normal(nilai);
			let tercakup = false;
			for (let i = 0; i < hasil.length; i += 1) {
				const ada = normal(hasil[i]);
				if (ada.includes(n) || n.includes(ada)) {
					// Simpan versi terpanjang supaya informasi tidak hilang.
					if (n.length > ada.length) hasil[i] = nilai;
					tercakup = true;
					break;
				}
			}
			if (!tercakup) hasil.push(nilai);
		}
		return hasil.length ? hasil.join(', ') : '-';
	}

	function getJenjangLabel(key?: Sekolah['jenjangPendidikan'] | null) {
		if (!key) return '-';
		const label = (jenjangPendidikanSederajat[key] ?? [])[0]?.label;
		return label ?? String(key);
	}

	function getJenjangVariantLabel(variantKey?: Sekolah['jenjangVariant'] | null) {
		if (!variantKey) return null;
		// search across all jenjang groups for a variant with the matching key
		for (const groupKey of Object.keys(jenjangPendidikanSederajat)) {
			const variants =
				jenjangPendidikanSederajat[groupKey as keyof typeof jenjangPendidikanSederajat] ?? [];
			const found = variants.find((v) => v.key === variantKey);
			if (found) return found.label;
		}
		return String(variantKey);
	}
</script>

<div class="flex flex-col gap-4">
	{#if sortedSekolahList.length}
		{#each sortedSekolahList as sekolah (sekolah.id)}
			<section
				class="overflow-hidden rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div class="border-b border-slate-200 p-5 dark:border-zinc-800">
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div class="flex items-center gap-4">
							<div
								class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 dark:border-zinc-700 dark:bg-zinc-900"
							>
								<img
									class="h-full w-full object-contain"
									src={`/sekolah/logo/${sekolah.id}`}
									alt={`Logo ${sekolah.nama}`}
								/>
							</div>

							<div class="min-w-0">
								<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
									{sekolah.nama}
								</h1>
								<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">Data Pokok Sekolah</p>
							</div>
						</div>
						{#if sekolah.id === activeSekolahId}
							<span
								class="inline-flex items-center rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
								>Aktif</span
							>
						{/if}
					</div>

					<div class="mt-4">
						{#if sekolah.tahunAjaranAktif}
							<div class="flex flex-wrap items-center gap-2 text-xs">
								<span
									class="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/60"
								>
									Tahun ajaran: {sekolah.tahunAjaranAktif.nama}
								</span>
								{#if sekolah.semesterAktif}
									<span
										class="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
									>
										Semester: {sekolah.semesterAktif.nama}
									</span>
									{#if sekolah.semesterAktif.tanggalBagiRaport}
										<span class="text-xs text-slate-500 dark:text-zinc-400">
											Bagi rapor: {formatDate(sekolah.semesterAktif.tanggalBagiRaport)}
										</span>
									{/if}
								{:else}
									<span class="text-xs text-slate-500 dark:text-zinc-400"
										>Belum ada semester aktif</span
									>
								{/if}
							</div>
						{:else}
							<div
								class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
							>
								<Icon name="warning" class="h-4 w-4 shrink-0" />
								<span>Belum ada tahun ajaran aktif. Atur melalui tombol "Tahun Ajaran".</span>
							</div>
						{/if}
					</div>
				</div>

				<div class="p-5">
					<dl class="divide-y divide-slate-100 text-sm dark:divide-zinc-800/80">
						<div class="grid grid-cols-1 gap-1 py-2.5 first:pt-0 md:grid-cols-3 md:gap-4">
							<dt class="text-xs font-semibold text-slate-500 dark:text-zinc-400">
								Jenjang Pendidikan
							</dt>
							<dd class="text-slate-900 md:col-span-2 dark:text-zinc-100">
								{#if sekolah.jenjangVariant}
									{getJenjangVariantLabel(sekolah.jenjangVariant)}
								{:else}
									{getJenjangLabel(sekolah.jenjangPendidikan)}
								{/if}
							</dd>
						</div>

						<div class="grid grid-cols-1 gap-1 py-2.5 md:grid-cols-3 md:gap-4">
							<dt class="text-xs font-semibold text-slate-500 dark:text-zinc-400">Naungan</dt>
							<dd class="text-slate-900 md:col-span-2 dark:text-zinc-100">
								{nauganLabelByKey[sekolah.naungan as keyof typeof nauganLabelByKey] ?? '-'}
							</dd>
						</div>

						<div class="grid grid-cols-1 gap-1 py-2.5 md:grid-cols-3 md:gap-4">
							<dt class="text-xs font-semibold text-slate-500 dark:text-zinc-400">NPSN</dt>
							<dd class="font-medium text-slate-900 tabular-nums md:col-span-2 dark:text-zinc-100">
								{sekolah.npsn}
							</dd>
						</div>

						<div class="grid grid-cols-1 gap-1 py-2.5 md:grid-cols-3 md:gap-4">
							<dt class="text-xs font-semibold text-slate-500 dark:text-zinc-400">
								Kepala Sekolah
							</dt>
							<dd class="text-slate-900 md:col-span-2 dark:text-zinc-100">
								<span title={sekolah.kepalaSekolah?.nip ?? undefined}>
									{sekolah.kepalaSekolah?.nama ?? '-'}
								</span>
								{#if sekolah.kepalaSekolah?.nip}
									<span class="ml-1.5 text-xs text-slate-500 tabular-nums dark:text-zinc-400">
										({sekolah.kepalaSekolah.nip})
									</span>
								{/if}
							</dd>
						</div>

						<div class="grid grid-cols-1 gap-1 py-2.5 md:grid-cols-3 md:gap-4">
							<dt class="text-xs font-semibold text-slate-500 dark:text-zinc-400">Alamat</dt>
							<dd class="text-slate-900 md:col-span-2 dark:text-zinc-100">
								{plainAlamat(sekolah.alamat)}
							</dd>
						</div>

						<div class="grid grid-cols-1 gap-1 py-2.5 md:grid-cols-3 md:gap-4">
							<dt class="text-xs font-semibold text-slate-500 dark:text-zinc-400">
								Website Sekolah
							</dt>
							<dd class="md:col-span-2">
								{#if sekolah.website}
									<a
										href={sekolah.website}
										target="_blank"
										rel="noopener noreferrer"
										class="font-medium text-blue-600 break-all underline hover:text-blue-700 dark:text-blue-400"
										>{sekolah.website}</a
									>
								{:else}
									<span class="text-slate-500 dark:text-zinc-400">-</span>
								{/if}
							</dd>
						</div>

						<div class="grid grid-cols-1 gap-1 py-2.5 last:pb-0 md:grid-cols-3 md:gap-4">
							<dt class="text-xs font-semibold text-slate-500 dark:text-zinc-400">Email Sekolah</dt>
							<dd class="break-all md:col-span-2">
								{#if sekolah.email}
									<a
										href={`mailto:${sekolah.email}`}
										target="_blank"
										rel="noopener noreferrer"
										class="font-medium text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
										>{sekolah.email}</a
									>
								{:else}
									<span class="text-slate-500 dark:text-zinc-400">-</span>
								{/if}
							</dd>
						</div>
					</dl>

					<div
						class="mt-6 flex flex-col justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row dark:border-zinc-800"
					>
						<a
							href="/sekolah/form/sync-dapodik"
							use:modalRoute={'sync-dapodik'}
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 {!canSekolahManage
								? 'pointer-events-none opacity-50'
								: ''}"
							aria-label="Sync Dapodik"
							aria-disabled={!canSekolahManage}
							title={!canSekolahManage ? 'Anda tidak memiliki izin untuk sinkronisasi Dapodik' : ''}
						>
							<Icon name="dapodik" class="h-4 w-4" />
							Sync Dapodik
						</a>
						<!-- Impor data pokok (Excel) & impor database tersedia di Beranda. -->
						<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
							<a
								href={`/sekolah/tahun-ajaran?sekolahId=${sekolah.id}`}
								class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 {!canSekolahManage
									? 'pointer-events-none opacity-50'
									: ''}"
								aria-label="Lihat tahun ajaran"
								aria-disabled={!canSekolahManage}
								title={!canSekolahManage
									? 'Anda tidak memiliki izin untuk melihat Tahun Ajaran'
									: ''}
							>
								<Icon name="calendar" class="h-4 w-4" />
								<span class="ssm:hidden">TA</span>
								<span class="hidden ssm:inline">Tahun Ajaran</span>
							</a>
							<a
								href={`/sekolah/form?sekolahId=${sekolah.id}`}
								class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 {!canSekolahManage
									? 'pointer-events-none opacity-50'
									: ''}"
								aria-label="Edit data sekolah"
								aria-disabled={!canSekolahManage}
								title={!canSekolahManage
									? 'Anda tidak memiliki izin untuk mengedit data sekolah'
									: ''}
							>
								<Icon name="edit" class="h-4 w-4" />
								Edit Sekolah
							</a>
						</div>
					</div>
				</div>
			</section>
		{/each}
	{:else}
		<div
			class="flex items-center gap-2 rounded-2xl border border-blue-200/80 bg-blue-50/75 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0" />
			<span>Belum ada data sekolah. Tambahkan sekolah untuk memulai.</span>
		</div>
	{/if}
</div>

<SekolahModals />
