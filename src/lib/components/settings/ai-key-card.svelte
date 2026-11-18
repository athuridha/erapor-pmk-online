<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let {
		variant,
		title,
		description,
		idPrefix,
		data
	}: {
		variant: 'sekolah' | 'pribadi';
		title: string;
		description: string;
		idPrefix: string;
		data: {
			keySet: boolean;
			maskedKey: string | null;
			envKeyPresent: boolean;
			model: string;
			baseUrl: string;
		};
	} = $props();

	// svelte-ignore state_referenced_locally
	const isPersonal = variant === 'pribadi';
	const saveAction = isPersonal ? '?/save-my-ai-key' : '?/save-gemini-key';
	const clearAction = isPersonal ? '?/clear-my-ai-key' : '?/clear-gemini-key';

	// Password visibility toggle
	let showKey = $state(false);
	let clearingKey = $state(false);
	// svelte-ignore state_referenced_locally
	let aiModel = $state(data.model);
	// svelte-ignore state_referenced_locally
	let aiBaseUrl = $state(data.baseUrl);
</script>

<section
	id="ai-key"
	class="scroll-mt-20 rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<FormEnhance
		action={saveAction}
		onsuccess={({ form }) => {
			form.reset();
		}}
	>
		{#snippet children({ submitting, invalid })}
			<header class="mb-4 space-y-2 border-b border-slate-200 pb-3 dark:border-zinc-800">
				<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">{title}</h2>
				<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					{description}
				</p>
				{#if data.keySet}
					<div
						class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
					>
						<Icon name="success" class="h-4 w-4 shrink-0" />
						<span>Kunci API {isPersonal ? 'pribadi ' : ''}aktif: {data.maskedKey}</span>
					</div>
				{:else if isPersonal}
					<div
						class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
					>
						<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0" />
						<span
							>Belum ada kunci API pribadi. Kunci sekolah tidak bisa dipakai untuk fitur "Generate".
							Setel kunci Anda di bawah.</span
						>
					</div>
				{:else if data.envKeyPresent}
					<div
						class="flex items-start gap-2 rounded-xl border border-blue-200/80 bg-blue-50/75 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
					>
						<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
						<span
							>Kunci API aktif dari variabel lingkungan <code>GEMINI_API_KEY</code> (file .env). Kunci
							di atas tidak dapat diubah dari halaman ini.</span
						>
					</div>
				{:else}
					<div
						class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
					>
						<Icon name="warning" class="h-4 w-4 shrink-0" />
						<span>Belum ada kunci API. Fitur "Generate" belum dapat digunakan.</span>
					</div>
				{/if}
			</header>

			<div class="space-y-4">
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Kunci API</span>
					<div
						class="flex h-9 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
					>
						<span class="pl-3 text-slate-500 dark:text-zinc-400"
							><Icon name="key" class="h-4 w-4" /></span
						>
						<input
							type={showKey ? 'text' : 'password'}
							id="{idPrefix}ApiKey"
							name="apiKey"
							class="validator h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
							required
							minlength={10}
							placeholder="AIzaSy… / sk-… / ds-…"
							autocomplete="off"
						/>
						<button
							type="button"
							class="cursor-pointer pr-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
							onclick={() => (showKey = !showKey)}
							aria-label="Lihat atau sembunyikan kunci API"
						>
							<Icon name={showKey ? 'eye-off' : 'eye'} class="h-4 w-4" />
						</button>
					</div>
					<span class="text-xs text-slate-500 dark:text-zinc-400">
						Masukkan kunci API baru untuk mengganti kunci yang tersimpan.
					</span>
				</label>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Model</span>
						<input
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							type="text"
							name="model"
							bind:value={aiModel}
							placeholder={isPersonal ? 'ikut setelan sekolah' : 'gemini-3.6-flash'}
							list="{idPrefix}-model-list"
						/>
						<datalist id="{idPrefix}-model-list">
							<option value="gemini-3.6-flash"></option>
							<option value="gemini-3.1-pro"></option>
							<option value="gemini-3.7-flash"></option>
							<option value="claude-opus-4.8"></option>
							<option value="claude-opus-5"></option>
							<option value="claude-sonnet-5"></option>
							<option value="gpt-5.6-sol"></option>
							<option value="gpt-5.6-terra"></option>
							<option value="deepseek-v4-flash"></option>
							<option value="deepseek-v4-pro"></option>
							<option value="glm-5.2"></option>
							<option value="glm-5.3"></option>
							<option value="kimi-k3"></option>
							<option value="qwen3.8-max"></option>
						</datalist>
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							{isPersonal
								? 'Kosongkan untuk mengikuti model setelan sekolah.'
								: 'Nama model sesuai penyedia API yang digunakan.'}
						</span>
					</label>

					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Base URL</span>
						<input
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							type="text"
							name="baseUrl"
							bind:value={aiBaseUrl}
							placeholder={isPersonal
								? 'ikut setelan sekolah'
								: 'contoh: https://generativelanguage.googleapis.com'}
							autocomplete="off"
							required={!isPersonal}
						/>
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							{#if isPersonal}
								Kosongkan untuk mengikuti base URL sekolah.
							{:else}
								Endpoint API lengkap termasuk <code>/v1</code> jika diperlukan.
							{/if}
						</span>
					</label>
				</div>
			</div>

			<div class="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800">
				{#if data.keySet}
					<button
						class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
						type="submit"
						form="{idPrefix}-key-clear"
						disabled={clearingKey}
					>
						<Icon name="del" class="h-3.5 w-3.5" />
						{clearingKey ? 'Menghapus…' : 'Hapus Kunci'}
					</button>
				{/if}

				<button
					class="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					type="submit"
					disabled={submitting || invalid}
				>
					<Icon name="save" class="h-4 w-4" />
					{submitting ? 'Menyimpan…' : 'Simpan'}
				</button>
			</div>
		{/snippet}
	</FormEnhance>

	{#if data.keySet}
		<FormEnhance
			id="{idPrefix}-key-clear"
			action={clearAction}
			submitStateChange={(s) => (clearingKey = s)}
		>
			{#snippet children({ submitting })}
				<button type="submit" class="hidden" disabled={submitting}>Hapus</button>
			{/snippet}
		</FormEnhance>
	{/if}
</section>
