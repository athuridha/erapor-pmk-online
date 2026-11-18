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

<div
	class="min-w-0 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800"
	>
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-2">
				<a
					href="/p5"
					class="inline-flex h-8 items-center gap-1 rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					title="Kembali ke daftar projek"
				>
					<Icon name="left" class="h-3.5 w-3.5" />
					P5
				</a>
				{#if data.projek}
					<span
						class="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
					>
						<Icon name="star" class="h-3 w-3" />
						{data.projek.tema}
					</span>
				{/if}
			</div>
			{#if data.projek}
				<h1
					class="mt-2 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100"
				>
					{data.projek.judul}
				</h1>
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					<span class="inline-flex items-center gap-1">
						<Icon name="users" class="h-3.5 w-3.5" />
						Anggota: {data.anggotaRows.length}
					</span>
					· {#if data.projek.pembina}Pembina: {data.projek.pembina.nama}{:else}
						Tanpa pembina{/if}
					{#if data.projek.kelas}· Kelas {data.projek.kelas.nama}{/if}
				</p>
				{#if data.projek.catatan}
					<p class="mt-0.5 text-xs italic text-slate-500 dark:text-zinc-400">
						{data.projek.catatan}
					</p>
				{/if}
			{:else}
				<h1 class="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Nilai P5
				</h1>
			{/if}
		</div>
		<div class="flex flex-row gap-2 max-sm:w-full max-sm:self-end">
			<a
				href={`/cetak/rapor-p5.pdf?projek=${data.projekId}`}
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				title="Cetak rapor P5 projek ini"
				target="_blank"
			>
				<Icon name="print" class="h-4 w-4" />
				Cetak
			</a>
		</div>
	</div>

	{#if !data.tableReady}
		<div
			class="mt-4 flex items-center gap-2.5 rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200"
		>
			<Icon name="warning" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
			<span>
				Database P5 belum siap. Jalankan <code>pnpm db:push</code> untuk menerapkan migrasi terbaru.
			</span>
		</div>
	{:else if !data.projek}
		<div
			class="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Projek P5 tidak ditemukan, mungkin sudah dihapus.</span>
		</div>
	{:else if data.anggotaRows.length === 0}
		<div
			class="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Projek tidak memiliki anggota murid.</span>
		</div>
	{:else}
		<FormEnhance id="form-nilai-p5" action="?/simpanNilai" {onsuccess}>
			{#snippet children({ submitting: busy, invalid })}
				<input name="projekId" value={data.projekId} hidden />

				<p class="mt-4 mb-2 text-[11px] text-slate-500 lg:hidden dark:text-zinc-400">
					Geser tabel ke kiri/kanan untuk melihat seluruh dimensi.
				</p>
				<div
					class="mt-4 w-full max-w-full overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
				>
					<table class="w-full min-w-max border-collapse text-xs">
						<thead>
							<tr
								class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
							>
								<th class="px-3 py-2.5">NO</th>
								<th class="px-3 py-2.5">SISWA</th>
								{#each data.dims as dimensi (dimensi)}
									<th class="px-3 py-2.5 text-center">{dimensi}</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
							{#each data.anggotaRows as murid, rowIdx (murid.id)}
								<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
									<td class="px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-400">
										{rowIdx + 1}
									</td>
									<td class="min-w-32 px-3 py-2.5 text-left whitespace-nowrap">
										<p class="font-medium text-slate-900 dark:text-zinc-100">{murid.nama}</p>
										{#if murid.nisn}
											<p class="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
												{murid.nisn}
											</p>
										{/if}
									</td>
									{#each data.dims as dimensi, dimIdx (dimensi)}
										{@const current = murid.nilai[dimensi] ?? ''}
										<td class="px-3 py-2.5 text-center">
											<span
												class="inline-flex flex-col items-center gap-1.5"
												aria-label={current
													? `${dimensi}: ${ratingLabel(current)}`
													: `${dimensi}: belum dinilai`}
											>
												<span
													class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {badgeClass(
														current
													)}"
													title={current ? ratingLabel(current) : 'Belum dinilai'}
												>
													{current || '-'}
												</span>
												<div class="relative flex items-center">
													<select
														name={`rating_${rowIdx}_${dimIdx}`}
														class="h-8 w-32 appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-7 pl-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
														value={current}
														disabled={busy}
														title={dimensi}
													>
														<option value="">-</option>
														{#each data.ratingOptions as option (option.code)}
															<option value={option.code}>{option.label}</option>
														{/each}
													</select>
													<span
														aria-hidden="true"
														class="pointer-events-none absolute right-2 flex items-center text-slate-400 dark:text-zinc-400"
													>
														<Icon name="down" class="h-3 w-3" />
													</span>
												</div>
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
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
						disabled={busy || invalid}
						title="Simpan Data"
					>
						{#if busy}
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
