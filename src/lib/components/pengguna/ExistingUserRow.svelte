<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	let { u, onEdit, onOpenUser, onDelete = undefined, onSwitch = undefined } = $props();
	const isMasterAdmin = $derived(u.id === 1 || u.username?.toLowerCase() === 'admin');
</script>

<td class="px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100"
	>{u.pegawaiName ?? u.pegawaiNik ?? u.username}</td
>
<td class="px-3 py-2.5 text-slate-700 dark:text-zinc-300">{(u.roles ?? []).join(', ')}</td>
<td class="px-3 py-2.5 font-mono text-xs text-slate-700 dark:text-zinc-300"
	>{u.pegawaiNik || u.username || '-'}</td
>
<td class="px-3 py-2.5">
	<div class="flex flex-row items-center gap-1">
		{#if onSwitch && !isMasterAdmin}
			<button
				class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950"
				title="Beralih ke akun ini (Switch User)"
				onclick={() => onSwitch?.(u)}
			>
				<Icon name="repeat" class="h-3.5 w-3.5" />
			</button>
		{/if}
		<div class="flex flex-row">
			<button
				class="inline-flex h-8 w-8 items-center justify-center border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 {isMasterAdmin
					? 'rounded-lg'
					: 'rounded-l-lg'}"
				title="Edit pengguna"
				onclick={() => onEdit?.(u)}
			>
				<Icon name="edit" class="h-3.5 w-3.5" />
			</button>
			{#if !isMasterAdmin}
				<button
					class="inline-flex h-8 w-8 items-center justify-center rounded-r-lg border-y border-r border-slate-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-zinc-700 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
					title="Hapus pengguna"
					onclick={() => onDelete?.(u)}
				>
					<Icon name="del" class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>
	</div>
</td>
<td class="px-3 py-2.5">
	<button
		class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
		title="Atur hak akses"
		type="button"
		onclick={(e) => {
			e.preventDefault();
			if (!u.isNew) onOpenUser?.(u);
		}}
		disabled={!!u.isNew}
	>
		<Icon name="key" class="h-3.5 w-3.5" />
	</button>
</td>
