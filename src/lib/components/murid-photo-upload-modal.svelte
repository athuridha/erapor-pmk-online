<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { onMount } from 'svelte';

	interface Props {
		isOpen?: boolean;
		muridId: number | null;
		muridNama?: string;
		onSuccess?: (filename: string) => void;
	}

	let { isOpen = $bindable(false), muridId, muridNama, onSuccess }: Props = $props();

	let selectedFile: File | null = $state(null);
	let previewUrl: string | null = $state(null);
	let uploadingFoto = $state(false);
	let uploadInputRef: HTMLInputElement | null = $state(null);
	let dialogRef: HTMLDialogElement | null = $state(null);

	onMount(() => {
		// Watch for isOpen changes and call showModal/close accordingly
		if (isOpen && dialogRef) {
			dialogRef.showModal?.();
		}
	});

	$effect(() => {
		if (isOpen && dialogRef) {
			// Use setTimeout to ensure it runs after DOM is ready
			setTimeout(() => {
				dialogRef?.showModal?.();
			}, 0);
		} else if (!isOpen && dialogRef) {
			// Close modal when isOpen becomes false
			dialogRef?.close();
		}
	});

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			selectedFile = null;
			previewUrl = null;
			return;
		}

		const allowed = ['image/png', 'image/jpeg'];
		if (!allowed.includes(file.type)) {
			toast({
				message: 'Format file tidak didukung; hanya JPG dan PNG yang diizinkan',
				type: 'error'
			});
			input.value = '';
			selectedFile = null;
			previewUrl = null;
			return;
		}

		if (file.size > 500 * 1024) {
			toast({ message: 'Ukuran file foto tidak boleh lebih dari 500KB', type: 'error' });
			input.value = '';
			selectedFile = null;
			previewUrl = null;
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			previewUrl = reader.result as string;
			selectedFile = file;
		};
		reader.readAsDataURL(file);
	}

	async function saveUploadFoto() {
		if (!selectedFile || !muridId) return;

		uploadingFoto = true;
		try {
			const formData = new FormData();
			formData.append('foto', selectedFile);

			const res = await fetch(`/api/murid-photo/${muridId}`, {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				let msg = 'Gagal upload foto';
				try {
					const json = await res.json().catch(() => null);
					if (json && typeof json.message === 'string') msg = json.message;
				} catch {
					void 0;
				}
				toast({ message: msg, type: 'error' });
				return;
			}

			const result = await res.json();
			if (result?.foto) {
				toast({ message: 'Foto berhasil diperbarui', type: 'success' });
				onSuccess?.(result.foto);
				// Dispatch custom event to notify other components
				window.dispatchEvent(
					new CustomEvent('murid:updated', {
						detail: { id: muridId, foto: result.foto, t: Date.now() }
					})
				);
			}
		} catch (err) {
			console.error(err);
			toast({ message: 'Gagal upload foto', type: 'error' });
		} finally {
			uploadingFoto = false;
		}
	}

	function resetModal() {
		selectedFile = null;
		previewUrl = null;
		if (uploadInputRef) uploadInputRef.value = '';
	}

	function closeModal() {
		resetModal();
		isOpen = false;
		dialogRef?.close();
	}

	function handleSave() {
		if (!selectedFile) {
			toast({ message: 'Pilih file foto terlebih dahulu', type: 'warning' });
			return;
		}
		saveUploadFoto().then(() => {
			// Close modal after upload finishes
			isOpen = false;
		});
	}

	function handleBatal() {
		closeModal();
	}
</script>

<dialog bind:this={dialogRef} class="modal bg-slate-950/45 backdrop-blur-[2px]">
	<div
		class="modal-box max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<h3 class="mb-4 border-b border-slate-100 pb-3 text-base font-bold dark:border-zinc-800">
			Unggah Foto {muridNama}
		</h3>

		<div class="flex flex-col gap-4 sm:flex-row">
			<!-- Preview -->
			<div class="flex justify-center">
				<div
					class="flex aspect-3/4 w-44 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/60"
				>
					{#if previewUrl}
						<img src={previewUrl} alt="Preview" class="h-full w-full object-cover" />
					{:else}
						<div class="p-4 text-center text-slate-400 dark:text-zinc-500">
							<Icon name="image" class="mx-auto h-8 w-8" />
							<p class="mt-2 text-xs">Foto belum dipilih</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- File Input -->
			<div class="flex-1">
				<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
					Pilih File
				</span>
				<input
					bind:this={uploadInputRef}
					type="file"
					accept="image/png,image/jpeg"
					class="file-input file-input-bordered w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					onchange={handleFileChange}
					disabled={uploadingFoto}
					aria-label="Unggah foto murid"
				/>
				<p class="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
					JPG atau PNG. Ukuran maks 500KB.
				</p>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				disabled={uploadingFoto}
				onclick={handleBatal}
				aria-label="Tutup modal"
			>
				Batal
			</button>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
				onclick={handleSave}
				disabled={uploadingFoto || !selectedFile}
				aria-label="Simpan foto"
			>
				{#if uploadingFoto}
					<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
				{:else}
					<Icon name="save" class="h-3.5 w-3.5" />
				{/if}
				Simpan
			</button>
		</div>
	</div>

	<button
		type="button"
		class="modal-backdrop bg-transparent"
		onclick={closeModal}
		aria-label="Close modal on backdrop click"
	></button>
</dialog>
