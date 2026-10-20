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
		if (value == null || value === '') return '—';
		if (typeof value === 'number') {
			return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		}
		return String(value);
	}
</script>

<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<h2 class="text-xl font-bold">Impor Nilai dari Excel</h2>
		<p class="text-base-content/80 block text-sm">
			Unduh template, isi di Excel, lalu unggah kembali. Nilai dicek dulu sebelum disimpan.
		</p>
	</div>
	<a class="btn btn-outline shadow-none max-sm:w-full" href="/nilai-akhir">
		<Icon name="left" />
		Rekap Nilai Akhir
	</a>
</div>

<div class="card bg-base-100 dark:bg-base-200 rounded-lg border border-none p-4 shadow-md">
	<div class="grid gap-3 sm:grid-cols-3">
		<label class="form-control">
			<span class="label-text mb-1 text-sm">Kelas</span>
			<select class="select select-bordered w-full" bind:value={kelasId}>
				<option value="">-- pilih kelas --</option>
				{#each daftarKelas as kelas (kelas.id)}
					<option value={kelas.id}>{kelas.nama}</option>
				{/each}
			</select>
		</label>

		<label class="form-control">
			<span class="label-text mb-1 text-sm">Jenis Nilai</span>
			<select class="select select-bordered w-full" bind:value={jenis}>
				<option value="sumatif">Sumatif (nilai akhir)</option>
				<option value="formatif">Formatif (tuntas per mapel)</option>
			</select>
		</label>

		<div class="form-control">
			<span class="label-text mb-1 text-sm">Template</span>
			<button
				type="button"
				class="btn btn-outline w-full"
				onclick={kirimTemplate}
				disabled={!kelasId}
			>
				<Icon name="download" />
				Unduh Template
			</button>
		</div>
	</div>

	<form
		class="mt-4 flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-end"
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
		<label class="form-control w-full max-w-md">
			<span class="label-text mb-1 text-sm">Berkas nilai (.xlsx)</span>
			<input
				type="file"
				name="berkas"
				accept=".xlsx"
				class="file-input file-input-bordered w-full"
				onchange={pilihBerkas}
			/>
		</label>
		<button type="submit" class="btn btn-primary" disabled={!kelasId || !berkas || submitting}>
			{#if submitting}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<Icon name="eye" />
			{/if}
			Periksa Berkas
		</button>
	</form>
</div>

{#if gagal}
	<div class="alert alert-error alert-soft mt-4 flex items-center gap-3">
		<Icon name="error" />
		<span>{gagal}</span>
	</div>
{/if}

{#if sukses}
	<div class="alert alert-success alert-soft mt-4 flex items-center gap-3">
		<Icon name="success" />
		<span>{sukses}</span>
	</div>
{/if}

{#if preview}
	<div class="mt-4 stats dark:bg-base-200 shadow-md">
		<div class="stat">
			<div class="stat-title">Nilai terbaca</div>
			<div class="stat-value text-lg">{preview.totalNilai}</div>
			<div class="stat-desc">dari {preview.baris.length} baris murid</div>
		</div>
		<div class="stat">
			<div class="stat-title">Baris Valid</div>
			<div class="stat-value text-lg">{preview.barisValid}</div>
			<div class="stat-desc">siap disimpan</div>
		</div>
		<div class="stat">
			<div class="stat-title">Baris Bermasalah</div>
			<div class="stat-value text-lg">{preview.barisBermasalah}</div>
			<div class="stat-desc">akan dilewati</div>
		</div>
	</div>

	{#if preview.pesanUmum?.length}
		<div class="alert alert-warning alert-soft mt-4 flex flex-col gap-1">
			{#each preview.pesanUmum as pesan (pesan)}
				<span>{pesan}</span>
			{/each}
		</div>
	{/if}

	<div
		class="bg-base-100 dark:bg-base-200 mt-4 overflow-x-auto rounded-md shadow-md dark:shadow-none"
	>
		<table class="border-base-200 table-sm table border dark:border-none">
			<thead>
				<tr class="bg-base-200 dark:bg-base-300 text-left font-bold">
					<th>Baris</th>
					<th>Murid</th>
					{#each preview.mapel as mapel (mapel.id)}
						<th class="text-center">{mapel.nama}</th>
					{/each}
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each preview.baris as baris (baris.baris)}
					<tr class={baris.masalah?.length ? 'text-error' : ''}>
						<td>{baris.baris}</td>
						<td>
							<div class="font-medium">{baris.muridNama ?? '-'}</div>
							<div class="text-xs opacity-60">NIS {baris.nis || '-'}</div>
						</td>
						{#each preview.mapel as mapel (mapel.id)}
							<td class="text-center">
								{formatNilai(baris.nilai?.get?.(mapel.id))}
							</td>
						{/each}
						<td class="text-xs">
							{#if baris.masalah?.length}
								{baris.masalah.join(' ')}
							{:else}
								<span class="badge badge-soft badge-success badge-sm">OK</span>
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
			class="btn btn-primary"
			disabled={!preview?.ok || submitting || !berkas}
			onclick={simpanNilai}
		>
			{#if submitting}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<Icon name="save" />
			{/if}
			Simpan {preview?.barisValid ?? 0} Baris ke Database
		</button>
		<p class="text-base-content/60 text-xs">
			Baris bermasalah dilewati. Setiap penyimpanan dicatat di jejak audit.
		</p>
	</div>
{/if}
