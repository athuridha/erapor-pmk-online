<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { page } from '$app/state';

	let { data } = $props();
	const status = $derived(data.status ?? 'empty');
	const murid = $derived(data.murid ?? null);
	const daftarNilai = $derived(status === 'ready' ? (data.daftarNilai ?? []) : []);
	const ringkasan = $derived(
		status === 'ready'
			? (data.ringkasan ?? { rataRata: null, mapelDinilai: 0, totalMapel: 0 })
			: { rataRata: null, mapelDinilai: 0, totalMapel: 0 }
	);
	const hasNilai = $derived(status === 'ready' && ringkasan.totalMapel > 0);
	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return null;
		return kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
	});
	let exporting = $state(false);

	function formatScore(value: number | null) {
		if (value == null) return '&mdash;';
		return value.toLocaleString('id-ID', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	const rataRataDisplay = $derived.by(() => formatScore(ringkasan.rataRata));
	const coverageDisplay = $derived.by(() => {
		if (!ringkasan.totalMapel) return '0/0 Mata Pelajaran';
		return `${ringkasan.mapelDinilai}/${ringkasan.totalMapel} Mata Pelajaran`;
	});

	async function handleExport() {
		if (!murid || !hasNilai || exporting) return;
		try {
			exporting = true;
			const ExcelJS = (await import('exceljs')).default ?? (await import('exceljs'));
			const headerRows: (string | number)[][] = [
				['Rekap Nilai Akhir Murid'],
				['Nama Murid', murid.nama],
				['Kelas', kelasAktifLabel ?? '-'],
				['Rata-rata', ringkasan.rataRata ?? ''],
				['Mapel Dinilai', `${ringkasan.mapelDinilai} dari ${ringkasan.totalMapel}`],
				[]
			];
			const tableHeader = ['No', 'Mata Pelajaran', 'Nilai Akhir', 'Status'];
			const tableRows = daftarNilai.map(
				(nilai: {
					no: number;
					mataPelajaran: string;
					sudahDinilai: boolean;
					nilaiAkhir: number | null;
				}) => [
					nilai.no,
					nilai.mataPelajaran,
					nilai.sudahDinilai && typeof nilai.nilaiAkhir === 'number'
						? Number.parseFloat(nilai.nilaiAkhir.toFixed(2))
						: null,
					nilai.sudahDinilai ? 'Sudah Dinilai' : 'Belum Dinilai'
				]
			);
			const workbook = new ExcelJS.Workbook();
			const worksheet = workbook.addWorksheet('Nilai Akhir');
			worksheet.addRows([...headerRows, tableHeader, ...tableRows]);
			// set approximate column widths
			try {
				const colDefs: Array<{ wch?: number }> = [
					{ wch: 6 },
					{ wch: 40 },
					{ wch: 14 },
					{ wch: 18 }
				];
				for (let i = 0; i < colDefs.length; i += 1) {
					const def = colDefs[i];
					if (def && def.wch) worksheet.getColumn(i + 1).width = def.wch;
				}
				worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRows.length + 1 }];
			} catch {
				// ignore view/width errors in some runtimes
			}
			const safeName = murid.nama.replace(/[<>:"/\\|?*]+/g, ' ').trim() || 'murid';
			const kelasName = kelasAktifLabel ? ` - ${kelasAktifLabel}` : '';
			const timestamp = new Date().toISOString().slice(0, 10);
			const fileName = `Nilai Akhir - ${safeName}${kelasName} - ${timestamp}.xlsx`;
			try {
				const buf = await workbook.xlsx.writeBuffer();
				const srcView = ArrayBuffer.isView(buf)
					? new Uint8Array(
							(buf as ArrayBufferView).buffer,
							(buf as ArrayBufferView).byteOffset,
							(buf as ArrayBufferView).byteLength
						)
					: new Uint8Array(buf as ArrayBufferLike);
				const uint8 = Uint8Array.from(srcView);
				const blob = new Blob([uint8], {
					type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
				});
				const link = document.createElement('a');
				link.href = URL.createObjectURL(blob);
				link.download = fileName;
				document.body.appendChild(link);
				link.click();
				link.remove();
				URL.revokeObjectURL(link.href);
			} catch (e) {
				console.error('Gagal menulis file Excel di client', e);
			}
		} catch (error) {
			console.error('Gagal mengekspor nilai akhir', error);
		} finally {
			exporting = false;
		}
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="mb-4 flex flex-col gap-2 sm:flex-row">
		<a
			href="/nilai-akhir/"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
		>
			<Icon name="left" class="h-4 w-4" />
			Kembali
		</a>
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			disabled={!hasNilai || exporting}
			aria-disabled={!hasNilai || exporting}
			title={exporting
				? 'Sedang menyiapkan file Excel'
				: hasNilai
					? 'Unduh nilai murid'
					: 'Belum ada nilai untuk diexport'}
			onclick={handleExport}
		>
			{#if exporting}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<Icon name="export" class="h-4 w-4" />
			{/if}
			Export
		</button>
	</div>

	{#if status === 'ready' && murid}
		<div
			class="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
		>
			<div>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Rekap Nilai Akhir Murid
				</h1>
				<p class="mt-0.5 text-sm font-medium text-slate-700 dark:text-zinc-300">{murid.nama}</p>
				{#if kelasAktifLabel}
					<p class="text-xs text-slate-500 dark:text-zinc-400">Kelas {kelasAktifLabel}</p>
				{/if}
			</div>
			<div class="flex flex-wrap gap-3">
				<div
					class="rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/50"
				>
					<p
						class="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-zinc-400"
					>
						Rata-rata
					</p>
					<p class="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
						{@html rataRataDisplay}
					</p>
				</div>
				<div
					class="rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/50"
				>
					<p
						class="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-zinc-400"
					>
						Mapel Dinilai
					</p>
					<p class="mt-0.5 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
						{coverageDisplay}
					</p>
				</div>
			</div>
		</div>

		<div
			role="alert"
			class="mt-4 flex items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50/80 p-3.5 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200"
		>
			<Icon name="info" class="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
			<div>
				<p class="text-xs">
					Nilai rata-rata ananda <b>{murid.nama}</b>
				</p>
				<p class="mt-0.5 text-xl font-bold tabular-nums">{@html rataRataDisplay}</p>
				<p class="mt-0.5 text-[11px] text-blue-800/80 dark:text-blue-300/80">
					Menggunakan nilai akhir seluruh mata pelajaran yang tersedia.
				</p>
			</div>
		</div>

		<div
			class="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th style="width: 50px; min-width: 40px;" class="px-3 py-2.5">No</th>
						<th class="w-full px-3 py-2.5" style="min-width: 150px;">Mata Pelajaran</th>
						<th style="min-width: 120px;" class="px-3 py-2.5">Nilai Akhir</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
					{#if hasNilai}
						{#each daftarNilai as nilai (nilai.mataPelajaranId)}
							<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
								<td class="px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-400"
									>{nilai.no}</td
								>
								<td class="px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
									{nilai.mataPelajaran}
								</td>
								<td
									class="px-3 py-2.5 font-semibold tabular-nums {nilai.sudahDinilai
										? 'text-slate-900 dark:text-zinc-100'
										: 'italic text-slate-500 dark:text-zinc-400'}"
								>
									{@html formatScore(nilai.nilaiAkhir)}
								</td>
							</tr>
						{/each}
					{:else}
						<tr>
							<td
								colspan="3"
								class="p-8 text-center text-xs italic text-slate-500 dark:text-zinc-400"
							>
								Belum ada nilai akhir yang terinput untuk murid ini.
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	{:else}
		<div
			class="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>
				{#if status === 'not-found'}
					<p class="font-semibold">Murid tidak ditemukan.</p>
					<p class="mt-0.5 text-amber-900/80 dark:text-amber-200/80">
						Pastikan Anda memilih murid dari daftar rekap yang sama.
					</p>
				{:else}
					<p class="font-semibold">Pilih murid terlebih dahulu.</p>
					<p class="mt-0.5 text-amber-900/80 dark:text-amber-200/80">
						Gunakan tombol "Lihat" pada halaman Rekap Nilai Akhir untuk membuka rincian.
					</p>
				{/if}
			</span>
		</div>
	{/if}
</div>
