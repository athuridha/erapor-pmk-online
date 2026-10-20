<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.filter?.q ?? '');
	let konfirmasiId = $state<number | null>(null);

	const modul = $derived(data.modul);
	const detail = $derived(data.detail);
	const kolom = $derived(detail?.kolom ?? []);
	const baris = $derived(detail?.baris ?? []);
	const total = $derived(detail?.total ?? 0);
	const totalHalaman = $derived(detail?.totalHalaman ?? 1);
	const page_ = $derived(data.filter?.page ?? 1);

	// Modul dengan aksi hapus langsung dari dashboard.
	const bisaHapus = $derived(
		['kelas', 'murid', 'intrakurikuler', 'pengguna', 'tahun_ajaran'].includes(modul?.key ?? '')
	);

	async function applySearch(value: string) {
		const params = new URLSearchParams(page.url.search);
		if (value.trim()) params.set('q', value.trim());
		else params.delete('q');
		params.delete('page');
		const query = params.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, { keepFocus: true });
	}

	async function gotoPage(pageNumber: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('page', String(pageNumber));
		await goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	}

	function formatNilai(value: string | number | null, format?: string) {
		if (value == null || value === '') return '—';
		if (format === 'angka') return String(value);
		if (format === 'desimal')
			return Number(value).toLocaleString('id-ID', { minimumFractionDigits: 2 });
		return String(value);
	}

	async function handleSuccess({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:dashboard-admin-detail');
		konfirmasiId = null;
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Data dihapus',
			type: 'success'
		});
	}
</script>

<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<div class="breadcrumbs mb-1 text-sm">
			<ul>
				<li><a href="/dashboard-admin">Dashboard Admin</a></li>
				<li>{modul?.judul}</li>
			</ul>
		</div>
		<h2 class="flex items-center gap-2 text-xl font-bold">
			<Icon name={modul?.ikon ?? 'grid'} />
			{modul?.judul}
		</h2>
		<p class="text-base-content/80 block text-sm">{modul?.deskripsi}</p>
	</div>
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		{#if modul?.tambah}
			<a class="btn btn-soft btn-primary shadow-none max-sm:w-full" href={modul.tambah}>
				<Icon name="plus" />
				Tambah
			</a>
		{/if}
		<a class="btn btn-outline shadow-none max-sm:w-full" href={modul?.kelola ?? '/dashboard-admin'}>
			<Icon name="edit" />
			Kelola
		</a>
	</div>
</div>

<div class="stats dark:bg-base-200 shadow-md mb-4">
	<div class="stat">
		<div class="stat-title">Total Data</div>
		<div class="stat-value text-lg">{total}</div>
		<div class="stat-desc">baris di database</div>
	</div>
	<div class="stat">
		<div class="stat-title">Halaman</div>
		<div class="stat-value text-lg">{page_} / {totalHalaman}</div>
		<div class="stat-desc text-wrap">50 baris per halaman</div>
	</div>
</div>

<form class="flex flex-col gap-2 sm:flex-row" onsubmit={(event) => event.preventDefault()}>
	<label class="input bg-base-200 dark:bg-base-300 w-full max-w-md dark:border-none">
		<Icon name="search" />
		<input
			type="search"
			bind:value={searchTerm}
			spellcheck="false"
			placeholder="Cari data..."
			autocomplete="off"
			onchange={(event) => applySearch((event.currentTarget as HTMLInputElement).value)}
		/>
	</label>
</form>

<div
	class="bg-base-100 dark:bg-base-200 mt-4 overflow-x-auto rounded-md shadow-md dark:shadow-none"
>
	<table class="border-base-200 table border dark:border-none">
		<thead>
			<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
				{#each kolom as kolomItem (kolomItem.key)}
					<th style="min-width: 120px;">{kolomItem.label}</th>
				{/each}
				{#if bisaHapus}
					<th class="text-center" style="min-width: 90px;">Aksi</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each baris as row, index (row.id ?? index)}
				<tr>
					{#each kolom as kolomItem (kolomItem.key)}
						<td class={kolomItem.format ? 'text-right' : ''}>
							{formatNilai(row[kolomItem.key] ?? null, kolomItem.format)}
						</td>
					{/each}
					{#if bisaHapus}
						<td class="text-center">
							{#if konfirmasiId === Number(row.id ?? 0)}
								<FormEnhance action="?/hapus" showToast={false} onsuccess={handleSuccess}>
									{#snippet children({ submitting })}
										<input type="hidden" name="modul" value={modul?.key ?? ''} />
										<input type="hidden" name="id" value={row.id ?? ''} />
										<div class="flex items-center justify-center gap-1">
											<button
												type="submit"
												class="btn btn-error btn-xs shadow-none"
												disabled={submitting}
											>
												Ya
											</button>
											<button
												type="button"
												class="btn btn-ghost btn-xs shadow-none"
												onclick={() => (konfirmasiId = null)}
											>
												Batal
											</button>
										</div>
									{/snippet}
								</FormEnhance>
							{:else}
								<button
									type="button"
									class="btn btn-ghost btn-xs text-error shadow-none"
									onclick={() => (konfirmasiId = Number(row.id ?? 0) || null)}
								>
									<Icon name="del" />
									Hapus
								</button>
							{/if}
						</td>
					{/if}
				</tr>
			{:else}
				<tr>
					<td colspan={kolom.length + (bisaHapus ? 1 : 0)} class="py-6 text-center opacity-70">
						Belum ada data pada modul ini.
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if totalHalaman > 1}
	<div class="mt-3 flex justify-end">
		<div class="join">
			<button
				type="button"
				class="btn btn-sm join-item"
				disabled={page_ <= 1}
				onclick={() => gotoPage(page_ - 1)}
			>
				«
			</button>
			<button type="button" class="btn btn-sm join-item pointer-events-none">
				{page_} / {totalHalaman}
			</button>
			<button
				type="button"
				class="btn btn-sm join-item"
				disabled={page_ >= totalHalaman}
				onclick={() => gotoPage(page_ + 1)}
			>
				»
			</button>
		</div>
	</div>
{/if}
