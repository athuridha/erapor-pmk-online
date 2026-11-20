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
	let apiKeyInput = $state('');
	let models = $state<string[]>([]);
	let fetchingModels = $state(false);
	let modelsError = $state('');
	// svelte-ignore state_referenced_locally
	let aiModel = $state(data.model);
	// svelte-ignore state_referenced_locally
	let aiBaseUrl = $state(data.baseUrl);
	const bisaMuatModel = $derived(apiKeyInput.trim().length > 0 && aiBaseUrl.trim().length > 0);

	function resetModels() {
		models = [];
		modelsError = '';
	}

	async function muatModel() {
		if (fetchingModels) return;
		fetchingModels = true;
		modelsError = '';
		try {
			const response = await fetch('/api/ai/models', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ baseUrl: aiBaseUrl, apiKey: apiKeyInput })
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				modelsError = body?.message || 'Gagal memuat daftar model.';
				return;
			}
			models = Array.isArray(body?.models) ? body.models : [];
			if (!models.length) modelsError = 'Tidak ada model yang tersedia di base URL ini.';
		} catch {
			modelsError = 'Gagal menghubungi penyedia AI.';
		} finally {
			fetchingModels = false;
		}
	}
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
							bind:value={apiKeyInput}
							oninput={resetModels}
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
						<span class="flex items-center justify-between gap-2">
							<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Model</span>
							<button
								type="button"
								class="inline-flex h-6 items-center gap-1 rounded-md px-1 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
								onclick={muatModel}
								disabled={fetchingModels || !bisaMuatModel}
								title={bisaMuatModel
									? 'Ambil daftar model dari base URL'
									: 'Isi kunci API dan base URL terlebih dahulu'}
								aria-busy={fetchingModels}
							>
								{#if fetchingModels}
									<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
								{:else}
									<Icon name="repeat" class="h-3 w-3" />
								{/if}
								Muat model
							</button>
						</span>
						{#if models.length}
							<input
								class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								type="text"
								name="model"
								bind:value={aiModel}
								placeholder="Pilih model"
								list="{idPrefix}-model-list"
								required
							/>
							<datalist id="{idPrefix}-model-list">
								{#each models as model (model)}
									<option value={model}></option>
								{/each}
							</datalist>
						{:else}
							<input type="hidden" name="model" value={aiModel} />
							<div
								class="flex h-9 w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400"
							>
								{aiModel || 'Isi kunci API dan base URL, lalu muat model'}
							</div>
						{/if}
						<span class="text-xs text-slate-500 dark:text-zinc-400">
							{modelsError
								? modelsError
								: isPersonal
									? 'Kosongkan untuk mengikuti model setelan sekolah.'
									: bisaMuatModel
										? 'Klik "Muat dari base URL" untuk mengambil daftar model.'
										: 'Isi kunci API dan base URL terlebih dahulu, lalu muat model.'}
						</span>
					</label>

					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Base URL</span>
						<input
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
							type="text"
							name="baseUrl"
							bind:value={aiBaseUrl}
							oninput={resetModels}
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
