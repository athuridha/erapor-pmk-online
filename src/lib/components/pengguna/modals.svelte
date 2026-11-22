<script lang="ts">
	import { page } from '$app/state';
	import ProfilGuru from '../../../routes/(admin)/master-data/pegawai/[id]/+page.svelte';
	import PenggunaForm from '../../../routes/pengguna/form/[[id]]/+page.svelte';

	const modalName = $derived(page.state.modal?.name);
	const isForm = $derived(modalName === 'add-pengguna' || modalName === 'edit-pengguna');
</script>

{#if isForm}
	<dialog
		class="modal bg-slate-950/45 backdrop-blur-[2px]"
		onclose={() => history.back()}
		open
		onclick={(e) => {
			const box = e.currentTarget.querySelector('.modal-box');
			if (box && e.target instanceof Node && !box.contains(e.target)) e.currentTarget.close();
		}}
	>
		<div
			class="modal-box max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<PenggunaForm data={page.state.modal?.data} modal onclose={() => history.back()} />
		</div>
	</dialog>
{:else if modalName === 'profil-guru'}
	<dialog
		class="modal bg-slate-950/45 backdrop-blur-[2px]"
		onclose={() => history.back()}
		open
		onclick={(e) => {
			const box = e.currentTarget.querySelector('.modal-box');
			if (box && e.target instanceof Node && !box.contains(e.target)) e.currentTarget.close();
		}}
	>
		<div
			class="modal-box max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<ProfilGuru data={page.state.modal?.data} modal onclose={() => history.back()} />
		</div>
	</dialog>
{/if}
