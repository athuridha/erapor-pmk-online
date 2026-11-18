<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let { passkeySet }: { passkeySet: boolean } = $props();

	// Password visibility toggles
	let showBukuTamuPasskey = $state(false);
	let showBukuTamuConfirm = $state(false);
	let clearingBukuTamuPasskey = $state(false);
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<FormEnhance
		action="?/buku-tamu-passkey"
		onsuccess={({ form }) => {
			form.reset();
		}}
	>
		{#snippet children({ submitting, invalid })}
			<header class="mb-4 space-y-2 border-b border-slate-200 pb-3 dark:border-zinc-800">
				<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Passkey Buku Tamu</h2>
				<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
					Jika diaktifkan, pengunjung harus memasukkan passkey sekali saat membuka halaman
					<code>/tamu</code> sebelum dapat mengisi buku tamu. Kosongkan untuk menonaktifkan.
				</p>
				{#if passkeySet}
					<div
						class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
					>
						<Icon name="success" class="h-4 w-4 shrink-0" />
						<span>Passkey buku tamu aktif.</span>
					</div>
				{/if}
			</header>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Passkey</span>
					<div
						class="flex h-9 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
					>
						<span class="pl-3 text-slate-500 dark:text-zinc-400"
							><Icon name="lock" class="h-4 w-4" /></span
						>
						<input
							type={showBukuTamuPasskey ? 'text' : 'password'}
							id="passkey"
							name="passkey"
							class="validator h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
							required
							minlength={4}
							maxlength={64}
							placeholder="Masukkan passkey baru (4-64 karakter)"
							autocomplete="new-password"
						/>
						<button
							type="button"
							class="cursor-pointer pr-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
							onclick={() => (showBukuTamuPasskey = !showBukuTamuPasskey)}
							aria-label="Lihat atau sembunyikan kunci akses"
						>
							<Icon name={showBukuTamuPasskey ? 'eye-off' : 'eye'} class="h-4 w-4" />
						</button>
					</div>
				</label>

				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Konfirmasi passkey</span
					>
					<div
						class="flex h-9 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
					>
						<span class="pl-3 text-slate-500 dark:text-zinc-400"
							><Icon name="lock" class="h-4 w-4" /></span
						>
						<input
							type={showBukuTamuConfirm ? 'text' : 'password'}
							id="confirmPasskey"
							name="confirmPasskey"
							class="validator h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
							required
							minlength={4}
							maxlength={64}
							placeholder="Ulangi passkey baru"
							autocomplete="new-password"
						/>
						<button
							type="button"
							class="cursor-pointer pr-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
							onclick={() => (showBukuTamuConfirm = !showBukuTamuConfirm)}
							aria-label="Lihat atau sembunyikan konfirmasi kunci akses"
						>
							<Icon name={showBukuTamuConfirm ? 'eye-off' : 'eye'} class="h-4 w-4" />
						</button>
					</div>
				</label>
			</div>

			<div class="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800">
				{#if passkeySet}
					<button
						class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
						type="submit"
						form="buku-tamu-passkey-clear"
						disabled={clearingBukuTamuPasskey}
					>
						<Icon name="del" class="h-3.5 w-3.5" />
						{clearingBukuTamuPasskey ? 'Menonaktifkan…' : 'Nonaktifkan Passkey'}
					</button>
				{/if}

				<button
					class="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					type="submit"
					disabled={submitting || invalid}
				>
					<Icon name="save" class="h-4 w-4" />
					{submitting ? 'Menyimpan…' : 'Simpan Passkey'}
				</button>
			</div>
		{/snippet}
	</FormEnhance>

	{#if passkeySet}
		<FormEnhance
			id="buku-tamu-passkey-clear"
			action="?/buku-tamu-passkey-clear"
			submitStateChange={(s) => (clearingBukuTamuPasskey = s)}
		>
			{#snippet children({ submitting })}
				<button type="submit" class="hidden" disabled={submitting}>Nonaktifkan</button>
			{/snippet}
		</FormEnhance>
	{/if}
</section>
