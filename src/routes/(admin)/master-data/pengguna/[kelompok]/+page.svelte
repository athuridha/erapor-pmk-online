<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import { buildPageNumbers, OPSI_BARIS_PER_HALAMAN } from '$lib/utils/pagination';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.filter?.q ?? '');

	const baris = $derived(data.baris ?? []);
	const total = $derived(data.total ?? 0);
	const totalHalaman = $derived(data.totalHalaman ?? 1);
	const perHalaman = $derived(data.perHalaman ?? 50);
	const halamanSekarang = $derived(data.filter?.page ?? 1);
	const nomorHalaman = $derived(buildPageNumbers(halamanSekarang, totalHalaman));

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

	async function gotoPerHalaman(jumlah: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('per_page', String(jumlah));
		params.delete('page');
		await goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	}

	function formatTanggal(value: string | null | undefined): string {
		if (!value) return '—';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(parsed);
	}
</script>

<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
	<div class="mb-4 flex items-start justify-between gap-2 max-sm:flex-col sm:flex-row">
		<div>
			<h2 class="text-xl font-bold">Data Pengguna — {data.kelompok.judul}</h2>
			<p class="text-base-content/80 block text-sm">{data.kelompok.deskripsi}</p>
		</div>
		<div class="flex flex-wrap items-center gap-2 max-sm:w-full">
			<a class="btn btn-primary btn-soft shadow-none max-sm:w-full" href="/pengguna/form">
				<Icon name="plus" />
				Tambah Akun
			</a>
		</div>
	</div>

	<form
		class="mb-4 flex flex-col gap-2 sm:flex-row"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
		onsubmit={(event) => event.preventDefault()}
	>
		<div class="join w-full">
			<label class="input bg-base-200 dark:bg-base-300 join-item grow dark:border-none">
				<Icon name="search" />
				<input
					type="search"
					name="q"
					bind:value={searchTerm}
					spellcheck="false"
					placeholder="Cari nama, NIK, atau username..."
					autocomplete="off"
					onchange={(event) => applySearch((event.currentTarget as HTMLInputElement).value)}
				/>
			</label>
			<select
				class="select bg-base-200 dark:bg-base-300 join-item w-auto shrink dark:border-none"
				value={perHalaman}
				title="Baris per halaman"
				onchange={(event) =>
					gotoPerHalaman(Number((event.currentTarget as HTMLSelectElement).value))}
			>
				{#each OPSI_BARIS_PER_HALAMAN as jumlah (jumlah)}
					<option value={jumlah}>{jumlah} / hal</option>
				{/each}
			</select>
		</div>
	</form>

	<div class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none">
		<table class="border-base-200 table border dark:border-none">
			<thead>
				<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
					<th style="min-width: 150px;">NIK / Username</th>
					<th style="min-width: 180px;">Nama</th>
					<th style="min-width: 130px;">Role</th>
					<th style="min-width: 130px;">Kelas</th>
					<th style="min-width: 150px;">Mata Pelajaran</th>
					<th class="text-center" style="width: 110px;">Hak Akses</th>
					<th style="min-width: 120px;">Dibuat</th>
					<th class="text-center" style="width: 190px;">Aksi</th>
				</tr>
			</thead>
			<tbody>
				{#each baris as row (row.id)}
					<tr>
						<td>{row.nik_username}</td>
						<td class="font-medium">{row.nama}</td>
						<td>
							<span class="badge badge-sm badge-soft badge-primary">{row.role}</span>
						</td>
						<td>{row.kelas ?? '—'}</td>
						<td>{row.mapel ?? '—'}</td>
						<td class="text-center">{row.izin}</td>
						<td>{formatTanggal(row.dibuat)}</td>
						<td>
							<div class="flex items-center justify-center gap-1">
								<a class="btn btn-soft btn-sm shadow-none" href={`/pengguna/${row.id}`}>
									<Icon name="eye" />
									Kelola
								</a>
								<a class="btn btn-soft btn-sm shadow-none" href={`/pengguna/form/${row.id}`}>
									<Icon name="edit" />
									Ubah
								</a>
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td class="p-6 text-center" colspan="8">
							<em class="opacity-60">Belum ada akun {data.kelompok.judul.toLowerCase()}.</em>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if totalHalaman > 1}
		<div class="mt-4 flex justify-center">
			<div class="join">
				<button
					type="button"
					class="join-item btn"
					disabled={halamanSekarang <= 1}
					onclick={() => gotoPage(halamanSekarang - 1)}
				>
					«
				</button>
				{#each nomorHalaman as nomor, index (index)}
					{#if nomor === '…'}
						<button type="button" class="join-item btn" disabled>…</button>
					{:else}
						<button
							type="button"
							class="join-item btn"
							class:btn-active={nomor === halamanSekarang}
							onclick={() => gotoPage(nomor)}
						>
							{nomor}
						</button>
					{/if}
				{/each}
				<button
					type="button"
					class="join-item btn"
					disabled={halamanSekarang >= totalHalaman}
					onclick={() => gotoPage(halamanSekarang + 1)}
				>
					»
				</button>
			</div>
		</div>
	{/if}

	<p class="mt-3 text-center text-sm opacity-70">
		Menampilkan {baris.length} dari {total} akun
	</p>
</div>
