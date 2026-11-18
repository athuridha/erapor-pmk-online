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
		<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Tanda Tangan</h1>
		<p class="text-xs text-slate-600 dark:text-zinc-400">
			Unggah tanda tangan kepala sekolah dan wali kelas. Tanda tangan ini dipakai otomatis di
			dokumen cetak (rapor, piagam, berita acara) sebagai gambar di atas nama penandatangan.
		</p>
	</header>

	{#if penandatangan.length === 0}
		<div
			class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0" />
			<span>
				Belum ada kepala sekolah atau wali kelas yang bisa ditandatangani. Isi data kelas dan
				penugasan wali kelas terlebih dahulu.
			</span>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{#each penandatangan as orang (orang.pegawaiId)}
				<section
					class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<div class="flex flex-col gap-3">
						<header
							class="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-zinc-800"
						>
							<div>
								<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">{orang.nama}</h2>
								<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
									{orang.peran}
									{#if orang.nip}
										&middot; NIP {orang.nip}{/if}
								</p>
								{#if orang.kelas.length > 0}
									<p class="mt-1 text-xs font-medium text-slate-700 dark:text-zinc-300">
										{orang.kelas.join(', ')}
									</p>
								{/if}
							</div>
							<span
								class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold {orang.hasSignature
									? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
									: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'}"
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
