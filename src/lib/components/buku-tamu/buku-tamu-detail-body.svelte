<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	let {
		nama,
		asalInstansi,
		nip,
		keperluan,
		pesanKesan,
		tandaTangan,
		createdAt
	}: {
		nama: string;
		asalInstansi: string;
		nip: string | null;
		keperluan: string;
		pesanKesan: string | null;
		tandaTangan: string | null;
		createdAt: string;
	} = $props();

	function formatWaktu(value: string): string {
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="not-prose space-y-4">
	<div
		class="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-800/50"
	>
		<p
			class="text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			Tamu
		</p>
		<p class="mt-1 text-sm font-bold leading-snug text-slate-900 dark:text-zinc-100">{nama}</p>
		<div class="mt-3 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
			>
				<Icon name="school" class="h-3.5 w-3.5" />
				{asalInstansi}
			</span>
			<span
				class="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
			>
				<Icon name="calendar" class="h-3.5 w-3.5" />
				{formatWaktu(createdAt)}
			</span>
		</div>
	</div>

	<section>
		<h4
			class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			<Icon name="user" class="h-3.5 w-3.5" />
			Kunjungan
		</h4>
		<dl class="mt-1.5 divide-y divide-slate-100 text-xs dark:divide-zinc-800">
			<div class="flex items-start justify-between gap-4 py-2">
				<dt class="text-slate-500 dark:text-zinc-400">Asal/Instansi</dt>
				<dd class="text-right font-semibold text-slate-900 dark:text-zinc-100">{asalInstansi}</dd>
			</div>
			{#if nip}
				<div class="flex items-start justify-between gap-4 py-2">
					<dt class="text-slate-500 dark:text-zinc-400">NIP</dt>
					<dd class="text-right font-semibold text-slate-900 dark:text-zinc-100">{nip}</dd>
				</div>
			{/if}
		</dl>
	</section>

	<section>
		<h4
			class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
		>
			<Icon name="info" class="h-3.5 w-3.5" />
			Keperluan
		</h4>
		<p class="mt-1 text-xs leading-relaxed text-slate-700 dark:text-zinc-200">{keperluan}</p>
	</section>

	{#if pesanKesan}
		<section>
			<h4
				class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
			>
				<Icon name="book" class="h-3.5 w-3.5" />
				Pesan &amp; Kesan
			</h4>
			<p class="mt-1 text-xs leading-relaxed text-slate-700 dark:text-zinc-200">{pesanKesan}</p>
		</section>
	{/if}

	{#if tandaTangan}
		<section>
			<h4
				class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-500"
			>
				<Icon name="pen" class="h-3.5 w-3.5" />
				Tanda Tangan
			</h4>
			<div
				class="mt-2 inline-block rounded-xl border border-slate-200/80 bg-white p-2 dark:border-zinc-700"
			>
				<img src={tandaTangan} alt="Tanda tangan" class="max-h-32" />
			</div>
		</section>
	{/if}
</div>
