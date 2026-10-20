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

<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
	<div class="mb-4 flex items-start justify-between gap-2 max-sm:flex-col sm:flex-row">
		<div>
			<h2 class="text-xl font-bold">Jejak Audit</h2>
			<p class="text-base-content/80 block text-sm">
				Riwayat perubahan nilai (impor Excel maupun ubah manual) beserta pelaku dan waktunya.
			</p>
		</div>
		<div class="flex items-center gap-2 max-sm:w-full max-sm:flex-col">
			<select
				class="select bg-base-200 dark:bg-base-300 w-full max-w-xs dark:border-none"
				value={aksi ?? ''}
				title="Filter jenis audit"
				onchange={(event) => setFilter((event.currentTarget as HTMLSelectElement).value)}
			>
				<option value="">Semua jenis</option>
				{#each Object.entries(labelAksi) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
			<a class="btn btn-soft shadow-none max-sm:w-full" href="/nilai-akhir/impor-nilai">
				<Icon name="import" />
				Impor Nilai
			</a>
		</div>
	</div>

	<div class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none">
		<table class="border-base-200 table border dark:border-none">
			<thead>
				<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
					<th style="min-width: 160px;">Waktu</th>
					<th style="min-width: 140px;">Aktor</th>
					<th style="min-width: 140px;">Jenis</th>
					<th>Keterangan</th>
					<th style="min-width: 140px;">Perubahan</th>
				</tr>
			</thead>
			<tbody>
				{#each daftar as item (item.id)}
					<tr>
						<td class="text-sm whitespace-nowrap">{formatWaktu(item.createdAt)}</td>
						<td class="text-sm">{item.aktor ?? '-'}</td>
						<td>
							<span class="badge badge-soft badge-sm">
								{labelAksi[String(item.aksi)] ?? item.aksi}
							</span>
						</td>
						<td class="text-sm">{item.ringkasan ?? '-'}</td>
						<td class="text-sm opacity-80">{detailTeks(item.detail)}</td>
					</tr>
				{:else}
					<tr>
						<td class="p-6 text-center" colspan="5">
							<em class="opacity-60">Belum ada jejak audit.</em>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="mt-3 text-center text-sm opacity-70">{daftar.length} entri terakhir</p>
</div>
