<script lang="ts">
	import { browser } from '$app/environment';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let showPassword = $state(false);
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
		const retry = failData?.retryAfterSeconds;
		if (typeof retry === 'number' && retry > 0) {
			const endAt = Date.now() + retry * 1000;
			lockoutEndsAt = endAt;
			persistLockout(endAt);
		}
	}
</script>

<!--
  Modern login page: gradient background + glass card.
  Theme: Emerald (SMK Pratama Mulya). Centered card on all screens.
-->
<div class="login-bg relative flex min-h-screen w-full items-center justify-center p-4">
	<!-- Soft background glow -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		<div class="blob-a absolute -top-32 -right-32 h-96 w-96 rounded-full"></div>
		<div class="blob-b absolute -bottom-32 -left-32 h-80 w-80 rounded-full"></div>
	</div>

	<!-- Card -->
	<main class="relative z-10 w-full max-w-md">
		<div class="login-card rounded-3xl p-8 shadow-2xl">
			<!-- Logo + title -->
			<div class="mb-6 flex flex-col items-center gap-3 text-center">
				<div class="flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-200/60 bg-white p-2 shadow-lg">
					<img src="/logo.png" alt="Logo SMK Pratama Mulya" class="h-full w-full object-contain" />
				</div>
				<div>
					<h1 class="text-2xl font-black tracking-tight text-emerald-950 dark:text-emerald-200">
						e-Rapor SMK Pratama Mulya
					</h1>
					<p class="mt-1 text-sm font-medium text-emerald-700/80 dark:text-emerald-400/80">
						Sistem Administrasi dan Pelaporan Hasil Belajar
					</p>
				</div>
			</div>

			<!-- Lockout alert -->
			{#if isLocked}
				<div class="mb-5 flex items-center gap-3 rounded-xl border border-error/30 bg-error/10 p-3 text-error" role="alert">
					<div class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/20">
						<Icon name="lock" class="h-5 w-5" />
					</div>
					<div>
						<p class="text-sm font-semibold">Terlalu banyak percobaan gagal</p>
						<p class="text-xs opacity-80">
							Coba lagi dalam
							<span class="font-mono font-bold">{countdownLabel}</span>
						</p>
					</div>
				</div>
			{/if}

			<!-- Login form -->
			<FormEnhance action="?/login" onfailure={handleLoginFailure}>
				{#snippet children({ submitting, invalid })}
					<div class="space-y-4">
						<!-- Username -->
						<div>
							<label class="mb-1.5 block text-sm font-medium text-base-content/80" for="username">
								NIK Guru
							</label>
							<div class="relative">
								<Icon name="user" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-base-content/40" />
								<input
									type="text"
									id="username"
									name="username"
									required
									autocomplete="username"
									class="login-input h-12 w-full rounded-xl pl-11 pr-4"
									placeholder="Masukkan NIK"
								/>
							</div>
						</div>

						<!-- Password -->
						<div>
							<label class="mb-1.5 block text-sm font-medium text-base-content/80" for="password">
								Kata Sandi
							</label>
							<div class="relative">
								<Icon name="lock" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-base-content/40" />
								<input
									type={showPassword ? 'text' : 'password'}
									id="password"
									name="password"
									required
									autocomplete="current-password"
									class="login-input h-12 w-full rounded-xl pl-11 pr-12"
									placeholder="Masukkan kata sandi"
								/>
								<button
									type="button"
									class="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-base-content/50 hover:bg-base-200/70 hover:text-base-content"
									onclick={() => (showPassword = !showPassword)}
									aria-label="Lihat atau sembunyikan kata sandi"
								>
									<Icon name={showPassword ? 'eye-off' : 'eye'} class="h-5 w-5" />
								</button>
							</div>
						</div>

						<!-- Submit -->
						<button
							class="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 font-semibold text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-700 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
							type="submit"
							disabled={submitting || invalid || isLocked}
						>
							{#if submitting}
								<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
								</svg>
								<span>Masuk…</span>
							{:else}
								<Icon name="right" class="h-5 w-5" />
								<span>Masuk</span>
							{/if}
						</button>
					</div>
				{/snippet}
			</FormEnhance>

			<!-- Footer -->
			<p class="mt-6 text-center text-xs text-base-content/50">
				e-Rapor SMK Pratama Mulya Karawang v{data.appVersion}
			</p>
		</div>
	</main>
</div>

<style>
	/* Full-page gradient background */
	.login-bg {
		background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 45%, #d1fae5 100%);
	}
	:global(.dark) .login-bg,
	:global([data-theme='dark']) .login-bg {
		background: linear-gradient(135deg, #064e3b 0%, #0f172a 60%, #134e4a 100%);
	}

	/* Glass card */
	.login-card {
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(16, 185, 129, 0.15);
	}
	:global(.dark) .login-card,
	:global([data-theme='dark']) .login-card {
		background: rgba(15, 23, 42, 0.75);
		border-color: rgba(16, 185, 129, 0.2);
	}

	/* Soft static glow blobs (no motion). */
	.blob-a {
		background: rgba(16, 185, 129, 0.15);
		filter: blur(80px);
	}
	.blob-b {
		background: rgba(45, 212, 191, 0.12);
		filter: blur(80px);
	}

	/* Input styling */
	.login-input {
		background: rgba(255, 255, 255, 0.9);
		border: 1px solid rgba(16, 185, 129, 0.2);
		color: var(--color-base-content, #1f2937);
		outline: none;
	}
	.login-input::placeholder {
		color: rgba(107, 114, 128, 0.7);
	}
	.login-input:focus {
		border-color: #059669;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
	}
	:global([data-theme='dark']) .login-input {
		background: rgba(30, 41, 59, 0.9);
		border-color: rgba(16, 185, 129, 0.25);
	}

	/* Keyboard navigation */
	.login-card :focus-visible {
		outline: 2px solid #059669;
		outline-offset: 2px;
	}
</style>
