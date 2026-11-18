<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let { data } = $props();

	type SectionLog = { label: string; status: 'ok' | 'gagal' | 'dilewati'; detail: string };

	const modes = [
		{ value: 'tes-koneksi', label: 'Tes Koneksi Dapodik' },
		{ value: 'kirim-matev', label: 'Kirim Matev' },
		{ value: 'kirim-nilai', label: 'Kirim Nilai' }
	] as const;

	type ModeValue = (typeof modes)[number]['value'];

	let selectedMode = $state<ModeValue>('tes-koneksi');
	let sections = $state<SectionLog[]>([]);
	let resultMessage = $state('');
	let notif = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	const modeDescription: Record<ModeValue, string> = {
		'tes-koneksi': 'Berfungsi untuk melakukan tes koneksi dapodik melalui bearer token.',
		'kirim-matev':
			'Mengambil daftar mata evaluasi dari Dapodik lalu membuat/memperbarui mata evaluasi untuk setiap mata pelajaran pada kelas aktif. Hanya mapel yang memiliki kode Dapodik yang dapat dikirim.',
		'kirim-nilai':
			'Mengirim mata evaluasi terlebih dahulu, lalu mengirim nilai akhir setiap murid ke Dapodik. Hanya murid dengan UUID Dapodik dan nilai akhir yang sudah terisi yang dapat terkirim.'
	};

	function statusIcon(status: SectionLog['status']): IconName {
		if (status === 'ok') return 'success';
		if (status === 'gagal') return 'error';
		return 'info';
	}

	function statusClass(status: SectionLog['status']): string {
		if (status === 'ok') return 'text-success';
		if (status === 'gagal') return 'text-error';
		return 'opacity-60';
	}

	async function handleSuccess({
		data: payload
	}: {
		form?: HTMLFormElement;
		data?: Record<string, unknown>;
	}) {
		resultMessage = typeof payload?.message === 'string' ? payload.message : 'Proses selesai.';
		sections = Array.isArray(payload?.sections) ? (payload.sections as SectionLog[]) : [];
		await refreshAll();
		notif = { type: 'success', message: resultMessage };
	}

	function handleFailure({ data }: { data?: Record<string, unknown> }) {
		const message =
			typeof data?.fail === 'string'
				? data.fail
				: typeof data?.message === 'string'
					? data.message
					: 'Kirim nilai ke Dapodik gagal.';
		resultMessage = '';
		sections = [];
		notif = { type: 'error', message };
	}
</script>

<FormEnhance
	action="?/kirim"
	class="flex min-h-0 flex-1 flex-col"
	init={{ ...(data.settings ?? {}), npsn: data.npsn ?? '' }}
	showToast={false}
	updateAfterSuccess={false}
	onsuccess={handleSuccess}
	onfailure={handleFailure}
>
	{#snippet children({ submitting })}
		<h3 class="mb-3 text-lg font-bold text-slate-900 dark:text-zinc-100">Kirim Nilai ke Dapodik</h3>
		<div class="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-0.5">
			<p class="text-xs text-slate-600 dark:text-zinc-400">
				Mengirim nilai akhir kelas {data.kelasNama ?? '-'} ke aplikasi Dapodik melalui Web Service (Bearer
				token).
			</p>

			{#if notif}
				<div
					role="alert"
					class="flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs {notif.type ===
					'success'
						? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200'
						: 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200'}"
				>
					<Icon
						name={notif.type === 'success' ? 'success' : 'error'}
						class="mt-0.5 h-4 w-4 shrink-0"
					/>
					<span class="text-wrap">{notif.message}</span>
				</div>
			{/if}

			<div class="grid grid-cols-1 gap-3">
				<input type="hidden" name="kelas_id" value={data.kelasId ?? ''} />

				<div>
					<label
						for="dapodik-token"
						class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300"
					>
						Token
					</label>
					<input
						id="dapodik-token"
						required
						type="text"
						name="token"
						placeholder="Masukkan token web service dapodik"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
					/>
					<p class="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
						Token didapat dari menu Web Service pada aplikasi Dapodik.
					</p>
				</div>

				<div>
					<label
						for="dapodik-url"
						class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300"
					>
						URL Dapodik
					</label>
					<input
						id="dapodik-url"
						required
						type="text"
						name="url"
						placeholder="Contoh: 192.168.8.114:5774"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
					/>
				</div>

				<div>
					<label
						for="dapodik-npsn"
						class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300"
					>
						NPSN
					</label>
					<input
						id="dapodik-npsn"
						required
						type="text"
						name="npsn"
						placeholder="Contoh: 69856875"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
					/>
				</div>

				<div>
					<label
						for="dapodik-mode"
						class="mb-1 block text-xs font-medium text-slate-700 dark:text-zinc-300"
					>
						Mode Pengiriman
					</label>
					<div class="relative flex items-center">
						<select
							id="dapodik-mode"
							bind:value={selectedMode}
							name="mode"
							class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						>
							{#each modes as item (item.value)}
								<option value={item.value}>{item.label}</option>
							{/each}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
					<p class="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
						{modeDescription[selectedMode]}
					</p>
				</div>
			</div>

			{#if sections.length > 0}
				<div
					class="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
				>
					{#if resultMessage}
						<p class="mb-2 text-xs font-semibold text-slate-900 dark:text-zinc-100">
							{resultMessage}
						</p>
					{/if}
					<ul class="flex flex-col gap-1.5">
						{#each sections as section (section.label)}
							<li class="flex items-start gap-2 text-xs text-slate-700 dark:text-zinc-300">
								<span class="{statusClass(section.status)} mt-0.5 shrink-0">
									<Icon name={statusIcon(section.status)} class="h-3.5 w-3.5" />
								</span>
								<span>
									<b>{section.label}:</b>
									{section.detail}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
		<div
			class="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 md:flex md:items-center dark:border-zinc-800"
		>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 md:mr-auto md:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={() => history.back()}
			>
				<Icon name="close" class="h-4 w-4" />
				Tutup
			</button>
			<button
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto dark:bg-blue-500 dark:hover:bg-blue-600"
				disabled={submitting}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Icon name="play" class="h-4 w-4" />
				{/if}
				Proses
			</button>
		</div>
	{/snippet}
</FormEnhance>
