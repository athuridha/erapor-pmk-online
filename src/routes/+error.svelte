<script lang="ts">
	import { page } from '$app/state';
	// `runes` attribute removed to avoid svelte-check warning about
	// unrecognized script attributes. The component reads the client-side
	// `page` store which is populated when the client starts with an error.

	function reload() {
		location.reload();
	}
</script>

<div
	class="w-full rounded-2xl border border-slate-200/75 bg-white p-6 text-center shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
>
	<h1 class="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-zinc-100">
		Ups, terjadi kesalahan
	</h1>
	<p class="mt-1.5 text-xs text-slate-600 dark:text-zinc-400">
		Status: <span class="font-mono text-sm font-semibold text-slate-900 dark:text-zinc-100"
			>{page?.status ?? 500}</span
		>
	</p>

	{#if page?.error}
		<div class="mt-5 w-full text-left">
			<p
				class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400"
			>
				Pesan teknis
			</p>
			<pre
				class="mt-1.5 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-800 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200"
				aria-live="polite">{String(page?.error?.message ?? page?.error)}</pre>
		</div>
	{/if}

	<div class="mt-6 flex flex-wrap justify-center gap-2.5">
		<a
			href="/"
			class="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
			aria-label="Kembali ke beranda"
		>
			Kembali ke Beranda
		</a>
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			onclick={reload}
			aria-label="Muat ulang halaman"
		>
			Muat ulang
		</button>
	</div>

	<p class="mt-4 text-xs text-slate-500 dark:text-zinc-400">
		Jika masalah berlanjut, hubungi admin sekolah dan sertakan nomor status di atas serta pesan
		teknis.
	</p>
</div>
