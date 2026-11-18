<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	let { id, mataPelajaran, newValues, onCancel, onSave } = $props();

	let showPassword = $state(false);
</script>

<td class="px-3 py-2">
	<input
		class="h-8 w-full rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
		bind:value={newValues[id].nama}
		placeholder="Nama"
	/>
</td>
<td class="overflow-hidden px-3 py-2">
	<div class="relative flex items-center">
		<select
			class="h-8 w-full appearance-none truncate rounded-lg border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
			bind:value={newValues[id].type}
		>
			<option value="admin">Admin</option>
			<option value="wali_kelas">Wali Kelas</option>
			<option value="wali_asuh">Wali Asuh</option>
			<option value="user">User</option>
		</select>
		<span
			aria-hidden="true"
			class="pointer-events-none absolute right-2 flex items-center text-slate-500 dark:text-zinc-400"
		>
			<Icon name="down" class="h-3 w-3" />
		</span>
	</div>
</td>
<td class="overflow-hidden px-3 py-2">
	<div class="relative flex items-center">
		<select
			class="h-8 w-full appearance-none truncate rounded-lg border border-[#7e8b9b] bg-white pr-7 pl-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
			bind:value={newValues[id].mataPelajaranId}
		>
			{#each mataPelajaran as m (m.id)}
				<option value={m.id}>{m.nama}</option>
			{/each}
			{#if mataPelajaran.length === 0}
				<option disabled>- tidak ada mata pelajaran -</option>
			{/if}
		</select>
		<span
			aria-hidden="true"
			class="pointer-events-none absolute right-2 flex items-center text-slate-500 dark:text-zinc-400"
		>
			<Icon name="down" class="h-3 w-3" />
		</span>
	</div>
</td>
<td class="px-3 py-2">
	<input
		class="h-8 w-full rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
		bind:value={newValues[id].username}
		placeholder="Nama pengguna"
	/>
</td>
<td class="px-3 py-2">
	<div
		class="flex h-8 w-full items-center overflow-hidden rounded-lg border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900"
	>
		<input
			type={showPassword ? 'text' : 'password'}
			class="h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-zinc-100"
			bind:value={newValues[id].password}
			placeholder="Kata sandi"
		/>
		<button
			type="button"
			class="cursor-pointer pr-2 text-slate-500 hover:text-slate-700 dark:text-zinc-400"
			onclick={() => (showPassword = !showPassword)}
			aria-label="Lihat atau sembunyikan kata sandi"
		>
			<Icon name={showPassword ? 'eye-off' : 'eye'} class="h-3.5 w-3.5" />
		</button>
	</div>
</td>
<td class="px-3 py-2">
	<div class="flex flex-row">
		<button
			class="inline-flex h-8 w-8 items-center justify-center rounded-l-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
			title="Batal"
			onclick={() => onCancel?.(id)}
		>
			<Icon name="close" class="h-3.5 w-3.5" />
		</button>
		<button
			class="inline-flex h-8 w-8 items-center justify-center rounded-r-lg bg-blue-600 text-white transition-colors hover:bg-blue-700"
			title="Simpan pengguna"
			onclick={() => onSave?.(id)}
		>
			<Icon name="save" class="h-3.5 w-3.5" />
		</button>
	</div>
</td>
