<script lang="ts">
	import { browser } from '$app/environment';
	import DarkMode from '$lib/components/dark-mode.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let showPassword = $state(false);
	let errorMessage = $state<string | null>(null);
	let { data } = $props();

	// Brute-force lockout countdown (epoch ms when the account/IP unlocks).
	const LOCKOUT_STORAGE_KEY = 'erapor-pmk-login-lockout-until';
	let lockoutEndsAt = $state<number | null>(null);
	let now = $state(Date.now());

	const remainingSeconds = $derived(
		lockoutEndsAt === null ? 0 : Math.max(0, Math.ceil((lockoutEndsAt - now) / 1000))
	);
	const countdownLabel = $derived(
		`${Math.floor(remainingSeconds / 60)
			.toString()
			.padStart(2, '0')}:${(remainingSeconds % 60).toString().padStart(2, '0')}`
	);
	const isLocked = $derived(remainingSeconds > 0);

	$effect(() => {
		if (!isLocked) return;
		const id = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(id);
	});

	function readStoredLockout(): number | null {
		if (!browser) return null;
		try {
			const raw = window.localStorage.getItem(LOCKOUT_STORAGE_KEY);
			if (!raw) return null;
			const end = Number(raw);
			return Number.isFinite(end) && end > 0 ? end : null;
		} catch {
			return null;
		}
	}

	function persistLockout(endAt: number | null) {
		if (!browser) return;
		try {
			if (endAt === null) {
				window.localStorage.removeItem(LOCKOUT_STORAGE_KEY);
			} else {
				window.localStorage.setItem(LOCKOUT_STORAGE_KEY, String(endAt));
			}
		} catch {
			// ignore storage errors (private browsing, quota, ...)
		}
	}

	// Restore the countdown on mount: prefer the freshest of the server-reported
	// per-IP lockout and the locally persisted value so reloads keep the alert.
	$effect(() => {
		if (!browser) return;
		const candidates: number[] = [];
		const stored = readStoredLockout();
		if (stored !== null) candidates.push(stored);
		if (data.initialRetryAfterSeconds > 0) {
			candidates.push(Date.now() + data.initialRetryAfterSeconds * 1000);
		}
		if (candidates.length > 0) {
			const endAt = Math.max(...candidates);
			if (endAt > Date.now()) {
				lockoutEndsAt = endAt;
			} else {
				persistLockout(null);
			}
		}
	});

	function handleLoginFailure({ data: failData }: { data?: Record<string, unknown> }) {
		const msg =
			typeof failData?.message === 'string'
				? failData.message
				: 'Gagal masuk. Periksa kembali data akun Anda.';
		errorMessage = msg;
		const retry = failData?.retryAfterSeconds;
		if (typeof retry === 'number' && retry > 0) {
			const endAt = Date.now() + retry * 1000;
			lockoutEndsAt = endAt;
			persistLockout(endAt);
		}
	}
</script>

<!--
  Minimalist login screen aligned with the workspace design system (app-canvas-bg).
-->
<div class="app-canvas-bg relative flex min-h-screen w-full items-center justify-center p-4 sm:p-6">
	<div class="absolute top-4 right-4 z-10">
		<DarkMode />
	</div>

	<main class="relative z-10 w-full max-w-md">
		<div
			class="rounded-2xl border border-slate-200/75 bg-white p-6 shadow-[0_8px_30px_-10px_rgba(15,23,42,0.1)] sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
		>
			<!-- Logo + title -->
			<div class="mb-6 flex flex-col items-center gap-3 text-center">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xs dark:border-zinc-700 dark:bg-zinc-950"
				>
					<img src="/logo.png" alt="Logo SMK Pratama Mulya" class="h-full w-full object-contain" />
				</div>
				<div>
					<h1
						class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-zinc-100"
					>
						e-Rapor SMK Pratama Mulya
					</h1>
					<p class="mt-1 text-xs font-medium text-blue-600 sm:text-sm dark:text-blue-400">
						Sistem Administrasi dan Pelaporan Hasil Belajar
					</p>
				</div>
			</div>

			<!-- Lockout alert -->
			{#if isLocked}
				<div
					class="mb-4 flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-3 text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
					role="alert"
				>
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
					>
						<Icon name="lock" class="h-4 w-4" />
					</div>
					<div class="min-w-0">
						<p class="text-xs font-semibold">Terlalu banyak percobaan gagal</p>
						<p class="mt-0.5 text-xs text-red-800 dark:text-red-300">
							Coba lagi dalam
							<span class="font-mono font-bold tabular-nums">{countdownLabel}</span>
						</p>
					</div>
				</div>
			{:else if errorMessage}
				<div
					class="mb-4 flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-3 text-xs font-medium text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
					role="alert"
				>
					<span aria-hidden="true" class="mt-0.5 shrink-0 text-red-700 dark:text-red-400">
						<Icon name="warning" class="h-4 w-4" />
					</span>
					<span>{errorMessage}</span>
				</div>
			{/if}

			<!-- Login form -->
			<FormEnhance
				action="?/login"
				showToast={false}
				submitStateChange={(sub) => {
					if (sub) errorMessage = null;
				}}
				onfailure={handleLoginFailure}
			>
				{#snippet children({ submitting })}
					<div class="space-y-4">
						<!-- Identifier -->
						<div>
							<label
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-200"
								for="username"
							>
								Nama Pengguna / NIK / NIP
							</label>
							<div class="relative">
								<span
									aria-hidden="true"
									class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
								>
									<Icon name="user" class="h-4 w-4" />
								</span>
								<input
									type="text"
									id="username"
									name="username"
									required
									autocomplete="username"
									oninput={() => {
										if (errorMessage) errorMessage = null;
									}}
									class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3.5 pl-10 text-sm text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
									placeholder="Masukkan NIK, NIP, atau Username"
								/>
							</div>
						</div>

						<!-- Password -->
						<div>
							<label
								class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-200"
								for="password"
							>
								Kata Sandi
							</label>
							<div class="relative">
								<span
									aria-hidden="true"
									class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
								>
									<Icon name="lock" class="h-4 w-4" />
								</span>
								<input
									type={showPassword ? 'text' : 'password'}
									id="password"
									name="password"
									required
									autocomplete="current-password"
									oninput={() => {
										if (errorMessage) errorMessage = null;
									}}
									class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white pr-11 pl-10 text-sm text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
									placeholder="Masukkan kata sandi"
								/>
								<button
									type="button"
									class="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
									onclick={() => (showPassword = !showPassword)}
									aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
								>
									<Icon name={showPassword ? 'eye-off' : 'eye'} class="h-4 w-4" />
								</button>
							</div>
						</div>

						<!-- Submit -->
						<button
							class="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							type="submit"
							disabled={submitting || isLocked}
						>
							{#if submitting}
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
									aria-hidden="true"
								></span>
								<span>Masuk...</span>
							{:else}
								<span aria-hidden="true"><Icon name="right" class="h-4 w-4" /></span>
								<span>Masuk</span>
							{/if}
						</button>
					</div>
				{/snippet}
			</FormEnhance>

			<p
				class="mt-5 border-t border-slate-200 pt-4 text-center text-xs leading-relaxed text-slate-600 dark:border-zinc-800 dark:text-zinc-400"
			>
				Admin memakai username; guru, wali kelas, dan kepala sekolah memakai NIK, NIP, atau
				username.
			</p>

			<!-- Footer -->
			<p class="mt-3 text-center text-xs font-medium text-slate-500 dark:text-zinc-400">
				e-Rapor SMK Pratama Mulya Karawang v{data.appVersion}
			</p>
		</div>
	</main>
</div>
