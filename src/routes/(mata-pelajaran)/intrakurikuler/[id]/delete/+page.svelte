<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import {
		agamaMapelLabelByName,
		agamaMapelNames,
		agamaParentName,
		jenisMapel
	} from '$lib/statics.js';

	let { data } = $props();
	let confirmDelete = $state(false);
	const invalidateTargets = ['app:mapel', 'app:mapel_tp-rl', 'app:asesmen-sumatif'];
	const AGAMA_MAPEL_NAME_SET = new Set<string>(agamaMapelNames);
	// svelte-ignore state_referenced_locally
	const isAgamaMapel = AGAMA_MAPEL_NAME_SET.has(data.mapel.nama);
	// svelte-ignore state_referenced_locally
	const agamaLabel = agamaMapelLabelByName[data.mapel.nama] ?? '';

	// Dapatkan jenjang varian dari sekolah (misalnya 'SMK')
	const jenjangVariant = $derived.by(() => {
		const sekolah = page.data.sekolah as { jenjangVariant?: string | null } | null | undefined;
		return sekolah?.jenjangVariant ?? null;
	});

	// Fungsi untuk mendapatkan label jenis mapel yang dinamis berdasarkan jenjang
	function getJenisMapelLabel(jenis: string): string {
		if (jenis === 'wajib' && jenjangVariant?.toUpperCase() === 'SMK') {
			return 'Mata Pelajaran Umum';
		}
		return jenisMapel[jenis as MataPelajaran['jenis']] ?? jenis;
	}
</script>

<FormEnhance
	action="?/delete"
	onsuccess={async () => {
		await Promise.all(invalidateTargets.map((token) => invalidate(token)));
		if (typeof window !== 'undefined' && window.history?.state?.modal) {
			history.back();
		} else {
			await goto('/intrakurikuler', { replaceState: true });
		}
	}}
>
	{#snippet children({ submitting })}
		<h3 class="mb-3 text-base font-bold text-slate-900 dark:text-zinc-100">
			Hapus Data Mata Pelajaran
		</h3>
		<dl
			class="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-800/60"
		>
			<div class="flex justify-between gap-2">
				<dt class="text-slate-500 dark:text-zinc-400">Nama</dt>
				<dd class="font-semibold text-slate-900 dark:text-zinc-100">{data.mapel.nama}</dd>
			</div>
			<div class="flex justify-between gap-2">
				<dt class="text-slate-500 dark:text-zinc-400">KKM</dt>
				<dd class="font-semibold text-slate-900 tabular-nums dark:text-zinc-100">
					{data.mapel.kkm}
				</dd>
			</div>
			<div class="flex justify-between gap-2">
				<dt class="text-slate-500 dark:text-zinc-400">Jenis</dt>
				<dd class="font-semibold text-slate-900 dark:text-zinc-100">
					{getJenisMapelLabel(data.mapel.jenis)}
				</dd>
			</div>
		</dl>

		{#if isAgamaMapel}
			<div
				class="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
				role="alert"
			>
				<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
				<div class="space-y-1">
					<p class="font-semibold">Perhatian: mata pelajaran ini memiliki perlakuan khusus.</p>
					<p>
						Terdapat beberapa sub-mata pelajaran Pendidikan Agama
						{#if data.mapel.nama !== agamaParentName && agamaLabel}
							(<strong>{agamaLabel}</strong>)
						{/if}
						yang saling terhubung dengan data agama siswa. Menghapus mata pelajaran ini dapat merusak
						logika nilai dan keterkaitan tersebut.
					</p>
				</div>
			</div>
		{/if}

		<!-- Konfirmasi eksplisit sebelum menghapus -->
		<label
			class="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
		>
			<input
				type="checkbox"
				class="checkbox checkbox-sm mt-0.5"
				name="confirm"
				bind:checked={confirmDelete}
				value="1"
			/>
			<span>
				Saya mengerti bahwa menghapus mata pelajaran ini akan menghapus Tujuan Pembelajaran dan data
				terkait.
			</span>
		</label>

		<div
			class="mt-5 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800"
		>
			<button
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				type="button"
				onclick={() => history.back()}
			>
				<Icon name="close" class="h-4 w-4" />
				Batal
			</button>

			<button
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
				type="submit"
				disabled={submitting || !confirmDelete}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Icon name="del" class="h-4 w-4" />
				{/if}
				Hapus
			</button>
		</div>
	{/snippet}
</FormEnhance>
