<script lang="ts">
	import { invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	type Kelompok = {
		id: number;
		kelasId: number;
		nama: string | null;
		skPenugasan: string | null;
		tanggalMulai: string | null;
		tanggalSelesai: string | null;
		lokasi: string | null;
		catatan: string | null;
		kelas: { nama: string; fase: string | null } | null;
		perusahaan: { nama: string } | null;
		pembimbing: { nama: string } | null;
	};

	type Anggota = {
		id: number;
		muridId: number;
		catatan: string | null;
		murid: { nama: string; nisn: string } | null;
	};

	type Tujuan = {
		id: number;
		urutan: number | null;
		deskripsi: string;
	};

	type NilaiSel = { nilais: string; predikat: string | null; catatan: string | null };

	interface PageData {
		authorized: boolean;
		kelompok: Kelompok | null;
		anggota: Anggota[];
		tujuan: Tujuan[];
		nilaiMap: Record<number, Record<number, NilaiSel>>;
	}

	let { data }: { data: PageData } = $props();

	const canManage = $derived(data.authorized);
	// Non-null snapshot for use inside lazy snippets (Svelte narrows only in the
	// immediate {#if} block, not inside default snippets).
	const kelompokId = $derived(data.kelompok?.id ?? 0);
</script>

{#if !data.authorized || !data.kelompok}
	<div
		class="mt-4 flex items-center gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
	>
		<Icon name="warning" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
		<span>
			{!data.authorized
				? 'Anda tidak memiliki izin untuk mengisi nilai PKL.'
				: 'Kelompok PKL tidak ditemukan.'}
		</span>
	</div>
{:else}
	<div
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
		>
			<div class="flex items-center gap-2.5">
				<span
					aria-hidden="true"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
				>
					<Icon name="users" class="h-4.5 w-4.5" />
				</span>
				<div>
					<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
						{data.kelompok.nama ?? `Kelompok ${data.kelompok.id}`}
					</h1>
					<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
						{data.kelompok.kelas?.fase
							? `${data.kelompok.kelas.nama} - ${data.kelompok.kelas.fase}`
							: (data.kelompok.kelas?.nama ?? '-')} · {data.kelompok.perusahaan?.nama ??
							'Tanpa perusahaan'}
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<a
					href="/prakerin"
					class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				>
					<Icon name="left" class="h-3.5 w-3.5" />
					Kembali
				</a>
				<a
					href={`/cetak/rapor-pkl.pdf?kelompok=${data.kelompok.id}`}
					target="_blank"
					rel="noopener"
					class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					title="Cetak rapor PKL kelompok ini"
				>
					<Icon name="print" class="h-3.5 w-3.5" />
					Cetak
				</a>
			</div>
		</div>

		<dl
			class="mb-4 grid gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/75 p-3.5 text-xs sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<div class="flex gap-2">
				<dt class="w-28 shrink-0 font-semibold text-slate-500 dark:text-zinc-400">Pembimbing</dt>
				<dd class="font-medium text-slate-900 dark:text-zinc-100">
					{data.kelompok.pembimbing?.nama ?? '-'}
				</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-28 shrink-0 font-semibold text-slate-500 dark:text-zinc-400">Periode</dt>
				<dd class="font-medium text-slate-900 tabular-nums dark:text-zinc-100">
					{data.kelompok.tanggalMulai ?? '-'} s/d {data.kelompok.tanggalSelesai ?? '-'}
				</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-28 shrink-0 font-semibold text-slate-500 dark:text-zinc-400">No. SK</dt>
				<dd class="font-medium text-slate-900 dark:text-zinc-100">
					{data.kelompok.skPenugasan ?? '-'}
				</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-28 shrink-0 font-semibold text-slate-500 dark:text-zinc-400">
					Jumlah Anggota
				</dt>
				<dd class="font-medium text-slate-900 tabular-nums dark:text-zinc-100">
					{data.anggota.length} murid
				</dd>
			</div>
		</dl>

		{#if data.tujuan.length === 0}
			<div
				class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/85 px-4 py-3 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200"
			>
				<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<span>Belum ada tujuan pembelajaran PKL. Atur di halaman PKL terlebih dahulu.</span>
			</div>
		{:else if data.anggota.length === 0}
			<div
				class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/85 px-4 py-3 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200"
			>
				<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<span>Kelompok belum memiliki anggota murid.</span>
			</div>
		{:else}
			<FormEnhance
				id="form-simpan-nilai"
				action="?/simpanNilai"
				onsuccess={() => {
					invalidate('app:prakerin');
				}}
			>
				{#snippet children({ submitting })}
					<input name="kelompokId" value={kelompokId} hidden />

					<div
						class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
					>
						<table class="w-full min-w-[860px] border-collapse text-xs">
							<thead>
								<tr
									class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
								>
									<th style="width: 40px;" class="px-3 py-2.5">No</th>
									<th class="min-w-[180px] px-3 py-2.5">Murid</th>
									{#each data.tujuan as tujuan (tujuan.id)}
										<th class="max-w-[120px] px-3 py-2.5 align-top">
											<span
												class="line-clamp-2 w-24 text-xs font-semibold break-normal"
												title={tujuan.deskripsi}
											>
												{tujuan.deskripsi}
											</span>
											<span class="block text-[10px] font-normal text-slate-500 dark:text-zinc-400">
												{tujuan.urutan ? `Urutan ${tujuan.urutan}` : ''}
											</span>
										</th>
									{/each}
									<th class="min-w-[180px] px-3 py-2.5">Catatan</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
								{#each data.anggota as anggota, index (anggota.id)}
									<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
										<td class="px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-400">
											{index + 1}
										</td>
										<td class="px-3 py-2.5">
											<span class="font-medium text-slate-900 dark:text-zinc-100">
												{anggota.murid?.nama ?? `Murid #${anggota.muridId}`}
											</span>
											<span class="block font-mono text-[11px] text-slate-500 dark:text-zinc-400">
												{anggota.murid?.nisn ?? '-'}
											</span>
										</td>
										{#each data.tujuan as tujuan (tujuan.id)}
											<td class="px-3 py-2.5">
												<input
													type="number"
													name={`nilai_${anggota.muridId}_${tujuan.id}`}
													min="0"
													max="100"
													value={data.nilaiMap[anggota.muridId]?.[tujuan.id]?.nilais ?? ''}
													title={data.nilaiMap[anggota.muridId]?.[tujuan.id]?.predikat ??
														'Belum dinilai'}
													class="h-8 w-24 rounded-lg border border-[#7e8b9b] bg-white px-2 text-center text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
													autocomplete="off"
													disabled={!canManage}
												/>
											</td>
										{/each}
										<td class="px-3 py-2.5">
											<input
												type="text"
												name={`catatan_${anggota.muridId}`}
												value={anggota.catatan ?? ''}
												class="h-8 w-full rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
												placeholder="Catatan pembimbing"
												autocomplete="off"
												disabled={!canManage}
											/>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="mt-4 flex items-center justify-end gap-2">
						<button
							type="submit"
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
							disabled={submitting || !canManage}
							aria-disabled={submitting || !canManage}
							title={!canManage ? 'Anda tidak memiliki izin untuk menyimpan' : ''}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
							{:else}
								<Icon name="save" class="h-4 w-4" />
							{/if}
							Simpan Data
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		{/if}
	</div>
{/if}
