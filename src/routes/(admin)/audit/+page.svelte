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
			return `${parsed.nilaiLama ?? '-'} → ${parsed.nilaiBaru ?? '-'}`;
		}
		if (parsed.tersimpan != null) return `${parsed.tersimpan} nilai tersimpan`;
		return '-';
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4 max-sm:flex-col sm:flex-row sm:items-center dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Jejak Audit
			</h1>
			<p class="mt-0.5 block text-xs text-slate-600 dark:text-zinc-400">
				Riwayat perubahan nilai (impor Excel maupun ubah manual) beserta pelaku dan waktunya.
			</p>
		</div>
		<div class="flex items-center gap-2 max-sm:w-full max-sm:flex-col">
			<div class="relative flex w-full items-center sm:w-48">
				<select
					class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					value={aksi ?? ''}
					title="Filter jenis audit"
					onchange={(event) => setFilter((event.currentTarget as HTMLSelectElement).value)}
				>
					<option value="">Semua jenis</option>
					{#each Object.entries(labelAksi) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
			<a
				class="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 max-sm:w-full dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				href="/nilai-akhir/impor-nilai"
			>
				<Icon name="import" class="h-4 w-4" />
				Impor Nilai
			</a>
		</div>
	</div>

	<div
		class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th class="px-3 py-2.5" style="min-width: 160px;">Waktu</th>
					<th class="px-3 py-2.5" style="min-width: 140px;">Aktor</th>
					<th class="px-3 py-2.5" style="min-width: 140px;">Jenis</th>
					<th class="px-3 py-2.5">Keterangan</th>
					<th class="px-3 py-2.5" style="min-width: 140px;">Perubahan</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
				{#each daftar as item (item.id)}
					<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
						<td class="px-3 py-2.5 whitespace-nowrap text-slate-600 tabular-nums dark:text-zinc-400"
							>{formatWaktu(item.createdAt)}</td
						>
						<td class="px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100"
							>{item.aktor ?? '-'}</td
						>
						<td class="px-3 py-2.5">
							<span
								class="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
							>
								{labelAksi[String(item.aksi)] ?? item.aksi}
							</span>
						</td>
						<td class="px-3 py-2.5 text-slate-800 dark:text-zinc-200">{item.ringkasan ?? '-'}</td>
						<td class="px-3 py-2.5 text-slate-600 dark:text-zinc-400">{detailTeks(item.detail)}</td>
					</tr>
				{:else}
					<tr>
						<td class="px-3 py-8 text-center text-slate-500 dark:text-zinc-400" colspan="5">
							Belum ada jejak audit.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="mt-3 text-center text-xs text-slate-500 dark:text-zinc-400">
		{daftar.length} entri terakhir
	</p>
</div>
