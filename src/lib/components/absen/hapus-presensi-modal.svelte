<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { hideModal, updateModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { onMount } from 'svelte';

	let {
		tanggal,
		labelTanggal,
		kelasId = 0
	}: {
		tanggal: string;
		labelTanggal: string;
		kelasId?: number;
	} = $props();

	async function handleDelete() {
		try {
			const fd = new FormData();
			fd.set('tanggal', tanggal);
			fd.set('kelasId', String(kelasId));
			const res = await fetch('?/deletePresensi', { method: 'POST', body: fd, redirect: 'error' });
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				throw new Error(body?.fail ?? `Error ${res.status}`);
			}
			toast(body?.message ?? 'Semua data presensi berhasil dihapus', 'success');
			hideModal();
			await invalidate('app:absen');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menghapus data presensi', 'error');
		}
	}

	onMount(() => {
		updateModal({
			onPositive: {
				label: 'Ya, Hapus',
				class:
					'border border-red-300 bg-red-600 text-white hover:bg-red-700 dark:border-red-800 dark:bg-red-600 dark:hover:bg-red-700',
				action: () => handleDelete()
			},
			onNegative: { label: 'Batal' }
		});
	});
</script>

<div class="flex flex-col gap-4">
	<p class="text-sm leading-relaxed text-slate-700 dark:text-zinc-200">
		Semua data presensi pada hari <strong class="font-semibold text-slate-900 dark:text-zinc-100"
			>{labelTanggal}</strong
		> ini akan dihapus. Bapak/Ibu yakin?
	</p>
</div>
