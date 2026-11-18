<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { onMount } from 'svelte';
	import { agamaVariantOptions } from '$lib/statics';

	interface Props {
		// callback supplied by caller to retrieve current selection
		setGetter?: (fn: () => string) => void;
		options?: { key: string; label: string; name: string }[];
	}

	let { setGetter, options = agamaVariantOptions }: Props = $props();

	// svelte-ignore state_referenced_locally
	let selectedKey = $state(options?.[0]?.key ?? 'islam');
	// unique id for label association
	let selectId = $state('agama-select-' + Math.random().toString(36).slice(2, 9));

	onMount(() => {
		if (typeof setGetter === 'function') {
			// expose a getter closure that reads the reactive selectedKey
			setGetter(() => selectedKey);
		}
	});
</script>

<div class="w-full space-y-1.5">
	<label for={selectId} class="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
		Pilih Agama
	</label>

	<div class="relative flex items-center">
		<select
			id={selectId}
			class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
			bind:value={selectedKey}
			aria-label="Pilih agama"
		>
			{#each options as opt (opt.key)}
				<option class="text-wrap" value={opt.key}>{opt.label}</option>
			{/each}
		</select>
		<span
			aria-hidden="true"
			class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
		>
			<Icon name="down" class="h-3.5 w-3.5" />
		</span>
	</div>

	<p class="text-[11px] text-slate-500 dark:text-zinc-400">
		Contoh nama mapel di file: <strong class="text-slate-700 dark:text-zinc-200"
			>{options.find((o) => o.key === selectedKey)?.name}</strong
		>
	</p>
</div>
