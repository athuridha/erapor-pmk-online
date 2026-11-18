<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { hideModal } from '$lib/components/global-modal.svelte';
</script>

<div
	role="alert"
	class="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
>
	<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
	<span>
		Data wali kelas yang terisi otomatis dari dapodik akan terhapus dan bapak/ibu harus mengisi
		manual (khusus guru yang belum ada di dapodik). Konfirmasi?
	</span>
</div>

<FormEnhance
	id="reset-walas-form"
	action="?/reset-walas"
	onsuccess={async () => {
		await invalidate('app:kelas');

		await goto('/kelas');
		hideModal();
	}}
>
	<label class="flex flex-col gap-1.5">
		<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Nama Guru</span>
		<input
			required
			type="text"
			class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			placeholder="Contoh: Bruce Wayne, Bat"
			name="namaGuru"
			autocomplete="off"
		/>
	</label>
</FormEnhance>
