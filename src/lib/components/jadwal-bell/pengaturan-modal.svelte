<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showModal, hideModal, setLoading } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { isValidTime } from '$lib/utils';

	interface Props {
		jamPelajaranMenit?: number;
		durasiIstirahat?: number;
		durasiUpacara?: number;
		jamMulai?: string;
		bellSounds?: Array<{ tipe: string; fileName: string; ttsMessage?: string | null }>;
		onAction?: (actions: { submit: () => Promise<void>; cancel: () => void }) => void;
	}

	let {
		jamPelajaranMenit = 35,
		durasiIstirahat = 30,
		durasiUpacara = 70,
		jamMulai = '07:00',
		bellSounds = [],
		onAction
	}: Props = $props();

	let submitting = $state(false);
	// svelte-ignore state_referenced_locally
	let jamPelajaranMenitValue = $state(String(jamPelajaranMenit));
	// svelte-ignore state_referenced_locally
	let durasiIstirahatValue = $state(String(durasiIstirahat));
	// svelte-ignore state_referenced_locally
	let durasiUpacaraValue = $state(String(durasiUpacara));
	// svelte-ignore state_referenced_locally
	let jamMulaiValue = $state(jamMulai);

	$effect(() => {
		jamPelajaranMenitValue = String(jamPelajaranMenit);
		durasiIstirahatValue = String(durasiIstirahat);
		durasiUpacaraValue = String(durasiUpacara);
		jamMulaiValue = jamMulai;
	});

	let uploadingTipe = $state<string | null>(null);
	let playingTipe = $state<string | null>(null);

	const soundTipes = [
		{ tipe: 'upacara', label: 'Upacara' },
		{ tipe: 'masuk', label: 'Masuk' },
		{ tipe: 'istirahat', label: 'Istirahat' },
		{ tipe: 'selesai_istirahat', label: 'Selesai Istirahat' },
		{ tipe: 'pergantian', label: 'Pergantian Jam' },
		{ tipe: 'pulang', label: 'Pulang' },
		{ tipe: 'custom', label: 'Bell' }
	];

	function getSoundFileName(tipe: string): string | undefined {
		return bellSounds.find((s) => s.tipe === tipe)?.fileName;
	}

	async function handleUploadSound(tipe: string) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.mp3,audio/mpeg';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			if (file.size > 2 * 1024 * 1024) {
				toast('Ukuran file maksimal 2MB', 'warning');
				return;
			}
			if (!file.name.toLowerCase().endsWith('.mp3') && file.type !== 'audio/mpeg') {
				showModal({
					title: 'Format Tidak Didukung',
					body: 'Hanya file MP3 yang dapat diterima. Silakan convert file Anda ke format MP3 terlebih dahulu.',
					onPositive: { label: 'OK', action: async ({ close }) => close() },
					dismissible: false
				});
				return;
			}
			uploadingTipe = tipe;
			try {
				const fd = new FormData();
				fd.append('file', file);
				const res = await fetch(`/api/bell-sound/${tipe}`, { method: 'POST', body: fd });
				if (!res.ok) {
					const err = await res.json().catch(() => ({ fail: 'Gagal upload' }));
					throw new Error(err.fail ?? `Error ${res.status}`);
				}
				toast('Sound berhasil diunggah', 'success');
				await invalidateAll();
			} catch (e) {
				toast(e instanceof Error ? e.message : 'Gagal unggah sound', 'error');
			} finally {
				uploadingTipe = null;
			}
		};
		input.click();
	}

	async function handlePlaySound(tipe: string) {
		playingTipe = tipe;
		try {
			const res = await fetch('/api/bell/play', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tipe })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({ fail: 'Gagal memutar sound' }));
				throw new Error(err.fail ?? `Error ${res.status}`);
			}
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal memutar sound di server', 'error');
		}
		playingTipe = null;
	}

	async function handleDeleteSound(tipe: string) {
		try {
			const res = await fetch(`/api/bell-sound/${tipe}`, { method: 'DELETE' });
			if (!res.ok) {
				const err = await res.json().catch(() => ({ fail: 'Gagal hapus' }));
				throw new Error(err.fail ?? `Error ${res.status}`);
			}
			toast('Sound berhasil dihapus', 'success');
			await invalidateAll();
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal hapus sound', 'error');
		}
	}

	async function handleSubmit() {
		if (!isValidTime(jamMulaiValue)) {
			toast('Format jam mulai tidak valid (HH:mm)', 'warning');
			return;
		}
		submitting = true;
		setLoading(true);
		const formData = new FormData();
		formData.append('jamPelajaranMenit', jamPelajaranMenitValue);
		formData.append('durasiIstirahat', durasiIstirahatValue);
		formData.append('durasiUpacara', durasiUpacaraValue);
		formData.append('jamMulai', jamMulaiValue);

		try {
			const response = await fetch('?/saveSettings', {
				method: 'POST',
				body: formData,
				redirect: 'error'
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({ fail: 'Gagal menyimpan pengaturan' }));
				throw new Error(err.fail ?? `Error ${response.status}`);
			}

			hideModal();
			toast('Pengaturan berhasil disimpan', 'success');
			await invalidateAll();
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan', 'error');
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

<div class="not-prose flex flex-col gap-5">
	<fieldset class="space-y-3">
		<legend
			class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
			>Durasi</legend
		>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium text-slate-700 dark:text-zinc-300"
					>Menit per Jam Pelajaran</span
				>
				<input
					type="number"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={jamPelajaranMenitValue}
					min="1"
					max="60"
					disabled={submitting}
				/>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium text-slate-700 dark:text-zinc-300"
					>Durasi Istirahat (menit)</span
				>
				<input
					type="number"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={durasiIstirahatValue}
					min="1"
					max="60"
					disabled={submitting}
				/>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium text-slate-700 dark:text-zinc-300"
					>Durasi Upacara (menit)</span
				>
				<input
					type="number"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={durasiUpacaraValue}
					min="1"
					max="120"
					disabled={submitting}
				/>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Jam Mulai Sekolah</span>
				<input
					type="text"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={jamMulaiValue}
					disabled={submitting}
					pattern="[0-9]{2}:[0-9]{2}"
					inputmode="numeric"
					placeholder="HH:mm"
				/>
			</label>
		</div>
	</fieldset>

	<fieldset class="space-y-2.5 border-t border-slate-200/70 pt-4 dark:border-zinc-800">
		<legend
			class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
			>Unggah Sound</legend
		>
		<p class="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
			Unggah file MP3, maksimal 2MB per file. Jika tidak ada, akan dipakai sound bawaan dari folder
			<code
				class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
				>static/sounds/</code
			>.
		</p>
		<div class="flex flex-col gap-1.5">
			{#each soundTipes as { tipe, label } (tipe)}
				<div
					class="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/65 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/45"
				>
					<div class="flex min-w-0 flex-col gap-0.5">
						<span class="text-xs font-semibold text-slate-800 dark:text-zinc-200">{label}</span>
						{#if getSoundFileName(tipe)}
							<span class="truncate text-[11px] text-slate-500 dark:text-zinc-400"
								>{getSoundFileName(tipe)}</span
							>
						{:else}
							<span class="text-[11px] text-slate-400 dark:text-zinc-500">Default: {tipe}.mp3</span>
						{/if}
					</div>
					<div class="flex shrink-0 items-center gap-1.5">
						<button
							type="button"
							class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => handleUploadSound(tipe)}
							disabled={submitting || uploadingTipe !== null}
						>
							{#if uploadingTipe === tipe}
								<span class="loading loading-spinner loading-xs"></span>
								Mengunggah…
							{:else}
								<Icon name="import" class="h-3.5 w-3.5" />
								Unggah
							{/if}
						</button>
						{#if getSoundFileName(tipe)}
							<button
								type="button"
								class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
								onclick={() => handleDeleteSound(tipe)}
								disabled={submitting}
								aria-label="Hapus sound {label}"
							>
								<Icon name="del" class="h-3.5 w-3.5" />
							</button>
						{/if}
						<button
							type="button"
							class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-blue-200/80 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
							onclick={() => handlePlaySound(tipe)}
							disabled={submitting || playingTipe !== null}
							aria-label="Putar sound {label}"
						>
							{#if playingTipe === tipe}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								<Icon name="play" class="h-3.5 w-3.5" />
							{/if}
						</button>
					</div>
				</div>
			{/each}
		</div>
	</fieldset>
</div>
