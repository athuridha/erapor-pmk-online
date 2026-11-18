<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	let {
		nama,
		tanggal,
		status,
		statusLabel,
		statusClass,
		waktu,
		keterangan,
		tandaTangan
	}: {
		nama: string;
		tanggal: string;
		status: string | null;
		statusLabel: string | null;
		statusClass: string;
		waktu: string | null;
		keterangan: string | null;
		tandaTangan: string | null;
	} = $props();

	const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
	const bulanList = [
		'Januari',
		'Februari',
		'Maret',
		'April',
		'Mei',
		'Juni',
		'Juli',
		'Agustus',
		'September',
		'Oktober',
		'November',
		'Desember'
	];

	const STATUS_ICON: Record<string, IconName> = {
		hadir: 'check',
		izin: 'info',
		sakit: 'alert',
		dinas_luar: 'briefcase',
		cuti: 'coffee'
	};

	function formatTanggal(dateStr: string): string {
		const d = new Date(`${dateStr}T00:00:00`);
		if (Number.isNaN(d.getTime())) return dateStr;
		return `${hariList[d.getDay()]}, ${d.getDate()} ${bulanList[d.getMonth()]} ${d.getFullYear()}`;
	}

	function formatJam(value: string): string {
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	}

	const statusIcon = $derived(status ? (STATUS_ICON[status] ?? 'info') : 'info');
</script>

<div class="not-prose space-y-4">
	<div
		class="rounded-xl border border-slate-200/80 bg-slate-50/65 p-4 dark:border-zinc-800 dark:bg-zinc-800/45"
	>
		<p
			class="text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			Guru
		</p>
		<p class="mt-1 text-sm font-semibold text-slate-900 dark:text-zinc-100">{nama}</p>
		<div class="mt-2.5 flex flex-wrap gap-2">
			{#if statusLabel}
				<span
					class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium {statusClass}"
				>
					<Icon name={statusIcon} class="h-3.5 w-3.5" />
					{statusLabel}
				</span>
			{:else}
				<span
					class="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
				>
					<Icon name="info" class="h-3.5 w-3.5" />
					Belum presensi
				</span>
			{/if}
		</div>
	</div>

	<section>
		<h4
			class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			<Icon name="calendar" class="h-3.5 w-3.5" />
			Waktu Presensi
		</h4>
		<dl class="mt-1.5 divide-y divide-slate-200/70 text-xs dark:divide-zinc-800">
			<div class="flex items-start justify-between gap-4 py-2">
				<dt class="text-slate-500 dark:text-zinc-400">Tanggal</dt>
				<dd class="text-right font-medium text-slate-800 dark:text-zinc-200">
					{formatTanggal(tanggal)}
				</dd>
			</div>
			{#if waktu}
				<div class="flex items-start justify-between gap-4 py-2">
					<dt class="text-slate-500 dark:text-zinc-400">Jam</dt>
					<dd class="text-right font-medium text-slate-800 dark:text-zinc-200">
						{formatJam(waktu)}
					</dd>
				</div>
			{/if}
			{#if keterangan}
				<div class="flex items-start justify-between gap-4 py-2">
					<dt class="text-slate-500 dark:text-zinc-400">Keterangan</dt>
					<dd class="text-right font-medium text-slate-800 dark:text-zinc-200">{keterangan}</dd>
				</div>
			{/if}
		</dl>
	</section>

	{#if tandaTangan}
		<section>
			<h4
				class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
			>
				<Icon name="pen" class="h-3.5 w-3.5" />
				Paraf
			</h4>
			<div
				class="mt-2 inline-block rounded-xl border border-slate-200/80 bg-white p-2 dark:border-zinc-700"
			>
				<img src={tandaTangan} alt="Paraf" class="max-h-32" />
			</div>
		</section>
	{/if}
</div>
