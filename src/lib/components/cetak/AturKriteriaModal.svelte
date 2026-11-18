<script lang="ts">
	import Icon from '../icon.svelte';

	// Component rendered inside the global modal. Parent reads DOM inputs by id.
	let {
		cukupUpper = 85,
		baikUpper = 95
	}: {
		cukupUpper?: number;
		baikUpper?: number;
	} = $props();

	// local state so UI updates while user types
	// svelte-ignore state_referenced_locally
	let localCukup: number | string = $state(cukupUpper);
	// svelte-ignore state_referenced_locally
	let localBaik: number | string = $state(baikUpper);
</script>

<div class="space-y-4">
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<label class="flex flex-col gap-1.5">
			<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
				>Batas atas Perlu Bimbingan</span
			>
			<input
				id="krit-perlu"
				class="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs text-slate-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
				disabled
				value="< KKM"
				aria-label="Perlu Bimbingan"
			/>
			<span class="text-xs text-slate-500 dark:text-zinc-400">
				Nilai kurang dari KKM dianggap perlu bimbingan.
			</span>
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Batas atas Cukup</span>
			<input
				id="krit-cukup"
				type="number"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
				bind:value={localCukup}
				min="0"
				max="100"
				aria-label="Batas atas nilai cukup"
			/>
			<span class="text-xs text-slate-500 dark:text-zinc-400"
				>KKM &le; nilai &le; nilai ini dianggap 'Cukup'.</span
			>
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Batas atas Baik</span>
			<input
				id="krit-baik"
				type="number"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
				bind:value={localBaik}
				min="0"
				max="100"
				aria-label="Batas atas nilai baik"
			/>
			<span class="text-xs text-slate-500 dark:text-zinc-400">
				(nilai di atas batas Cukup hingga nilai ini dianggap 'Baik').
			</span>
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
				>Batas atas Sangat Baik</span
			>
			<input
				id="krit-sangat"
				class="h-9 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs text-slate-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
				disabled
				value={`≥ ${Number(localBaik || 0) + 1}`}
				aria-label="Sangat Baik"
			/>
			<span class="text-xs text-slate-500 dark:text-zinc-400">
				Diambil otomatis sebagai nilai di atas batas 'Baik'.
			</span>
		</label>
	</div>

	<div class="flex flex-wrap items-center justify-between gap-2 pt-1">
		<button
			type="button"
			class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			onclick={() => {
				localCukup = 85;
				localBaik = 95;
			}}
		>
			Reset ke default
		</button>
		<label class="inline-flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				id="krit-clear"
				class="checkbox checkbox-sm rounded border-[#7e8b9b] checked:border-blue-600 checked:bg-blue-600 checked:text-white dark:border-zinc-600"
			/>
			<span class="text-xs text-slate-700 dark:text-zinc-300">Kembalikan ke setelan sekolah</span>
		</label>
	</div>
	<div
		role="alert"
		class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
	>
		<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0" />
		<span
			>Hati-hati dalam menentukan <strong>batas atas nilai Cukup</strong>; jika bentrok dengan nilai
			KKM akan menyebabkan error.</span
		>
	</div>
	<div
		role="alert"
		class="flex items-start gap-2 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3.5 py-2.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
	>
		<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
		<span>
			Pengaturan ini disimpan per kelas dan berlaku untuk kelas yang sedang aktif. Setiap wali kelas
			dapat menyetel kriteria sendiri tanpa memengaruhi kelas lain.</span
		>
	</div>
</div>
