<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';

	type KelasPilihan = { id: number; nama: string; fase: string | null };

	let { variant = 'navbar' }: { variant?: 'navbar' | 'mobile' } = $props();

	/**
	 * Local class selector: updates `?kelas_id=` for the active route without
	 * writing the global `active-kelas-id` cookie.
	 */
	const picker = $derived(
		(
			page.data as {
				kelasPicker?: {
					tampil?: boolean;
					currentId?: number | null;
					bolehSemuaKelas?: boolean;
					pilihan?: KelasPilihan[];
				} | null;
			}
		).kelasPicker ?? null
	);
	const pilihan = $derived(picker?.pilihan ?? []);
	const selectId = $derived(
		variant === 'mobile' ? 'kelas-picker-lokal-mobile' : 'kelas-picker-lokal'
	);

	async function pilihKelas(event: Event) {
		const nilai = (event.currentTarget as HTMLSelectElement).value;
		const params = new URLSearchParams(page.url.search);
		if (nilai) params.set('kelas_id', nilai);
		else params.delete('kelas_id');
		params.delete('page');
		params.delete('murid_id');
		params.delete('mapel_id');
		const query = params.toString();
		await goto(`${page.url.pathname}${query ? `?${query}` : ''}`, {
			keepFocus: true,
			noScroll: true
		});
	}
</script>

{#if picker?.tampil && pilihan.length > 0}
	{#if variant === 'mobile'}
		<div class="flex w-full items-center gap-2">
			<label
				for={selectId}
				class="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300"
			>
				<span aria-hidden="true"><Icon name="users" class="h-3.5 w-3.5" /></span>
				<span>Kelas</span>
			</label>
			<div class="relative min-w-0 flex-1">
				<select
					id={selectId}
					class="h-9 w-full appearance-none rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-semibold text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					title="Pilih kelas untuk halaman ini"
					onchange={pilihKelas}
					value={picker.currentId == null
						? picker.bolehSemuaKelas
							? 'semua'
							: ''
						: String(picker.currentId)}
				>
					{#if picker.bolehSemuaKelas}
						<option value="semua">Semua Kelas</option>
					{:else if picker.currentId == null}
						<option value="" disabled>Pilih Kelas...</option>
					{/if}
					{#each pilihan as kelas (kelas.id)}
						<option value={String(kelas.id)}>
							{kelas.nama}{kelas.fase ? ` - ${kelas.fase}` : ''}
						</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</div>
	{:else}
		<div class="flex items-center">
			<label for={selectId} class="sr-only">Pilih kelas untuk halaman ini</label>
			<div class="relative flex items-center">
				<span
					aria-hidden="true"
					class="pointer-events-none absolute left-2.5 flex items-center text-slate-500 dark:text-zinc-400"
				>
					<Icon name="users" class="h-3.5 w-3.5" />
				</span>
				<select
					id={selectId}
					class="h-8 w-44 appearance-none rounded-xl border border-[#7e8b9b] bg-slate-50 pr-7 pl-8 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-100 focus:border-blue-600 focus:outline-none lg:w-52 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80 dark:focus:border-blue-400"
					title="Pilih kelas untuk halaman ini"
					onchange={pilihKelas}
					value={picker.currentId == null
						? picker.bolehSemuaKelas
							? 'semua'
							: ''
						: String(picker.currentId)}
				>
					{#if picker.bolehSemuaKelas}
						<option value="semua">Semua Kelas</option>
					{:else if picker.currentId == null}
						<option value="" disabled>Pilih Kelas...</option>
					{/if}
					{#each pilihan as kelas (kelas.id)}
						<option value={String(kelas.id)}>
							{kelas.nama}{kelas.fase ? ` - ${kelas.fase}` : ''}
						</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</div>
	{/if}
{/if}
