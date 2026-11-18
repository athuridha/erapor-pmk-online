<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/state';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	type Mapel = {
		id: number;
		nama: string;
		pengampu: string;
		terkunci: boolean;
		dikunciOleh: string | null;
		dikunciPada: string | null;
		alasan: string | null;
	};

	let { data } = $props();

	let cari = $state('');
	let targetKunci = $state<Mapel | null>(null);
	let targetKunciId = $state(0);
	let alasan = $state('');

	const mapel = $derived((data.mapel ?? []) as Mapel[]);
	const daftarKelas = $derived(
		(page.data.daftarKelas ?? []) as Array<{ id: number; nama: string; fase: string | null }>
	);
	const jumlahTerkunci = $derived(mapel.filter((row) => row.terkunci).length);
	const daftarTersaring = $derived.by(() => {
		const keyword = cari.trim().toLowerCase();
		if (!keyword) return mapel;
		return mapel.filter(
			(row) =>
				row.nama.toLowerCase().includes(keyword) || row.pengampu.toLowerCase().includes(keyword)
		);
	});

	/** Pilihan kelas lokal halaman ini (tidak mengubah konteks halaman lain). */
	function pilihKelas(kelasId: number) {
		goto(`/kunci-nilai?kelas_id=${kelasId}`, { invalidateAll: true });
	}

	function formatWaktu(value: string | null): string {
		if (!value) return '-';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(parsed);
	}

	async function handleSelesai({ data: hasil }: { data?: Record<string, unknown> }) {
		await invalidateAll();
		targetKunci = null;
		targetKunciId = 0;
		alasan = '';
		toast({
			message: typeof hasil?.message === 'string' ? hasil.message : 'Perubahan disimpan.',
			type: 'success'
		});
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4 max-sm:flex-col sm:flex-row dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Kunci Nilai
			</h1>
			<p class="mt-0.5 block max-w-2xl text-xs text-slate-500 dark:text-zinc-400">
				Nilai yang sudah dikunci tidak bisa diubah guru sampai operator membuka kuncinya. Penilaian
				harian (formatif) tetap bisa diisi.
			</p>
		</div>
		{#if data.kelasId}
			<div class="flex flex-wrap items-center gap-2 max-sm:w-full">
				<span
					class="inline-flex items-center rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
				>
					{data.kelasNama}
				</span>
				<FormEnhance action="?/kunciSemua" showToast={false} onsuccess={handleSelesai}>
					{#snippet children({ submitting })}
						<input type="hidden" name="kelasId" value={data.kelasId} />
						<button
							type="submit"
							class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							disabled={submitting || mapel.length === 0 || jumlahTerkunci === mapel.length}
						>
							<Icon name="lock" class="h-3.5 w-3.5" />
							Kunci Semua
						</button>
					{/snippet}
				</FormEnhance>
				<FormEnhance action="?/bukaSemua" showToast={false} onsuccess={handleSelesai}>
					{#snippet children({ submitting })}
						<input type="hidden" name="kelasId" value={data.kelasId} />
						<button
							type="submit"
							class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							disabled={submitting || jumlahTerkunci === 0}
						>
							<Icon name="key" class="h-3.5 w-3.5" />
							Buka Semua
						</button>
					{/snippet}
				</FormEnhance>
			</div>
		{/if}
	</div>

	{#if daftarKelas.length > 0}
		<div class="mb-4 flex flex-wrap items-center gap-2">
			<label
				for="pilih-kelas-kunci"
				class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
			>
				Kelas
			</label>
			<div class="relative flex w-full items-center sm:w-64">
				<select
					id="pilih-kelas-kunci"
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					value={data.kelasId ?? ''}
					onchange={(event) => {
						const nilai = Number((event.currentTarget as HTMLSelectElement).value);
						if (Number.isInteger(nilai) && nilai > 0) pilihKelas(nilai);
					}}
				>
					<option value="">Pilih kelas...</option>
					{#each daftarKelas as kelas (kelas.id)}
						<option value={kelas.id}>
							{kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama}
						</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</div>
	{/if}

	{#if !data.kelasId}
		<div
			class="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Pilih kelas pada dropdown di atas untuk mengelola kunci nilai.</span>
		</div>
	{:else}
		<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
			<div class="relative w-full sm:max-w-sm">
				<span
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
				>
					<Icon name="search" class="h-4 w-4" />
				</span>
				<input
					type="search"
					name="q"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
					bind:value={cari}
					spellcheck="false"
					placeholder="Cari mata pelajaran atau pengampu..."
					autocomplete="off"
				/>
			</div>
			<p class="text-xs text-slate-500 tabular-nums dark:text-zinc-400">
				{jumlahTerkunci} dari {mapel.length} mata pelajaran terkunci
			</p>
		</div>

		<p class="mb-2 text-[11px] text-slate-500 lg:hidden dark:text-zinc-400">
			Geser tabel ke kiri/kanan untuk melihat kolom lain.
		</p>
		<div
			class="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full min-w-max border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th style="min-width: 200px;" class="px-3 py-2.5">Mata Pelajaran</th>
						<th style="min-width: 180px;" class="px-3 py-2.5">Pengampu</th>
						<th style="min-width: 130px;" class="px-3 py-2.5">Status</th>
						<th style="min-width: 200px;" class="px-3 py-2.5">Dikunci oleh</th>
						<th class="px-3 py-2.5 text-center" style="width: 150px;">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
					{#each daftarTersaring as row (row.id)}
						<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
							<td class="px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100">{row.nama}</td>
							<td class="px-3 py-2.5 text-slate-700 dark:text-zinc-300">{row.pengampu}</td>
							<td class="px-3 py-2.5">
								{#if row.terkunci}
									<span
										class="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300"
									>
										Terkunci
									</span>
								{:else}
									<span
										class="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
									>
										Bebas
									</span>
								{/if}
							</td>
							<td class="px-3 py-2.5 text-xs">
								{#if row.terkunci}
									<div class="font-medium text-slate-800 dark:text-zinc-200">
										{row.dikunciOleh ?? '-'}
									</div>
									<div class="text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
										{formatWaktu(row.dikunciPada)}
									</div>
									{#if row.alasan}
										<div class="mt-0.5 italic text-slate-500 dark:text-zinc-400">{row.alasan}</div>
									{/if}
								{:else}
									<span class="text-slate-400 dark:text-zinc-500">-</span>
								{/if}
							</td>
							<td class="px-3 py-2.5">
								<div class="flex items-center justify-center gap-1.5">
									{#if row.terkunci}
										<FormEnhance action="?/buka" showToast={false} onsuccess={handleSelesai}>
											{#snippet children({ submitting })}
												<input type="hidden" name="mapelId" value={row.id} />
												<button
													type="submit"
													class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300"
													disabled={submitting}
												>
													<Icon name="key" class="h-3.5 w-3.5" />
													Buka
												</button>
											{/snippet}
										</FormEnhance>
									{:else}
										<button
											type="button"
											class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
											onclick={() => {
												targetKunci = row;
												targetKunciId = row.id;
												alasan = '';
											}}
										>
											<Icon name="lock" class="h-3.5 w-3.5" />
											Kunci
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td
								class="p-8 text-center text-xs italic text-slate-500 dark:text-zinc-400"
								colspan="5"
							>
								Belum ada mata pelajaran di kelas ini.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if targetKunci}
	<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open>
		<div
			class="modal-box max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="mb-1 text-lg font-bold">Kunci Nilai {targetKunci.nama}</h3>
			<p class="mb-4 text-xs text-slate-600 dark:text-zinc-400">
				Setelah dikunci, guru tidak bisa mengubah nilai mata pelajaran ini sampai kunci dibuka.
			</p>

			<FormEnhance action="?/kunci" showToast={false} onsuccess={handleSelesai}>
				{#snippet children({ submitting, invalid })}
					<input type="hidden" name="mapelId" value={targetKunciId} />
					<label class="block">
						<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
							Alasan (opsional)
						</span>
						<textarea
							name="alasan"
							bind:value={alasan}
							class="w-full rounded-xl border border-[#7e8b9b] bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
							rows="3"
							placeholder="Contoh: Rapor semester 1 sudah dibagikan ke wali kelas"
							disabled={submitting}></textarea>
					</label>

					<div
						class="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800"
					>
						<button
							type="button"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (targetKunci = null)}
							disabled={submitting}
						>
							<Icon name="close" class="h-4 w-4" />
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
							disabled={submitting || invalid}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								<Icon name="lock" class="h-4 w-4" />
							{/if}
							Kunci Nilai
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<div class="modal-backdrop bg-transparent">
			<button type="button" onclick={() => (targetKunci = null)}>close</button>
		</div>
	</dialog>
{/if}
