<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.filter?.q ?? '');
	let formTerbuka = $state(false);
	let barisEdit = $state<Record<string, string | number | null> | null>(null);
	let hapusId = $state<number | null>(null);

	const daftar = $derived(data.daftar ?? []);
	const entitas = $derived(data.entitas ?? null);
	const baris = $derived(data.baris ?? []);
	const relasi = $derived(data.relasi ?? {});

	function nilaiField(key: string): string {
		const sumber = barisEdit ?? baris[0] ?? {};
		const nilai = sumber[key];
		return nilai == null ? '' : String(nilai);
	}

	function bukaTambah() {
		barisEdit = null;
		formTerbuka = true;
	}

	function bukaUbah(row: Record<string, string | number | null>) {
		barisEdit = row;
		formTerbuka = true;
	}

	function tutupForm() {
		formTerbuka = false;
		barisEdit = null;
	}

	async function gantiEntitas(key: string) {
		await goto(`/master-data/${key}`, { keepFocus: true });
	}

	async function applySearch(value: string) {
		const params = new URLSearchParams(page.url.search);
		if (value.trim()) params.set('q', value.trim());
		else params.delete('q');
		const query = params.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, { keepFocus: true });
	}

	async function handleSimpan({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:master-data');
		tutupForm();
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Tersimpan',
			type: 'success'
		});
	}

	async function handleHapus({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidate('app:master-data');
		hapusId = null;
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
				<li><a href="/master-data">Master Data</a></li>
				{#if entitas}<li>{entitas.judul}</li>{/if}
			</ul>
		</div>
		<h2 class="flex items-center gap-2 text-xl font-bold">
			<Icon name={entitas?.ikon ?? 'database'} />
			{entitas?.judul ?? 'Master Data'}
		</h2>
		{#if entitas}
			<p class="text-base-content/80 block text-sm">{entitas.deskripsi}</p>
		{/if}
	</div>
	{#if entitas}
		<button type="button" class="btn btn-primary shadow-none max-sm:w-full" onclick={bukaTambah}>
			<Icon name="plus" />
			Tambah
		</button>
	{/if}
</div>

<div
	class="bg-base-100 dark:bg-base-200 mb-4 flex flex-col gap-3 rounded-md p-4 shadow-md sm:flex-row sm:items-end sm:justify-between"
>
	<label class="form-control w-full max-w-sm">
		<span class="label-text mb-1 text-sm">Jenis Master Data</span>
		<select
			class="select select-bordered w-full"
			value={entitas?.key ?? ''}
			onchange={(event) => gantiEntitas((event.currentTarget as HTMLSelectElement).value)}
		>
			{#each daftar as item (item.key)}
				<option value={item.key}>{item.judul}</option>
			{/each}
		</select>
	</label>

	<label class="form-control w-full max-w-sm">
		<span class="label-text mb-1 text-sm">Cari data</span>
		<label class="input input-bordered flex w-full items-center gap-2">
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
	</label>
</div>

{#if entitas}
	<div class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none">
		<table class="border-base-200 table border dark:border-none">
			<thead>
				<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
					{#each entitas.kolom as kolom (kolom.key)}
						<th style="min-width: 130px;">{kolom.label}</th>
					{/each}
					<th class="text-center" style="min-width: 130px;">Aksi</th>
				</tr>
			</thead>
			<tbody>
				{#each baris as row (row.id)}
					<tr>
						{#each entitas.kolom as kolom (kolom.key)}
							<td>{row[kolom.key] ?? '—'}</td>
						{/each}
						<td class="text-center">
							{#if hapusId === row.id}
								<FormEnhance action="?/hapus" showToast={false} onsuccess={handleHapus}>
									{#snippet children({ submitting })}
										<input type="hidden" name="id" value={row.id} />
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
												onclick={() => (hapusId = null)}
											>
												Batal
											</button>
										</div>
									{/snippet}
								</FormEnhance>
							{:else}
								<div class="flex items-center justify-center gap-1">
									<button
										type="button"
										class="btn btn-ghost btn-xs shadow-none"
										onclick={() => bukaUbah(row)}
									>
										<Icon name="edit" />
										Ubah
									</button>
									<button
										type="button"
										class="btn btn-ghost btn-xs text-error shadow-none"
										onclick={() => (hapusId = row.id)}
									>
										<Icon name="del" />
									</button>
								</div>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan={entitas.kolom.length + 1} class="py-6 text-center opacity-70">
							Belum ada data {entitas.judul.toLowerCase()}.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if entitas && formTerbuka}
	<dialog class="modal" open>
		<div class="modal-box max-w-2xl">
			<h3 class="mb-4 text-lg font-bold">
				{barisEdit ? 'Ubah' : 'Tambah'}
				{entitas.judul}
			</h3>

			<FormEnhance action="?/simpan" showToast={false} onsuccess={handleSimpan}>
				{#snippet children({ submitting, invalid })}
					{#if barisEdit}
						<input type="hidden" name="id" value={barisEdit.id} />
					{/if}

					<div class="grid gap-3 sm:grid-cols-2">
						{#each entitas.fields as field (field.key)}
							<label class="form-control">
								<span class="label-text mb-1 text-sm">
									{field.label}
									{#if field.wajib}<span class="text-error">*</span>{/if}
								</span>
								{#if field.tipe === 'toggle'}
									<input
										type="checkbox"
										name={field.key}
										class="toggle toggle-primary"
										checked={nilaiField(field.key) === 'Ya' || nilaiField(field.key) === 'true'}
										disabled={submitting}
									/>
								{:else if field.tipe === 'pilihan'}
									<select
										name={field.key}
										class="select select-bordered w-full"
										required={field.wajib}
										disabled={submitting}
									>
										{#if !field.wajib}<option value="">—</option>{/if}
										{#each field.opsi ?? [] as opsi (opsi.value)}
											<option value={opsi.value} selected={nilaiField(field.key) === opsi.value}>
												{opsi.label}
											</option>
										{/each}
									</select>
								{:else if field.tipe === 'relasi'}
									<select
										name={field.key}
										class="select select-bordered w-full"
										required={field.wajib}
										disabled={submitting}
									>
										{#if !field.wajib}<option value="">—</option>{/if}
										{#each relasi[field.relasi ?? 'kelas'] ?? [] as opsi (opsi.value)}
											<option
												value={opsi.value}
												selected={nilaiField(field.key) === String(opsi.value)}
											>
												{opsi.label}
											</option>
										{/each}
									</select>
								{:else if field.tipe === 'textarea'}
									<textarea
										name={field.key}
										class="textarea textarea-bordered w-full"
										rows="3"
										required={field.wajib}
										placeholder={field.placeholder ?? ''}
										disabled={submitting}>{nilaiField(field.key)}</textarea
									>
								{:else}
									<input
										name={field.key}
										type={field.tipe === 'tanggal'
											? 'date'
											: field.tipe === 'angka' || field.tipe === 'desimal'
												? 'number'
												: 'text'}
										class="input input-bordered w-full"
										value={nilaiField(field.key)}
										required={field.wajib}
										placeholder={field.placeholder ?? ''}
										disabled={submitting}
									/>
								{/if}
								{#if field.bantu}
									<span class="label-text-alt mt-1 text-xs opacity-70">{field.bantu}</span>
								{/if}
							</label>
						{/each}
					</div>

					<div class="modal-action">
						<button
							type="button"
							class="btn btn-soft shadow-none"
							onclick={tutupForm}
							disabled={submitting}
						>
							<Icon name="close" />
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-primary btn-soft shadow-none"
							disabled={submitting || invalid}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<Icon name="save" />
							{/if}
							Simpan
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>
{/if}
