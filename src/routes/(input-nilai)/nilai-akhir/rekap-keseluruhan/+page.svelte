<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';

	let { data } = $props();

	let searchTerm = $state('');

	const rekap = $derived(data.rekap);
	const daftarKelas = $derived(data.daftarKelas ?? []);
	const semester = $derived(rekap?.semester ?? []);
	const baris = $derived(rekap?.baris ?? []);
	const ringkasan = $derived(rekap?.ringkasan ?? []);
	const konfigurasi = $derived(rekap?.konfigurasi ?? null);

	const barisTampil = $derived.by(() => {
		const keyword = searchTerm.trim().toLowerCase();
		if (!keyword) return baris;
		return baris.filter(
			(row) =>
				row.nama.toLowerCase().includes(keyword) ||
				row.nis.toLowerCase().includes(keyword) ||
				row.nisn.toLowerCase().includes(keyword)
		);
	});

	const kelasLabel = $derived(
		rekap?.kelas?.fase ? `${rekap.kelas.nama} - ${rekap.kelas.fase}` : (rekap?.kelas?.nama ?? '-')
	);

	const semesterAwal = $derived(semester[0]?.label ?? '-');
	const semesterAkhir = $derived(semester[semester.length - 1]?.label ?? '-');
	const rataKelasTerakhir = $derived(
		ringkasan.length ? (ringkasan[ringkasan.length - 1]?.nilai ?? null) : null
	);

	async function gantiKelas(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if (!value) return;
		await goto(`/nilai-akhir/rekap-keseluruhan?kelas_id=${value}`, { keepFocus: true });
	}

	function formatScore(value: number | null | undefined) {
		if (value == null) return '—';
		return value.toLocaleString('id-ID', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	function badgeClass(kriteria: string | null) {
		switch (kriteria) {
			case 'Sangat Baik':
				return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
			case 'Baik':
				return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
			case 'Cukup':
				return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
			case 'Perlu Bimbingan':
				return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
			default:
				return 'bg-base-200 text-base-content/60 dark:bg-base-300';
		}
	}

	function selKelas(semesterId: number) {
		const kelas = barisTampil
			.map((row) => row.perSemester.find((sel) => sel.semesterId === semesterId)?.kelasNama)
			.filter((value): value is string => Boolean(value));
		if (!kelas.length) return '-';
		const unik = [...new Set(kelas)];
		return unik.length === 1 ? unik[0] : `${unik.length} kelas`;
	}
</script>

<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<h2 class="text-xl font-bold">Rekap Nilai Keseluruhan</h2>
		<p class="text-base-content/80 block text-sm">
			{kelasLabel} · {semesterAwal} sampai {semesterAkhir}
		</p>
	</div>
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		<a
			class="btn btn-outline shadow-none max-sm:w-full"
			href="/nilai-akhir/rekap-keseluruhan/export"
		>
			<Icon name="download" />
			Unduh Excel
		</a>
		<a class="btn btn-primary shadow-none max-sm:w-full" href="/nilai-akhir">
			<Icon name="left" />
			Rekap Nilai Akhir
		</a>
	</div>
</div>

{#if daftarKelas.length > 1}
	<label class="form-control w-full max-w-md">
		<span class="label-text mb-1 text-sm">Kelas yang direkap</span>
		<select
			class="select select-bordered w-full"
			value={rekap?.kelas?.id ?? ''}
			onchange={gantiKelas}
		>
			{#each daftarKelas as kelas (kelas.id)}
				<option value={kelas.id}>
					{kelas.nama} — {kelas.semesterLabel}
				</option>
			{/each}
		</select>
	</label>
{/if}

<div class="stats dark:bg-base-200 shadow-md mt-4">
	<div class="stat">
		<div class="stat-title">Murid Kelas</div>
		<div class="stat-value text-lg">{rekap?.totalMurid ?? 0}</div>
		<div class="stat-desc">{rekap?.totalDinilai ?? 0} sudah punya nilai</div>
	</div>
	<div class="stat">
		<div class="stat-title">Semester Dilalui</div>
		<div class="stat-value text-lg">{semester.length}</div>
		<div class="stat-desc text-wrap">Dari kelas pertama sampai kelas terakhir</div>
	</div>
	<div class="stat">
		<div class="stat-title">Rata-rata Kelas</div>
		<div class="stat-value text-lg">{formatScore(rataKelasTerakhir)}</div>
		<div class="stat-desc text-wrap">Semester terakhir</div>
	</div>
	{#if konfigurasi}
		<div class="stat">
			<div class="stat-title">Bobot Nilai</div>
			<div class="stat-value text-lg">
				{konfigurasi.bobotLingkup}/{konfigurasi.bobotSts}/{konfigurasi.bobotSas}
			</div>
			<div class="stat-desc text-wrap">Lingkup/STS/SAS dari pengaturan sekolah</div>
		</div>
		<div class="stat">
			<div class="stat-title">Ambang Kriteria</div>
			<div class="stat-value text-lg">{konfigurasi.kriteriaCukup} · {konfigurasi.kriteriaBaik}</div>
			<div class="stat-desc text-wrap">Batas Cukup dan Baik</div>
		</div>
	{/if}
</div>

<form class="mt-4 flex flex-col gap-2 sm:flex-row" onsubmit={(event) => event.preventDefault()}>
	<label class="input bg-base-200 dark:bg-base-300 w-full dark:border-none">
		<Icon name="search" />
		<input
			type="search"
			name="q"
			bind:value={searchTerm}
			spellcheck="false"
			placeholder="Cari nama / NIS murid..."
			autocomplete="off"
		/>
	</label>
</form>

{#if !semester.length}
	<div class="alert alert-warning alert-soft mt-4 flex items-center gap-3">
		<Icon name="warning" />
		<span>
			Belum ada data nilai untuk kelas ini. Kolom semester terisi otomatis begitu ada murid di kelas
			tersebut pada semester berjalan dan nilai akhir mapel sudah diinput.
		</span>
	</div>
{:else}
	<div
		class="bg-base-100 dark:bg-base-200 mt-4 overflow-x-auto rounded-md shadow-md dark:shadow-none"
	>
		<table class="border-base-200 table border dark:border-none">
			<thead>
				<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
					<th class="w-12 text-center" style="min-width: 48px;">No</th>
					<th style="min-width: 190px;">Nama Murid</th>
					{#each semester as sem (sem.semesterId)}
						<th class="text-center" style="min-width: 130px;">
							{sem.label}
							<span class="block text-xs font-normal opacity-70">{selKelas(sem.semesterId)}</span>
						</th>
					{/each}
					<th class="text-center" style="min-width: 130px;">Rata-rata Kumulatif</th>
					<th class="text-center" style="min-width: 90px;">Peringkat</th>
				</tr>
			</thead>
			<tbody>
				{#each barisTampil as row, index (row.key)}
					<tr>
						<td class="text-center">{index + 1}</td>
						<td>
							<div class="font-medium">{row.nama}</div>
							<div class="text-xs opacity-60">NIS {row.nis || '-'} · NISN {row.nisn || '-'}</div>
						</td>
						{#each row.perSemester as sel (sel.semesterId)}
							<td class="text-center">
								<span
									class={`badge badge-sm ${badgeClass(sel.kriteria)}`}
									title={sel.kelasNama ? `Kelas: ${sel.kelasNama}` : 'Tidak ada data kelas'}
								>
									{formatScore(sel.nilai)}
								</span>
								<span class="block text-xs opacity-60">{sel.dinilai}/{sel.total} mapel</span>
							</td>
						{/each}
						<td class="text-center">
							<span class={`badge badge-sm ${badgeClass(row.kriteriaKumulatif)}`}>
								{formatScore(row.rataKumulatif)}
							</span>
							{#if row.kriteriaKumulatif}
								<span class="block text-xs opacity-60">{row.kriteriaKumulatif}</span>
							{/if}
						</td>
						<td class="text-center font-semibold">{row.peringkat}</td>
					</tr>
				{:else}
					<tr>
						<td colspan={semester.length + 4} class="py-6 text-center opacity-70">
							Tidak ada murid yang cocok dengan pencarian.
						</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr class="bg-base-200 dark:bg-base-300 font-semibold">
					<td></td>
					<td>Rata-rata Kelas</td>
					{#each ringkasan as item (item.semesterId)}
						<td class="text-center">
							{formatScore(item.nilai)}
							<span class="block text-xs font-normal opacity-70">{item.dinilai} nilai</span>
						</td>
					{/each}
					<td colspan="2"></td>
				</tr>
			</tfoot>
		</table>
	</div>

	<p class="text-base-content/60 mt-2 text-xs">
		Nilai akhir tiap mapel dihitung dari komponen lingkup, STS, dan SAS memakai bobot dari
		pengaturan sekolah. Kriteria (Perlu Bimbingan/Cukup/Baik/Sangat Baik) mengikuti ambang di
		pengaturan rapor. Jumlah mapel memakai katalog mapel jenjang (gabungan mapel semua kelas pada
		tingkat yang sama), bukan hanya mapel kelas yang dipilih. Kelas yang diikuti murid dapat berbeda
		antar semester.
	</p>
{/if}
