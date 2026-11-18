<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	interface Props {
		nilaiAkhirText: string;
		errorMessage: string | null;
		onInput?: (value: string) => void;
	}

	let { nilaiAkhirText, errorMessage, onInput }: Props = $props();
	let nilaiAkhirOverride = $state<string | null>(null);
	const nilaiAkhirValue = $derived.by(() => nilaiAkhirOverride ?? nilaiAkhirText);

	$effect(() => {
		if (nilaiAkhirOverride != null && nilaiAkhirOverride === nilaiAkhirText) {
			nilaiAkhirOverride = null;
		}
	});

	function handleInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		nilaiAkhirOverride = target.value;
		onInput?.(target.value);
	}
</script>

<div class="flex flex-col gap-4">
	<div
		class="mt-1 flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
	>
		<Icon name="alert" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
		<span>
			Menggunakan fitur ini membuat penilaian menjadi tidak objektif. Resiko dan beban moral
			ditanggung masing-masing.
		</span>
	</div>

	<label class="flex flex-col gap-1.5">
		<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
			Target nilai akhir untuk ditampilkan di rapor
		</span>
		<input
			class="h-9 w-full rounded-xl border px-3 text-xs focus:outline-none {errorMessage
				? 'border-red-400 bg-red-50/40 text-red-900 focus:border-red-600 dark:border-red-700 dark:bg-red-950/30 dark:text-red-200'
				: 'border-[#7e8b9b] bg-white text-slate-900 focus:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100'}"
			placeholder="Contoh: 87.5"
			type="number"
			min="0"
			max="100"
			step="0.01"
			autocomplete="off"
			value={nilaiAkhirValue}
			oninput={handleInput}
		/>
		{#if errorMessage}
			<span class="text-[11px] font-medium text-red-600 dark:text-red-400">{errorMessage}</span>
		{/if}
	</label>

	<p class="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
		Nilai akan dibagikan secara acak ke setiap tujuan pembelajaran dengan memastikan total akhir
		sesuai dengan target yang dimasukkan.
	</p>
</div>
