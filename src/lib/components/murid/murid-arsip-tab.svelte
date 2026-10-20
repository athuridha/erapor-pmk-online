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
			<p class="font-semibold">Arsip dokumen murid</p>
			<p class="text-base-content/60 mt-1 text-sm">
				Simpan berkas penting dalam format PDF, JPG, atau PNG. Maksimal 4MB per berkas.
			</p>
		</div>
		{#if status === 'lulus'}
			<span class="badge badge-success badge-soft">Murid lulus</span>
		{/if}
	</div>

	{#if !canEdit}
		<div class="alert alert-info alert-soft text-sm">
			<Icon name="info" />
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
				class="rounded-xl border border-base-300 bg-base-100 p-4 {terkunci
					? 'opacity-60'
					: 'hover:border-primary/40'}"
			>
				<div class="flex items-start gap-3">
					<span
						class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
					>
						<Icon name={terkunci ? 'lock' : 'folder'} />
					</span>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-semibold">{item.label}</p>
						<p class="text-base-content/55 mt-0.5 text-xs leading-5">{item.description}</p>
					</div>
				</div>

				{#if terkunci}
					<p class="mt-4 rounded-lg bg-base-200 px-3 py-2 text-xs text-base-content/60">
						Ubah status murid menjadi <strong>Lulus</strong> di form data murid untuk membuka arsip ijazah
						sekolah.
					</p>
				{:else if entry}
					<div class="mt-4 rounded-lg bg-base-200/70 px-3 py-2">
						<p class="truncate text-xs font-medium" title={entry.namaFile}>{entry.namaFile}</p>
						<p class="text-base-content/50 mt-0.5 text-[11px]">{sizeLabel(entry.ukuran)}</p>
					</div>
					<div class="mt-3 flex flex-wrap gap-1.5">
						<a
							class="btn btn-xs btn-soft"
							href={`/api/murid-arsip/${muridId}?jenis=${encodeURIComponent(item.jenis)}`}
							target="_blank"
							rel="noopener"
						>
							<Icon name="eye" />
							Lihat
						</a>
						<a
							class="btn btn-xs btn-soft"
							href={`/api/murid-arsip/${muridId}?jenis=${encodeURIComponent(item.jenis)}&download=1`}
							target="_blank"
							rel="noopener"
						>
							<Icon name="download" />
							Unduh
						</a>
						{#if canEdit}
							<button
								class="btn btn-xs btn-soft"
								type="button"
								onclick={() => pickFile(item.jenis)}
							>
								<Icon name="edit" />
								Ganti
							</button>
							<button
								class="btn btn-xs btn-soft btn-error"
								type="button"
								disabled={deletingJenis === item.jenis}
								onclick={() => confirmDelete(item.jenis, item.label)}
							>
								<Icon name="del" />
								Hapus
							</button>
						{/if}
					</div>
				{:else}
					<p class="text-base-content/45 mt-4 text-xs">Belum ada berkas.</p>
					{#if canEdit}
						<button
							class="btn btn-sm btn-primary btn-soft mt-3 shadow-none"
							type="button"
							disabled={uploading}
							onclick={() => pickFile(item.jenis)}
						>
							{#if uploading && uploadJenis === item.jenis}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								<Icon name="import" />
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
