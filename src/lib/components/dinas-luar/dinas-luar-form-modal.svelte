<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { hideModal, updateModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { onMount } from 'svelte';

	let maksud = $state('');
	let file = $state<File | null>(null);
	let submitting = $state(false);

	onMount(() => {
		updateModal({
			onPositive: {
				label: 'Ajukan',
				class: 'btn-primary',
				action: () => void submit()
			},
			onNegative: undefined,
			onNeutral: { label: 'Batal', action: () => hideModal() },
			spreadActions: true
		});
	});

	function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const selected = input.files?.[0] ?? null;
		if (!selected) {
			file = null;
			return;
		}
		if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
			toast('File undangan harus berupa PDF', 'warning');
			input.value = '';
			file = null;
			return;
		}
		file = selected;
	}

	async function submit() {
		if (submitting) return;

		if (!maksud.trim()) {
			toast('Maksud perjalanan dinas wajib diisi', 'warning');
			return;
		}

		submitting = true;
		try {
			const formData = new FormData();
			formData.set('maksud', maksud.trim());
			if (file) {
				formData.set('undangan', file);
			}
			const res = await fetch('/api/dinas-luar', {
				method: 'POST',
				body: formData
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(
					(data as { message?: string }).message ?? `Terjadi kesalahan (${res.status})`
				);
			}
			hideModal();
			await invalidate('app:dinas-luar');
			toast(
				(data as { message?: string }).message ?? 'Permohonan perjalanan dinas berhasil disimpan',
				'success'
			);
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menyimpan data', 'error');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="not-prose flex flex-col gap-4">
	<div>
		<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
			Unggah file undangan kegiatan perjalanan dinas
		</span>
		<input
			type="file"
			class="file-input file-input-bordered w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
			accept=".pdf,application/pdf"
			onchange={handleFileChange}
			disabled={submitting}
		/>
		<p class="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Opsional. Format PDF.</p>
	</div>

	<div>
		<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
			Maksud Perjalanan Dinas
			<span class="text-red-500">*</span>
		</span>
		<textarea
			class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			bind:value={maksud}
			placeholder="Contoh: Menghadiri undangan rapat koordinasi, seminar, dsb."
			rows={3}
			disabled={submitting}></textarea>
	</div>
</div>
