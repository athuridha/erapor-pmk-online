<script lang="ts">
	import SppdDetailBody from '$lib/components/sppd/sppd-detail-body.svelte';
	import Icon from '$lib/components/icon.svelte';

	interface BuktiItem {
		id: number;
		jenis: 'pdf' | 'foto';
		namaFile: string;
	}

	interface SppdDetailData {
		id: number;
		maksud: string;
		nomorSuratTugas: string | null;
		tanggalSuratTugas: string | null;
		dasarSuratTugas: string | null;
		alatAngkut: string | null;
		tempatBerangkat: string | null;
		tempatTujuan: string | null;
		lamanya: string | null;
		tanggalBerangkat: string;
		tanggalKembali: string;
		keteranganPengikut: string | null;
		kodeRekening: string | null;
		tingkatBiaya: string | null;
		keteranganLain: string | null;
		jumlah: number;
		undanganFile: string | null;
		pegawai: { id: number; authUserId: number | null; nama: string }[];
		pengikut: { id: number; nama: string; tempatLahir: string; tanggalLahir: string }[];
		bukti: BuktiItem[];
	}

	let { sppd }: { sppd: SppdDetailData } = $props();

	const undanganUrl = $derived(
		sppd.undanganFile?.startsWith('undangan/')
			? `/api/dinas-luar/undangan/${sppd.undanganFile.slice('undangan/'.length)}`
			: null
	);
	const undanganName = $derived(sppd.undanganFile?.split('/').pop() ?? null);

	const pdfBukti = $derived(sppd.bukti.filter((b) => b.jenis === 'pdf'));
	const fotoBukti = $derived(sppd.bukti.filter((b) => b.jenis === 'foto'));

	function buktiUrl(item: BuktiItem): string {
		return `/api/dinas-luar/bukti/${item.namaFile}`;
	}
</script>

<SppdDetailBody {sppd} />

{#if undanganUrl && undanganName}
	<section class="not-prose mt-4">
		<a
			class="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
			href={undanganUrl}
			target="_blank"
			rel="noopener"
			title="Lihat file undangan kegiatan perjalanan dinas"
		>
			<span class="flex min-w-0 items-center gap-3">
				<span
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
				>
					<Icon name="download" class="h-4 w-4" />
				</span>
				<span class="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100"
					>Undangan Kegiatan</span
				>
			</span>
			<span
				class="inline-flex shrink-0 items-center rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
				>Lihat Undangan</span
			>
		</a>
	</section>
{/if}

<section class="not-prose mt-5 border-t border-slate-100 pt-4 dark:border-zinc-800">
	<h4
		class="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
	>
		<Icon name="download" class="h-3.5 w-3.5" />
		Bukti Perjalanan Dinas
	</h4>

	{#if pdfBukti.length > 0 || fotoBukti.length > 0}
		<div class="space-y-2">
			{#each pdfBukti as item (item.id)}
				<a
					class="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 transition-colors hover:bg-slate-100/70 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
					href={buktiUrl(item)}
					target="_blank"
					rel="noopener"
					title="Lihat file PDF bukti"
				>
					<span class="flex min-w-0 items-center gap-3">
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
						>
							<Icon name="book" class="h-4 w-4" />
						</span>
						<span class="truncate text-xs font-medium text-slate-900 dark:text-zinc-100">
							{item.namaFile.split('/').pop()}
						</span>
					</span>
					<span
						class="inline-flex shrink-0 items-center rounded-full border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
						>PDF</span
					>
				</a>
			{/each}
		</div>

		{#if fotoBukti.length > 0}
			<div class="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
				{#each fotoBukti as item (item.id)}
					<a
						class="group relative block overflow-hidden rounded-xl border border-slate-200/80 dark:border-zinc-700"
						href={buktiUrl(item)}
						target="_blank"
						rel="noopener"
						title="Lihat foto bukti"
					>
						<img src={buktiUrl(item)} alt="Bukti foto" class="h-24 w-full object-cover" />
					</a>
				{/each}
			</div>
		{/if}
	{:else}
		<p class="text-xs text-slate-500 dark:text-zinc-400">Belum ada bukti perjalanan dinas.</p>
	{/if}
</section>
