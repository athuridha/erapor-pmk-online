<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	type DocumentType = 'cover' | 'biodata' | 'rapor' | 'piagam' | 'jurnal-mengajar';

	type PreviewPayload = {
		meta?: { title?: string | null } | null;
		coverData?: NonNullable<App.PageData['coverData']> | null;
		biodataData?: NonNullable<App.PageData['biodataData']> | null;
		raporData?: NonNullable<App.PageData['raporData']> | null;
		piagamData?: NonNullable<App.PageData['piagamData']> | null;
	};

	let {
		previewDocument = '',
		previewData = null,
		previewError = null,
		selectedTemplate = '1',
		bgRefreshKey = 0,
		onPrintableReady,
		onBulkPrintableReady,
		showBgLogo = false
	}: {
		previewDocument: DocumentType | '';
		previewData: PreviewPayload | null;
		previewError: string | null;
		selectedTemplate: '1' | '2';
		bgRefreshKey: number;
		onPrintableReady: (node: HTMLDivElement | null) => void;
		onBulkPrintableReady: (index: number, node: HTMLDivElement | null) => void;
		showBgLogo?: boolean;
	} = $props();

	// Props digunakan untuk re-rendering dan reaktivitas, meskipun tidak langsung di template
	// svelte-ignore state_referenced_locally
	void selectedTemplate;
	// svelte-ignore state_referenced_locally
	void bgRefreshKey;
	// svelte-ignore state_referenced_locally
	void onPrintableReady;
	// svelte-ignore state_referenced_locally
	void onBulkPrintableReady;
	// svelte-ignore state_referenced_locally
	void showBgLogo;
</script>

{#if previewError}
	<div
		role="alert"
		class="mt-6 flex items-center gap-3 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-xs font-medium text-red-900 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200"
	>
		<Icon name="error" class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
		<span>{previewError}</span>
	</div>
{:else if previewDocument && previewData}
	<div
		role="status"
		class="mt-6 flex items-center gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/80 px-4 py-3 text-xs font-medium text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200"
	>
		<Icon name="info" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
		<span>Pilih murid dan klik tombol "Unduh PDF" untuk mengunduh dokumen.</span>
	</div>
{/if}

<style lang="postcss">
</style>
