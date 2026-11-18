<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { createEventDispatcher } from 'svelte';

	export let open: boolean;
	export let lingkup: number;
	export let sts: number;
	export let sas: number;
	export let lingkupRts: number;
	export let stsRts: number;
	export let loading: boolean = false;
	export let saving: boolean = false;
	export let error: string | null = null;

	// RAS state
	let lingkupLocal: number | string = lingkup;
	let stsLocal: number | string = sts;
	let sasLocal: number | string = sas;

	let initialLingkup: number | string = lingkup;
	let initialSts: number | string = sts;
	let initialSas: number | string = sas;

	// RTS state
	let lingkupRtsLocal: number | string = lingkupRts;
	let stsRtsLocal: number | string = stsRts;

	let initialLingkupRts: number | string = lingkupRts;
	let initialStsRts: number | string = stsRts;

	let activeTab: string = 'ras';

	const dispatch = createEventDispatcher();

	$: totalRas = (Number(lingkupLocal) || 0) + (Number(stsLocal) || 0) + (Number(sasLocal) || 0);
	$: totalRts = (Number(lingkupRtsLocal) || 0) + (Number(stsRtsLocal) || 0);
	$: currentTotal = activeTab === 'ras' ? totalRas : totalRts;
	$: isComplete = currentTotal === 100;

	function close() {
		dispatch('close');
	}

	function reset() {
		if (activeTab === 'ras') {
			lingkupLocal = initialLingkup;
			stsLocal = initialSts;
			sasLocal = initialSas;
			dispatch('reset', {
				lingkup: Number(initialLingkup) || 0,
				sts: Number(initialSts) || 0,
				sas: Number(initialSas) || 0,
				rapor: 'ras'
			});
		} else {
			lingkupRtsLocal = initialLingkupRts;
			stsRtsLocal = initialStsRts;
			dispatch('reset', {
				lingkup: Number(initialLingkupRts) || 0,
				sts: Number(initialStsRts) || 0,
				rapor: 'rts'
			});
		}
	}

	function save() {
		if (activeTab === 'ras') {
			dispatch('save', {
				lingkup: Number(lingkupLocal) || 0,
				sts: Number(stsLocal) || 0,
				sas: Number(sasLocal) || 0,
				rapor: 'ras'
			});
		} else {
			dispatch('save', {
				lingkup: Number(lingkupRtsLocal) || 0,
				sts: Number(stsRtsLocal) || 0,
				rapor: 'rts'
			});
		}
	}

	$: if (open) {
		initialLingkup = lingkup;
		initialSts = sts;
		initialSas = sas;
		lingkupLocal = lingkup;
		stsLocal = sts;
		sasLocal = sas;

		initialLingkupRts = lingkupRts;
		initialStsRts = stsRts;
		lingkupRtsLocal = lingkupRts;
		stsRtsLocal = stsRts;
	}
</script>

<input id="sumatif-bobot-modal" type="checkbox" class="modal-toggle" bind:checked={open} hidden />
<div
	class="modal bg-slate-950/45 backdrop-blur-[2px]"
	class:modal-open={open}
	aria-hidden={!open}
	onclick={(e) => {
		if (e.target === e.currentTarget) close();
	}}
>
	<div
		class="modal-box max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<div class="border-b border-slate-100 pb-3 dark:border-zinc-800">
			<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">
				Atur Bobot Default - Sumatif
			</h3>
			<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
				Atur distribusi bobot default untuk perhitungan nilai akhir sumatif.
			</p>
		</div>

		<div
			role="tablist"
			class="mt-4 inline-flex w-full rounded-xl border border-slate-200/80 bg-slate-50 p-1 dark:border-zinc-700 dark:bg-zinc-800"
		>
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'ras'}
				class="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {activeTab ===
				'ras'
					? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
					: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
				onclick={() => (activeTab = 'ras')}
			>
				Rapor Akhir Semester
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'rts'}
				class="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {activeTab ===
				'rts'
					? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
					: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
				onclick={() => (activeTab = 'rts')}
			>
				Rapor Tengah Semester
			</button>
		</div>

		<div class="mt-4 space-y-3">
			{#if activeTab === 'ras'}
				<div>
					<label
						for="bobot-ras-lingkup"
						class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Lingkup Materi (%)
					</label>
					<input
						id="bobot-ras-lingkup"
						type="number"
						min="0"
						max="100"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={lingkupLocal}
						disabled={loading || saving}
					/>
				</div>
				<div>
					<label
						for="bobot-ras-sts"
						class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Sumatif Tengah Semester (STS) (%)
					</label>
					<input
						id="bobot-ras-sts"
						type="number"
						min="0"
						max="100"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={stsLocal}
						disabled={loading || saving}
					/>
				</div>
				<div>
					<label
						for="bobot-ras-sas"
						class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Sumatif Akhir Semester (SAS) (%)
					</label>
					<input
						id="bobot-ras-sas"
						type="number"
						min="0"
						max="100"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={sasLocal}
						disabled={loading || saving}
					/>
				</div>
			{:else}
				<div>
					<label
						for="bobot-rts-lingkup"
						class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Lingkup Materi (%)
					</label>
					<input
						id="bobot-rts-lingkup"
						type="number"
						min="0"
						max="100"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={lingkupRtsLocal}
						disabled={loading || saving}
					/>
				</div>
				<div>
					<label
						for="bobot-rts-sts"
						class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Sumatif Tengah Semester (STS) (%)
					</label>
					<input
						id="bobot-rts-sts"
						type="number"
						min="0"
						max="100"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={stsRtsLocal}
						disabled={loading || saving}
					/>
				</div>
			{/if}
		</div>

		<div class="mt-4 text-xs">
			{#if loading}
				<p class="text-slate-500 dark:text-zinc-400">Memuat bobot...</p>
			{/if}
			<p class="text-slate-700 dark:text-zinc-300">
				Total: <strong class="text-slate-900 dark:text-zinc-100">{currentTotal}%</strong>
			</p>
			{#if error}
				<p class="mt-1.5 font-medium text-red-600 dark:text-red-400">{error}</p>
			{:else if !isComplete}
				<p class="mt-1.5 font-medium text-amber-600 dark:text-amber-400">
					Perhatian: jumlah bobot belum 100%.
				</p>
			{/if}
		</div>

		<div
			class="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800"
		>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 max-sm:me-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={close}
			>
				<Icon name="left" class="h-3.5 w-3.5" />
				Batal
			</button>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 sm:ml-auto dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
				onclick={reset}
				disabled={saving}>Reset</button
			>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
				onclick={save}
				disabled={saving || !isComplete}
			>
				{#if saving}Menyimpan...{:else}Simpan{/if}
			</button>
		</div>
	</div>
</div>
