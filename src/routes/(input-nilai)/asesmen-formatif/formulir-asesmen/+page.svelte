<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { invalidate, goto } from '$app/navigation';
	import MuridPicker from '$lib/components/asesmen-sumatif/murid-picker.svelte';
	import { checkboxArrowNavigation } from '$lib/utils/checkbox-navigation';

	type EntryStatus = 'ya' | 'tidak' | null;
	type PageData = {
		murid: { id: number; nama: string };
		kelasId: number;
		mapelList: { id: number; nama: string }[];
		pickerMapelId: number;
		mapel: { id: number; nama: string };
		entries: Array<{
			index: number;
			tujuanPembelajaranId: number;
			deskripsi: string;
			lingkupMateri: string;
			teknikPenilaianId?: number | null;
			teknikPenilaian?: {
				id: number;
				nama: string;
				singkatan: string;
				keterangan?: string | null;
			} | null;
			status: EntryStatus;
		}>;
		hasTujuan: boolean;
	};

	let { data }: { data: PageData } = $props();

	type EntryOverrideMap = Record<number, EntryStatus | undefined>;

	let overrides = $state<EntryOverrideMap>({});

	const entries = $derived.by(
		() =>
			data.entries.map<PageData['entries'][number]>((entry, index) => {
				const override = overrides[index];
				return {
					...entry,
					status: override === undefined ? entry.status : override
				};
			}) as PageData['entries']
	);

	// svelte-ignore state_referenced_locally
	const kembaliHref = `/asesmen-formatif?mapel_id=${data.mapel.id}`;

	// Navigasi antar murid/mapel memakai route yang sama (komponen tidak remount) —
	// bersihkan override agar status murid/mapel baru terbaca dari data server.
	$effect(() => {
		void data.murid.id;
		void data.mapel.id;
		overrides = {};
	});

	// Pemilih murid & mapel (komponen bersama) — isDirty dipakai untuk
	// konfirmasi sebelum pindah agar penilaian yang belum tersimpan tidak hilang.
	const isDirty = $derived(Object.keys(overrides).length > 0);

	function toggleEntry(
		index: number,
		value: Exclude<EntryStatus, null>,
		target: HTMLInputElement | null = null
	) {
		const base = data.entries[index];
		if (!base) return;
		const currentStatus = overrides[index] ?? base.status ?? null;
		const nextStatus: EntryStatus = currentStatus === value ? null : value;
		const updated: EntryOverrideMap = { ...overrides };
		const baseStatus = base.status ?? null;
		if (nextStatus === baseStatus) {
			delete updated[index];
		} else {
			updated[index] = nextStatus;
		}
		overrides = updated;

		if (!target) return;
		target.checked = nextStatus === value;
		const row = target.closest('tr');
		if (!row) return;
		const oppositeColumn = value === 'ya' ? 'tidak' : 'ya';
		const oppositeInput = row.querySelector<HTMLInputElement>(
			`input[data-checkbox-column="${oppositeColumn}"]`
		);
		if (oppositeInput) {
			oppositeInput.checked = false;
		}
	}

	function isChecked(status: EntryStatus, value: 'ya' | 'tidak') {
		return status === value;
	}

	async function handleSuccess() {
		await invalidate('app:asesmen-formatif');
		await invalidate('app:asesmen-formatif/formulir');
		overrides = {};
	}

	async function pilihMapel(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const mapelId = Number(select.value);
		if (!Number.isInteger(mapelId) || mapelId === data.pickerMapelId) return;
		if (
			isDirty &&
			!confirm(
				'Masih ada perubahan penilaian yang belum disimpan. Pindah mapel akan membuangnya. Lanjutkan?'
			)
		) {
			select.value = String(data.pickerMapelId);
			return;
		}
		await goto(`/asesmen-formatif/formulir-asesmen?murid_id=${data.murid.id}&mapel_id=${mapelId}`, {
			keepFocus: true
		});
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<FormEnhance action="?/save" onsuccess={handleSuccess} showToast>
		{#snippet children({ submitting })}
			<input type="hidden" name="muridId" value={data.murid.id} />
			<input type="hidden" name="mapelId" value={data.mapel.id} />

			<div
				class="mb-4 grid grid-cols-2 gap-2 border-b border-slate-200 pb-4 md:flex md:items-center dark:border-zinc-800"
			>
				<a
					href={kembaliHref}
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 md:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				>
					<Icon name="left" class="h-4 w-4" />
					Kembali
				</a>
				<button
					type="submit"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:ml-auto md:w-auto"
					disabled={!data.hasTujuan || submitting}
				>
					<Icon name="save" class="h-4 w-4" />
					{submitting ? 'Menyimpan...' : 'Simpan'}
				</button>
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<div class="relative flex items-center">
					<select
						class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						title="Pilih mata pelajaran"
						aria-label="Pilih mata pelajaran"
						value={data.pickerMapelId}
						onchange={pilihMapel}
					>
						{#each data.mapelList as opsi (opsi.id)}
							<option value={opsi.id}>{opsi.nama}</option>
						{/each}
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</div>
				<MuridPicker
					basePath="/asesmen-formatif/formulir-asesmen"
					kelasId={data.kelasId}
					muridId={data.murid.id}
					mapelId={data.pickerMapelId}
					getDirty={() => isDirty}
					confirmMessage="Masih ada perubahan penilaian yang belum disimpan. Pindah murid akan membuangnya. Lanjutkan?"
				/>
			</div>

			<h1 class="mt-4 mb-3 text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Apakah {data.murid.nama} telah memenuhi setiap tujuan pembelajaran {data.mapel.nama}?
			</h1>

			{#if !data.hasTujuan}
				<div
					class="mt-4 flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200"
				>
					<Icon name="info" class="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
					<span>
						Belum ada tujuan pembelajaran untuk mata pelajaran ini. Tambahkan tujuan pembelajaran di
						menu <strong>Intrakurikuler</strong> terlebih dahulu.
					</span>
				</div>
			{:else}
				<div
					class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
				>
					<table class="w-full border-collapse text-xs">
						<thead>
							<tr
								class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
							>
								<th style="width: 44px; min-width: 40px;" class="px-3 py-2.5">No</th>
								<th class="w-full px-3 py-2.5" style="min-width: 260px;">Tujuan Pembelajaran</th>
								<th class="px-3 py-2.5 text-center">Ya</th>
								<th class="px-3 py-2.5 text-center">Tidak</th>
							</tr>
						</thead>
						<tbody
							class="divide-y divide-slate-200 dark:divide-zinc-800"
							use:checkboxArrowNavigation
						>
							{#each entries as entry, index (entry.tujuanPembelajaranId)}
								<tr
									class="transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50 {entry.status ===
									'ya'
										? 'border-l-4 border-l-emerald-600'
										: entry.status === 'tidak'
											? 'border-l-4 border-l-red-500'
											: ''}"
								>
									<td class="px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-400">
										{entry.index}
									</td>
									<td class="px-3 py-2.5">
										<p class="font-medium text-slate-900 dark:text-zinc-100">{entry.deskripsi}</p>
										<div
											class="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400"
										>
											<span class="font-semibold tracking-wider uppercase"
												>{entry.lingkupMateri}</span
											>
											{#if entry.teknikPenilaian}
												<span
													class="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300"
												>
													<span class="font-bold">{entry.teknikPenilaian.singkatan}</span>
													<span class="opacity-60">·</span>
													<span>{entry.teknikPenilaian.nama}</span>
												</span>
											{/if}
										</div>
										<input
											type="hidden"
											name={`entries.${index}.tujuanPembelajaranId`}
											value={entry.tujuanPembelajaranId}
										/>
										<input
											type="hidden"
											name={`entries.${index}.status`}
											value={entry.status ?? ''}
										/>
									</td>
									<td class="px-3 py-2.5 text-center">
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											disabled={submitting}
											checked={isChecked(entry.status, 'ya')}
											data-checkbox-column="ya"
											onchange={(event) =>
												toggleEntry(index, 'ya', event.currentTarget as HTMLInputElement)}
										/>
									</td>
									<td class="px-3 py-2.5 text-center">
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											disabled={submitting}
											checked={isChecked(entry.status, 'tidak')}
											data-checkbox-column="tidak"
											onchange={(event) =>
												toggleEntry(index, 'tidak', event.currentTarget as HTMLInputElement)}
										/>
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
