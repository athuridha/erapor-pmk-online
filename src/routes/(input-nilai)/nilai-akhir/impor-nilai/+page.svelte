<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data, form } = $props();

	let kelasId = $state<number | ''>('');
	// svelte-ignore state_referenced_locally
	let jenis = $state<'sumatif' | 'formatif'>(data.jenis ?? 'sumatif');
	let berkas = $state<File | null>(null);
	let submitting = $state(false);

	interface BarisPreview {
		baris: number;
		muridNama: string | null;
		nis: string;
		nisn: string;
		nilai: Map<number, number | boolean>;
		masalah: string[];
	}
	interface PreviewImpor {
		ok: boolean;
		jenis: 'sumatif' | 'formatif';
		kelasId: number;
		kelasNama: string;
		mapel: Array<{ id: number; nama: string }>;
		baris: BarisPreview[];
		totalNilai: number;
		barisValid: number;
		barisBermasalah: number;
		pesanUmum: string[];
	}

	const daftarKelas = $derived(data.daftarKelas ?? []);
	const preview = $derived((form as { preview?: PreviewImpor })?.preview ?? null);
	const gagal = $derived((form as { fail?: string })?.fail ?? null);
	const sukses = $derived((form as { message?: string })?.message ?? null);

	function pilihBerkas(event: Event) {
		berkas = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
	}

	async function kirimTemplate(event: Event) {
		event.preventDefault();
		if (!kelasId) {
			toast('Pilih kelas dulu.', 'error');
			return;
		}
		const params = new URLSearchParams({ kelas_id: String(kelasId), jenis });
		const response = await fetch(`/api/nilai-akhir/impor-nilai/template?${params.toString()}`);
		if (!response.ok) {
			toast('Gagal membuat template.', 'error');
			return;
		}
		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `Template Nilai ${jenis === 'sumatif' ? 'Sumatif' : 'Formatif'}.xlsx`;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	async function simpanNilai() {
		if (!berkas || !preview) return;
		submitting = true;
		try {
			const dataForm = new FormData();
			dataForm.set('kelasId', String(preview.kelasId));
			dataForm.set('jenis', preview.jenis);
			dataForm.set('berkas', berkas);
			const response = await fetch('?/simpan', {
				method: 'POST',
				headers: { Accept: 'application/json' },
				body: dataForm
			});
			const hasil = await response.json();
			if (hasil?.type === 'success') {
				toast(hasil.data?.message ?? 'Nilai tersimpan.', 'success');
			} else {
				toast(hasil?.data?.fail ?? 'Gagal menyimpan nilai.', 'error');
			}
		} catch (error) {
			console.error(error);
			toast('Gagal menyimpan nilai.', 'error');
		} finally {
			submitting = false;
		}
	}

	function formatNilai(value: unknown) {
		if (value == null || value === '') return '-';
		if (typeof value === 'number') {
			return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		}
		return String(value);
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Impor Nilai dari Excel
			</h1>
			<p class="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">
				Unduh template, isi di Excel, lalu unggah kembali. Nilai dicek dulu sebelum disimpan.
			</p>
		</div>
		<a
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 max-sm:w-full dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			href="/nilai-akhir"
		>
			<Icon name="left" class="h-4 w-4" />
			Rekap Nilai Akhir
		</a>
	</div>

	<div class="grid gap-3.5 sm:grid-cols-3">
		<label class="block">
			<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">Kelas</span>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={kelasId}
				>
					<option value="">Pilih kelas...</option>
					{#each daftarKelas as kelas (kelas.id)}
						<option value={kelas.id}>{kelas.nama}</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</label>

		<label class="block">
			<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300"
				>Jenis Nilai</span
			>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={jenis}
				>
					<option value="sumatif">Sumatif (nilai akhir)</option>
					<option value="formatif">Formatif (tuntas per mapel)</option>
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</label>

		<div>
			<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">Template</span>
			<button
				type="button"
				class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={kirimTemplate}
				disabled={!kelasId}
			>
				<Icon name="download" class="h-4 w-4" />
				Unduh Template
			</button>
		</div>
	</div>

	<form
		class="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end dark:border-zinc-800"
		method="POST"
		action="?/preview"
		enctype="multipart/form-data"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				submitting = false;
				await update();
			};
		}}
	>
		<input type="hidden" name="kelasId" value={kelasId} />
		<input type="hidden" name="jenis" value={jenis} />
		<label class="block w-full max-w-md">
			<span class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300">
				Berkas nilai (.xlsx)
			</span>
			<input
				type="file"
				name="berkas"
				accept=".xlsx"
				class="w-full cursor-pointer rounded-xl border border-dashed border-[#7e8b9b] bg-slate-50 px-3 py-1.5 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300"
				onchange={pilihBerkas}
			/>
		</label>
		<button
			type="submit"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
			disabled={!kelasId || !berkas || submitting}
		>
			{#if submitting}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<Icon name="eye" class="h-4 w-4" />
			{/if}
			Periksa Berkas
		</button>
	</form>
</div>

{#if gagal}
	<div
		class="mt-4 flex items-center gap-2.5 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200"
	>
		<Icon name="error" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
		<span>{gagal}</span>
	</div>
{/if}

{#if sukses}
	<div
		class="mt-4 flex items-center gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200"
	>
		<Icon name="success" class="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
		<span>{sukses}</span>
	</div>
{/if}

{#if preview}
	<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
		<div
			class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Nilai terbaca</div>
			<div class="mt-1 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{preview.totalNilai}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
				dari {preview.baris.length} baris murid
			</div>
		</div>
		<div
			class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Baris Valid</div>
			<div class="mt-1 text-xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
				{preview.barisValid}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">siap disimpan</div>
		</div>
		<div
			class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Baris Bermasalah</div>
			<div class="mt-1 text-xl font-bold text-amber-700 tabular-nums dark:text-amber-400">
				{preview.barisBermasalah}
			</div>
			<div class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">akan dilewati</div>
		</div>
	</div>

	{#if preview.pesanUmum?.length}
		<div
			class="mt-4 flex flex-col gap-1 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
		>
			{#each preview.pesanUmum as pesan (pesan)}
				<span>{pesan}</span>
			{/each}
		</div>
	{/if}

	<div
		class="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					<th class="px-3 py-2.5">Baris</th>
					<th class="px-3 py-2.5">Murid</th>
					{#each preview.mapel as mapel (mapel.id)}
						<th class="px-3 py-2.5 text-center">{mapel.nama}</th>
					{/each}
					<th class="px-3 py-2.5">Status</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
				{#each preview.baris as baris (baris.baris)}
					<tr
						class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 {baris.masalah
							?.length
							? 'text-red-700 dark:text-red-400'
							: ''}"
					>
						<td class="px-3 py-2 tabular-nums">{baris.baris}</td>
						<td class="px-3 py-2">
							<div class="font-medium text-slate-900 dark:text-zinc-100">
								{baris.muridNama ?? '-'}
							</div>
							<div class="text-[11px] text-slate-500 tabular-nums dark:text-zinc-400">
								NIS {baris.nis || '-'}
							</div>
						</td>
						{#each preview.mapel as mapel (mapel.id)}
							<td class="px-3 py-2 text-center tabular-nums">
								{formatNilai(baris.nilai?.get?.(mapel.id))}
							</td>
						{/each}
						<td class="px-3 py-2 text-xs">
							{#if baris.masalah?.length}
								{baris.masalah.join(' ')}
							{:else}
								<span
									class="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
								>
									OK
								</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
			disabled={!preview?.ok || submitting || !berkas}
			onclick={simpanNilai}
		>
			{#if submitting}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<Icon name="save" class="h-4 w-4" />
			{/if}
			Simpan {preview?.barisValid ?? 0} Baris ke Database
		</button>
		<p class="text-[11px] text-slate-500 dark:text-zinc-400">
			Baris bermasalah dilewati. Setiap penyimpanan dicatat di jejak audit.
		</p>
	</div>
{/if}
