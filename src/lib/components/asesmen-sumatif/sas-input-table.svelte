<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Props {
		tesText: string;
		nonTesText: string;
		getInputClass: (value: string) => string;
		/** prefix used for input `name` attributes, e.g. 'sas' or 'sts' */
		namePrefix?: string;
		/** label for the tes row */
		tesLabel?: string;
		/** label for the non-tes row */
		nonTesLabel?: string;
	}

	let {
		tesText,
		nonTesText,
		getInputClass,
		namePrefix = 'sas',
		tesLabel = 'Nilai Tes Sumatif Akhir Semester (SAS)',
		nonTesLabel = 'Nilai Non Tes Sumatif Akhir Semester (SAS)'
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		sasChange: { namePrefix: string; target: 'tes' | 'nonTes'; value: string };
	}>();

	function handleInput(targetKey: 'tes' | 'nonTes', event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		dispatch('sasChange', { namePrefix, target: targetKey, value: target.value });
	}
</script>

<div
	class="mt-2 overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="hidden border-b border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 text-xs font-semibold text-slate-600 sm:grid sm:grid-cols-[3rem_1fr_9.5rem] sm:gap-2 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
	>
		<div>No</div>
		<div>Jenis Tes</div>
		<div>Nilai</div>
	</div>

	<div class="divide-y divide-slate-100 dark:divide-zinc-800/80">
		<div
			class="flex flex-col gap-2 p-3.5 transition-colors hover:bg-slate-50/70 sm:grid sm:grid-cols-[3rem_1fr_9.5rem] sm:items-center sm:gap-2 sm:px-3.5 sm:py-2.5 dark:hover:bg-zinc-800/40"
		>
			<div class="hidden text-xs text-slate-500 tabular-nums sm:block dark:text-zinc-400">1</div>
			<label
				for={`${namePrefix}-tes-input`}
				class="text-sm font-medium text-slate-900 sm:text-xs dark:text-zinc-100"
			>
				{tesLabel}
			</label>
			<div>
				<input
					id={`${namePrefix}-tes-input`}
					type="number"
					name={`${namePrefix}Tes`}
					class="{getInputClass(
						tesText
					)} h-11 text-center font-mono text-base font-bold sm:h-9 sm:text-left sm:text-xs"
					value={tesText}
					placeholder="Isi nilai"
					min="0"
					max="100"
					step="0.01"
					inputmode="decimal"
					title="Rentang 0-100 dengan maksimal 2 angka desimal"
					spellcheck="false"
					oninput={(event) => handleInput('tes', event)}
				/>
			</div>
		</div>

		<div
			class="flex flex-col gap-2 p-3.5 transition-colors hover:bg-slate-50/70 sm:grid sm:grid-cols-[3rem_1fr_9.5rem] sm:items-center sm:gap-2 sm:px-3.5 sm:py-2.5 dark:hover:bg-zinc-800/40"
		>
			<div class="hidden text-xs text-slate-500 tabular-nums sm:block dark:text-zinc-400">2</div>
			<label
				for={`${namePrefix}-nontes-input`}
				class="text-sm font-medium text-slate-900 sm:text-xs dark:text-zinc-100"
			>
				{nonTesLabel}
			</label>
			<div>
				<input
					id={`${namePrefix}-nontes-input`}
					type="number"
					name={`${namePrefix}NonTes`}
					class="{getInputClass(
						nonTesText
					)} h-11 text-center font-mono text-base font-bold sm:h-9 sm:text-left sm:text-xs"
					value={nonTesText}
					placeholder="Isi nilai"
					min="0"
					max="100"
					step="0.01"
					inputmode="decimal"
					title="Rentang 0-100 dengan maksimal 2 angka desimal"
					spellcheck="false"
					oninput={(event) => handleInput('nonTes', event)}
				/>
			</div>
		</div>
	</div>
</div>
