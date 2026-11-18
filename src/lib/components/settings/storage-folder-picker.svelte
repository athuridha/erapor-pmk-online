<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import type { BrowseResponse } from '$lib/server/storage-browse';

	interface Props {
		open: boolean;
		title: string;
		initial: string;
	}

	let { open, title, initial }: Props = $props();

	const dispatch = createEventDispatcher<{ close: void; select: { path: string } }>();

	let current = $state('');
	let parent = $state<string | null>(null);
	let entries = $state<string[]>([]);
	let drives = $state<string[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	function requestClose() {
		dispatch('close');
	}

	function requestSelect() {
		if (!current) return;
		dispatch('select', { path: current });
	}

	async function extractErrorMessage(response: Response): Promise<string> {
		const contentType = response.headers.get('content-type') ?? '';
		if (contentType.includes('application/json')) {
			try {
				const body = (await response.json()) as { message?: string } | null;
				if (typeof body?.message === 'string' && body.message) return body.message;
			} catch {
				// malformed JSON — fall through to the generic message
			}
		}
		return '';
	}

	async function load(target: string | null, name?: string) {
		loading = true;
		error = null;
		try {
			const params = new URLSearchParams();
			if (target) params.set('path', target);
			if (name) params.set('name', name);
			const qs = params.toString();
			const response = await fetch(`/api/storage/browse${qs ? `?${qs}` : ''}`, {
				credentials: 'same-origin',
				cache: 'no-store'
			});
			if (!response.ok) {
				const message = await extractErrorMessage(response);
				throw new Error(message || `Gagal memuat folder (${response.status}).`);
			}
			let payload: BrowseResponse | null = null;
			try {
				payload = (await response.json()) as BrowseResponse;
			} catch {
				payload = null;
			}
			if (!payload) {
				throw new Error('Respons server tidak valid. Silakan masuk kembali dan coba lagi.');
			}
			current = payload.current;
			parent = payload.parent;
			entries = payload.entries;
			drives = payload.drives;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Gagal memuat folder.';
		} finally {
			loading = false;
		}
	}

	function navigate(name: string) {
		void load(current, name);
	}

	function goUp() {
		if (!parent) return;
		void load(parent);
	}

	$effect(() => {
		if (open) {
			void load(initial);
		}
	});

	function handleCancel(event: Event) {
		event.preventDefault();
		requestClose();
	}
</script>

{#if open}
	<dialog
		class="modal modal-open modal-middle bg-slate-950/45 backdrop-blur-[2px]"
		open
		aria-modal="true"
		oncancel={handleCancel}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				requestClose();
			}
		}}
	>
		<div
			class="modal-box max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<div class="border-b border-slate-100 pb-3 dark:border-zinc-800">
				<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">{title}</h2>
				<p class="mt-0.5 break-all font-mono text-xs text-slate-500 dark:text-zinc-400">
					{current || 'Pilih drive/folder'}
				</p>
			</div>

			<div class="mt-4 space-y-3">
				{#if error}
					<div
						class="flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
					>
						<Icon name="error" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
						<span>{error}</span>
					</div>
				{/if}

				<div class="flex flex-wrap gap-2">
					<button
						class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						type="button"
						onclick={goUp}
						disabled={!parent || loading}
					>
						<Icon name="up" class="h-3.5 w-3.5" />
						Naik
					</button>
					<button
						class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						type="button"
						onclick={() => void load(current)}
						disabled={loading}
					>
						<Icon name="repeat" class="h-3.5 w-3.5" />
						Muat ulang
					</button>
				</div>

				{#if loading}
					<div
						class="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
					>
						<p class="text-xs font-medium text-slate-600 dark:text-zinc-300">Memuat folder...</p>
						<progress class="progress progress-primary mt-3 w-full"></progress>
					</div>
				{:else}
					<div
						class="max-h-72 space-y-0.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-800/40"
					>
						{#if drives.length > 0}
							{#each drives as drive (drive)}
								<button
									class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-white hover:text-blue-700 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-blue-300"
									type="button"
									onclick={() => navigate(drive)}
								>
									<Icon name="folder" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
									<span class="font-mono font-medium">{drive}</span>
								</button>
							{/each}
						{/if}
						{#if entries.length === 0 && drives.length === 0}
							<p class="p-3 text-center text-xs text-slate-500 dark:text-zinc-400">
								Folder ini kosong (tidak ada subfolder).
							</p>
						{/if}
						{#each entries as name (current + '/' + name)}
							<button
								class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-white hover:text-blue-700 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-blue-300"
								type="button"
								onclick={() => navigate(name)}
							>
								<Icon name="folder" class="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
								<span class="truncate font-medium">{name}</span>
							</button>
						{/each}
					</div>
				{/if}

				<div class="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
					<button
						class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						type="button"
						onclick={requestClose}
					>
						Batal
					</button>
					<button
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
						type="button"
						onclick={requestSelect}
						disabled={!current}
					>
						<Icon name="check" class="h-3.5 w-3.5" />
						Pilih Folder Ini
					</button>
				</div>
			</div>
		</div>
		<form
			method="dialog"
			class="modal-backdrop bg-transparent"
			onsubmit={(event) => {
				event.preventDefault();
				requestClose();
			}}
		>
			<button type="submit">tutup</button>
		</form>
	</dialog>
{/if}
