<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	type GeneratedGroup = {
		lingkupMateri: string;
		deskripsi: string[];
	};

	interface Props {
		mapelId: number;
		mapelName: string;
		kelasLabel: string;
		onCancel: () => void;
		onSuccess: (data?: Record<string, unknown>) => void;
	}

	let { mapelId, mapelName, kelasLabel, onCancel, onSuccess }: Props = $props();

	let capaianPembelajaran = $state('');
	let maxLingkupMateri = $state(10);
	let maxTujuanPembelajaran = $state(10);
	let generating = $state(false);
	let saving = $state(false);
	let errorMessage = $state('');
	let groups = $state<GeneratedGroup[]>([]);

	let aiStatus = $state<'checking' | 'ready' | 'unconfigured'>('checking');
	let isAdminUser = $state(false);

	const isFormEnabled = $derived(aiStatus === 'ready');

	const isAgamaFamily = $derived(
		/^pendidikan (agama|kepercayaan)/i.test(mapelName) || /^pendalaman kitab suci/i.test(mapelName)
	);

	const UNCONFIGURED_MESSAGE =
		'Fitur AI belum aktif. Silakan setel kunci API di halaman Pengaturan.';

	onMount(() => {
		(async () => {
			try {
				const response = await fetch('/api/ai/status');
				const body = await response.json().catch(() => ({}));
				aiStatus = response.ok && body?.configured ? 'ready' : 'unconfigured';
				isAdminUser = Boolean(body?.isAdmin);
			} catch {
				aiStatus = 'unconfigured';
			}
		})();
	});

	const hasGenerated = $derived(groups.length > 0);

	function resetError() {
		errorMessage = '';
	}

	async function handleGenerate() {
		resetError();
		if (!isFormEnabled) {
			errorMessage = UNCONFIGURED_MESSAGE;
			return;
		}
		if (!capaianPembelajaran.trim()) {
			errorMessage = 'Capaian Pembelajaran wajib diisi.';
			return;
		}
		if (!Number.isInteger(maxLingkupMateri) || maxLingkupMateri < 1) {
			errorMessage = 'Maksimal Lingkup Materi harus antara 1–20.';
			return;
		}
		if (!Number.isInteger(maxTujuanPembelajaran) || maxTujuanPembelajaran < 1) {
			errorMessage = 'Maksimal Tujuan Pembelajaran harus antara 1–20.';
			return;
		}

		generating = true;
		try {
			const response = await fetch('/api/ai/generate-tp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mapelId,
					capaianPembelajaran: capaianPembelajaran.trim(),
					maxLingkupMateri,
					maxTujuanPembelajaran
				})
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				errorMessage = body?.message || 'Gagal generate tujuan pembelajaran.';
				return;
			}
			const nextGroups = (body?.data?.groups ?? []) as GeneratedGroup[];
			if (nextGroups.length === 0) {
				errorMessage = 'AI tidak menghasilkan lingkup materi. Coba lagi.';
				return;
			}
			groups = nextGroups;
		} catch {
			errorMessage = 'Terjadi kesalahan saat menghubungi layanan AI. Coba lagi.';
		} finally {
			generating = false;
		}
	}

	function updateLingkupMateri(index: number, value: string) {
		groups = groups.map((group, groupIndex) =>
			groupIndex === index ? { ...group, lingkupMateri: value } : group
		);
	}

	function updateDeskripsi(groupIndex: number, tpIndex: number, value: string) {
		groups = groups.map((group, index) =>
			index === groupIndex
				? {
						...group,
						deskripsi: group.deskripsi.map((tp, tpIndex2) => (tpIndex2 === tpIndex ? value : tp))
					}
				: group
		);
	}

	function removeDeskripsi(groupIndex: number, tpIndex: number) {
		groups = groups.map((group, index) =>
			index === groupIndex
				? { ...group, deskripsi: group.deskripsi.filter((_, tpIndex2) => tpIndex2 !== tpIndex) }
				: group
		);
	}

	function removeGroup(groupIndex: number) {
		groups = groups.filter((_, index) => index !== groupIndex);
	}

	function handleBackToForm() {
		groups = [];
		resetError();
	}

	async function handleSave() {
		resetError();
		const cleaned = groups
			.map((group) => ({
				lingkupMateri: group.lingkupMateri.trim(),
				deskripsi: group.deskripsi.map((tp) => tp.trim()).filter((tp) => tp.length > 0)
			}))
			.filter((group) => group.lingkupMateri.length > 0 && group.deskripsi.length > 0);

		if (cleaned.length === 0) {
			errorMessage = 'Minimal satu lingkup materi dengan tujuan pembelajaran harus diisi.';
			return;
		}

		const formData = new FormData();
		cleaned.forEach((group, groupIndex) => {
			formData.append(`groups.${groupIndex}.lingkupMateri`, group.lingkupMateri);
			group.deskripsi.forEach((tp, tpIndex) => {
				formData.append(`groups.${groupIndex}.deskripsi.${tpIndex}`, tp);
			});
		});

		saving = true;
		try {
			const response = await fetch('?/aigenerate', {
				method: 'POST',
				body: formData
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				toast(body?.data?.fail || 'Gagal menyimpan tujuan pembelajaran.', 'error');
				return;
			}
			const data = (body?.data ?? {}) as Record<string, unknown>;
			toast(
				typeof data.message === 'string' ? data.message : 'Tujuan pembelajaran berhasil disimpan.',
				'success'
			);
			onSuccess(data);
		} catch {
			toast('Terjadi kesalahan saat menyimpan tujuan pembelajaran.', 'error');
		} finally {
			saving = false;
		}
	}

	function handleCancel() {
		onCancel();
	}
</script>

<dialog class="modal bg-slate-950/45 backdrop-blur-[2px]" open onclose={handleCancel}>
	{#snippet UnconfiguredMessage()}
		<span>
			Fitur AI belum aktif. Setel kunci API {isAdminUser ? '' : 'pribadi Anda '}di halaman
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- deep link to settings page AI key card -->
			<a class="font-medium underline hover:opacity-80" href="/pengaturan#ai-key">Pengaturan</a>.
		</span>
	{/snippet}
	<div
		class="modal-box flex max-h-[90vh] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl sm:w-full sm:max-w-3xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
	>
		<div class="mb-3 flex shrink-0 items-start justify-between gap-3">
			<div>
				<h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
					Generate Lingkup Materi dan Tujuan Pelajaran {mapelName}
					{kelasLabel}
				</h3>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Fitur ini menggunakan AI untuk generate Materi beserta Tujuan Pembelajarannya menggunakan
					taksonomi SOLO.
				</p>
			</div>
			<button
				type="button"
				class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
				onclick={handleCancel}
				disabled={generating || saving}
				aria-label="Tutup"
			>
				<Icon name="close" class="h-4 w-4" />
			</button>
		</div>

		<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-0.5">
			{#if aiStatus !== 'unconfigured'}
				<div
					class="flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3.5 py-2.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
					role="note"
				>
					<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
					{#if isAgamaFamily}
						<span>
							Khusus sekolah negeri, pastikan menggunakan Capaian Pembelajaran dari
							<a
								class="font-medium underline hover:text-blue-700 dark:hover:text-blue-300"
								href="https://drive.google.com/file/d/1kZnNYVitjQQqHtqVHGhuiMTdNFDqF3v1/view"
								target="_blank"
								rel="noreferrer">Keputusan Kepala BKPDM Nomor 020 Tahun 2026</a
							>.
						</span>
					{:else}
						<span>
							Khusus sekolah negeri, pastikan menggunakan Capaian Pembelajaran dari
							<a
								class="font-medium underline hover:text-blue-700 dark:hover:text-blue-300"
								href="https://uploads.belajar.id/document/files/Kepka_BSKAP_No_01k17e8396ajn15j3hcw0k773b.pdf"
								target="_blank"
								rel="noreferrer">Keputusan Kepala BSKAP Nomor 046 tahun 2025</a
							>.
						</span>
					{/if}
				</div>
			{/if}

			{#if errorMessage}
				<div
					class="flex items-start gap-2.5 rounded-xl border border-red-200/80 bg-red-50/90 px-3.5 py-2.5 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
					role="alert"
				>
					<Icon name="error" class="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
					{#if errorMessage.startsWith('Fitur AI belum aktif')}
						{@render UnconfiguredMessage()}
					{:else}
						<span>{errorMessage}</span>
					{/if}
				</div>
			{/if}

			{#if aiStatus === 'checking'}
				<div
					class="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3.5 py-2.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
				>
					<span class="loading loading-spinner loading-xs"></span>
					<span>Memeriksa ketersediaan fitur AI…</span>
				</div>
			{:else if aiStatus === 'unconfigured'}
				<div
					class="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
					role="alert"
				>
					<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
					{@render UnconfiguredMessage()}
				</div>
			{/if}

			{#if !hasGenerated}
				<div class="flex flex-col gap-4">
					<label class="block space-y-1.5">
						<span class="block text-xs font-medium text-slate-700 dark:text-zinc-300"
							>Capaian Pembelajaran</span
						>
						<textarea
							class="min-h-40 w-full rounded-xl border border-[#7e8b9b] bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
							bind:value={capaianPembelajaran}
							placeholder="Tempel atau tulis Capaian Pembelajaran mata pelajaran ini"
							disabled={!isFormEnabled}></textarea>
					</label>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<label class="block space-y-1.5">
							<span class="block text-xs font-medium text-slate-700 dark:text-zinc-300"
								>Maksimal Lingkup Materi</span
							>
							<input
								type="number"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								bind:value={maxLingkupMateri}
								min="1"
								max="20"
								step="1"
								disabled={!isFormEnabled}
							/>
						</label>

						<label class="block space-y-1.5">
							<span class="block text-xs font-medium text-slate-700 dark:text-zinc-300"
								>Maksimal Tujuan Pembelajaran</span
							>
							<input
								type="number"
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
								bind:value={maxTujuanPembelajaran}
								min="1"
								max="20"
								step="1"
								disabled={!isFormEnabled}
							/>
						</label>
					</div>
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each groups as group, groupIndex (groupIndex)}
						<div
							class="rounded-xl border border-slate-200/80 bg-slate-50/65 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/45"
						>
							<div class="mb-2.5 flex items-center gap-2">
								<span class="shrink-0 text-xs font-semibold text-slate-700 dark:text-zinc-300">
									Lingkup {groupIndex + 1}
								</span>
								<input
									type="text"
									class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
									value={group.lingkupMateri}
									oninput={(event) =>
										updateLingkupMateri(
											groupIndex,
											(event.currentTarget as HTMLInputElement).value
										)}
									aria-label="Nama lingkup materi"
								/>
								<button
									type="button"
									class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
									title="Hapus lingkup materi ini"
									onclick={() => removeGroup(groupIndex)}
								>
									<Icon name="del" class="h-3.5 w-3.5" />
								</button>
							</div>
							<div class="flex flex-col gap-2">
								{#each group.deskripsi as tp, tpIndex (tpIndex)}
									<div class="flex items-start gap-2">
										<textarea
											class="min-h-16 w-full rounded-xl border border-[#7e8b9b] bg-white p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
											value={tp}
											maxlength="100"
											oninput={(event) =>
												updateDeskripsi(
													groupIndex,
													tpIndex,
													(event.currentTarget as HTMLTextAreaElement).value
												)}
											aria-label={`Tujuan pembelajaran ${tpIndex + 1}`}></textarea>
										<button
											type="button"
											class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
											title="Hapus tujuan pembelajaran ini"
											onclick={() => removeDeskripsi(groupIndex, tpIndex)}
										>
											<Icon name="del" class="h-3.5 w-3.5" />
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div
			class="mt-4 flex shrink-0 items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-zinc-800"
		>
			<button
				class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				type="button"
				onclick={handleCancel}
				disabled={generating || saving}
			>
				Batal
			</button>

			<div class="flex items-center gap-2">
				{#if hasGenerated}
					<button
						class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						type="button"
						onclick={handleBackToForm}
						disabled={generating || saving}
					>
						Kembali
					</button>
					<button
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						type="button"
						onclick={handleSave}
						disabled={saving}
						aria-busy={saving}
					>
						{#if saving}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<Icon name="save" class="h-3.5 w-3.5" />
						{/if}
						Simpan ke Halaman
					</button>
				{:else}
					<button
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						type="button"
						onclick={handleGenerate}
						disabled={generating || !isFormEnabled}
						aria-busy={generating}
					>
						{#if generating}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<Icon name="sparkles" class="h-3.5 w-3.5" />
						{/if}
						Generate
					</button>
				{/if}
			</div>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop bg-transparent">
		<button>close</button>
	</form>
</dialog>
