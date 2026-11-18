<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { EkstrakurikulerNilaiKategori } from '$lib/ekstrakurikuler';

	type PageData = {
		murid: { id: number; nama: string };
		ekstrakurikuler: { id: number; nama: string; nilaiKosong: boolean };
		tujuan: Array<{ id: number; deskripsi: string }>;
		nilaiByTujuan: Record<number, EkstrakurikulerNilaiKategori>;
		kategoriOptions: Array<{ value: EkstrakurikulerNilaiKategori; label: string }>;
		backUrl: string;
	};

	let { data }: { data: PageData } = $props();

	const hasTujuan = $derived.by(() => data.tujuan.length > 0);
	const initValue = $derived.by(() => ({
		muridId: data.murid.id,
		ekstrakurikulerId: data.ekstrakurikuler.id,
		nilai: data.nilaiByTujuan,
		nilaiKosong: data.ekstrakurikuler.nilaiKosong
	}));

	function capitalizeSentence(value: string | null | undefined) {
		if (!value) return '';
		const trimmed = value.trimStart();
		if (!trimmed) return '';
		return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
	}

	function formatTujuan(value: string) {
		return value.trim();
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<FormEnhance action="?/save" init={initValue} id="form-asesmen-ekstrakurikuler">
		{#snippet children({ submitting, invalid })}
			<input type="hidden" name="muridId" value={data.murid.id} />
			<input type="hidden" name="ekstrakurikulerId" value={data.ekstrakurikuler.id} />

			<div
				class="flex flex-row justify-between gap-2 border-b border-slate-200 pb-4 dark:border-zinc-800"
			>
				<a
					href={data.backUrl}
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				>
					<Icon name="left" class="h-4 w-4" />
					Kembali
				</a>
				<button
					type="submit"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!hasTujuan || invalid || submitting}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon name="save" class="h-4 w-4" />
					{/if}
					Simpan
				</button>
			</div>

			<h1 class="mt-4 pb-2 text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Isi nilai untuk tiap tujuan pembelajaran ekstrakurikuler di bawah ini untuk Ananda
				<span class="text-blue-600 dark:text-blue-400">
					{capitalizeSentence(data.murid.nama)}
				</span>.
			</h1>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-xs text-slate-600 dark:text-zinc-400">
					Ekstrakurikuler:
					<strong class="text-slate-900 dark:text-zinc-100">
						{capitalizeSentence(data.ekstrakurikuler.nama)}
					</strong>
				</p>
				<div
					class="tooltip sm:tooltip-left tooltip-right"
					data-tip="Toggle ini untuk menandai ekstrakurikuler tanpa nilai. Di rapor akan muncul &quot;-&quot;"
				>
					<label class="swap swap-flip text-xs">
						<input type="checkbox" name="nilaiKosong" value="1" />
						<div
							class="swap-on inline-flex h-8 items-center rounded-lg border border-red-300 bg-red-50 px-3 font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
						>
							Nilai Kosong
						</div>
						<div
							class="swap-off inline-flex h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
						>
							Nilai Ada
						</div>
					</label>
				</div>
			</div>

			{#if !hasTujuan}
				<div
					class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
				>
					<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
					<span>
						Belum ada tujuan pembelajaran untuk ekstrakurikuler ini. Tambahkan tujuan terlebih
						dahulu melalui menu <strong>Ekstrakurikuler &gt; Tujuan</strong>.
					</span>
				</div>
			{:else}
				<div
					class="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
				>
					<table class="w-full border-collapse text-xs">
						<thead>
							<tr
								class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
							>
								<th style="width: 48px;" class="px-3 py-2.5">No</th>
								<th class="w-full px-3 py-2.5" style="min-width: 240px;">Tujuan Pembelajaran</th>
								<th class="min-w-44 px-3 py-2.5">Pilih Nilai</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
							{#each data.tujuan as tujuan, index (tujuan.id)}
								<tr class="transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50">
									<td class="px-3 py-2.5 align-top tabular-nums text-slate-600 dark:text-zinc-400">
										{index + 1}
									</td>
									<td class="px-3 py-2.5 align-top text-xs text-slate-800 dark:text-zinc-200">
										{formatTujuan(tujuan.deskripsi)}
									</td>
									<td class="px-3 py-2.5 align-top">
										<div class="relative flex items-center">
											<select
												class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
												name={`nilai.${tujuan.id}`}
											>
												<option value="">Belum dinilai</option>
												{#each data.kategoriOptions as option (option.value)}
													<option value={option.value}>{option.label}</option>
												{/each}
											</select>
											<span
												aria-hidden="true"
												class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
											>
												<Icon name="down" class="h-3.5 w-3.5" />
											</span>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/snippet}
	</FormEnhance>
</div>
