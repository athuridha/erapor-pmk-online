<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let {
		onPasswordChanged
	}: {
		onPasswordChanged?: () => void;
	} = $props();

	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);

	function handlePasswordSuccess({ form }: { form: HTMLFormElement }) {
		form.reset();
		onPasswordChanged?.();
	}
</script>

<div class="space-y-4">
	<header class="border-b border-slate-100 pb-3 dark:border-zinc-800">
		<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Ganti Kata Sandi</h2>
		<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
			Akun Anda memakai kata sandi bawaan. Perbarui kata sandi sebelum menggunakan aplikasi.
		</p>
	</header>

	<FormEnhance action="/pengaturan?/change-password" onsuccess={handlePasswordSuccess}>
		{#snippet children({ submitting, invalid })}
			<div class="space-y-3">
				<div>
					<label
						for="forced-currentPassword"
						class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Kata sandi saat ini
					</label>
					<div class="relative flex items-center">
						<span
							aria-hidden="true"
							class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
						>
							<Icon name="lock" class="h-3.5 w-3.5" />
						</span>
						<input
							type={showCurrentPassword ? 'text' : 'password'}
							id="forced-currentPassword"
							name="currentPassword"
							required
							autocomplete="current-password"
							placeholder="Masukkan kata sandi lama"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-9 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						/>
						<button
							type="button"
							class="absolute right-2.5 flex items-center text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
							onclick={() => (showCurrentPassword = !showCurrentPassword)}
							aria-label="Lihat atau sembunyikan kata sandi"
						>
							<Icon name={showCurrentPassword ? 'eye-off' : 'eye'} class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>

				<div>
					<label
						for="forced-newPassword"
						class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Kata sandi baru
					</label>
					<div class="relative flex items-center">
						<span
							aria-hidden="true"
							class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
						>
							<Icon name="lock" class="h-3.5 w-3.5" />
						</span>
						<input
							type={showNewPassword ? 'text' : 'password'}
							id="forced-newPassword"
							name="newPassword"
							required
							minlength={8}
							autocomplete="new-password"
							placeholder="Minimal 8 karakter"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-9 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						/>
						<button
							type="button"
							class="absolute right-2.5 flex items-center text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
							onclick={() => (showNewPassword = !showNewPassword)}
							aria-label="Lihat atau sembunyikan kata sandi"
						>
							<Icon name={showNewPassword ? 'eye-off' : 'eye'} class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>

				<div>
					<label
						for="forced-confirmPassword"
						class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					>
						Konfirmasi kata sandi baru
					</label>
					<div class="relative flex items-center">
						<span
							aria-hidden="true"
							class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
						>
							<Icon name="lock" class="h-3.5 w-3.5" />
						</span>
						<input
							type={showConfirmPassword ? 'text' : 'password'}
							id="forced-confirmPassword"
							name="confirmPassword"
							required
							minlength={8}
							autocomplete="new-password"
							placeholder="Ulangi kata sandi baru"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-9 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						/>
						<button
							type="button"
							class="absolute right-2.5 flex items-center text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
							onclick={() => (showConfirmPassword = !showConfirmPassword)}
							aria-label="Lihat atau sembunyikan kata sandi"
						>
							<Icon name={showConfirmPassword ? 'eye-off' : 'eye'} class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>

				<p class="text-[11px] text-slate-500 dark:text-zinc-400">
					Gunakan kombinasi huruf dan angka untuk keamanan maksimal.
				</p>

				<div class="flex justify-end border-t border-slate-100 pt-3 dark:border-zinc-800">
					<button
						class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
						type="submit"
						disabled={submitting || invalid}
					>
						<Icon name="save" class="h-3.5 w-3.5" />
						{submitting ? 'Menyimpan...' : 'Simpan kata sandi'}
					</button>
				</div>
			</div>
		{/snippet}
	</FormEnhance>
</div>
