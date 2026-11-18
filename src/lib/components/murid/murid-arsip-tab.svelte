<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';

	type Jenis = 'kk' | 'akta' | 'ijazah_terakhir' | 'ijazah_sekolah';

	interface Lampiran {
		id: number;
		jenis: Jenis;
		namaFile: string;
		mimeType: string;
		ukuran: number;
		createdAt?: string | null;
	}

	interface Props {
		muridId: number;
		lampiran?: Lampiran[];
		status?: string;
		canEdit?: boolean;
	}

	let { muridId, lampiran = [], status = 'aktif', canEdit = false }: Props = $props();

	const items: Array<{
		jenis: Jenis;
		label: string;
		description: string;
		hanyaLulus?: boolean;
	}> = [
		{
			jenis: 'kk',
			label: 'Kartu Keluarga (KK)',
			description: 'Scan atau foto KK yang masih berlaku.'
		},
		{
			jenis: 'akta',
			label: 'Akta Kelahiran',
			description: 'Scan atau foto akta kelahiran murid.'
		},
		{
			jenis: 'ijazah_terakhir',
			label: 'Ijazah Terakhir',
			description: 'Ijazah dari sekolah sebelumnya.'
		},
		{
			jenis: 'ijazah_sekolah',
			label: 'Ijazah Sekolah',
			description: 'Arsip ijazah yang diterbitkan sekolah untuk murid lulus.',
			hanyaLulus: true
		}
	];

	let fileInput = $state<HTMLInputElement | null>(null);
	let uploadJenis = $state<Jenis | null>(null);
	let uploading = $state(false);
	let deletingJenis = $state<Jenis | null>(null);

	function entryFor(jenis: Jenis) {
		return lampiran.find((item) => item.jenis === jenis) ?? null;
	}

	function sizeLabel(bytes: number) {
		if (!bytes) return '0 KB';
		if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}

	function pickFile(jenis: Jenis) {
		if (!canEdit) return;
		uploadJenis = jenis;
		if (fileInput) {
			fileInput.value = '';
			fileInput.click();
		}
	}

	async function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const jenis = uploadJenis;
		input.value = '';
		if (!file || !jenis) return;

		if (file.size > 4 * 1024 * 1024) {
			toast({ message: 'Ukuran berkas maksimal 4MB.', type: 'warning' });
			return;
		}

		uploading = true;
		try {
			const form = new FormData();
			form.set('jenis', jenis);
			form.set('berkas', file);
			const response = await fetch(`/api/murid-arsip/${muridId}`, {
				method: 'POST',
				body: form
			});
			const result = await response.json().catch(() => null);
			if (!response.ok) {
				toast({
					message: result?.message || 'Gagal mengunggah arsip.',
					type: 'error'
				});
				return;
			}
			toast({ message: 'Arsip berhasil disimpan.', type: 'success' });
			await invalidateAll();
		} catch (error) {
			console.error(error);
			toast({ message: 'Gagal mengunggah arsip.', type: 'error' });
		} finally {
			uploading = false;
			uploadJenis = null;
		}
	}

	function confirmDelete(jenis: Jenis, label: string) {
		if (!canEdit) return;
		showModal({
			title: 'Hapus arsip',
			body: `<p>Hapus <strong>${label}</strong>? Berkas yang sudah dihapus tidak dapat dikembalikan.</p>`,
			onPositive: {
				label: 'Hapus',
				icon: 'del',
				class: 'btn-error',
				action: async ({ close }: { close: () => void }) => {
					deletingJenis = jenis;
					try {
						const response = await fetch(
							`/api/murid-arsip/${muridId}?jenis=${encodeURIComponent(jenis)}`,
							{ method: 'DELETE' }
						);
						const result = await response.json().catch(() => null);
						if (!response.ok) {
							toast({
								message: result?.message || 'Gagal menghapus arsip.',
								type: 'error'
							});
							return;
						}
						toast({ message: 'Arsip berhasil dihapus.', type: 'success' });
						close();
						await invalidateAll();
					} catch (error) {
						console.error(error);
						toast({ message: 'Gagal menghapus arsip.', type: 'error' });
					} finally {
						deletingJenis = null;
					}
				}
			},
			onNegative: { label: 'Batal', icon: 'close' },
			dismissible: true
		});
	}
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<p class="text-sm font-semibold text-slate-900 dark:text-zinc-100">Arsip dokumen murid</p>
			<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
				Simpan berkas penting dalam format PDF, JPG, atau PNG. Maksimal 4MB per berkas.
			</p>
		</div>
		{#if status === 'lulus'}
			<span
				class="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
				>Murid lulus</span
			>
		{/if}
	</div>

	{#if !canEdit}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3.5 py-2.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
		>
			<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
			<span
				>Akun ini hanya dapat melihat arsip. Hubungi admin untuk mengunggah atau mengganti berkas.</span
			>
		</div>
	{/if}

	<div class="grid gap-4 sm:grid-cols-2">
		{#each items as item (item.jenis)}
			{@const entry = entryFor(item.jenis)}
			{@const terkunci = item.hanyaLulus && status !== 'lulus'}
			<article
				class="rounded-2xl border border-slate-200/80 bg-white p-4 transition-colors dark:border-zinc-800 dark:bg-zinc-900 {terkunci
					? 'opacity-60'
					: 'hover:border-blue-300 dark:hover:border-blue-800'}"
			>
				<div class="flex items-start gap-3">
					<span
						class="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
					>
						<Icon name={terkunci ? 'lock' : 'folder'} class="h-4 w-4" />
					</span>
					<div class="min-w-0 flex-1">
						<p class="text-xs font-semibold text-slate-900 dark:text-zinc-100">{item.label}</p>
						<p class="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
							{item.description}
						</p>
					</div>
				</div>

				{#if terkunci}
					<p
						class="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/75 px-3 py-2 text-xs text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/45 dark:text-zinc-400"
					>
						Ubah status murid menjadi <strong class="text-slate-700 dark:text-zinc-200"
							>Lulus</strong
						> di form data murid untuk membuka arsip ijazah sekolah.
					</p>
				{:else if entry}
					<div
						class="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/75 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/45"
					>
						<p
							class="truncate text-xs font-medium text-slate-800 dark:text-zinc-200"
							title={entry.namaFile}
						>
							{entry.namaFile}
						</p>
						<p class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
							{sizeLabel(entry.ukuran)}
						</p>
					</div>
					<div class="mt-3 flex flex-wrap gap-1.5">
						<a
							class="inline-flex h-7 items-center gap-1 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							href={`/api/murid-arsip/${muridId}?jenis=${encodeURIComponent(item.jenis)}`}
							target="_blank"
							rel="noopener"
						>
							<Icon name="eye" class="h-3 w-3" />
							Lihat
						</a>
						<a
							class="inline-flex h-7 items-center gap-1 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							href={`/api/murid-arsip/${muridId}?jenis=${encodeURIComponent(item.jenis)}&download=1`}
							target="_blank"
							rel="noopener"
						>
							<Icon name="download" class="h-3 w-3" />
							Unduh
						</a>
						{#if canEdit}
							<button
								class="inline-flex h-7 items-center gap-1 rounded-lg border border-[#7e8b9b] bg-white px-2.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
								type="button"
								onclick={() => pickFile(item.jenis)}
							>
								<Icon name="edit" class="h-3 w-3" />
								Ganti
							</button>
							<button
								class="inline-flex h-7 items-center gap-1 rounded-lg border border-red-200/80 bg-red-50 px-2.5 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
								type="button"
								disabled={deletingJenis === item.jenis}
								onclick={() => confirmDelete(item.jenis, item.label)}
							>
								<Icon name="del" class="h-3 w-3" />
								Hapus
							</button>
						{/if}
					</div>
				{:else}
					<p class="mt-4 text-xs text-slate-400 dark:text-zinc-500">Belum ada berkas.</p>
					{#if canEdit}
						<button
							class="mt-3 inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
							type="button"
							disabled={uploading}
							onclick={() => pickFile(item.jenis)}
						>
							{#if uploading && uploadJenis === item.jenis}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								<Icon name="import" class="h-3.5 w-3.5" />
							{/if}
							Unggah
						</button>
					{/if}
				{/if}
			</article>
		{/each}
	</div>

	<input
		bind:this={fileInput}
		type="file"
		class="hidden"
		accept="application/pdf,image/jpeg,image/png"
		onchange={handleFileChange}
	/>
</div>
