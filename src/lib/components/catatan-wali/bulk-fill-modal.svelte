<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { hideModal, setLoading } from '$lib/components/global-modal.svelte';

	interface Props {
		formId: string;
		muridIdsPayload: string;
		catatan: string;
		targetCount: number;
		onCatatanChange?: (value: string) => void;
		onSuccess?: (params: { data?: Record<string, unknown> }) => void | Promise<void>;
		onAction?: (actions: { submit: () => void }) => void;
	}

	let {
		formId,
		muridIdsPayload,
		catatan,
		targetCount,
		onCatatanChange,
		onSuccess,
		onAction
	}: Props = $props();

	let catatanOverride = $state<string | null>(null);
	const catatanValue = $derived.by(() => catatanOverride ?? catatan);
	// svelte-ignore state_referenced_locally
	let previousCatatan = catatan;

	$effect(() => {
		if (catatan !== previousCatatan) {
			previousCatatan = catatan;
			catatanOverride = null;
			return;
		}
		if (catatanOverride != null && catatanOverride === catatan) {
			catatanOverride = null;
		}
	});

	function handleInput(event: Event) {
		const value = (event.currentTarget as HTMLTextAreaElement).value;
		catatanOverride = value;
		onCatatanChange?.(value);
	}

	async function handleSuccess({
		data
	}: {
		form: HTMLFormElement;
		data?: Record<string, unknown>;
	}) {
		await onSuccess?.({ data });
		hideModal();
	}

	$effect(() => {
		onAction?.({
			submit: () => (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit()
		});
	});
</script>

<div class="not-prose flex flex-col gap-4">
	<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
		Terapkan catatan yang sama untuk <strong class="text-slate-900 dark:text-zinc-100"
			>{targetCount}</strong
		> murid pada halaman ini. Tindakan ini akan menimpa catatan sebelumnya.
	</p>

	<FormEnhance
		action="?/fillAll"
		id={formId}
		onsuccess={handleSuccess}
		submitStateChange={setLoading}
	>
		<input type="hidden" name="muridIds" value={muridIdsPayload} />
		<label class="flex flex-col gap-1.5">
			<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Catatan</span>
			<textarea
				class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				name="catatan"
				rows="5"
				value={catatanValue}
				oninput={handleInput}
				placeholder="Tuliskan catatan yang ingin diterapkan ke semua murid"
				spellcheck="false"></textarea>
			<small class="text-[11px] text-slate-500 dark:text-zinc-400">
				Biarkan kosong untuk menghapus catatan seluruh murid pada halaman ini.
			</small>
		</label>
	</FormEnhance>
</div>
