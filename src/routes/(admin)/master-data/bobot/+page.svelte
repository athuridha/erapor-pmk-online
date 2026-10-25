<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	// State RAS
	// svelte-ignore state_referenced_locally
	let rasLingkup = $state(data.bobot.ras.lingkup);
	// svelte-ignore state_referenced_locally
	let rasSts = $state(data.bobot.ras.sts);
	// svelte-ignore state_referenced_locally
	let rasSas = $state(data.bobot.ras.sas);

	// State RTS
	// svelte-ignore state_referenced_locally
	let rtsLingkup = $state(data.bobot.rts.lingkup);
	// svelte-ignore state_referenced_locally
	let rtsSts = $state(data.bobot.rts.sts);

	const totalRas = $derived(
		(Number(rasLingkup) || 0) + (Number(rasSts) || 0) + (Number(rasSas) || 0)
	);
	const totalRts = $derived((Number(rtsLingkup) || 0) + (Number(rtsSts) || 0));

	const isRasValid = $derived(totalRas === 100);
	const isRtsValid = $derived(totalRts === 100);
	const isValid = $derived(isRasValid && isRtsValid);

	function resetForm() {
		rasLingkup = 60;
		rasSts = 20;
		rasSas = 20;
		rtsLingkup = 70;
		rtsSts = 30;
	}
</script>

<svelte:head>
	<title>Bobot Penilaian Sumatif — {data.sekolahNama}</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<!-- Header -->
	<div class="card bg-base-100 p-6 shadow-md dark:border-none">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Bobot Penilaian Sumatif</h1>
				<p class="text-base-content/70 mt-1 text-sm">
					Atur persentase bobot komponen penilaian untuk Rapor Akhir Semester (RAS) dan Rapor Tengah
					Semester (RTS). Nilai akhir siswa akan dihitung otomatis sesuai bobot ini.
				</p>
			</div>
			<div class="flex gap-2">
				<FormEnhance
					action="?/resetDefault"
					onsuccess={() => {
						resetForm();
						toast('Bobot berhasil dikembalikan ke standar default.', 'success');
					}}
				>
					{#snippet children({ submitting })}
						<button
							type="submit"
							class="btn btn-soft btn-sm shadow-none"
							disabled={submitting}
							title="Kembalikan ke standar 60/20/20 & 70/30"
						>
							<Icon name="repeat" />
							Reset Default
						</button>
					{/snippet}
				</FormEnhance>
			</div>
		</div>
	</div>

	<FormEnhance
		action="?/simpanBobot"
		onsuccess={() => {
			toast('Pengaturan bobot berhasil disimpan dan nilai akhir diperbarui.', 'success');
		}}
	>
		{#snippet children({ submitting })}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- Card RAS -->
				<div class="card bg-base-100 p-6 shadow-md dark:border-none">
					<div class="mb-4 flex items-center justify-between border-b pb-3">
						<div>
							<h2 class="text-lg font-bold">Rapor Akhir Semester (RAS)</h2>
							<p class="text-base-content/60 text-xs">Penentuan nilai akhir di buku rapor</p>
						</div>
						<span
							class="badge badge-sm font-semibold {isRasValid ? 'badge-success' : 'badge-error'}"
						>
							Total: {totalRas}%
						</span>
					</div>

					<div class="space-y-4">
						<fieldset class="fieldset">
							<legend class="fieldset-legend font-medium">Bobot Lingkup Materi / TP (%)</legend>
							<input
								type="number"
								name="rasLingkup"
								class="input bg-base-200 dark:bg-base-300 w-full"
								min="0"
								max="100"
								bind:value={rasLingkup}
								required
							/>
							<span class="label text-base-content/60 text-xs"
								>Rata-rata asesmen sumatif per materi pokok</span
							>
						</fieldset>

						<fieldset class="fieldset">
							<legend class="fieldset-legend font-medium"
								>Bobot Sumatif Tengah Semester (STS) (%)</legend
							>
							<input
								type="number"
								name="rasSts"
								class="input bg-base-200 dark:bg-base-300 w-full"
								min="0"
								max="100"
								bind:value={rasSts}
								required
							/>
							<span class="label text-base-content/60 text-xs"
								>Ujian / Asesmen pertengahan semester</span
							>
						</fieldset>

						<fieldset class="fieldset">
							<legend class="fieldset-legend font-medium"
								>Bobot Sumatif Akhir Semester (SAS) (%)</legend
							>
							<input
								type="number"
								name="rasSas"
								class="input bg-base-200 dark:bg-base-300 w-full"
								min="0"
								max="100"
								bind:value={rasSas}
								required
							/>
							<span class="label text-base-content/60 text-xs">Ujian / Asesmen akhir semester</span>
						</fieldset>

						{#if !isRasValid}
							<div class="alert alert-error alert-soft text-xs">
								<Icon name="warning" />
								<span>Total bobot RAS harus tepat 100% (saat ini {totalRas}%).</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Card RTS -->
				<div class="card bg-base-100 p-6 shadow-md dark:border-none">
					<div class="mb-4 flex items-center justify-between border-b pb-3">
						<div>
							<h2 class="text-lg font-bold">Rapor Tengah Semester (RTS)</h2>
							<p class="text-base-content/60 text-xs">
								Penentuan nilai rapor sisipan / tengah semester
							</p>
						</div>
						<span
							class="badge badge-sm font-semibold {isRtsValid ? 'badge-success' : 'badge-error'}"
						>
							Total: {totalRts}%
						</span>
					</div>

					<div class="space-y-4">
						<fieldset class="fieldset">
							<legend class="fieldset-legend font-medium">Bobot Lingkup Materi RTS (%)</legend>
							<input
								type="number"
								name="rtsLingkup"
								class="input bg-base-200 dark:bg-base-300 w-full"
								min="0"
								max="100"
								bind:value={rtsLingkup}
								required
							/>
							<span class="label text-base-content/60 text-xs"
								>Rata-rata asesmen sumatif sampai tengah semester</span
							>
						</fieldset>

						<fieldset class="fieldset">
							<legend class="fieldset-legend font-medium"
								>Bobot Sumatif Tengah Semester (STS) (%)</legend
							>
							<input
								type="number"
								name="rtsSts"
								class="input bg-base-200 dark:bg-base-300 w-full"
								min="0"
								max="100"
								bind:value={rtsSts}
								required
							/>
							<span class="label text-base-content/60 text-xs">Nilai STS tengah semester</span>
						</fieldset>

						{#if !isRtsValid}
							<div class="alert alert-error alert-soft text-xs">
								<Icon name="warning" />
								<span>Total bobot RTS harus tepat 100% (saat ini {totalRts}%).</span>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Footer Tombol Simpan -->
			<div
				class="card bg-base-100 mt-6 flex flex-row items-center justify-between p-4 shadow-md dark:border-none"
			>
				<div class="text-base-content/70 text-xs">
					{#if isValid}
						<span class="text-success font-medium">✓ Komposisi bobot sudah valid (100%).</span>
					{:else}
						<span class="text-error font-medium">⚠ Perbaiki total bobot sebelum menyimpan.</span>
					{/if}
				</div>
				<button type="submit" class="btn btn-primary shadow-none" disabled={!isValid || submitting}>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
						Menyimpan & Menghitung Ulang...
					{:else}
						<Icon name="save" />
						Simpan Bobot
					{/if}
				</button>
			</div>
		{/snippet}
	</FormEnhance>

	<!-- Informasi Petunjuk -->
	<div class="alert alert-info alert-soft text-xs">
		<Icon name="info" />
		<div class="space-y-1">
			<p class="font-bold">Informasi Rumus Perhitungan Nilai Akhir:</p>
			<ul class="list-disc pl-4 space-y-0.5">
				<li>
					<strong>Rapor Akhir Semester (RAS):</strong>
					<code>(Lingkup × BobotLingkup + STS × BobotSTS + SAS × BobotSAS) / 100</code>
				</li>
				<li>
					Jika suatu mata pelajaran tidak mengadakan STS, bobot dialihkan otomatis menjadi Lingkup
					70% dan SAS 30%.
				</li>
				<li>
					<strong>Rapor Tengah Semester (RTS):</strong>
					<code>(Lingkup × BobotLingkupRTS + STS × BobotSTSRTS) / 100</code>
				</li>
			</ul>
		</div>
	</div>
</div>
