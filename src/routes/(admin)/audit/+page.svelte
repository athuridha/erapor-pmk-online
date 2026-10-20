<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';

	let { data } = $props();

	const daftar = $derived(data.daftar ?? []);
	const aksi = $derived(data.filter?.aksi ?? null);

	const labelAksi: Record<string, string> = {
		import_nilai: 'Impor Nilai',
		update_nilai: 'Ubah Nilai'
	};

	async function setFilter(nilai: string) {
		const params = new URLSearchParams(page.url.search);
		if (nilai) params.set('aksi', nilai);
		else params.delete('aksi');
		const query = params.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, { keepFocus: true });
	}

	function formatWaktu(iso: unknown) {
		if (!iso) return '-';
		const date = new Date(String(iso));
		if (Number.isNaN(date.getTime())) return String(iso);
		return date.toLocaleString('id-ID', {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	function detailTeks(detail: unknown) {
		if (!detail || typeof detail !== 'object') return '-';
		const parsed = detail as Record<string, unknown>;
		if (parsed.nilaiLama != null || parsed.nilaiBaru != null) {
			return `${parsed.nilaiLama ?? '—'} → ${parsed.nilaiBaru ?? '—'}`;
		}
		if (parsed.tersimpan != null) return `${parsed.tersimpan} nilai tersimpan`;
		return '-';
	}
</script>

<div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
	<div>
		<h2 class="text-2xl leading-tight font-bold tracking-tight">Jejak Audit</h2>
		<p class="text-base-content/60 mt-0.5 block text-sm">
			Riwayat perubahan nilai (impor Excel maupun ubah manual) beserta pelaku dan waktunya.
		</p>
	</div>
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		<label
			class="input bg-base-200/60 w-full max-w-xs rounded-xl border border-transparent transition focus:border-primary/40 focus:bg-base-100"
		>
			<Icon name="search" />
			<select
				class="grow"
				value={aksi ?? ''}
				onchange={(event) => setFilter((event.currentTarget as HTMLSelectElement).value)}
			>
				<option value="">Semua jenis</option>
				{#each Object.entries(labelAksi) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</label>
		<a class="btn btn-ghost max-sm:w-full rounded-xl" href="/nilai-akhir/impor-nilai">
			<Icon name="import" />
			Impor Nilai
		</a>
	</div>
</div>

<div class="mb-4 grid gap-3 sm:grid-cols-3">
	<div class="rounded-2xl border border-base-200/60 bg-base-100 p-4">
		<p class="text-base-content/50 text-xs font-medium tracking-wide uppercase">Jumlah Entri</p>
		<p class="mt-1 text-2xl font-bold tracking-tight">{daftar.length}</p>
		<p class="text-base-content/50 text-xs">200 entri terakhir</p>
	</div>
	<div class="rounded-2xl border border-base-200/60 bg-base-100 p-4">
		<p class="text-base-content/50 text-xs font-medium tracking-wide uppercase">Impor Nilai</p>
		<p class="mt-1 text-2xl font-bold tracking-tight">
			{daftar.filter((item) => item.aksi === 'import_nilai').length}
		</p>
		<p class="text-base-content/50 text-xs">perubahan lewat Excel</p>
	</div>
	<div class="rounded-2xl border border-base-200/60 bg-base-100 p-4">
		<p class="text-base-content/50 text-xs font-medium tracking-wide uppercase">Ubah Nilai</p>
		<p class="mt-1 text-2xl font-bold tracking-tight">
			{daftar.filter((item) => item.aksi === 'update_nilai').length}
		</p>
		<p class="text-base-content/50 text-xs">perubahan manual guru</p>
	</div>
</div>

<div class="mt-4 overflow-x-auto rounded-2xl border border-base-200/60 bg-base-100 shadow-sm">
	<table class="border-base-200 table border dark:border-none">
		<thead>
			<tr
				class="bg-base-200/40 text-base-content/50 border-b border-base-200/60 text-left text-[11px] font-semibold tracking-wider uppercase"
			>
				<th style="min-width: 160px;">Waktu</th>
				<th style="min-width: 140px;">Aktor</th>
				<th style="min-width: 140px;">Jenis</th>
				<th>Keterangan</th>
				<th style="min-width: 140px;">Perubahan</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-base-200/60">
			{#each daftar as item (item.id)}
				<tr>
					<td class="text-sm whitespace-nowrap">{formatWaktu(item.createdAt)}</td>
					<td class="text-sm">{item.aktor ?? '-'}</td>
					<td>
						<span class="badge badge-soft badge-sm rounded-full">
							{labelAksi[String(item.aksi)] ?? item.aksi}
						</span>
					</td>
					<td class="text-sm">{item.ringkasan ?? '-'}</td>
					<td class="text-sm opacity-80">{detailTeks(item.detail)}</td>
				</tr>
			{:else}
				<tr>
					<td class="p-10 text-center" colspan="5">
						<em class="opacity-60">Belum ada jejak audit.</em>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
