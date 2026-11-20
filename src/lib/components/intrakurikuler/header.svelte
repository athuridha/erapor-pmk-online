<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/icon.svelte';

	let {
		mapelDisplayName,
		mapelKelasNama,
		kelasAktifLabel,
		importTooltip,
		isImportDisabled,
		onOpenImport,
		showAgamaSelect,
		isAgamaSelectLocked = false,
		agamaSelectId,
		agamaOptions,
		selectedAgamaId,
		onAgamaChange,
		onAgamaElementMounted,
		onBack,
		handlePrimaryActionClick,
		isTambahTpDisabled,
		tambahTpTooltip,
		onGenerate,
		isGenerateDisabled = false,
		generateTooltip = undefined,
		hasSelection,
		isInteractionLocked,
		isCreateModeActive,
		isEditModeActive,
		submitActiveForm,
		activeFormId,
		isFormSubmitting,
		isEditingBobot,
		hasGroups,
		toggleBobotEditing,
		kelasDiampuLain = [],
		onOpenSyncModal
	} = $props();

	let agamaEl = $state<HTMLSelectElement | null>(null);

	onMount(() => {
		if (onAgamaElementMounted && agamaEl) onAgamaElementMounted(agamaEl as HTMLSelectElement);
	});

	// Ensure the select element reflects the locked/disabled state for
	// accessibility and visual affordance. Use $effect (runes mode) instead
	// of legacy `$:` reactive statements.
	$effect(() => {
		if (!agamaEl) return;
		const el = agamaEl as HTMLSelectElement;
		el.disabled = Boolean(isAgamaSelectLocked);
		if (isAgamaSelectLocked) {
			el.setAttribute('aria-disabled', 'true');
			el.classList.add('opacity-50', 'pointer-events-none');
		} else {
			el.removeAttribute('aria-disabled');
			el.classList.remove('opacity-50', 'pointer-events-none');
		}
	});
</script>

<div class="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
	<div class="sm:flex-1">
		<h2 class="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
			<span class="font-normal text-slate-400 dark:text-zinc-500">Mata Pelajaran:</span>
			{mapelDisplayName} - {mapelKelasNama}
		</h2>
		{#if kelasAktifLabel}
			<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
				Kelas aktif: <span class="font-medium text-slate-800 dark:text-zinc-200"
					>{kelasAktifLabel}</span
				>
			</p>
		{:else}
			<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
				Pilih kelas pada pemilih kelas untuk melihat mata pelajaran intrakurikuler.
			</p>
		{/if}
	</div>

	<button
		class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 max-sm:hidden sm:w-auto sm:max-w-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
		type="button"
		onclick={() => onOpenImport && onOpenImport()}
		disabled={isImportDisabled}
		aria-disabled={isImportDisabled}
		title={importTooltip}
	>
		<Icon name="import" class="h-3.5 w-3.5" />
		Import TP
	</button>
</div>

<div class="mb-2 grid grid-cols-2 gap-2 sm:hidden">
	<button
		class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
		type="button"
		onclick={() => onBack?.()}
	>
		<Icon name="left" class="h-3.5 w-3.5" />
		Kembali
	</button>

	<button
		class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
		type="button"
		onclick={() => onOpenImport && onOpenImport()}
		disabled={isImportDisabled}
		aria-disabled={isImportDisabled}
		title={importTooltip}
	>
		<Icon name="import" class="h-3.5 w-3.5" />
		Import TP
	</button>
</div>

<!-- action row -->
<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
	<button
		class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 max-sm:hidden dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
		type="button"
		onclick={() => onBack?.()}
	>
		<Icon name="left" class="h-3.5 w-3.5" />
		Kembali
	</button>

	{#if showAgamaSelect}
		<div class="relative flex items-center sm:w-60">
			<select
				class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				id={agamaSelectId}
				bind:this={agamaEl}
				aria-label="Pilih Agama"
				value={selectedAgamaId}
				onchange={(e) => onAgamaChange && onAgamaChange(e)}
				disabled={isAgamaSelectLocked}
				title={isAgamaSelectLocked
					? 'Dipilih dan dikunci sesuai dengan tugas guru mapel agama'
					: undefined}
			>
				<option value="" disabled>Pilih Agama</option>
				{#each agamaOptions as option (option.id)}
					<option value={option.id.toString()}>{option.label}</option>
				{/each}
			</select>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
			>
				<Icon name="down" class="h-3.5 w-3.5" />
			</span>
		</div>
	{/if}

	{#if onGenerate}
		<button
			class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200/80 bg-blue-50 px-3.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:max-w-40 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
			type="button"
			onclick={() => onGenerate && onGenerate()}
			disabled={isGenerateDisabled}
			aria-disabled={isGenerateDisabled}
			title={generateTooltip}
		>
			<Icon name="sparkles" class="h-3.5 w-3.5" />
			Generate
		</button>
	{/if}

	{#if onOpenSyncModal && kelasDiampuLain && kelasDiampuLain.length > 0}
		<button
			class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200/80 bg-blue-50 px-3.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 sm:w-auto dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
			type="button"
			onclick={() => onOpenSyncModal && onOpenSyncModal()}
			title="Sinkronkan TP dari kelas ini ke {kelasDiampuLain.length} kelas lain yang diampu"
		>
			<Icon name="repeat" class="h-3.5 w-3.5" />
			<span>Sinkronkan ke Kelas Lain ({kelasDiampuLain.length})</span>
		</button>
	{/if}

	<div class="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:items-center">
		<button
			class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:max-w-40 {hasSelection
				? 'border border-red-200/80 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950'
				: isInteractionLocked
					? 'border border-amber-200/80 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950'
					: 'border border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800'}"
			type="button"
			onclick={() => handlePrimaryActionClick && handlePrimaryActionClick()}
			disabled={isTambahTpDisabled}
			aria-disabled={isTambahTpDisabled}
			title={tambahTpTooltip}
		>
			<Icon
				name={hasSelection ? 'del' : isInteractionLocked ? 'close' : 'plus'}
				class="h-3.5 w-3.5"
			/>
			{hasSelection ? 'Hapus TP' : isInteractionLocked ? 'Batalkan' : 'Tambah TP'}
		</button>

		{#if isCreateModeActive || isEditModeActive}
			<button
				class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:max-w-40"
				type="button"
				onclick={() => submitActiveForm && submitActiveForm()}
				disabled={!activeFormId || isFormSubmitting}
				aria-busy={isFormSubmitting}
			>
				<Icon name="save" class="h-3.5 w-3.5" />
				Simpan
			</button>
		{:else}
			<button
				class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:max-w-40 {isEditingBobot
					? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
					: 'border border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800'}"
				type="button"
				onclick={() => toggleBobotEditing && toggleBobotEditing()}
				disabled={!hasGroups}
			>
				<Icon name="percent" class="h-3.5 w-3.5" />
				{isEditingBobot ? 'Simpan Bobot' : 'Atur Bobot'}
			</button>
		{/if}
	</div>
</div>
