<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let showAdminPassword = $state(false);

	function handleAdminUsernameSuccess({ form }: { form: HTMLFormElement }) {
		form.reset();
	}
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<!-- Change Admin Username -->
	<FormEnhance action="?/change-admin-username" onsuccess={handleAdminUsernameSuccess}>
		{#snippet children({ submitting, invalid })}
			<header class="mb-4 border-b border-slate-200 pb-3 dark:border-zinc-800">
				<h2 class="text-base font-bold text-slate-900 dark:text-zinc-100">Ganti Nama Pengguna</h2>
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Perbarui nama pengguna untuk menjaga keamanan akses aplikasi.
				</p>
			</header>
			<div class="flex flex-col gap-3">
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nama Pengguna</span>
					<div
						class="flex h-9 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
					>
						<span class="pl-3 text-slate-500 dark:text-zinc-400"
							><Icon name="users" class="h-4 w-4" /></span
						>
						<input
							type="text"
							id="adminUsername"
							name="adminUsername"
							class="validator h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
							required
							pattern="^[A-Za-z0-9._-]&#123;3,&#125;$"
							title="Gunakan huruf, angka, titik, underscore atau minus. Minimal 3 karakter."
							placeholder="contoh: laila2"
						/>
					</div>
					<span class="text-xs text-slate-500 dark:text-zinc-400">Masukkan nama pengguna baru.</span
					>
				</label>

				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Konfirmasi dengan kata sandi</span
					>
					<div
						class="flex h-9 items-center overflow-hidden rounded-xl border border-[#7e8b9b] bg-white focus-within:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-blue-400"
					>
						<span class="pl-3 text-slate-500 dark:text-zinc-400"
							><Icon name="lock" class="h-4 w-4" /></span
						>
						<input
							type={showAdminPassword ? 'text' : 'password'}
							id="adminPassword"
							name="adminPassword"
							class="validator h-full w-full bg-transparent px-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
							required
							placeholder="Masukkan kata sandi"
							autocomplete="current-password"
						/>
						<button
							type="button"
							class="cursor-pointer pr-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
							onclick={() => (showAdminPassword = !showAdminPassword)}
							aria-label="Lihat atau sembunyikan kata sandi"
						>
							<Icon name={showAdminPassword ? 'eye-off' : 'eye'} class="h-4 w-4" />
						</button>
					</div>
					<span class="text-xs text-slate-500 dark:text-zinc-400">
						Masukkan kata sandi saat ini untuk konfirmasi perubahan nama pengguna.
					</span>
				</label>
			</div>

			<div class="mt-5 flex justify-end border-t border-slate-200 pt-4 dark:border-zinc-800">
				<button
					class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					type="submit"
					disabled={submitting || invalid}
				>
					<Icon name="save" class="h-4 w-4" />
					{submitting ? 'Menyimpan…' : 'Terapkan'}
				</button>
			</div>
		{/snippet}
	</FormEnhance>
</section>
