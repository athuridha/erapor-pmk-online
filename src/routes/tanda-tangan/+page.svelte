<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import SignaturePad from '$lib/components/settings/signature-pad.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	interface Penandatangan {
		pegawaiId: number;
		nama: string;
		nip: string;
		peran: 'Kepala Sekolah' | 'Wali Kelas';
		kelas: string[];
		hasSignature: boolean;
		signatureUrl: string | null;
		bisaUbah: boolean;
	}

	const penandatangan = $derived((data.penandatangan ?? []) as Penandatangan[]);
</script>

<div class="space-y-4">
	<header class="space-y-1">
		<h1 class="text-2xl font-bold">Tanda Tangan</h1>
		<p class="text-base-content/70 text-sm">
			Unggah tanda tangan kepala sekolah dan wali kelas. Tanda tangan ini dipakai otomatis di
			dokumen cetak (rapor, piagam, berita acara) sebagai gambar di atas nama penandatangan.
		</p>
	</header>

	{#if penandatangan.length === 0}
		<div class="alert alert-info">
			<Icon name="info" />
			<span>
				Belum ada kepala sekolah atau wali kelas yang bisa ditandatangani. Isi data kelas dan
				penugasan wali kelas terlebih dahulu.
			</span>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{#each penandatangan as orang (orang.pegawaiId)}
				<section class="card bg-base-100 rounded-box shadow-md">
					<div class="card-body gap-3 p-4">
						<header class="flex flex-wrap items-start justify-between gap-2">
							<div>
								<h2 class="text-lg font-bold">{orang.nama}</h2>
								<p class="text-base-content/60 text-xs">
									{orang.peran}
									{#if orang.nip}
										· NIP {orang.nip}{/if}
								</p>
								{#if orang.kelas.length > 0}
									<p class="text-base-content/70 mt-1 text-xs">
										{orang.kelas.join(', ')}
									</p>
								{/if}
							</div>
							<span
								class="badge badge-soft {orang.hasSignature ? 'badge-success' : 'badge-warning'}"
							>
								{orang.hasSignature ? 'Sudah ada' : 'Belum ada'}
							</span>
						</header>

						<SignaturePad
							pegawaiId={orang.pegawaiId}
							existingSrc={orang.signatureUrl}
							canEdit={orang.bisaUbah}
							simpanDi={async () => {
								await invalidateAll();
							}}
						/>
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
