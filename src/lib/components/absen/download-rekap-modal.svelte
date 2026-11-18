<script lang="ts">
	import { hideModal } from '$lib/components/global-modal.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	const bulanList = [
		'Januari',
		'Februari',
		'Maret',
		'April',
		'Mei',
		'Juni',
		'Juli',
		'Agustus',
		'September',
		'Oktober',
		'November',
		'Desember'
	];

	const now = new Date();
	let bulan = $state(now.getMonth() + 1);
	let tahun = $state(now.getFullYear());

	let { onAction } = $props<{
		onAction?: (actions: { download: () => Promise<void>; cancel: () => void }) => void;
	}>();

	async function handleDownload() {
		try {
			const response = await fetch('/api/absen/download-rekap', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bulan,
					tahun
				})
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({ message: 'Gagal mengunduh rekap' }));
				throw new Error(err.message ?? `Error ${response.status}`);
			}

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `Rekap_Kehadiran_${bulanList[bulan - 1]}_${tahun}.xlsx`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			hideModal();
			toast('Rekap berhasil diunduh', 'success');
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Gagal mengunduh rekap';
			toast(message, 'error');
		}
	}

	function handleCancel() {
		hideModal();
	}

	$effect(() => {
		onAction?.({ download: handleDownload, cancel: handleCancel });
	});
</script>

<div class="not-prose flex flex-col gap-5">
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div>
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">Bulan</span
			>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={bulan}
				>
					{#each bulanList as nama, i (nama)}
						<option value={i + 1}>{nama}</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</div>
		<div>
			<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">Tahun</span
			>
			<input
				type="number"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={tahun}
				min="2000"
				max="2099"
			/>
		</div>
	</div>
</div>
