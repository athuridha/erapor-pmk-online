<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { jenisKelamin } from '$lib/statics.js';
	import { modalRoute } from '$lib/utils.js';
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { showModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import MuridPhotoUploadModal from '$lib/components/murid-photo-upload-modal.svelte';
	import MuridArsipTab from '$lib/components/murid/murid-arsip-tab.svelte';
	import { page } from '$app/state';
	import { isAdminUser } from '../../../../pengguna/permissions';

	let { data } = $props();

	function statusLabel(value?: string | null) {
		const labels: Record<string, string> = {
			aktif: 'Aktif',
			lulus: 'Lulus',
			pindah: 'Pindah',
			keluar: 'Keluar'
		};
		return labels[value ?? 'aktif'] ?? value;
	}

	// Ubah data murid hanya operator/admin; foto & arsip juga boleh wali kelas.
	const canEdit = $derived(isAdminUser(page.data.user));
	const canUploadBerkas = $derived(
		isAdminUser(page.data.user) ||
			(page.data.user as { type?: string } | null | undefined)?.type === 'wali_kelas'
	);

	/** Label kelas + fase tanpa kata "Fase" ganda ("Fase Fase F"). */
	function labelKelasFase(
		kelas: { nama?: string | null; fase?: string | null } | null | undefined
	): string {
		const nama = kelas?.nama || '-';
		const fase = (kelas?.fase ?? '').trim().replace(/^fase\s+/i, '');
		return fase ? `${nama} Fase ${fase}` : nama;
	}

	let kelas = $derived(labelKelasFase(data.murid.kelas));
	let deletingFoto = $state(false);
	let isUploadModalOpen = $state(false);

	// Track if data was updated while modal was open
	let dataWasUpdated = $state(false);

	// compute a robust image src for the detail modal:
	// - if `data.murid.foto` is a URL or data URI, use it directly
	// - otherwise fallback to the internal API endpoint and add a cache-busting
	//   query param so updated photos are fetched instead of a cached image
	const photoSrc = $derived(
		!data?.murid?.foto
			? null
			: typeof data.murid.foto === 'string'
				? data.murid.foto.startsWith('http') ||
					data.murid.foto.startsWith('data:') ||
					data.murid.foto.startsWith('/')
					? data.murid.foto
					: `/api/murid-photo/${data.murid.id}?v=${encodeURIComponent(data.murid.foto)}`
				: `/api/murid-photo/${data.murid.id}?t=${Date.now()}`
	);

	let _muridUpdatedHandler: ((e: CustomEvent<Record<string, unknown>>) => void) | null = null;

	onMount(() => {
		_muridUpdatedHandler = (e: CustomEvent<Record<string, unknown>>) => {
			try {
				const detail = (e?.detail ?? null) as Record<string, unknown> | null;
				if (!detail) return;
				// match by id
				if (String(detail.id) === String(data?.murid?.id)) {
					// replace all fields with the fresh data from the server
					data = {
						...data,
						murid: {
							...(data.murid ?? {}),
							...detail,
							foto: typeof detail.foto === 'string' ? detail.foto : null
						}
					};
					// Mark that data was updated, will force refresh on next modal open
					dataWasUpdated = true;
				}
			} catch (err) {
				console.debug('murid:updated handler error', err);
			}
		};
		window.addEventListener('murid:updated', _muridUpdatedHandler as EventListener);
	});

	onDestroy(() => {
		if (_muridUpdatedHandler)
			window.removeEventListener('murid:updated', _muridUpdatedHandler as EventListener);
		// Invalidate data when component destroys if there were updates
		if (dataWasUpdated) {
			invalidateAll().catch((err) => console.error('Invalidate error:', err));
		}
	});

	async function deleteFoto() {
		if (!data.murid?.id) return;
		showModal({
			title: 'Hapus foto murid',
			body: '<p>Hapus foto murid? Tindakan ini tidak dapat dibatalkan.</p>',
			onPositive: {
				label: 'Hapus',
				icon: 'del',
				action: async ({ close }: { close: () => void }) => {
					deletingFoto = true;
					try {
						const res = await fetch(`/api/murid-photo/${data.murid.id}`, { method: 'DELETE' });
						if (!res.ok) {
							let msg = 'Gagal menghapus foto';
							try {
								const json = await res.json().catch(() => null);
								if (json && typeof json.message === 'string') msg = json.message;
							} catch {
								void 0;
							}
							toast({ message: msg, type: 'warning' });
						} else {
							data = { ...data, murid: { ...data.murid, foto: null } };
							// Dispatch custom event to notify other components
							window.dispatchEvent(
								new CustomEvent('murid:updated', {
									detail: { id: data.murid.id, foto: null }
								})
							);
							toast({ message: 'Foto berhasil dihapus', type: 'success' });
							close();
						}
					} catch (err) {
						console.error(err);
						toast({ message: 'Gagal menghapus foto', type: 'error' });
					} finally {
						deletingFoto = false;
					}
				}
			},
			onNegative: { label: 'Batal', icon: 'close' },
			dismissible: true
		});
	}

	function handleUploadSuccess(filename: string) {
		data = { ...data, murid: { ...data.murid, foto: filename } };
	}
</script>

{#snippet field(label: string, value?: string | null)}
	<!-- use snippet for repeatable elements -->
	<div class="space-y-0.5">
		<span class="text-xs font-medium text-slate-500 dark:text-zinc-400">{label}</span>
		<p class="text-sm font-semibold text-slate-900 dark:text-zinc-100">{value || '-'}</p>
	</div>
{/snippet}

<h2 class="mb-4 text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
	Detail Data Murid
</h2>
<div class="max-h-[60vh] overflow-y-auto sm:max-h-none sm:overflow-y-visible">
	<div class="w-full max-w-full">
		<div class="tabs tabs-box bg-slate-100/80 p-1 dark:bg-zinc-800/70">
			<!-- data Murid -->
			<input
				type="radio"
				name="tab-detil-murid"
				class="tab pointer-events-auto text-xs font-semibold"
				aria-label="Data Murid"
				checked
			/>
			<div
				class="tab-content mt-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<!-- Foto murid (placeholder) -->
					<div class="flex flex-col items-center justify-between gap-3 text-center sm:col-span-1">
						<div
							class="flex aspect-3/4 w-full max-w-xs items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/60"
						>
							{#if photoSrc}
								<img src={photoSrc} alt="Foto murid" class="h-full w-full object-cover" />
							{:else}
								<!-- Simple placeholder: initials or icon -->
								<div class="p-4 text-center text-slate-400 dark:text-zinc-500">
									<Icon name="user" class="mx-auto text-6xl" />
									<p class="mt-2 text-xs font-medium">Foto belum tersedia</p>
								</div>
							{/if}
						</div>
						<div class="flex flex-row">
							<button
								class="inline-flex h-8 items-center gap-1.5 rounded-l-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
								type="button"
								onclick={() => (isUploadModalOpen = true)}
								aria-disabled={!canUploadBerkas}
								disabled={!canUploadBerkas}
								title={!canUploadBerkas ? 'Anda tidak memiliki izin untuk mengubah foto' : ''}
								aria-label="Ubah Foto Murid"
							>
								<Icon name="edit" class="h-3.5 w-3.5" />
								Ubah
							</button>
							<button
								class="inline-flex h-8 items-center gap-1.5 rounded-r-xl border-y border-r border-red-300 bg-red-50 px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
								type="button"
								onclick={deleteFoto}
								aria-disabled={deletingFoto || !photoSrc || !canUploadBerkas}
								disabled={deletingFoto || !photoSrc || !canUploadBerkas}
								title={!canUploadBerkas ? 'Anda tidak memiliki izin untuk menghapus foto' : ''}
								aria-label="Hapus Foto Murid"
							>
								<Icon name="del" class="h-3.5 w-3.5" />
								Hapus
							</button>
						</div>
					</div>
					<!-- Data fields (kept as two-column grid inside the right area) -->
					<div class="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
						{@render field('NIS', data.murid.nis)}
						{@render field('NISN', data.murid.nisn)}
						{@render field('Nama', data.murid.nama)}
						{@render field('Kelas', kelas)}
						{@render field('Tempat Lahir', data.murid.tempatLahir)}
						{@render field('Tanggal Lahir', data.murid.tanggalLahir)}
						{@render field('Jenis Kelamin', jenisKelamin[data.murid.jenisKelamin])}
						{@render field('Agama', data.murid.agama)}
						{@render field('Pendidikan Sebelumnya', data.murid.pendidikanSebelumnya)}
						{@render field('Tanggal Masuk Sekolah Ini', data.murid.tanggalMasuk)}
						{@render field('Status', statusLabel(data.murid.status))}
						{#if data.murid.status === 'lulus'}
							{@render field('Tanggal Lulus', data.murid.tanggalLulus)}
						{:else if data.murid.status === 'keluar' || data.murid.status === 'pindah'}
							{@render field('Tanggal Keluar', data.murid.tanggalKeluar)}
							{@render field('Alasan Keluar', data.murid.alasanKeluar)}
						{/if}
					</div>
				</div>
			</div>
			<!-- data Orang Tua -->
			<input
				type="radio"
				name="tab-detil-murid"
				class="tab pointer-events-auto text-xs font-semibold"
				aria-label="Data Orang Tua"
			/>
			<div
				class="tab-content mt-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{@render field('Nama Ayah', data.murid.ayah?.nama)}
					{@render field('Pekerjaan Ayah', data.murid.ayah?.pekerjaan)}
					{@render field('Nama Ibu', data.murid.ibu?.nama)}
					{@render field('Pekerjaan Ibu', data.murid.ibu?.pekerjaan)}
					{@render field(
						'Kontak',
						data.murid.ayah?.kontak || data.murid.ibu?.kontak || data.murid.wali?.kontak
					)}
				</div>
			</div>
			<!-- data Alamat Murid -->
			<input
				type="radio"
				name="tab-detil-murid"
				class="tab pointer-events-auto text-xs font-semibold"
				aria-label="Data Alamat Murid"
			/>
			<div
				class="tab-content mt-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{@render field('Jalan', data.murid.alamat?.jalan)}
					{@render field('Kelurahan/Desa', data.murid.alamat?.desa)}
					{@render field('Kecamatan', data.murid.alamat?.kecamatan)}
					{@render field('Kabupaten/Kota', data.murid.alamat?.kabupaten)}
					{@render field('Provinsi', data.murid.alamat?.provinsi)}
				</div>
			</div>
			<!-- data Wali -->
			<input
				type="radio"
				name="tab-detil-murid"
				class="tab pointer-events-auto text-xs font-semibold"
				aria-label="Data Wali"
			/>
			<div
				class="tab-content mt-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{@render field('Nama Wali', data.murid.wali?.nama)}
					{@render field('Pekerjaan Wali', data.murid.wali?.pekerjaan)}
					{@render field('Alamat Wali', data.murid.wali?.alamat)}
					{@render field('Kontak', data.murid.wali?.kontak)}
				</div>
			</div>
			<!-- data Wali Asuh -->
			<input
				type="radio"
				name="tab-detil-murid"
				class="tab pointer-events-auto text-xs font-semibold"
				aria-label="Wali Asuh"
			/>
			<div
				class="tab-content mt-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{@render field('Nama Wali Asuh', data.murid.waliAsuhNama)}
					{@render field('NIP Wali Asuh', data.murid.waliAsuhNip)}
				</div>
			</div>
			<!-- Arsip dokumen -->
			<input
				type="radio"
				name="tab-detil-murid"
				class="tab pointer-events-auto text-xs font-semibold"
				aria-label="Arsip"
			/>
			<div
				class="tab-content mt-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<MuridArsipTab
					muridId={data.murid.id}
					lampiran={data.murid.lampiran ?? []}
					status={data.murid.status}
					canEdit={canUploadBerkas}
				/>
			</div>
		</div>
	</div>
</div>

<div
	class="mt-4 flex flex-row justify-between gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800"
>
	<button
		type="button"
		class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 pointer-events-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
		onclick={() => history.back()}
	>
		<Icon name="close" class="h-3.5 w-3.5" />
		Tutup
	</button>

	{#if canEdit}
		<a
			class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
			href="/master-data/murid/form/{data.murid.id}"
			use:modalRoute={'edit-murid'}
		>
			<Icon name="edit" class="h-3.5 w-3.5" />
			Edit
		</a>
	{:else}
		<button
			type="button"
			class="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white opacity-50"
			disabled
			aria-disabled="true"
			title="Anda tidak memiliki izin untuk mengedit"
		>
			<Icon name="edit" class="h-3.5 w-3.5" />
			Edit
		</button>
	{/if}
</div>

<!-- Upload Foto Modal -->
<MuridPhotoUploadModal
	bind:isOpen={isUploadModalOpen}
	muridId={data.murid?.id}
	muridNama={data.murid?.nama}
	onSuccess={handleUploadSuccess}
/>
