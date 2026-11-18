<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	interface UserItem {
		id: number;
		username: string;
		fullName: string;
		role: string;
		roleLabel: string;
		kelasName: string | null;
	}

	let {
		open = $bindable(false),
		currentUserId = 0,
		impersonator = null
	} = $props<{
		open: boolean;
		currentUserId?: number;
		impersonator?: { id: number; username: string; type: string } | null;
	}>();

	let searchQuery = $state('');
	let users = $state<UserItem[]>([]);
	let isLoading = $state(false);
	let isSwitching = $state<number | null>(null);

	async function loadUsers(q = '') {
		isLoading = true;
		try {
			const res = await fetch(`/api/auth/switch-user/users?q=${encodeURIComponent(q)}`);
			const json = await res.json();
			if (res.ok && json.success) {
				users = json.users || [];
			} else {
				toast(json.message || 'Gagal memuat pengguna.', 'error');
			}
		} catch {
			toast('Koneksi gagal saat memuat daftar pengguna.', 'error');
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (open) {
			searchQuery = '';
			loadUsers('');
		}
	});

	let searchTimer: NodeJS.Timeout;
	function handleSearchInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			loadUsers(searchQuery);
		}, 300);
	}

	async function handleStopSwitch() {
		try {
			const res = await fetch('/api/auth/switch-user/stop', { method: 'POST' });
			const json = await res.json();
			if (res.ok && json.success) {
				toast(json.message || 'Kembali ke akun Admin.', 'success');
				open = false;
				window.location.href = json.redirect || '/';
			} else {
				toast(json.message || 'Gagal kembali ke admin.', 'error');
			}
		} catch {
			toast('Terjadi kesalahan saat kembali ke admin.', 'error');
		}
	}

	async function handleSwitch(userId: number) {
		if (userId === currentUserId) {
			toast('Anda sudah menggunakan akun ini.', 'info');
			return;
		}

		if (impersonator && userId === impersonator.id) {
			await handleStopSwitch();
			return;
		}

		isSwitching = userId;
		try {
			const res = await fetch('/api/auth/switch-user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId })
			});
			const json = await res.json();
			if (res.ok && json.success) {
				toast(json.message || 'Berhasil beralih akun.', 'success');
				open = false;
				window.location.href = json.redirect || '/';
			} else {
				toast(json.message || 'Gagal beralih akun.', 'error');
			}
		} catch {
			toast('Terjadi kesalahan saat beralih akun.', 'error');
		} finally {
			isSwitching = null;
		}
	}
</script>

{#if open}
	<div class="modal modal-open z-[60] bg-slate-950/45 backdrop-blur-[2px]">
		<div
			class="modal-box max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<div
				class="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-zinc-800"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
					>
						<Icon name="repeat" class="h-4 w-4" />
					</div>
					<div>
						<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">
							Beralih Akun (Switch User)
						</h3>
						<p class="text-[11px] text-slate-500 dark:text-zinc-400">
							Masuk sebagai guru atau akun lain untuk verifikasi tanpa perlu kata sandi.
						</p>
					</div>
				</div>
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
					aria-label="Tutup Beralih Akun"
					onclick={() => (open = false)}
				>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>

			{#if impersonator}
				<div
					class="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
				>
					<div class="flex items-center gap-2 overflow-hidden">
						<Icon name="warning" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
						<span class="truncate">
							Sesi asal: <strong>@{impersonator.username}</strong>
						</span>
					</div>
					<button
						type="button"
						class="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-amber-900 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-amber-950 dark:bg-amber-700 dark:hover:bg-amber-600"
						onclick={handleStopSwitch}
					>
						<Icon name="repeat" class="h-3 w-3" />
						<span>Kembali ke Admin</span>
					</button>
				</div>
			{/if}

			<!-- Search -->
			<div class="mt-4">
				<div class="relative flex items-center">
					<span
						aria-hidden="true"
						class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
					>
						<Icon name="search" class="h-3.5 w-3.5" />
					</span>
					<input
						type="search"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						placeholder="Cari nama pengguna atau nama guru..."
						bind:value={searchQuery}
						oninput={handleSearchInput}
					/>
				</div>
			</div>

			<!-- List Users -->
			<div class="mt-3.5 max-h-72 space-y-2 overflow-y-auto pr-1">
				{#if isLoading}
					<div
						class="flex items-center justify-center gap-2 py-8 text-xs text-slate-500 dark:text-zinc-400"
					>
						<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
						<span>Memuat daftar akun...</span>
					</div>
				{:else if users.length === 0}
					<div class="py-8 text-center text-xs text-slate-500 italic dark:text-zinc-400">
						Tidak ada akun yang sesuai dengan pencarian.
					</div>
				{:else}
					{#each users as u (u.id)}
						{@const isImpersonatorOrigin = impersonator && u.id === impersonator.id}
						<div
							class="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors {isImpersonatorOrigin
								? 'border-amber-300 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-950/20'
								: 'border-slate-200/80 bg-white hover:border-blue-200 hover:bg-blue-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20'}"
						>
							<div class="flex items-center gap-3 overflow-hidden">
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
								>
									<Icon name="user" class="h-4 w-4" />
								</div>
								<div class="overflow-hidden">
									<div class="truncate text-xs font-bold text-slate-900 dark:text-zinc-100">
										{u.fullName}
									</div>
									<div
										class="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400"
									>
										<span class="font-mono">@{u.username}</span>
										<span>&bull;</span>
										<span
											class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
										>
											{u.roleLabel}
										</span>
										{#if u.kelasName}
											<span class="font-medium text-emerald-700 dark:text-emerald-400"
												>({u.kelasName})</span
											>
										{/if}
										{#if isImpersonatorOrigin}
											<span
												class="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
											>
												Akun Asal Anda
											</span>
										{/if}
									</div>
								</div>
							</div>

							<button
								type="button"
								class="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 {isImpersonatorOrigin
									? 'bg-amber-500 text-white hover:bg-amber-600'
									: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'}"
								disabled={isSwitching !== null || u.id === currentUserId}
								onclick={() => handleSwitch(u.id)}
							>
								{#if isSwitching === u.id}
									<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
								{:else if u.id === currentUserId}
									<span>Aktif</span>
								{:else if isImpersonatorOrigin}
									<Icon name="repeat" class="h-3 w-3" />
									<span>Kembali</span>
								{:else}
									<Icon name="repeat" class="h-3 w-3" />
									<span>Pilih</span>
								{/if}
							</button>
						</div>
					{/each}
				{/if}
			</div>

			<div class="mt-4 flex justify-end border-t border-slate-100 pt-3 dark:border-zinc-800">
				<button
					type="button"
					class="inline-flex h-8 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={() => (open = false)}
				>
					Tutup
				</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop bg-transparent"
			aria-label="Tutup Beralih Akun"
			onclick={() => (open = false)}
		></button>
	</div>
{/if}
