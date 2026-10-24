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
	<div class="alert border-warning/60 bg-warning/10 text-warning-content mt-4 border border-dashed">
		<Icon name="warning" />
		<span>
			{!data.authorized
				? 'Anda tidak memiliki izin untuk mengisi nilai PKL.'
				: 'Kelompok PKL tidak ditemukan.'}
		</span>
	</div>
{:else}
	<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
		<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-2">
				<Icon name="users" class="text-primary" />
				<div>
					<h2 class="text-xl font-bold">
						{data.kelompok.nama ?? `Kelompok ${data.kelompok.id}`}
					</h2>
					<p class="text-base-content/70 text-sm">
						{data.kelompok.kelas?.fase
							? `${data.kelompok.kelas.nama} - ${data.kelompok.kelas.fase}`
							: (data.kelompok.kelas?.nama ?? '-')} · {data.kelompok.perusahaan?.nama ??
							'Tanpa perusahaan'}
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<a href="/prakerin" class="btn btn-ghost btn-sm shadow-none">
					<Icon name="close" />
					Kembali
				</a>
				<a
					href={`/cetak/rapor-pkl.pdf?kelompok=${data.kelompok.id}`}
					target="_blank"
					rel="noopener"
					class="btn btn-soft btn-sm shadow-none"
					title="Cetak rapor PKL kelompok ini"
				>
					<Icon name="print" />
					Cetak
				</a>
			</div>
		</div>

		<dl
			class="bg-base-200/40 dark:bg-base-300/40 mb-4 grid gap-2 rounded-md p-3 text-sm sm:grid-cols-2"
		>
			<div class="flex gap-2">
				<dt class="w-28 shrink-0 font-medium">Pembimbing</dt>
				<dd>{data.kelompok.pembimbing?.nama ?? '-'}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-28 shrink-0 font-medium">Periode</dt>
				<dd>{data.kelompok.tanggalMulai ?? '-'} s/d {data.kelompok.tanggalSelesai ?? '-'}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-28 shrink-0 font-medium">No. SK</dt>
				<dd>{data.kelompok.skPenugasan ?? '-'}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-28 shrink-0 font-medium">Jumlah Anggota</dt>
				<dd>{data.anggota.length} murid</dd>
			</div>
		</dl>

		{#if data.tujuan.length === 0}
			<div class="alert alert-soft alert-info">
				<Icon name="info" />
				<span>Belum ada tujuan pembelajaran PKL. Atur di halaman PKL terlebih dahulu.</span>
			</div>
		{:else if data.anggota.length === 0}
			<div class="alert alert-soft alert-info">
				<Icon name="info" />
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
						class="bg-base-100 dark:bg-base-200 overflow-x-auto rounded-md shadow-md dark:shadow-none"
					>
						<table class="border-base-200 table table-sm min-w-[860px] border dark:border-none">
							<thead>
								<tr class="bg-base-200 dark:bg-base-300 text-left font-bold">
									<th style="width: 40px;">No</th>
									<th class="min-w-[180px]">Murid</th>
									{#each data.tujuan as tujuan (tujuan.id)}
										<th class="max-w-[60px] align-top">
											<span
												class="line-clamp-2 w-24 break-normal text-xs font-semibold"
												title={tujuan.deskripsi}
											>
												{tujuan.deskripsi}
											</span>
											<span class="text-base-content/50 block text-[10px] font-normal">
												{tujuan.urutan ? `Urutan ${tujuan.urutan}` : ''}
											</span>
										</th>
									{/each}
									<th class="min-w-[180px]">Catatan</th>
								</tr>
							</thead>
							<tbody>
								{#each data.anggota as anggota, index (anggota.id)}
									<tr>
										<td>{index + 1}</td>
										<td>
											<span class="font-medium"
												>{anggota.murid?.nama ?? `Murid #${anggota.muridId}`}</span
											>
											<span class="text-base-content/60 block text-xs">
												{anggota.murid?.nisn ?? '-'}
											</span>
										</td>
										{#each data.tujuan as tujuan (tujuan.id)}
											<td>
												<input
													type="number"
													name={`nilai_${anggota.muridId}_${tujuan.id}`}
													min="0"
													max="100"
													value={data.nilaiMap[anggota.muridId]?.[tujuan.id]?.nilais ?? ''}
													title={data.nilaiMap[anggota.muridId]?.[tujuan.id]?.predikat ??
														'Belum dinilai'}
													class="input input-xs w-24 text-center"
													autocomplete="off"
													disabled={!canManage}
												/>
											</td>
										{/each}
										<td>
											<input
												type="text"
												name={`catatan_${anggota.muridId}`}
												value={anggota.catatan ?? ''}
												class="input input-xs w-full"
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
							class="btn btn-primary shadow-none"
							disabled={submitting || !canManage}
							title={!canManage ? 'Anda tidak memiliki izin untuk menyimpan' : ''}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
							{/if}
							<Icon name="save" />
							Simpan Data
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		{/if}
	</div>
{/if}
