<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { showModal, hideModal, setLoading } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import Icon from '$lib/components/icon.svelte';

	interface Props {
		onAction?: (actions: { submit: () => Promise<void>; cancel: () => void }) => void;
		existingKegiatan?: {
			kode: string;
			nama: string;
			durasi: number | null;
			soundFileName?: string | null;
		};
	}

	let { onAction, existingKegiatan }: Props = $props();

	let isEdit = $derived(existingKegiatan !== undefined);

	let submitting = $state(false);
	// svelte-ignore state_referenced_locally
	let nama = $state(existingKegiatan?.nama ?? '');
	// svelte-ignore state_referenced_locally
	let kode = $state(existingKegiatan?.kode ?? '');
	// svelte-ignore state_referenced_locally
	let durasi = $state(existingKegiatan?.durasi?.toString() ?? '');
	let soundFile: File | null = $state(null);
	// svelte-ignore state_referenced_locally
	let soundFileName = $state(existingKegiatan?.soundFileName ?? '');
	let hapusSound = $state(false);

	$effect(() => {
		nama = existingKegiatan?.nama ?? '';
		kode = existingKegiatan?.kode ?? '';
		durasi = existingKegiatan?.durasi?.toString() ?? '';
		soundFileName = existingKegiatan?.soundFileName ?? '';
		soundFile = null;
		hapusSound = false;
	});

	function normalizeKode(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
		kode = input.value;
	}

	function handleFileSelect(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			if (file.size > 2 * 1024 * 1024) {
				toast('Ukuran file maksimal 2MB', 'warning');
				input.value = '';
				return;
			}
			if (!file.name.toLowerCase().endsWith('.mp3') && file.type !== 'audio/mpeg') {
				showModal({
					title: 'Format Tidak Didukung',
					body: 'Hanya file MP3 yang dapat diterima. Silakan convert file Anda ke format MP3 terlebih dahulu.',
					onPositive: { label: 'OK', action: async ({ close }) => close() },
					dismissible: false
				});
				input.value = '';
				return;
			}
			soundFile = file;
			soundFileName = file.name;
			hapusSound = false;
		}
	}

	function handleHapusSound() {
		soundFile = null;
		soundFileName = '';
		hapusSound = true;
	}

	async function handleSubmit() {
		if (!nama.trim() || !kode.trim()) {
			toast('Nama dan kode harus diisi', 'warning');
			return;
		}

		submitting = true;
		setLoading(true);
		const formData = new FormData();
		formData.append('nama', nama.trim());
		formData.append('kode', kode.trim());
		if (durasi) formData.append('durasi', durasi);
		if (isEdit) {
			formData.append('kodeLama', existingKegiatan!.kode);
			if (hapusSound) formData.append('hapusSound', '1');
		}
		if (soundFile) formData.append('sound', soundFile);

		try {
			const action = isEdit ? '?/editKegiatan' : '?/tambahKegiatan';
			const response = await fetch(action, {
				method: 'POST',
				body: formData,
				redirect: 'error'
			});

			if (!response.ok) {
				const err = await response
					.json()
					.catch(() => ({ fail: 'Gagal ' + (isEdit ? 'mengedit' : 'menambah') + ' kegiatan' }));
				throw new Error(err.fail ?? `Error ${response.status}`);
			}

			hideModal();
			toast(isEdit ? 'Kegiatan berhasil diedit' : 'Kegiatan berhasil ditambahkan', 'success');
			await invalidate('app:jadwal-bell');
		} catch (e) {
			toast(
				e instanceof Error
					? e.message
					: 'Gagal ' + (isEdit ? 'mengedit' : 'menambah') + ' kegiatan',
				'error'
			);
		} finally {
			submitting = false;
			setLoading(false);
		}
	}

	function handleCancel() {
		hideModal();
	}

	$effect(() => {
		onAction?.({ submit: handleSubmit, cancel: handleCancel });
	});
</script>

<div class="not-prose flex flex-col gap-4">
	<label class="flex flex-col gap-1.5">
		<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Nama Kegiatan</span>
		<input
			type="text"
			class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
			bind:value={nama}
			placeholder="Contoh: Literasi, Senam Pagi"
			disabled={submitting}
		/>
	</label>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<label class="flex min-w-0 flex-col gap-1.5">
			<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Kode</span>
			<input
				type="text"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 uppercase placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={kode}
				oninput={normalizeKode}
				placeholder="Contoh: LIT, SP"
				maxlength={10}
				disabled={submitting}
			/>
			<p class="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
				Kode akan otomatis dikapitalisasi. Maksimal 10 karakter.
			</p>
		</label>
		<label class="flex min-w-0 flex-col gap-1.5">
			<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Durasi (menit)</span>
			<input
				type="number"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={durasi}
				placeholder="Contoh: 20"
				min="1"
				disabled={submitting}
			/>
			<p class="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
				Opsional, kosongkan jika sama dengan 1 jam pelajaran
			</p>
		</label>
	</div>
	<fieldset class="space-y-1.5">
		<legend class="text-xs font-medium text-slate-700 dark:text-zinc-300"
			>Sound Kegiatan (opsional)</legend
		>
		<div class="flex items-center gap-2">
			<input
				type="file"
				class="file-input file-input-bordered file-input-sm w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				accept=".mp3,audio/mpeg"
				onchange={handleFileSelect}
				disabled={submitting}
			/>
			{#if soundFileName}
				<button
					type="button"
					class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
					onclick={handleHapusSound}
					aria-label="Hapus sound"
				>
					<Icon name="del" class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>
		<p class="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
			MP3/audio, maksimal 2MB. Akan dibunyikan saat kegiatan ini dimulai.
		</p>
	</fieldset>
</div>
