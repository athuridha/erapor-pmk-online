<script lang="ts">
	import { invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	type RatingOption = { code: string; label: string; badge: string };

	type PageData = {
		tableReady: boolean;
		projekId: number;
		projek: {
			id: number;
			tema: string;
			judul: string;
			catatan: string | null;
			kelas: { id: number; nama: string; fase: string | null } | null;
			pembina: { id: number; nama: string } | null;
		} | null;
		anggotaRows: Array<{
			id: number;
			nama: string;
			nisn: string | null;
			nilai: Record<string, string>;
		}>;
		dims: string[];
		ratingOptions: RatingOption[];
	};

	let { data }: { data: PageData } = $props();

	const badgeClass = (code: string) =>
		data.ratingOptions.find((option) => option.code === code)?.badge ?? '';
	const ratingLabel = (code: string) =>
		data.ratingOptions.find((option) => option.code === code)?.label ?? code;

	function onsuccess() {
		invalidate('app:p5');
	}
</script>

<div class="card bg-base-100 rounded-lg border border-none p-4 shadow-md">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
		<div class="min-w-0">
			<div class="flex items-center gap-2">
				<a
					href="/p5"
					class="btn btn-soft btn-sm btn-ghost shadow-none"
					title="Kembali ke daftar projek"
				>
					<Icon name="left" />
					P5
				</a>
				{#if data.projek}
					<span class="badge badge-primary badge-soft">
						<Icon name="star" />
						{data.projek.tema}
					</span>
				{/if}
			</div>
			{#if data.projek}
				<h2 class="mt-1 truncate text-xl font-bold">{data.projek.judul}</h2>
				<p class="text-base-content/70 mt-1 text-sm">
					<span class="inline-flex items-center gap-1">
						<Icon name="users" />
						Anggota: {data.anggotaRows.length}
					</span>
					· {#if data.projek.pembina}Pembina: {data.projek.pembina.nama}{:else}
						Tanpa pembina{/if}
					{#if data.projek.kelas}· Kelas {data.projek.kelas.nama}{/if}
				</p>
				{#if data.projek.catatan}
					<p class="text-base-content/60 mt-1 text-sm italic">{data.projek.catatan}</p>
				{/if}
			{:else}
				<h2 class="mt-1 text-xl font-bold">Nilai P5</h2>
			{/if}
		</div>
		<div class="flex flex-row gap-2 max-sm:w-full max-sm:self-end">
			<a
				href={`/cetak/rapor-p5.pdf?projek=${data.projekId}`}
				class="btn btn-soft shadow-none"
				title="Cetak rapor P5 projek ini"
				target="_blank"
			>
				<Icon name="print" />
				Cetak
			</a>
		</div>
	</div>

	{#if !data.tableReady}
		<div class="alert border-error/60 bg-error/10 text-error-content mt-4 border border-dashed">
			<Icon name="warning" />
			<span>
				Database P5 belum siap. Jalankan <code>pnpm db:push</code> untuk menerapkan migrasi terbaru.
			</span>
		</div>
	{:else if !data.projek}
		<div
			class="alert border-warning/60 bg-warning/10 text-warning-content mt-4 border border-dashed"
		>
			<Icon name="info" />
			<span>Projek P5 tidak ditemukan, mungkin sudah dihapus.</span>
		</div>
	{:else if data.anggotaRows.length === 0}
		<div
			class="alert border-warning/60 bg-warning/10 text-warning-content mt-4 border border-dashed"
		>
			<Icon name="info" />
			<span>Projek tidak memiliki anggota murid.</span>
		</div>
	{:else}
		<FormEnhance id="form-nilai-p5" action="?/simpanNilai" {onsuccess}>
			{#snippet children({ submitting: busy, invalid })}
				<input name="projekId" value={data.projekId} hidden />

				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th>NO</th>
								<th>SISWA</th>
								{#each data.dims as dimensi (dimensi)}
									<th>{dimensi}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each data.anggotaRows as murid, rowIdx (murid.id)}
								<tr>
									<td>{rowIdx + 1}</td>
									<td class="min-w-32 whitespace-nowrap text-left">
										<p>{murid.nama}</p>
										{#if murid.nisn}<p class="text-base-content/50 text-xs">{murid.nisn}</p>{/if}
									</td>
									{#each data.dims as dimensi, dimIdx (dimensi)}
										{@const current = murid.nilai[dimensi] ?? ''}
										<td class="text-center">
											<span
												class="mb-1 inline-flex flex-col items-center gap-1"
												aria-label={current
													? `${dimensi}: ${ratingLabel(current)}`
													: `${dimensi}: belum dinilai`}
											>
												<span
													class="badge badge-soft badge-outline badge-sm {badgeClass(current)}"
													title={current ? ratingLabel(current) : 'Belum dinilai'}
												>
													{current || '—'}
												</span>
												<select
													name={`rating_${rowIdx}_${dimIdx}`}
													class="select select-xs bg-base-200 w-full max-w-32"
													value={current}
													disabled={busy}
													title={dimensi}
												>
													<option value="">—</option>
													{#each data.ratingOptions as option (option.code)}
														<option value={option.code}>{option.label}</option>
													{/each}
												</select>
											</span>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="mt-4 flex items-center justify-end gap-2">
					<button
						type="submit"
						class="btn btn-primary shadow-none"
						disabled={busy || invalid}
						title="Simpan Data"
					>
						{#if busy}
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
