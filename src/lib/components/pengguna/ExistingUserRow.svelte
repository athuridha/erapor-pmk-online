<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	let { u, onEdit, onOpenUser, onDelete = undefined, onSwitch = undefined } = $props();
	const isMasterAdmin = $derived(u.id === 1 || u.username?.toLowerCase() === 'admin');
</script>

<td>{u.pegawaiName ?? u.username}</td>
<td>{(u.roles ?? []).join(', ')}</td>
<td>{u.pegawaiNik || u.username || '-'}</td>
<td>
	<div class="flex flex-row items-center gap-1">
		{#if onSwitch && !isMasterAdmin}
			<button
				class="btn btn-sm btn-ghost btn-square text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shadow-none"
				title="Beralih ke akun ini (Switch User)"
				onclick={() => onSwitch?.(u)}
			>
				<Icon name="repeat" />
			</button>
		{/if}
		<button
			class="btn btn-sm btn-soft {isMasterAdmin ? 'rounded-btn' : 'rounded-r-none'} shadow-none"
			title="Edit pengguna"
			onclick={() => onEdit?.(u)}
		>
			<Icon name="edit" />
		</button>
		{#if !isMasterAdmin}
			<button
				class="btn btn-sm btn-error btn-soft rounded-l-none shadow-none"
				title="Hapus pengguna"
				onclick={() => onDelete?.(u)}
			>
				<Icon name="del" />
			</button>
		{/if}
	</div>
</td>
<td>
	<button
		class="btn btn-sm btn-soft shadow-none"
		title="Atur hak akses"
		type="button"
		onclick={(e) => {
			e.preventDefault();
			if (!u.isNew) onOpenUser?.(u);
		}}
		disabled={!!u.isNew}
	>
		<Icon name="key" />
	</button>
</td>
