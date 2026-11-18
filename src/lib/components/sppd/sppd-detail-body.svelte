<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	interface SppdPegawaiRow {
		id: number;
		authUserId: number | null;
		nama: string;
	}

	interface SppdPengikutRow {
		id: number;
		nama: string;
		tempatLahir: string;
		tanggalLahir: string;
	}

	interface SppdDetailData {
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
		pegawai: SppdPegawaiRow[];
		pengikut: SppdPengikutRow[];
	}

	let { sppd }: { sppd: SppdDetailData } = $props();

	function formatTanggal(value: string | null | undefined): string {
		if (!value) return '-';
		const d = new Date(`${value}T00:00:00`);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function initials(nama: string): string {
		return nama
			.replace(/[^a-zA-Z ]/g, '')
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.join('');
	}

	interface InfoRow {
		label: string;
		value: string;
	}

	const perjalananRows = $derived<InfoRow[]>([
		{ label: 'Tempat Berangkat', value: sppd.tempatBerangkat ?? '-' },
		{ label: 'Tempat Tujuan', value: sppd.tempatTujuan ?? '-' },
		{ label: 'Tanggal Berangkat', value: formatTanggal(sppd.tanggalBerangkat) },
		{ label: 'Tanggal Kembali', value: formatTanggal(sppd.tanggalKembali) }
	]);

	const suratRows = $derived<InfoRow[]>([
		{ label: 'Nomor Surat Tugas', value: sppd.nomorSuratTugas ?? '-' },
		{ label: 'Tanggal Surat Tugas', value: formatTanggal(sppd.tanggalSuratTugas) },
		{ label: 'Dasar Surat Tugas', value: sppd.dasarSuratTugas ?? '-' }
	]);
</script>

<div class="not-prose space-y-4">
	<div
		class="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-800/50"
	>
		<p
			class="text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			Maksud Perjalanan Dinas
		</p>
		<p class="mt-1 text-sm font-bold leading-snug text-slate-900 dark:text-zinc-100">
			{sppd.maksud}
		</p>
		<div class="mt-3 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
			>
				<Icon name="users" class="h-3.5 w-3.5" />
				{sppd.jumlah} Pegawai
			</span>
			{#if sppd.alatAngkut}
				<span
					class="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
				>
					<Icon name="briefcase" class="h-3.5 w-3.5" />
					{sppd.alatAngkut}
				</span>
			{/if}
			{#if sppd.lamanya}
				<span
					class="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
				>
					<Icon name="calendar" class="h-3.5 w-3.5" />
					{sppd.lamanya}
				</span>
			{/if}
		</div>
	</div>

	<section>
		<h4
			class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			<Icon name="briefcase" class="h-3.5 w-3.5" />
			Perjalanan
		</h4>
		<dl class="mt-1.5 divide-y divide-slate-100 text-xs dark:divide-zinc-800">
			{#each perjalananRows as row (row.label)}
				<div class="flex items-start justify-between gap-4 py-2">
					<dt class="text-slate-500 dark:text-zinc-400">{row.label}</dt>
					<dd class="text-right font-semibold text-slate-900 dark:text-zinc-100">{row.value}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section>
		<h4
			class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			<Icon name="book" class="h-3.5 w-3.5" />
			Surat Tugas
		</h4>
		<dl class="mt-1.5 divide-y divide-slate-100 text-xs dark:divide-zinc-800">
			{#each suratRows as row (row.label)}
				<div class="flex items-start justify-between gap-4 py-2">
					<dt class="text-slate-500 dark:text-zinc-400">{row.label}</dt>
					<dd class="text-right font-semibold text-slate-900 dark:text-zinc-100">{row.value}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section>
		<h4
			class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			<Icon name="users" class="h-3.5 w-3.5" />
			Pegawai Pelaksana ({sppd.jumlah})
		</h4>
		<ul class="mt-2 space-y-2">
			{#each sppd.pegawai as p (p.id)}
				<li
					class="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/50"
				>
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
					>
						{initials(p.nama)}
					</span>
					<span class="text-xs font-semibold text-slate-900 dark:text-zinc-100">{p.nama}</span>
				</li>
			{/each}
		</ul>
	</section>

	{#if sppd.pengikut.length > 0}
		<section>
			<h4
				class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
			>
				<Icon name="user" class="h-3.5 w-3.5" />
				Pengikut ({sppd.pengikut.length})
			</h4>
			<ul class="mt-2 space-y-2">
				{#each sppd.pengikut as p (p.id)}
					<li
						class="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
					>
						<div class="flex min-w-0 items-center gap-3">
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
							>
								{initials(p.nama)}
							</span>
							<span class="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100"
								>{p.nama}</span
							>
						</div>
						<span class="shrink-0 text-[11px] text-slate-500 dark:text-zinc-400">
							{p.tempatLahir}, {formatTanggal(p.tanggalLahir)}
						</span>
					</li>
				{/each}
			</ul>
			{#if sppd.keteranganPengikut}
				<p class="mt-2 text-xs text-slate-600 dark:text-zinc-300">
					<span class="font-semibold">Keterangan:</span>
					{sppd.keteranganPengikut}
				</p>
			{/if}
		</section>
	{/if}

	{#if sppd.kodeRekening || sppd.tingkatBiaya || sppd.keteranganLain}
		<section>
			<h4
				class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
			>
				<Icon name="info" class="h-3.5 w-3.5" />
				Lain-lain
			</h4>
			<dl class="mt-1.5 divide-y divide-slate-100 text-xs dark:divide-zinc-800">
				{#if sppd.kodeRekening}
					<div class="flex items-start justify-between gap-4 py-2">
						<dt class="text-slate-500 dark:text-zinc-400">Kode Rekening</dt>
						<dd class="text-right font-semibold text-slate-900 dark:text-zinc-100">
							{sppd.kodeRekening}
						</dd>
					</div>
				{/if}
				{#if sppd.tingkatBiaya}
					<div class="flex items-start justify-between gap-4 py-2">
						<dt class="text-slate-500 dark:text-zinc-400">Tingkat Biaya Perjalanan Dinas</dt>
						<dd class="text-right font-semibold text-slate-900 dark:text-zinc-100">
							{sppd.tingkatBiaya}
						</dd>
					</div>
				{/if}
				{#if sppd.keteranganLain}
					<div class="flex items-start justify-between gap-4 py-2">
						<dt class="text-slate-500 dark:text-zinc-400">Keterangan Lain-lain</dt>
						<dd class="text-right font-semibold text-slate-900 dark:text-zinc-100">
							{sppd.keteranganLain}
						</dd>
					</div>
				{/if}
			</dl>
		</section>
	{/if}
</div>
