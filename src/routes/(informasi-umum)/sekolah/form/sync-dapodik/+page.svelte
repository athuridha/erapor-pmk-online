<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	type SectionLog = { label: string; status: 'ok' | 'gagal' | 'dilewati'; detail: string };

	const modes = [
		{ value: 'tes-koneksi', label: 'Tes Koneksi Dapodik' },
		{ value: 'semester', label: 'Ambil Semester Saja' },
		{ value: 'semua', label: 'Ambil Semua Data' }
	] as const;

	type ModeValue = (typeof modes)[number]['value'];

	let selectedMode = $state<ModeValue>('tes-koneksi');
	let sections = $state<SectionLog[]>([]);
	let resultMessage = $state('');
	let notif = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	const modeDescription: Record<ModeValue, string> = {
		'tes-koneksi': 'Berfungsi untuk melakukan tes koneksi dapodik melalui bearer token.',
		semester:
			'Ambil data semester saja. Berdampak pada halaman /sekolah/tahun-ajaran dan "Semester Aktif" pada halaman /akademik.',
		semua:
			'Ambil semua data yang dapat diambil dari Dapodik: profil sekolah, semester, PTK/guru, rombongan belajar, peserta didik, pembelajaran (mapel & pengampu), dan ekstrakurikuler.'
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
		form,
		data: payload
	}: {
		form?: HTMLFormElement;
		data?: Record<string, unknown>;
	}) {
		resultMessage =
			typeof payload?.message === 'string' ? payload.message : 'Sinkronisasi selesai.';
		sections = Array.isArray(payload?.sections) ? (payload.sections as SectionLog[]) : [];

		const submittedMode = form ? (new FormData(form).get('mode') as ModeValue | null) : null;
		if ((submittedMode ?? selectedMode) !== 'semua') {
			await refreshAll();
			notif = { type: 'success', message: resultMessage };
			return;
		}

		toast(resultMessage, 'success');
		await goto('/', { replaceState: true });
	}

	function handleFailure({ data }: { data?: Record<string, unknown> }) {
		const message =
			typeof data?.fail === 'string'
				? data.fail
				: typeof data?.message === 'string'
					? data.message
					: 'Sinkronisasi Dapodik gagal.';
		resultMessage = '';
		sections = [];
		notif = { type: 'error', message };
	}
</script>

<FormEnhance
	action="?/sync"
	class="flex min-h-0 flex-1 flex-col"
	init={{ ...(data.settings ?? {}), npsn: data.npsn ?? '' }}
	showToast={false}
	updateAfterSuccess={false}
	onsuccess={handleSuccess}
	onfailure={handleFailure}
>
	{#snippet children({ submitting })}
		<h2
			class="mb-3 border-b border-slate-200 pb-3 text-lg font-bold tracking-tight text-slate-900 dark:border-zinc-800 dark:text-zinc-100"
		>
			Sinkronisasi Dapodik
		</h2>
		<div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
			<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
				Ambil data dari aplikasi Dapodik melalui Web Service (Bearer token). Data Dapodik akan
				menimpa data yang sudah ada di sistem.
			</p>

			{#if notif}
				<div
					role="alert"
					class="flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs {notif.type ===
					'success'
						? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
						: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'}"
				>
					<Icon
						name={notif.type === 'success' ? 'success' : 'error'}
						class="mt-0.5 h-4 w-4 shrink-0"
					/>
					<span class="text-wrap">{notif.message}</span>
				</div>
			{/if}

			<div class="grid grid-cols-1 gap-3">
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Token</span>
					<input
						required
						type="text"
						name="token"
						placeholder="Masukkan token web service dapodik"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
					/>
					<span class="text-xs text-slate-500 dark:text-zinc-400"
						>Token didapat dari menu Web Service pada aplikasi Dapodik.</span
					>
				</label>

				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">URL Dapodik</span>
					<input
						required
						type="text"
						name="url"
						placeholder="Contoh: 192.168.8.114:5774"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">NPSN</span>
					<input
						required
						type="text"
						name="npsn"
						placeholder="Contoh: 69856875"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Mode Sinkronisasi</span
					>
					<div class="relative flex items-center">
						<select
							bind:value={selectedMode}
							name="mode"
							class="validator h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						>
							{#each modes as item (item.value)}
								<option value={item.value}>{item.label}</option>
							{/each}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
					<span class="text-xs text-slate-500 dark:text-zinc-400"
						>{modeDescription[selectedMode]}</span
					>
				</label>
			</div>

			{#if sections.length > 0}
				<div
					class="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/70"
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
									<b class="text-slate-900 dark:text-zinc-100">{section.label}:</b>
									{section.detail}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
		<div
			class="modal-action mt-4 grid grid-cols-2 justify-between gap-2 border-t border-slate-200 pt-3 sm:flex sm:flex-row sm:items-center dark:border-zinc-800"
		>
			<button
				type="button"
				class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 sm:w-auto sm:flex-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={() => history.back()}
			>
				<Icon name="close" class="h-3.5 w-3.5" />
				Tutup
			</button>
			<button
				class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:flex-none"
				disabled={submitting}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					<Icon name="play" class="h-3.5 w-3.5" />
				{/if}
				Proses
			</button>
		</div>
	{/snippet}
</FormEnhance>
