<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	interface Props {
		isOpen?: boolean;
		onSuccess?: () => void;
	}

	let { isOpen = $bindable(false), onSuccess }: Props = $props();

	let selectedFile: File | null = $state(null);
	let uploadingPhotos = $state(false);
	let uploadProgress = $state<{ current: number; total: number } | null>(null);
	let uploadInputRef: HTMLInputElement | null = $state(null);
	let dialogRef: HTMLDialogElement | null = $state(null);

	$effect(() => {
		// React to isOpen changes
		if (isOpen && dialogRef) {
			// Add small delay to ensure dropdown is closed and DOM is settled
			const timer = setTimeout(() => {
				if (dialogRef && !dialogRef.open) {
					try {
						dialogRef.showModal?.();
					} catch (err) {
						console.error('Error opening modal:', err);
					}
				}
			}, 50);
			return () => clearTimeout(timer);
		} else if (!isOpen && dialogRef?.open) {
			try {
				dialogRef?.close?.();
			} catch (err) {
				console.error('Error closing modal:', err);
			}
		}
	});

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			selectedFile = null;
			return;
		}

		if (!file.type.includes('zip') && !file.name.endsWith('.zip')) {
			toast({
				message: 'Format file tidak didukung; hanya ZIP yang diizinkan',
				type: 'error'
			});
			input.value = '';
			selectedFile = null;
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			// 5MB limit for zip
			toast({ message: 'Ukuran file ZIP tidak boleh lebih dari 5MB', type: 'error' });
			input.value = '';
			selectedFile = null;
			return;
		}

		selectedFile = file;
		toast({
			message: `File dipilih: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
			type: 'success'
		});
	}

	async function saveUploadPhotos() {
		if (!selectedFile) return;
		if (uploadingPhotos) return;

		uploadingPhotos = true;
		uploadProgress = { current: 0, total: 1 };

		try {
			const formData = new FormData();
			formData.append('zipFile', selectedFile);

			const res = await fetch('/api/murid-bulk-photo', {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				let msg = 'Gagal upload foto massal';
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
			const { uploaded = 0, failed = 0 } = result;

			if (failed > 0) {
				toast({
					message: `Upload selesai: ${uploaded} foto berhasil, ${failed} gagal`,
					type: 'warning',
					persist: true
				});
			} else {
				toast({
					message: `${uploaded} foto berhasil diperbarui`,
					type: 'success',
					persist: true
				});
			}

			// Dispatch event untuk refresh data
			window.dispatchEvent(new CustomEvent('murid:bulk-updated'));

			onSuccess?.();
		} catch (err) {
			console.error(err);
			toast({ message: 'Gagal upload foto massal', type: 'error' });
		} finally {
			uploadingPhotos = false;
			uploadProgress = null;
		}
	}

	function resetModal() {
		selectedFile = null;
		uploadProgress = null;
		if (uploadInputRef) uploadInputRef.value = '';
	}

	function closeModal() {
		resetModal();
		// Ensure state sync by closing dialog first
		if (dialogRef?.open) {
			dialogRef.close();
		}
		// Then update state
		isOpen = false;
	}

	function handleSave() {
		if (!selectedFile) {
			toast({ message: 'Pilih file ZIP terlebih dahulu', type: 'warning' });
			return;
		}
		saveUploadPhotos().then(() => {
			isOpen = false;
		});
	}

	function handleBatal() {
		closeModal();
	}
</script>

<dialog
	bind:this={dialogRef}
	class="modal bg-slate-950/45 backdrop-blur-[2px]"
	style="z-index: 9999"
	onclose={() => {
		isOpen = false;
		resetModal();
	}}
>
	<div
		class="modal-box max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<h3 class="mb-4 border-b border-slate-100 pb-3 text-base font-bold dark:border-zinc-800">
			Unggah Semua Foto
		</h3>

		<div class="flex flex-col gap-4">
			<!-- Instructions -->
			<div
				class="flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 text-xs text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
			>
				<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<div>
					<p class="mb-2 font-semibold">Cara menyiapkan file ZIP:</p>
					<ol class="list-inside list-decimal space-y-1.5 text-[11px] leading-relaxed">
						<li>
							<strong>Ubah nama semua foto</strong> menjadi NISN murid
							<br />
							<span class="ml-4 text-slate-600 dark:text-zinc-300">
								Contoh:
								<code class="rounded bg-white/80 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800"
									>3142593492.jpg</code
								>
							</span>
						</li>
						<li>
							<strong>Periksa ukuran foto</strong>
							<br />
							<span class="ml-4 text-slate-600 dark:text-zinc-300">
								Setiap foto maksimal 500KB. Kompresi jika diperlukan.
							</span>
						</li>
						<li>
							<strong>Blok semua foto</strong> (jangan dalam folder)
							<br />
							<span class="ml-4 text-slate-600 dark:text-zinc-300">
								ZIP hanya berisi file JPG/PNG, tidak ada folder di dalamnya.
							</span>
						</li>
						<li>
							<strong>Buat file ZIP</strong>
							<br />
							<span class="ml-4 text-slate-600 dark:text-zinc-300">
								Total ukuran ZIP maksimal 5MB. Upload di sini.
							</span>
						</li>
					</ol>
					<p class="mt-2 font-semibold">Format foto yang didukung: JPG, JPEG, PNG</p>
				</div>
			</div>

			<!-- File Input -->
			<div>
				<span class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
					Pilih File ZIP
				</span>
				<input
					bind:this={uploadInputRef}
					type="file"
					accept=".zip,application/zip"
					class="file-input file-input-bordered w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					onchange={handleFileChange}
					disabled={uploadingPhotos}
					aria-label="Unggah ZIP foto massal"
				/>
				<p class="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
					File ZIP dengan nama file = NISN (max 5MB). Setiap foto max 500KB.
				</p>
			</div>

			<!-- File Info -->
			{#if selectedFile}
				<div
					class="flex items-center gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
				>
					<Icon name="check" class="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
					<div>
						<p class="font-semibold">{selectedFile.name}</p>
						<p class="text-[11px] opacity-80">
							{(selectedFile.size / 1024 / 1024).toFixed(2)} MB
						</p>
					</div>
				</div>
			{/if}

			<!-- Upload Progress -->
			{#if uploadProgress}
				<div class="flex flex-col gap-1.5">
					<div class="flex justify-between text-xs text-slate-600 dark:text-zinc-300">
						<span>Proses upload...</span>
						<span>{uploadProgress.current} / {uploadProgress.total}</span>
					</div>
					<progress
						class="progress progress-primary w-full"
						value={uploadProgress.current}
						max={uploadProgress.total}
					></progress>
				</div>
			{/if}
		</div>

		<!-- Action Buttons -->
		<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
			<button
				type="button"
				class="mr-auto inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				disabled={uploadingPhotos}
				onclick={handleBatal}
				aria-label="Tutup modal"
			>
				Batal
			</button>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
				disabled={uploadingPhotos || !selectedFile}
				onclick={handleSave}
				aria-label="Unggah foto"
			>
				{#if uploadingPhotos}
					<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
				{:else}
					<Icon name="import" class="h-3.5 w-3.5" />
				{/if}
				Upload
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop bg-transparent">
		<button>close</button>
	</form>
</dialog>
