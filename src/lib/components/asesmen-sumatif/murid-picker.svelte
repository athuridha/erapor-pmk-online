<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';

	type Option = { id: number; nama: string };

	let {
		basePath,
		kelasId,
		muridId,
		mapelId,
		getDirty = () => false,
		confirmMessage
	}: {
		basePath: string;
		kelasId: number;
		muridId: number;
		mapelId: number;
		getDirty?: () => boolean;
		confirmMessage: string;
	} = $props();

	const MAX_OPSI = 80;

	let muridQuery = $state('');
	let daftarTerbuka = $state(false);
	let indeksSorot = $state(-1);
	let muridOptions = $state<Option[]>([]);
	let muridLoading = $state(false);

	// Komponen tidak remount antar navigasi route sama — buang cache daftar
	// murid saat kelas/mapel berganti agar filter agama per mapel tetap akurat.
	$effect(() => {
		void kelasId;
		void mapelId;
		muridOptions = [];
	});

	async function loadMuridOptions() {
		if (muridOptions.length || muridLoading) return;
		muridLoading = true;
		try {
			const res = await fetch(`/api/murid/daftar?kelas_id=${kelasId}&mapel_id=${mapelId}`);
			if (res.ok) muridOptions = await res.json();
		} finally {
			muridLoading = false;
		}
	}

	const muridTersaring = $derived.by(() => {
		const q = muridQuery.trim().toLowerCase();
		if (!q) return muridOptions;
		return muridOptions.filter((o) => o.nama.toLowerCase().includes(q));
	});

	function sorotGeser(delta: number) {
		const total = Math.min(muridTersaring.length, MAX_OPSI);
		if (total === 0) return;
		indeksSorot = (indeksSorot + delta + total) % total;
		document
			.getElementById(`picker-murid-opsi-${indeksSorot}`)
			?.scrollIntoView({ block: 'nearest' });
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') e.preventDefault();
		if (e.key === 'Escape') {
			daftarTerbuka = false;
			return;
		}
		if (!daftarTerbuka || muridTersaring.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			sorotGeser(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			sorotGeser(-1);
		} else if (e.key === 'Enter' && indeksSorot >= 0) {
			pilihMurid(muridTersaring[Math.min(indeksSorot, muridTersaring.length - 1)]);
		}
	}

	async function pilihMurid(murid: Option) {
		daftarTerbuka = false;
		indeksSorot = -1;
		muridQuery = '';
		if (murid.id === muridId) return;
		if (!getDirty() || confirm(confirmMessage)) {
			await goto(`${basePath}?murid_id=${murid.id}&mapel_id=${mapelId}`, { keepFocus: true });
		}
	}
</script>

<div class="relative">
	<div class="relative flex items-center">
		<span
			aria-hidden="true"
			class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
		>
			<Icon name="search" class="h-3.5 w-3.5" />
		</span>
		<input
			type="search"
			class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:h-9 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			placeholder="Ketik nama murid atau pilih di sini"
			autocomplete="off"
			role="combobox"
			aria-expanded={daftarTerbuka}
			aria-controls="daftar-murid-formulir"
			aria-activedescendant={daftarTerbuka && indeksSorot >= 0
				? `picker-murid-opsi-${indeksSorot}`
				: undefined}
			bind:value={muridQuery}
			onfocus={() => {
				void loadMuridOptions();
				daftarTerbuka = true;
				indeksSorot = -1;
			}}
			oninput={() => {
				daftarTerbuka = true;
				indeksSorot = -1;
			}}
			onblur={() => (daftarTerbuka = false)}
			onkeydown={onKeydown}
		/>
	</div>
	{#if daftarTerbuka && muridTersaring.length > 0}
		<ul
			id="daftar-murid-formulir"
			role="listbox"
			class="absolute z-50 mt-1.5 max-h-60 w-full list-none overflow-y-auto rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
		>
			{#each muridTersaring.slice(0, MAX_OPSI) as opsi, i (opsi.id)}
				<li id={`picker-murid-opsi-${i}`} role="option" aria-selected={i === indeksSorot}>
					<button
						type="button"
						class="flex w-full items-center truncate rounded-lg px-2.5 py-2.5 text-left text-sm text-slate-800 transition-colors hover:bg-blue-50/70 hover:text-blue-700 sm:py-2 sm:text-xs dark:text-zinc-200 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 {i ===
						indeksSorot
							? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
							: ''}"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => pilihMurid(opsi)}
					>
						{#if opsi.id === muridId}
							<Icon
								name="check"
								class="mr-1.5 inline size-3.5 shrink-0 text-blue-600 dark:text-blue-400"
							/>
						{/if}
						<span class="truncate">{opsi.nama}</span>
					</button>
				</li>
			{/each}
			{#if muridTersaring.length > MAX_OPSI}
				<li class="px-2.5 py-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
					{muridTersaring.length - MAX_OPSI} lainnya. Ketik untuk mempersempit.
				</li>
			{/if}
		</ul>
	{:else if daftarTerbuka && muridLoading}
		<ul
			role="listbox"
			class="absolute z-50 mt-1.5 w-full list-none rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
		>
			<li class="text-xs text-slate-500 dark:text-zinc-400">Memuat...</li>
		</ul>
	{:else if daftarTerbuka}
		<ul
			role="listbox"
			class="absolute z-50 mt-1.5 w-full list-none rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
		>
			<li class="text-xs text-slate-500 dark:text-zinc-400">Murid tidak ditemukan.</li>
		</ul>
	{/if}
</div>
