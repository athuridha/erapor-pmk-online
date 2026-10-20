<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	const payload = $derived(data.payload ?? null);
	const valid = $derived(Boolean(data.valid));
</script>

<svelte:head>
	<title>Verifikasi Rapor - e-Rapor SMK Pratama Mulya</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-base-200 p-4">
	<div class="card bg-base-100 w-full max-w-lg rounded-box shadow-md">
		<div class="card-body gap-4 p-6">
			<header class="flex items-center gap-3">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full {valid
						? 'bg-success/15 text-success'
						: 'bg-error/15 text-error'}"
				>
					<Icon name={valid ? 'success' : 'error'} class="h-6 w-6" />
				</div>
				<div>
					<h1 class="text-xl font-bold">
						{valid ? 'Rapor ini sah' : 'Rapor tidak dapat diverifikasi'}
					</h1>
					<p class="text-base-content/70 text-sm">
						{valid
							? 'Tanda tangan digital pada QR cocok dengan data rapor.'
							: 'QR code tidak dikenali atau sudah diubah.'}
					</p>
				</div>
			</header>

			{#if payload}
				<div class="space-y-2 text-sm">
					<div class="flex justify-between gap-4 border-b border-base-300 pb-2">
						<span class="text-base-content/60">Nama Murid</span>
						<span class="text-right font-semibold">{payload.nama}</span>
					</div>
					<div class="flex justify-between gap-4 border-b border-base-300 pb-2">
						<span class="text-base-content/60">Kelas</span>
						<span class="text-right font-semibold">
							{payload.kelas}
							{#if payload.fase}
								· {payload.fase}{/if}
						</span>
					</div>
					<div class="flex justify-between gap-4 border-b border-base-300 pb-2">
						<span class="text-base-content/60">Sekolah</span>
						<span class="text-right font-semibold">{payload.sekolah}</span>
					</div>
					<div class="flex justify-between gap-4 border-b border-base-300 pb-2">
						<span class="text-base-content/60">Semester / Tahun Ajaran</span>
						<span class="text-right font-semibold">
							{payload.semester}
							{payload.tahunAjaran ? ` · ${payload.tahunAjaran}` : ''}
						</span>
					</div>
					{#if payload.periode}
						<div class="flex justify-between gap-4 border-b border-base-300 pb-2">
							<span class="text-base-content/60">Periode</span>
							<span class="text-right font-semibold">
								{payload.periode === 'rts' ? 'Rapor Tengah Semester' : 'Rapor Akhir Semester'}
							</span>
						</div>
					{/if}
					{#if payload.tanggal}
						<div class="flex justify-between gap-4">
							<span class="text-base-content/60">Tanggal Rapor</span>
							<span class="text-right font-semibold">{payload.tanggal}</span>
						</div>
					{/if}
				</div>
			{/if}

			<p class="text-base-content/60 text-xs">
				Verifikasi dilakukan secara offline dari tanda tangan digital pada QR code. Data yang
				ditampilkan berasal dari rapor itu sendiri, bukan dari database sekolah.
			</p>
		</div>
	</div>
</div>
