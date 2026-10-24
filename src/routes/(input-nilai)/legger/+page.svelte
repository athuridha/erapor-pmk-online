<script lang="ts">
	import type { PageProps } from './$types';
	import Icon from '$lib/components/icon.svelte';

	let { data }: PageProps = $props();

	const kelasLegger = $derived(data.kelas);
	const kolom = $derived(data.kolom);
	const baris = $derived(data.baris);
	const rekap = $derived(data.rekap);
	const kelengkapanKelas = $derived(data.kelengkapanKelas);

	const exportHref = $derived(
		data.kelasId ? `/api/legger/export?kelas_id=${data.kelasId}` : '/api/legger/export'
	);

	function formatNilai(value: number | null) {
		if (value == null) return '–';
		if (Number.isInteger(value)) return value.toLocaleString('id-ID');
		return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function warnaNilai(value: number | null) {
		if (value == null) return 'text-base-content/30';
		if (value >= 90) return 'text-emerald-600 dark:text-emerald-400';
		if (value >= 80) return 'text-sky-700 dark:text-sky-400';
		if (value >= 70) return 'text-amber-600 dark:text-amber-400';
		return 'text-rose-600 dark:text-rose-400';
	}

	function chipKelasClass(persentase: number | null, aktif: boolean) {
		if (aktif) return 'badge-primary';
		if (persentase == null) return 'bg-base-200 text-base-content/70 dark:bg-base-300';
		if (persentase >= 90)
			return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
		if (persentase >= 80) return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
		if (persentase >= 70)
			return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
		return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
	}
</script>

<div class="mb-4 flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
	<div>
		<h2 class="text-xl font-bold">Legger</h2>
		<p class="text-base-content/80 block text-sm">
			Grid nilai akhir murid per mata pelajaran untuk kelas ini.
		</p>
	</div>
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		{#if kelasLegger}
			<span
				class="badge badge-soft badge-lg gap-1"
				title="Kelengkapan {rekap.terisi} dari {rekap.total} sel nilai"
			>
				<Icon name="percent" />
				{rekap.persentase ?? 0}%
			</span>
		{/if}
		<a class="btn btn-outline shadow-none max-sm:w-full" href={exportHref}>
			<Icon name="download" />
			Unduh Excel
		</a>
		<button
			type="button"
			class="btn btn-soft shadow-none max-sm:w-full"
			onclick={() => window.print()}
		>
			<Icon name="print" />
			Cetak
		</button>
	</div>
</div>

<div class="mb-4 flex flex-col gap-3 print:hidden xl:flex-row xl:items-start xl:justify-between">
	<form method="GET" class="w-full max-w-xs">
		<label class="form-control">
			<span class="label-text mb-1 text-sm">Pilih Kelas</span>
			<select
				name="kelas"
				class="select select-bordered"
				value={data.kelasId ?? ''}
				onchange={(event) => event.currentTarget.form?.requestSubmit()}
			>
				{#each data.daftarKelas as kelas (kelas.id)}
					<option value={kelas.id}>{kelas.nama} — {kelas.semesterLabel}</option>
				{/each}
			</select>
		</label>
		<noscript>
			<button type="submit" class="btn btn-xs mt-1">Tampilkan</button>
		</noscript>
	</form>

	{#if kelengkapanKelas.length}
		<div class="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
			{#each kelengkapanKelas as chip (chip.kelasId)}
				<a
					href="?kelas={chip.kelasId}"
					class={`badge gap-1 ${chipKelasClass(chip.persentase, data.kelasId === chip.kelasId)}`}
					title="Kelengkapan nilai kelas {chip.nama}"
				>
					{chip.nama} — {chip.persentase ?? '–'}%
				</a>
			{/each}
		</div>
	{/if}
</div>

{#if !kolom.length || !baris.length}
	<div class="alert alert-warning alert-soft mt-3 flex items-center gap-3">
		<Icon name="info" />
		<span>Belum ada murid atau mata pelajaran pada kelas ini.</span>
	</div>
{:else}
	<div
		class="bg-base-100 dark:bg-base-200 mt-3 max-h-[70vh] overflow-auto rounded-md shadow-md dark:shadow-none print:max-h-none print:overflow-visible"
	>
		<table class="border-base-200 table border text-sm dark:border-none">
			<thead>
				<tr class="bg-base-200 dark:bg-base-300 text-left font-bold">
					<th class="sticky left-0 top-0 z-30 w-11 bg-base-200 text-center dark:bg-base-300">
						No
					</th>
					<th class="sticky left-11 top-0 z-30 min-w-48 bg-base-200 dark:bg-base-300">
						Nama Murid
					</th>
					{#each kolom as col (col.key)}
						<th
							class="sticky top-0 z-20 min-w-14 bg-base-200 text-center dark:bg-base-300"
							title={col.nama}
						>
							{col.singkatan}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each baris as row, index (row.muridId)}
					<tr>
						<td class="sticky left-0 z-10 w-11 bg-base-100 text-center dark:bg-base-200">
							{index + 1}
						</td>
						<td class="sticky left-11 z-10 bg-base-100 dark:bg-base-200">
							<div class="font-medium">{row.nama}</div>
							<div class="text-xs opacity-60">NISN {row.nisn || '-'}</div>
						</td>
						{#each row.sel as value, cellIndex (cellIndex)}
							<td class={`text-center font-medium ${warnaNilai(value)}`}>
								{formatNilai(value)}
							</td>
						{/each}
					</tr>
				{:else}
					<tr>
						<td colspan={kolom.length + 2} class="py-6 text-center opacity-70">
							Tidak ada murid.
						</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr class="bg-base-200 dark:bg-base-300 font-semibold">
					<td class="sticky left-0 bg-base-200 dark:bg-base-300"></td>
					<td class="sticky left-11 bg-base-200 dark:bg-base-300">
						Terisi {rekap.terisi} / {rekap.total} sel
					</td>
					{#each kolom as col (col.key)}
						<td class="text-center"></td>
					{/each}
				</tr>
			</tfoot>
		</table>
	</div>

	<div class="mt-3 flex flex-wrap items-center gap-3 text-xs print:hidden">
		<span class="flex items-center gap-1">
			<Icon name="info" />
			Warna nilai:
		</span>
		<span class={`font-semibold ${warnaNilai(95)}`}>≥ 90</span>
		<span class={`font-semibold ${warnaNilai(85)}`}>80 – 89</span>
		<span class={`font-semibold ${warnaNilai(75)}`}>70 – 79</span>
		<span class={`font-semibold ${warnaNilai(60)}`}>&lt; 70</span>
	</div>
{/if}
