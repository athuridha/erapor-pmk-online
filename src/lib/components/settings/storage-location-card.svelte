<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import StorageFolderPicker from '$lib/components/settings/storage-folder-picker.svelte';

	let { storage }: { storage: { dataRoot: string; rootManagedByLauncher: boolean } } = $props();

	// Storage location form (admin only). Uploads/sounds follow the data root
	// automatically, so only the root is editable here.
	// svelte-ignore state_referenced_locally
	let storageRoot = $state(storage.dataRoot);
	const storageChanged = $derived(storageRoot !== storage.dataRoot);

	// Folder picker
	let pickerOpen = $state(false);
	let pickerInitial = $state('');
	let pickerTitle = $state('Pilih Folder');

	function openPicker() {
		pickerInitial = storageRoot;
		pickerTitle = 'Pilih Folder Root Data';
		pickerOpen = true;
	}

	function handlePickerSelect(event: CustomEvent<{ path: string }>) {
		storageRoot = event.detail.path;
		pickerOpen = false;
	}
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<FormEnhance action="?/update-storage-location">
		{#snippet children({ submitting })}
			<header class="mb-4 border-b border-slate-200 pb-3 dark:border-zinc-800">
				<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Lokasi Data</h2>
				<p class="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Pilih root data. Subfolder <code>ttd/</code>, <code>dinas-luar/</code>,
					<code>uploads/</code>, dan <code>sounds/</code> akan dibuat otomatis di dalamnya. File yang
					ada akan dipindahkan otomatis ke lokasi baru; perubahan berlaku setelah server dimulai ulang.
				</p>
			</header>

			{#if storage.rootManagedByLauncher}
				<div
					role="alert"
					class="mb-4 flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/75 px-3.5 py-2.5 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
				>
					<Icon name="alert" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
					<span
						>Pada instalasi Windows, pengaturan ini disimpan ke file Installer
						<code>%LOCALAPPDATA%\erapor-pmk-data\data-root.txt</code> dan diterapkan saat aplikasi
						dimulai ulang. Basis data tetap berada di
						<code>%LOCALAPPDATA%\erapor-pmk-data\database.sqlite3</code>.</span
					>
				</div>
			{/if}

			<div class="flex flex-col gap-1.5">
				<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>Root data (ERAPOR_PMK_DATA_DIR)</span
				>
				<div class="flex flex-col gap-2 sm:flex-row">
					<input
						class="h-9 flex-1 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						type="text"
						name="dataRoot"
						bind:value={storageRoot}
						placeholder="Kosongkan untuk default"
					/>
					<button
						class="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						type="button"
						onclick={openPicker}
					>
						<Icon name="folder" class="h-4 w-4" />
						Jelajah
					</button>
				</div>
				<p class="text-xs text-slate-500 dark:text-zinc-400">
					Cukup pilih root ini saja. Subfolder <code>ttd/</code>, <code>dinas-luar/</code>,
					<code>uploads/</code>, dan <code>sounds/</code> dibuat otomatis di dalamnya saat disimpan.
				</p>
			</div>

			<div
				role="alert"
				class="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300"
			>
				<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<span
					>File di lokasi lama akan disalin ke lokasi baru (tidak dihapus). Perlu mulai ulang server
					agar aplikasi membaca folder baru.</span
				>
			</div>

			<div class="mt-5 flex justify-end border-t border-slate-200 pt-4 dark:border-zinc-800">
				<button
					class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					type="submit"
					disabled={submitting || !storageChanged}
					aria-disabled={!storageChanged}
					title={storageChanged ? '' : 'Tidak ada perubahan yang disimpan'}
				>
					<Icon name="save" class="h-4 w-4" />
					{submitting ? 'Menyimpan…' : 'Simpan Lokasi'}
				</button>
			</div>
		{/snippet}
	</FormEnhance>

	<StorageFolderPicker
		open={pickerOpen}
		title={pickerTitle}
		initial={pickerInitial}
		on:select={handlePickerSelect}
		on:close={() => (pickerOpen = false)}
	/>
</section>
