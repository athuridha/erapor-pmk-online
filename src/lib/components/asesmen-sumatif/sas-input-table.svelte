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
	class="mt-2 overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
>
	<table class="w-full border-collapse text-xs">
		<thead>
			<tr
				class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
			>
				<th class="w-12 min-w-10 px-3.5 py-2.5">No</th>
				<th class="w-full min-w-52 px-3.5 py-2.5">Jenis Tes</th>
				<th class="min-w-36 px-3.5 py-2.5">Nilai</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
			<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
				<td class="px-3.5 py-2.5 text-slate-500 dark:text-zinc-400">1</td>
				<td class="px-3.5 py-2.5 font-medium text-slate-900 dark:text-zinc-100">{tesLabel}</td>
				<td class="px-3.5 py-2.5">
					<input
						type="number"
						name={`${namePrefix}Tes`}
						class={getInputClass(tesText)}
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
				</td>
			</tr>
			<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
				<td class="px-3.5 py-2.5 text-slate-500 dark:text-zinc-400">2</td>
				<td class="px-3.5 py-2.5 font-medium text-slate-900 dark:text-zinc-100">{nonTesLabel}</td>
				<td class="px-3.5 py-2.5">
					<input
						type="number"
						name={`${namePrefix}NonTes`}
						class={getInputClass(nonTesText)}
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
				</td>
			</tr>
		</tbody>
	</table>
</div>
