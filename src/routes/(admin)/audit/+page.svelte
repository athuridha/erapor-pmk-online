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

<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<h2 class="text-xl font-bold">Jejak Audit</h2>
		<p class="text-base-content/80 block text-sm">
			Riwayat perubahan nilai (impor Excel maupun ubah manual) beserta pelaku dan waktunya.
		</p>
	</div>
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		<select
			class="select select-bordered w-full max-w-xs"
			value={aksi ?? ''}
			onchange={(event) => setFilter((event.currentTarget as HTMLSelectElement).value)}
		>
			<option value="">Semua jenis</option>
			{#each Object.entries(labelAksi) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
		<a class="btn btn-outline shadow-none max-sm:w-full" href="/nilai-akhir/impor-nilai">
			<Icon name="import" />
			Impor Nilai
		</a>
	</div>
</div>

<div class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none">
	<table class="border-base-200 table-sm table border dark:border-none">
		<thead>
			<tr class="bg-base-200 dark:bg-base-300 text-left font-bold">
				<th>Waktu</th>
				<th>Aktor</th>
				<th>Jenis</th>
				<th>Keterangan</th>
				<th>Perubahan</th>
			</tr>
		</thead>
		<tbody>
			{#each daftar as item (item.id)}
				<tr>
					<td class="whitespace-nowrap text-xs">{formatWaktu(item.createdAt)}</td>
					<td class="text-sm">{item.aktor ?? '-'}</td>
					<td>
						<span class="badge badge-soft badge-sm">
							{labelAksi[String(item.aksi)] ?? item.aksi}
						</span>
					</td>
					<td class="text-sm">{item.ringkasan ?? '-'}</td>
					<td class="text-xs opacity-80">{detailTeks(item.detail)}</td>
				</tr>
			{:else}
				<tr>
					<td colspan="5" class="py-6 text-center opacity-70">Belum ada jejak audit.</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
