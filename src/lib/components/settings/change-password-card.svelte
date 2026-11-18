<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let { onsuccess }: { onsuccess?: () => void } = $props();

	// Password visibility toggles
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);

	function handlePasswordSuccess({ form }: { form: HTMLFormElement }) {
		form.reset();
		onsuccess?.();
	}
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	id="ganti-password"
>
	<div class="space-y-4">
		<header class="border-b border-slate-200 pb-3 dark:border-zinc-800">
			<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Ganti Kata Sandi</h2>
			<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
				Perbarui kata sandi untuk menjaga keamanan akses aplikasi.
			</p>
		</header>

		<FormEnhance action="?/change-password" onsuccess={handlePasswordSuccess}>
			{#snippet children({ submitting, invalid })}
				<div class="space-y-3">
					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Kata sandi saat ini</span
						>
						<div
							class="flex h-9 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
						>
							<span class="pl-3 text-slate-500 dark:text-zinc-400"
								><Icon name="lock" class="h-4 w-4" /></span
							>
							<input
								type={showCurrentPassword ? 'text' : 'password'}
								id="currentPassword"
								name="currentPassword"
								class="validator h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
								required
								autocomplete="current-password"
								placeholder="Masukkan kata sandi lama"
							/>
							<button
								type="button"
								class="cursor-pointer pr-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
								onclick={() => (showCurrentPassword = !showCurrentPassword)}
								aria-label="Lihat atau sembunyikan kata sandi"
							>
								<Icon name={showCurrentPassword ? 'eye-off' : 'eye'} class="h-4 w-4" />
							</button>
						</div>
					</label>

					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Kata sandi baru</span
						>
						<div
							class="flex h-9 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
						>
							<span class="pl-3 text-slate-500 dark:text-zinc-400"
								><Icon name="lock" class="h-4 w-4" /></span
							>
							<input
								type={showNewPassword ? 'text' : 'password'}
								id="newPassword"
								name="newPassword"
								class="validator h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
								required
								minlength={8}
								autocomplete="new-password"
								placeholder="Minimal 8 karakter"
							/>
							<button
								type="button"
								class="cursor-pointer pr-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
								onclick={() => (showNewPassword = !showNewPassword)}
								aria-label="Lihat atau sembunyikan kata sandi"
							>
								<Icon name={showNewPassword ? 'eye-off' : 'eye'} class="h-4 w-4" />
							</button>
						</div>
					</label>

					<label class="flex flex-col gap-1.5">
						<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
							>Konfirmasi kata sandi baru</span
						>
						<div
							class="flex h-9 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
						>
							<span class="pl-3 text-slate-500 dark:text-zinc-400"
								><Icon name="lock" class="h-4 w-4" /></span
							>
							<input
								type={showConfirmPassword ? 'text' : 'password'}
								id="confirmPassword"
								name="confirmPassword"
								class="validator h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
								required
								minlength={8}
								autocomplete="new-password"
								placeholder="Ulangi kata sandi baru"
							/>
							<button
								type="button"
								class="cursor-pointer pr-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
								aria-label="Lihat atau sembunyikan kata sandi"
							>
								<Icon name={showConfirmPassword ? 'eye-off' : 'eye'} class="h-4 w-4" />
							</button>
						</div>
					</label>

					<p class="text-xs text-slate-500 dark:text-zinc-400">
						Gunakan kombinasi huruf dan angka untuk keamanan maksimal.
					</p>

					<div class="mt-5 flex justify-end border-t border-slate-200 pt-4 dark:border-zinc-800">
						<button
							class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							type="submit"
							disabled={submitting || invalid}
						>
							<Icon name="save" class="h-4 w-4" />
							{submitting ? 'Menyimpan…' : 'Simpan kata sandi'}
						</button>
					</div>
				</div>
			{/snippet}
		</FormEnhance>
	</div>
</section>
