<script lang="ts" module>
	export type DeleteSekolahModalHandle = {
		open: (sekolah: import('./types').SekolahCard) => void;
		close: () => void;
	};
</script>

<script lang="ts">
	import { invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { SekolahCard } from './types';

	let dialogEl: HTMLDialogElement | null = null;
	let targetSekolah = $state<SekolahCard | null>(null);
	let purgeAck = $state(false);

	const needsPurgeAck = $derived.by(() => {
		const sekolah = targetSekolah;
		if (!sekolah) return false;
		return (sekolah.jumlahRombel ?? 0) > 0 || (sekolah.jumlahMurid ?? 0) > 0;
	});

	function resetState() {
		targetSekolah = null;
		purgeAck = false;
	}

	export function open(sekolah: SekolahCard) {
		targetSekolah = sekolah;
		purgeAck = false;
		requestAnimationFrame(() => {
			try {
				console.debug('[DeleteSekolahModal] open() called for', sekolah && sekolah.id);
				dialogEl?.showModal();
			} catch (err) {
				// fallback: some envs/browsers may not support dialog.showModal or it may throw
				console.debug('[DeleteSekolahModal] showModal failed, applying fallback', err);
				if (dialogEl) {
					dialogEl.setAttribute('open', '');
					// add modal class on document to mimic dialog show if needed (daisyui uses .modal)
					document.documentElement.classList.add('modal-open');
				}
			}
		});
	}

	export function close() {
		dialogEl?.close();
		resetState();
	}

	async function handleDeleteSuccess() {
		await invalidate('app:sekolah');
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
	{#if targetSekolah}
		{@const sekolah = targetSekolah}
		<div
			class="modal-box max-h-[85vh] max-w-2xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-0 text-slate-900 shadow-2xl sm:max-h-[90vh] sm:w-full dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<FormEnhance action="?/delete" onsuccess={handleDeleteSuccess}>
				{#snippet children({ submitting })}
					<input type="hidden" name="sekolahId" value={sekolah.id} />
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
								<div>
									<h3
										class="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100"
									>
										Hapus data sekolah?
									</h3>
									<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
										Anda akan menghapus <b class="text-slate-800 dark:text-zinc-200"
											>{sekolah.nama}</b
										> dari daftar sekolah secara permanen.
									</p>
								</div>
							</div>
						</header>
						<section class="flex-1 overflow-y-auto p-4 sm:p-5">
							<div class="space-y-4">
								<div class="grid gap-3 sm:grid-cols-2">
									<div
										class="rounded-xl border border-slate-200/80 bg-slate-50/65 p-3 dark:border-zinc-800 dark:bg-zinc-800/45"
									>
										<p
											class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
										>
											Total Rombel
										</p>
										<p class="mt-0.5 text-lg font-bold text-slate-900 dark:text-zinc-100">
											{sekolah.jumlahRombel}
										</p>
									</div>
									<div
										class="rounded-xl border border-slate-200/80 bg-slate-50/65 p-3 dark:border-zinc-800 dark:bg-zinc-800/45"
									>
										<p
											class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
										>
											Total Murid
										</p>
										<p class="mt-0.5 text-lg font-bold text-slate-900 dark:text-zinc-100">
											{sekolah.jumlahMurid}
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
											Sekolah masih memiliki rombel atau murid. Anda dapat menghapus semuanya
											sekaligus dengan opsi di bawah.
										</span>
									</div>
									<div
										class="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/65 p-4 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/45 dark:text-zinc-300"
									>
										<p>Centang persetujuan untuk menghapus seluruh data berikut secara permanen:</p>
										<ul class="ml-5 list-disc space-y-1">
											<li>
												Semua rombel dan mata pelajaran, termasuk Pendidikan Agama dan Budi Pekerti
											</li>
											<li>Tujuan pembelajaran, ekstrakurikuler, dan kokurikuler</li>
											<li>Seluruh murid beserta data pendukungnya</li>
											<li>Tahun ajaran aktif dan riwayat tugas terkait sekolah</li>
											<li>
												Kepala sekolah dan wali kelas (pegawai) yang tidak digunakan di sekolah lain
											</li>
											<li>
												Data orang tua/wali murid serta alamat sekolah dan alamat murid yang hanya
												dimiliki sekolah ini
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
											<span class="leading-relaxed">
												Saya paham tindakan ini tidak dapat dibatalkan dan ingin menghapus seluruh
												data sekolah.
											</span>
										</label>
									</div>
								{:else}
									<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
										Tindakan ini akan menghapus data sekolah secara permanen, termasuk kepala
										sekolah, wali kelas, alamat terkait, serta data orang tua/wali murid yang masih
										terhubung.
									</p>
								{/if}
							</div>
						</section>
						<footer
							class="shrink-0 border-t border-slate-200/70 bg-white p-4 sm:px-5 dark:border-zinc-800 dark:bg-zinc-900"
						>
							<div class="flex items-center justify-between gap-2">
								<button
									type="button"
									class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
									onclick={close}
									disabled={submitting}
								>
									<Icon name="close" class="h-3.5 w-3.5" />
									Batal
								</button>
								<button
									type="submit"
									class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-4 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
									disabled={submitting || (needsPurgeAck && !purgeAck)}
								>
									{#if submitting}
										<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
										<span class="sr-only">Menghapus sekolah...</span>
									{:else}
										<Icon name="del" class="h-3.5 w-3.5" />
									{/if}
									Hapus Sekolah
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
