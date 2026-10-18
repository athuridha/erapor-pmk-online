<script lang="ts">
	let { data, form } = $props();

	const tokenSourceLabel = $derived(
		data.credentials.tokenSource === 'env'
			? 'Token dari pengaturan aplikasi'
			: data.credentials.tokenSource === 'database'
				? 'Token tersimpan di aplikasi'
				: data.credentials.tokenSource === 'wrangler'
					? 'Token dari sesi wrangler di komputer ini'
					: 'Belum ada token'
	);

	const counts = $derived(data.counts ?? {});
</script>

<svelte:head>
	<title>Penyiapan Awal - e-Rapor SMK Pratama Mulya</title>
</svelte:head>

<div class="min-h-screen bg-base-200 flex items-start justify-center p-4 py-10">
	<div class="w-full max-w-2xl space-y-4">
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body gap-4">
				<div>
					<h1 class="text-xl font-semibold">Penyiapan awal</h1>
					<p class="text-sm text-base-content/70 mt-1">
						Komputer ini belum punya data sekolah, jadi belum ada akun yang bisa dipakai masuk.
						Sinkronkan dulu master data dari Database Pusat: data sekolah, pegawai, kelas, siswa,
						dan akun pengguna. Setelah itu masuk seperti biasa.
					</p>
				</div>

				<div class="rounded-lg border border-base-300 p-3 text-sm space-y-1">
					<div class="flex items-center justify-between gap-3">
						<span class="text-base-content/70">Kredensial Database Pusat</span>
						<span class="badge {data.credentials.ready ? 'badge-success' : 'badge-warning'}">
							{data.credentials.ready ? 'Siap' : 'Belum siap'}
						</span>
					</div>
					<p class="text-base-content/70">{tokenSourceLabel}</p>
					{#if data.credentials.wranglerTokenExpired}
						<p class="text-warning">Sesi wrangler di komputer ini sudah kedaluwarsa.</p>
					{/if}
				</div>

				{#if form?.message}
					<div class="alert {form.success ? 'alert-success' : 'alert-error'} text-sm">
						<span>{form.message}</span>
					</div>
				{/if}

				{#if form?.step === 'pull' && form?.success}
					<div class="rounded-lg border border-base-300 p-3 text-sm">
						<p class="font-medium mb-2">Baris yang dipasang</p>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1">
							{#each Object.entries(form.counts ?? {}) as [name, total] (name)}
								<span class="text-base-content/70">{name.replaceAll('_', ' ')}</span>
								<span class="text-right tabular-nums">{total}</span>
							{/each}
						</div>
						<a class="btn btn-primary btn-sm mt-3" href="/login">Lanjut ke halaman masuk</a>
					</div>
				{:else}
					<div class="rounded-lg border border-base-300 p-3 text-sm">
						<p class="font-medium mb-2">Data lokal saat ini</p>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1">
							{#each Object.entries(counts) as [name, total] (name)}
								<span class="text-base-content/70">{name.replaceAll('_', ' ')}</span>
								<span class="text-right tabular-nums">{total}</span>
							{/each}
						</div>
					</div>

					<div class="flex flex-wrap gap-2">
						<form method="POST" action="?/test">
							<button class="btn btn-outline btn-sm" type="submit">Tes koneksi</button>
						</form>
						<form method="POST" action="?/pull">
							<button
								class="btn btn-primary btn-sm"
								type="submit"
								disabled={!data.credentials.ready}
							>
								Sinkron dari Database Pusat
							</button>
						</form>
						<a class="btn btn-ghost btn-sm" href="/login?manual=1">Lewati, masuk manual</a>
					</div>
				{/if}

				<p class="text-xs text-base-content/60">
					Halaman ini hanya bisa dibuka dari komputer yang menjalankan aplikasi dan hanya selama
					datanya masih kosong. Aplikasi versi {data.appVersion}.
				</p>
			</div>
		</div>
	</div>
</div>
