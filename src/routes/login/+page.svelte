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

<section class="card bg-base-100 w-full max-w-md overflow-hidden shadow-2xl border border-emerald-100 dark:border-none">
	<div class="relative h-36 w-full overflow-hidden bg-emerald-900">
		<img src="/guru-banner.webp" alt="" class="h-full w-full object-cover opacity-85" />
		<div class="absolute inset-0 bg-gradient-to-t from-[#064e3b]/90 via-[#064e3b]/40 to-transparent"></div>
	</div>
	<div class="card-body space-y-5 -mt-10 relative z-10 pt-0">
		<header class="mb-2 space-y-2 text-center">
			<div class="mx-auto w-20 h-20 rounded-2xl bg-white p-2 shadow-lg border border-emerald-100 flex items-center justify-center">
				<img
					src="/logo.png"
					alt="Logo SMK Pratama Mulya"
					class="w-full h-full object-contain"
				/>
			</div>
			<h1 class="text-2xl font-black text-emerald-950 dark:text-emerald-300">e-Rapor SMK Pratama Mulya</h1>
			<p class="text-emerald-700/80 dark:text-emerald-400 text-xs font-semibold">Sistem Administrasi dan Pelaporan Hasil Belajar</p>
		</header>

		{#if isLocked}
			<div class="alert alert-error" role="alert">
				<Icon name="lock" />
				<span>
					Terlalu banyak percobaan gagal. Coba lagi dalam
					<span class="font-mono tabular-nums font-bold">{countdownLabel}</span>.
				</span>
			</div>
		{/if}

		<FormEnhance action="?/login" onfailure={handleLoginFailure}>
			{#snippet children({ submitting, invalid })}
				<div class="fieldset">
					<label class="fieldset-legend" for="username"> Nama Pengguna </label>
					<input
						type="text"
						id="username"
						name="username"
						required
						autocomplete="username"
						placeholder="Contoh: Admin"
						class="input input-bordered dark:bg-base-200 w-full dark:border-none"
					/>
				</div>

				<div class="fieldset">
					<label class="fieldset-legend" for="password"> Kata Sandi </label>
					<label class="input input-bordered dark:bg-base-200 w-full dark:border-none">
						<input
							type={showPassword ? 'text' : 'password'}
							id="password"
							name="password"
							required
							autocomplete="current-password"
							placeholder="••••••••"
						/>
						<button
							type="button"
							class="cursor-pointer"
							onclick={() => (showPassword = !showPassword)}
							aria-label="Lihat atau sembunyikan kata sandi"
						>
							<Icon name={showPassword ? 'eye-off' : 'eye'} />
						</button>
					</label>
				</div>

				<button
					class="btn btn-primary mt-6 w-full shadow-none"
					type="submit"
					disabled={submitting || invalid || isLocked}
				>
					{submitting ? 'Masuk…' : 'Masuk'}
				</button>
			{/snippet}
		</FormEnhance>

		<p class="text-base-content/50 text-center text-xs">
			e-Rapor SMK Pratama Mulya Karawang v{data.appVersion}
		</p>
	</div>
</section>
