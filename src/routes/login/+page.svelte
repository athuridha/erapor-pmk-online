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
	const currentYear = new Date().getFullYear();

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

<div
	class="login-page min-h-dvh w-full bg-[#f7f9fa] text-[#1f3038] lg:grid lg:grid-cols-12 dark:bg-zinc-950 dark:text-zinc-100"
>
	<!-- Editorial login workspace -->
	<main
		class="flex min-h-dvh flex-col justify-between px-5 py-5 sm:px-8 sm:py-7 lg:col-span-5 lg:px-12 lg:py-8 xl:px-16"
	>
		<!-- Top bar: school crest lockup + theme switch -->
		<header class="flex items-center justify-between gap-3">
			<div class="flex min-w-0 items-center gap-3">
				<img
					src="/logo.png"
					alt="Logo SMK Pratama Mulya"
					class="h-10 w-10 shrink-0 object-contain"
					width="40"
					height="40"
				/>
				<div class="min-w-0">
					<p
						class="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-100"
					>
						e-Rapor
					</p>
					<p class="truncate text-[13px] text-slate-600 dark:text-zinc-400">
						SMK Pratama Mulya Karawang
					</p>
				</div>
			</div>

			<div class="shrink-0">
				<DarkMode />
			</div>
		</header>

		<!-- Main sign-in block -->
		<div class="mx-auto my-auto w-full max-w-[400px] py-7 lg:mx-0 lg:max-w-[420px] lg:py-10">
			<p
				class="login-enter text-[13px] font-medium text-slate-600 dark:text-zinc-400"
				style="--enter-delay: 0ms"
			>
				Portal Akademik · Karawang
			</p>

			<h1
				class="login-enter mt-2 text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] text-[#1f3038] sm:text-[38px] dark:text-zinc-50"
				style="--enter-delay: 60ms"
			>
				Masuk ke e-Rapor
			</h1>

			<p
				class="login-enter mt-2.5 text-[15px] leading-relaxed text-slate-600 sm:text-base dark:text-zinc-400"
				style="--enter-delay: 110ms"
			>
				Kelola penilaian, presensi, dan laporan hasil belajar sekolah dalam satu sistem.
			</p>

			{#if isLocked}
				<div
					class="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
					role="alert"
				>
					<span aria-hidden="true" class="mt-0.5 shrink-0">
						<Icon name="lock" class="h-4 w-4" />
					</span>
					<div class="min-w-0">
						<p>Terlalu banyak percobaan gagal. Coba lagi dalam</p>
						<p class="mt-0.5 font-mono font-semibold tabular-nums">{countdownLabel}</p>
					</div>
				</div>
			{:else if errorMessage}
				<div
					class="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
					role="alert"
				>
					<span aria-hidden="true" class="mt-0.5 shrink-0">
						<Icon name="warning" class="h-4 w-4" />
					</span>
					<span>{errorMessage}</span>
				</div>
			{/if}

			<div class="login-enter mt-6" style="--enter-delay: 160ms">
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
							<div>
								<label
									class="mb-1.5 block text-sm font-medium text-[#1f3038] dark:text-zinc-200"
									for="username"
								>
									NIK, NIP, atau Username
								</label>
								<div class="relative">
									<span
										aria-hidden="true"
										class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
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
										class="login-input h-12 w-full rounded-xl border border-slate-300 bg-white pr-4 pl-11 text-base text-slate-900 placeholder:text-slate-400 focus:border-[#2563eb] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400"
										placeholder="Masukkan NIK, NIP, atau username"
									/>
								</div>
							</div>

							<div>
								<label
									class="mb-1.5 block text-sm font-medium text-[#1f3038] dark:text-zinc-200"
									for="password"
								>
									Kata sandi
								</label>
								<div class="relative">
									<span
										aria-hidden="true"
										class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
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
										class="login-input h-12 w-full rounded-xl border border-slate-300 bg-white pr-12 pl-11 text-base text-slate-900 placeholder:text-slate-400 focus:border-[#2563eb] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400"
										placeholder="Masukkan kata sandi"
									/>
									<button
										type="button"
										class="absolute top-1/2 right-0.5 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
										onclick={() => (showPassword = !showPassword)}
										aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
									>
										<Icon name={showPassword ? 'eye-off' : 'eye'} class="h-4 w-4" />
									</button>
								</div>
							</div>

							<button
								class="login-submit mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
								type="submit"
								disabled={submitting || isLocked}
							>
								{#if submitting}
									<span
										class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
										aria-hidden="true"
									></span>
									<span>Memverifikasi...</span>
								{:else}
									<span>Masuk</span>
									<span aria-hidden="true" class="login-arrow inline-flex items-center">
										<Icon name="right" class="h-4 w-4" />
									</span>
								{/if}
							</button>
						</div>
					{/snippet}
				</FormEnhance>
			</div>

			<p
				class="login-enter mt-4 text-[13px] leading-relaxed text-slate-600 dark:text-zinc-400"
				style="--enter-delay: 210ms"
			>
				Guru dan wali kelas masuk memakai NIK atau NIP. Operator sekolah masuk memakai username.
			</p>
		</div>

		<!-- Mobile & tablet photograph placed below the form so the CTA stays above the fold -->
		<div class="lg:hidden">
			<div
				class="mx-auto mt-6 w-full max-w-[400px] overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/60 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<img
					src="/building.webp"
					alt="Guru dan staf SMK Pratama Mulya Karawang di depan gedung Workshop Otomotif"
					class="login-photo-settle aspect-[16/10] w-full object-cover object-[center_32%]"
					loading="eager"
					decoding="async"
				/>
			</div>
		</div>

		<footer
			class="mt-6 flex items-center justify-between gap-3 border-t border-slate-200/80 pt-4 text-[13px] text-slate-600 dark:border-zinc-800 dark:text-zinc-400"
		>
			<span>© {currentYear} SMK Pratama Mulya Karawang</span>
			<span class="shrink-0 font-mono tabular-nums">v{data.appVersion}</span>
		</footer>
	</main>

	<!-- Desktop daylight school photograph -->
	<aside class="hidden p-3 lg:col-span-7 lg:block lg:p-4 xl:p-5">
		<div
			class="h-full w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/60 dark:border-zinc-800 dark:bg-zinc-900"
		>
			<img
				src="/building.webp"
				alt="Guru dan staf SMK Pratama Mulya Karawang di depan gedung Workshop Otomotif"
				class="login-photo-settle h-full w-full object-cover object-[center_35%]"
				fetchpriority="high"
				decoding="async"
			/>
		</div>
	</aside>
</div>

<style>
	.login-page {
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			Roboto,
			sans-serif;
	}

	.login-enter {
		animation: login-rise 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: var(--enter-delay, 0ms);
	}

	.login-photo-settle {
		animation: login-photo-in 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.login-input {
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease;
	}

	.login-input:focus {
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
	}

	:global([data-theme='dark']) .login-input:focus {
		box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.22);
	}

	.login-submit {
		transition:
			background-color 150ms cubic-bezier(0.2, 0.8, 0.2, 1),
			transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
			opacity 120ms ease;
	}

	.login-arrow {
		transition: transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	@media (hover: hover) and (pointer: fine) {
		.login-submit:hover:not(:disabled) {
			background-color: #1d4ed8;
			transform: translateY(-1px);
		}

		.login-submit:hover:not(:disabled) .login-arrow {
			transform: translateX(3px);
		}
	}

	.login-submit:active:not(:disabled) {
		background-color: #1e40af;
		transform: translateY(1px) scale(0.985);
		transition-duration: 90ms;
	}

	@keyframes login-rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes login-photo-in {
		from {
			transform: scale(1.04);
		}
		to {
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.login-enter,
		.login-photo-settle {
			animation: none;
		}

		.login-submit,
		.login-arrow {
			transition:
				background-color 120ms ease,
				opacity 120ms ease;
		}

		.login-submit:hover:not(:disabled),
		.login-submit:active:not(:disabled),
		.login-submit:hover:not(:disabled) .login-arrow {
			transform: none;
		}
	}
</style>
