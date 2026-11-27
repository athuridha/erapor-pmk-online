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
	<title>Bobot Penilaian Sumatif - {data.sekolahNama}</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-5">
	<!-- Header -->
	<div
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Bobot Penilaian Sumatif
				</h1>
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Atur persentase bobot komponen penilaian untuk Rapor Akhir Semester (RAS) dan Rapor Tengah
					Semester (RTS). Nilai akhir siswa akan dihitung otomatis sesuai bobot ini.
				</p>
			</div>
			<div class="flex shrink-0 gap-2">
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
							class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							aria-disabled={submitting}
							disabled={submitting}
							title="Kembalikan ke standar 60/20/20 & 70/30"
						>
							<Icon name="repeat" class="h-3.5 w-3.5" />
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
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<!-- Card RAS -->
				<div
					class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<div
						class="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-zinc-800"
					>
						<div>
							<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">
								Rapor Akhir Semester (RAS)
							</h2>
							<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
								Penentuan nilai akhir di buku rapor
							</p>
						</div>
						<span
							class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums {isRasValid
								? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
								: 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300'}"
						>
							Total: {totalRas}%
						</span>
					</div>

					<div class="space-y-4">
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Bobot Formatif (F) (%)</span
							>
							<input
								type="number"
								name="rasLingkup"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								min="0"
								max="100"
								bind:value={rasLingkup}
								required
							/>
							<span class="text-xs text-slate-500 dark:text-zinc-400"
								>Nilai rata-rata berbobot kolom asesmen Formatif (F)</span
							>
						</label>

						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Bobot Sumatif (S) (%)</span
							>
							<input
								type="number"
								name="rasSts"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								min="0"
								max="100"
								bind:value={rasSts}
								required
							/>
							<span class="text-xs text-slate-500 dark:text-zinc-400"
								>Nilai rata-rata berbobot kolom Sumatif (S) / Tengah Semester</span
							>
						</label>

						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Bobot Sumatif AS (AS) (%)</span
							>
							<input
								type="number"
								name="rasSas"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								min="0"
								max="100"
								bind:value={rasSas}
								required
							/>
							<span class="text-xs text-slate-500 dark:text-zinc-400"
								>Ujian / Asesmen akhir semester</span
							>
						</label>

						{#if !isRasValid}
							<div
								class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
							>
								<Icon name="warning" class="h-4 w-4 shrink-0" />
								<span>Total bobot RAS harus tepat 100% (saat ini {totalRas}%).</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Card RTS -->
				<div
					class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<div
						class="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-zinc-800"
					>
						<div>
							<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">
								Rapor Tengah Semester (RTS)
							</h2>
							<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
								Penentuan nilai rapor sisipan / tengah semester
							</p>
						</div>
						<span
							class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums {isRtsValid
								? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
								: 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300'}"
						>
							Total: {totalRts}%
						</span>
					</div>

					<div class="space-y-4">
						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Bobot Lingkup Materi RTS (%)</span
							>
							<input
								type="number"
								name="rtsLingkup"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								min="0"
								max="100"
								bind:value={rtsLingkup}
								required
							/>
							<span class="text-xs text-slate-500 dark:text-zinc-400"
								>Rata-rata asesmen sumatif sampai tengah semester</span
							>
						</label>

						<label class="flex flex-col gap-1.5">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
								>Bobot Sumatif Tengah Semester (STS) (%)</span
							>
							<input
								type="number"
								name="rtsSts"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
								min="0"
								max="100"
								bind:value={rtsSts}
								required
							/>
							<span class="text-xs text-slate-500 dark:text-zinc-400"
								>Nilai STS tengah semester</span
							>
						</label>

						{#if !isRtsValid}
							<div
								class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
							>
								<Icon name="warning" class="h-4 w-4 shrink-0" />
								<span>Total bobot RTS harus tepat 100% (saat ini {totalRts}%).</span>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Footer Tombol Simpan -->
			<div
				class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div class="text-xs">
					{#if isValid}
						<span class="font-semibold text-emerald-700 dark:text-emerald-400"
							>Komposisi bobot sudah valid (100%).</span
						>
					{:else}
						<span class="font-semibold text-red-700 dark:text-red-400"
							>Perbaiki total bobot sebelum menyimpan.</span
						>
					{/if}
				</div>
				<button
					type="submit"
					class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!isValid || submitting}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
						Menyimpan &amp; Menghitung Ulang...
					{:else}
						<Icon name="save" class="h-4 w-4" />
						Simpan Bobot
					{/if}
				</button>
			</div>
		{/snippet}
	</FormEnhance>

	<!-- Informasi Petunjuk -->
	<div
		class="flex items-start gap-2.5 rounded-2xl border border-blue-200/80 bg-blue-50/75 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
	>
		<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0" />
		<div class="space-y-1 leading-relaxed">
			<p class="font-bold">Cara perhitungan nilai akhir:</p>
			<ul class="list-disc space-y-0.5 pl-4">
				<li>
					<strong>Rapor Akhir Semester (RAS):</strong>
					<code>NA (F) + NA (S) + NA (AS)</code>, dengan masing-masing
					<code>NA = rata-rata komponen × persentase bobot</code>.
				</li>
				<li>
					<strong>Rapor Tengah Semester (RTS):</strong>
					<code>NA (F) + NA (S)</code> menggunakan persentase bobot RTS.
				</li>
				<li>
					Komponen yang belum diisi dihitung <code>0</code> sampai nilainya diinput, selama minimal satu
					komponen sudah terisi (bila semua kosong, nilai akhir tetap kosong).
				</li>
			</ul>
		</div>
	</div>
</div>
