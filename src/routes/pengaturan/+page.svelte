<script lang="ts">
	import { browser } from '$app/environment';
	import Icon from '$lib/components/icon.svelte';
	import { onMount } from 'svelte';
	import ChangeUsernameCard from '$lib/components/settings/change-username-card.svelte';
	import ChangePasswordCard from '$lib/components/settings/change-password-card.svelte';
	import DatabaseCard from '$lib/components/settings/database-card.svelte';
	import BukuTamuPasskeyCard from '$lib/components/settings/buku-tamu-passkey-card.svelte';
	import AiKeyCard from '$lib/components/settings/ai-key-card.svelte';
	import type { PageData } from './$types';

	const { data } = $props<{ data: PageData }>();

	// svelte-ignore state_referenced_locally
	let wasForcePasswordChange = $state(data.forcePasswordChange);
	let passwordChanged = $state(false);

	onMount(() => {
		if (data.forcePasswordChange && browser) {
			document.getElementById('default-password-warning')?.scrollIntoView({ behavior: 'smooth' });
		}
	});

	function handlePasswordSuccess() {
		passwordChanged = true;
	}
</script>

<div class="settings-page mx-auto w-full max-w-4xl">
	<header
		class="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800"
	>
		<div class="min-w-0">
			<div class="flex items-center gap-2">
				<Icon name="gear" class="h-5 w-5 shrink-0 text-slate-500 dark:text-zinc-400" />
				<h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Pengaturan
				</h1>
			</div>
			<p class="mt-1 text-sm text-slate-600 dark:text-zinc-400">
				Akun, integrasi AI, dan sistem sekolah dalam satu tempat.
			</p>
			<p class="mt-1 text-xs text-slate-500 dark:text-zinc-400">
				Versi {data.appVersion ?? '0.0.0'}
			</p>
		</div>
		<div class="flex shrink-0 flex-wrap items-center gap-2">
			{#if data.canManageUsers}
				<a
					class="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					href="/master-data/pengguna"
				>
					<Icon name="users" class="h-4 w-4" />
					Akun Pengguna
				</a>
			{/if}
			<a
				class="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
				href="/pengaturan/profil"
			>
				<Icon name="user" class="h-4 w-4" />
				Edit Profil
			</a>
		</div>
	</header>

	{#if wasForcePasswordChange}
		{#if passwordChanged}
			<div
				class="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
				role="status"
			>
				<Icon name="success" class="h-4 w-4 shrink-0" />
				<span>Kata sandi berhasil diubah. Silakan gunakan aplikasi.</span>
			</div>
		{:else}
			<div
				id="default-password-warning"
				class="mt-4 flex scroll-mt-20 items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
				role="alert"
			>
				<Icon name="lock" class="h-4 w-4 shrink-0" />
				<span>
					Jangan gunakan sandi bawaan! Perbarui kata sandi di bagian
					<strong>Ganti Kata Sandi</strong> di bawah sebelum menggunakan aplikasi.
				</span>
			</div>
		{/if}
	{/if}

	<div class="mt-6 space-y-8">
		<section aria-labelledby="pengaturan-akun">
			<div class="mb-3">
				<h2 id="pengaturan-akun" class="text-sm font-semibold text-slate-900 dark:text-zinc-100">
					Akun
				</h2>
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Nama pengguna dan kata sandi untuk masuk ke aplikasi.
				</p>
			</div>
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<ChangeUsernameCard />
				<ChangePasswordCard onsuccess={handlePasswordSuccess} />
			</div>
		</section>

		{#if data.canManageAi}
			<section aria-labelledby="pengaturan-ai">
				<div class="mb-3">
					<h2 id="pengaturan-ai" class="text-sm font-semibold text-slate-900 dark:text-zinc-100">
						Integrasi AI
					</h2>
					<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
						Satu kunci untuk semua fitur Generate. Berlaku bagi seluruh pengguna aplikasi.
					</p>
				</div>
				<AiKeyCard
					variant="sekolah"
					title="Kunci API"
					description="Integrasi AI sekolah untuk semua fitur Generate (Tujuan Pembelajaran, RPM, lampiran). Hanya admin yang dapat mengubahnya; seluruh pengguna memakai kunci ini. Mendukung Google Gemini langsung (native API) dan semua penyedia yang kompatibel dengan OpenAI chat completions (OpenRouter, DeepSeek, Groq, dsb)."
					idPrefix="gemini"
					data={data.gemini}
				/>
			</section>
		{/if}

		{#if data.canManageBukuTamu}
			<section aria-labelledby="pengaturan-buku-tamu">
				<div class="mb-3">
					<h2
						id="pengaturan-buku-tamu"
						class="text-sm font-semibold text-slate-900 dark:text-zinc-100"
					>
						Buku Tamu
					</h2>
					<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
						Passkey untuk membuka akses buku tamu sekolah.
					</p>
				</div>
				<BukuTamuPasskeyCard passkeySet={data.bukuTamuPasskeySet} />
			</section>
		{/if}

		<!-- Hidden during forced password change: the auth guard redirects the database
			API calls in that state, so the buttons would silently fail. -->
		{#if data.canManageDatabase && !wasForcePasswordChange}
			<section aria-labelledby="pengaturan-sistem">
				<div class="mb-3">
					<h2
						id="pengaturan-sistem"
						class="text-sm font-semibold text-slate-900 dark:text-zinc-100"
					>
						Sistem
					</h2>
					<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
						Cadangkan, impor, atau reset data aplikasi.
					</p>
				</div>
				<DatabaseCard />
			</section>
		{/if}
	</div>
</div>

<style>
	/* Mobile: primary actions in the cards get a 44px tap target. */
	@media (max-width: 767px) {
		:global(.settings-page) :global(button[type='submit']),
		:global(.settings-page) :global(a[href]) {
			min-height: 2.75rem;
		}
	}
</style>
