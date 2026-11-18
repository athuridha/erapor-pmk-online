<script lang="ts">
	import { invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { KelasCard } from './types';

	let dialogEl: HTMLDialogElement | null = null;
	let targetKelas = $state<KelasCard | null>(null);
	let purgeAck = $state(false);

	const needsPurgeAck = $derived.by(() => {
		const kelas = targetKelas;
		if (!kelas) return false;
		return (
			(kelas.jumlahMurid ?? 0) > 0 ||
			(kelas.jumlahMapel ?? 0) > 0 ||
			(kelas.jumlahEkstrakurikuler ?? 0) > 0 ||
			(kelas.jumlahKokurikuler ?? 0) > 0 ||
			Boolean(kelas.waliKelas)
		);
	});

	function resetState() {
		targetKelas = null;
		purgeAck = false;
	}

	export function open(kelas: KelasCard) {
		targetKelas = kelas;
		purgeAck = false;
		requestAnimationFrame(() => dialogEl?.showModal());
	}

	export function close() {
		dialogEl?.close();
		resetState();
	}

	async function handleDeleteSuccess() {
		await invalidate('app:kelas');
		close();
	}
</script>

<dialog
	class="modal bg-slate-950/45 backdrop-blur-[2px]"
	bind:this={dialogEl}
	aria-modal="true"
	role="alertdialog"
	onclose={resetState}
>
	{#if targetKelas}
		{@const kelas = targetKelas as KelasCard}
		<div
			class="modal-box max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-0 text-slate-900 shadow-2xl sm:max-h-[90vh] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<FormEnhance action="?/delete" onsuccess={handleDeleteSuccess}>
				{#snippet children({ submitting })}
					<input name="id" value={kelas.id} hidden />
					<div class="flex max-h-[85vh] flex-col sm:max-h-[90vh]">
						<header
							class="shrink-0 border-b border-slate-200/70 bg-white p-4 sm:px-5 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<div class="flex items-start gap-3">
								<span
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
									aria-hidden="true"
								>
									<Icon name="warning" class="h-5 w-5" />
								</span>
								<div class="flex flex-col gap-0.5">
									<h3
										class="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100"
									>
										Hapus kelas?
									</h3>
									<p class="text-xs text-slate-500 dark:text-zinc-400">
										Yakin ingin menghapus kelas <span
											class="font-semibold text-slate-800 dark:text-zinc-200">{kelas.nama}</span
										> dari daftar rombel?
									</p>
								</div>
							</div>
						</header>
						<section class="flex-1 overflow-y-auto p-4 sm:p-5">
							<div class="space-y-4">
								<div class="space-y-1 text-xs text-slate-600 dark:text-zinc-400">
									<p class="text-sm font-semibold text-slate-900 dark:text-zinc-100">
										{kelas.nama}
									</p>
									<p>
										Fase: <span class="font-medium text-slate-800 dark:text-zinc-200"
											>{kelas.fase ?? '-'}</span
										>
									</p>
									<p>
										Tahun Ajaran: <span class="font-medium text-slate-800 dark:text-zinc-200"
											>{kelas.tahunAjaran?.nama ?? '-'}</span
										>
									</p>
									<p>
										Semester: <span class="font-medium text-slate-800 dark:text-zinc-200"
											>{kelas.semester?.nama ?? '-'}</span
										>
									</p>
								</div>

								<div class="grid gap-3 sm:grid-cols-2">
									<div
										class="rounded-xl border border-slate-200/80 bg-slate-50/65 p-3 dark:border-zinc-800 dark:bg-zinc-800/45"
									>
										<p
											class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
										>
											Jumlah Murid
										</p>
										<p class="mt-0.5 text-lg font-bold text-slate-900 dark:text-zinc-100">
											{kelas.jumlahMurid}
										</p>
									</div>
									<div
										class="rounded-xl border border-slate-200/80 bg-slate-50/65 p-3 dark:border-zinc-800 dark:bg-zinc-800/45"
									>
										<p
											class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
										>
											Mata Pelajaran
										</p>
										<p class="mt-0.5 text-lg font-bold text-slate-900 dark:text-zinc-100">
											{kelas.jumlahMapel}
										</p>
									</div>
									<div
										class="rounded-xl border border-slate-200/80 bg-slate-50/65 p-3 dark:border-zinc-800 dark:bg-zinc-800/45"
									>
										<p
											class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
										>
											Ekstrakurikuler
										</p>
										<p class="mt-0.5 text-lg font-bold text-slate-900 dark:text-zinc-100">
											{kelas.jumlahEkstrakurikuler}
										</p>
									</div>
									<div
										class="rounded-xl border border-slate-200/80 bg-slate-50/65 p-3 dark:border-zinc-800 dark:bg-zinc-800/45"
									>
										<p
											class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
										>
											Kokurikuler
										</p>
										<p class="mt-0.5 text-lg font-bold text-slate-900 dark:text-zinc-100">
											{kelas.jumlahKokurikuler}
										</p>
									</div>
								</div>

								{#if needsPurgeAck}
									<div
										class="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
									>
										<Icon
											name="warning"
											class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
										/>
										<span>
											Kelas masih memiliki relasi data. Centang persetujuan untuk menghapus seluruh
											data berikut secara permanen.
										</span>
									</div>
									<div
										class="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/65 p-4 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/45 dark:text-zinc-300"
									>
										<ul class="ml-5 list-disc space-y-1">
											<li>Seluruh murid dalam kelas</li>
											<li>Semua mata pelajaran termasuk Pendidikan Agama dan Budi Pekerti</li>
											<li>Tujuan pembelajaran, ekstrakurikuler, dan kokurikuler</li>
											<li>Wali kelas (pegawai) jika tidak digunakan di kelas atau sekolah lain</li>
											<li>
												Data orang tua/wali murid beserta alamat yang hanya dimiliki kelas ini
											</li>
										</ul>
										<label
											class="flex cursor-pointer items-start gap-2.5 rounded-xl border border-red-200/80 bg-red-50/75 p-3 text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300"
										>
											<input
												type="checkbox"
												class="checkbox checkbox-sm mt-0.5 rounded border-red-400 checked:border-red-600 checked:bg-red-600 checked:text-white"
												name="forceDelete"
												value="true"
												bind:checked={purgeAck}
												required
											/>
											<span class="leading-relaxed"
												>Saya paham tindakan ini tidak dapat dibatalkan dan ingin menghapus seluruh
												data tersebut secara permanen.</span
											>
										</label>
									</div>
								{:else}
									<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
										Tindakan ini akan menghapus data kelas secara permanen, termasuk wali kelas,
										data orang tua/wali murid, serta alamat yang hanya dimiliki kelas ini.
									</p>
								{/if}
							</div>
						</section>
						<footer
							class="shrink-0 border-t border-slate-200/70 bg-white p-4 sm:px-5 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<div class="flex items-center justify-end gap-2">
								<button
									class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
									type="button"
									onclick={close}
								>
									Batal
								</button>
								<button
									class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-4 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
									disabled={submitting || (needsPurgeAck && !purgeAck)}
								>
									{#if submitting}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										<Icon name="del" class="h-3.5 w-3.5" />
									{/if}
									Hapus
								</button>
							</div>
						</footer>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<form method="dialog" class="modal-backdrop bg-transparent">
			<button>close</button>
		</form>
	{/if}
</dialog>
